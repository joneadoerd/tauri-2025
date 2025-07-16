use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use crate::transport::{ConnectionInfo, Transport};

#[derive(Default, Clone)]
pub struct Manager {
    pub connections: Arc<RwLock<HashMap<String, Arc<dyn Transport + Send + Sync>>>>,
    pub active_shares: Arc<tokio::sync::Mutex<HashMap<(String, String), tokio::sync::mpsc::Sender<Vec<u8>>>>>,
    pub share_tasks: Arc<tokio::sync::Mutex<HashMap<(String, String), tokio::task::JoinHandle<()>>>>,
    pub simulation_stream_tasks: Arc<tokio::sync::Mutex<HashMap<String, tokio::task::JoinHandle<()>>>>,
}

impl Manager {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
            active_shares: Arc::new(tokio::sync::Mutex::new(HashMap::new())),
            share_tasks: Arc::new(tokio::sync::Mutex::new(HashMap::new())),
            simulation_stream_tasks: Arc::new(tokio::sync::Mutex::new(HashMap::new())),
        }
    }
    /// Share data from one connection to another by id, with interval
    pub async fn share_data_between_ids(
        &self,
        from_id: &str,
        to_id: &str,
        interval_ms: u64,
    ) -> Result<tokio::sync::mpsc::Sender<Vec<u8>>, String> {
        let connections = self.connections.clone();
        let to = {
            let guard = connections.read().unwrap();
            guard.get(to_id).cloned()
        }.ok_or_else(|| format!("No transport found for ID: {}", to_id))?;
        // Create channel and start sharing
        let (tx, rx) = tokio::sync::mpsc::channel(100);
        to.share_data_channel(rx, interval_ms);
        // Store sender for stop
        let mut active = self.active_shares.lock().await;
        active.insert((from_id.to_string(), to_id.to_string()), tx.clone());

        // Spawn a task to forward packets from 'from' to the share channel as streaming
        let from_id_owned = from_id.to_string();
        let to_id_owned = to_id.to_string();
        let tx_clone = tx.clone();
        let from_id_for_task = from_id_owned.clone();
        let connections_arc = self.connections.clone();
        let handle = tokio::spawn(async move {
            loop {
                let conn = {
                    let guard = connections_arc.read().unwrap();
                    guard.get(&from_id_for_task).cloned()
                };
                if let Some(conn) = conn {
                    if let Some(serial) = conn.as_any().downcast_ref::<crate::transport::serial::SerialTransport>() {
                        let ld = serial.last_data.lock().await;
                        if let Some(data) = &*ld {
                            let _ = tx_clone.send(data.clone()).await;
                        }
                        drop(ld);
                        // Wait for new data notification
                        serial.notify.notified().await;
                        continue;
                    }
                }
                // If not found or not serial, sleep to avoid busy loop
                tokio::time::sleep(std::time::Duration::from_millis(interval_ms)).await;
            }
        });
        let mut share_tasks = self.share_tasks.lock().await;
        share_tasks.insert((from_id_owned, to_id_owned), handle);
        Ok(tx)
    }

    /// Stop sharing by aborting the share task and dropping the sender for a specific from/to pair
    pub async fn stop_share(&self, from_id: &str, to_id: &str) -> Result<(), String> {
        let mut share_tasks = self.share_tasks.lock().await;
        if let Some(handle) = share_tasks.remove(&(from_id.to_string(), to_id.to_string())) {
            handle.abort();
        }
        let mut active = self.active_shares.lock().await;
        active.remove(&(from_id.to_string(), to_id.to_string()));
        Ok(())
    }

    pub async fn add_connection(
        &self,
        id: String,
        transport: Arc<dyn Transport + Send + Sync>,
    ) -> Result<(), String> {
        let connections = self.connections.clone();
        if connections.read().unwrap().contains_key(&id) {
            return Err(format!("Connection ID '{}' already exists", id.clone()));
        }

        connections.write().unwrap().insert(id, transport);
        Ok(())
    }

    pub async fn send_to(&self, id: &str, data: Vec<u8>) -> Result<(), String> {
        let transport = {
            let guard = self.connections.read().unwrap();
            guard.get(id).cloned()
        };
        if let Some(transport) = transport {
            transport.send(data).await
        } else {
            Err(format!("No transport found for ID: {}", id))
        }
    }

    pub async fn stop_all(&self) {
        let ids: Vec<_> = self.connections.read().unwrap().keys().cloned().collect();
        for id in &ids {
            let transport = self.connections.write().unwrap().remove(id);
            if let Some(transport) = transport {
                // Add timeout to prevent hanging
                let _ = tokio::time::timeout(
                    std::time::Duration::from_secs(3),
                    transport.stop()
                ).await;
            }
        }
        // Abort and remove all share tasks
        let mut share_tasks = self.share_tasks.lock().await;
        for (_key, handle) in share_tasks.drain() {
            handle.abort();
        }
        // Abort and remove all simulation streaming tasks
        let mut simulation_stream_tasks = self.simulation_stream_tasks.lock().await;
        for (_key, handle) in simulation_stream_tasks.drain() {
            handle.abort();
        }
    }
    pub async fn stop(&self, id: &str) -> Result<(), String> {
        println!("[manager] Stopping connection {}", id);
        let transport = self.connections.write().unwrap().remove(id);
        if let Some(transport) = transport {
            // Check if this is a UDP connection and stop any simulation streaming using the same address
            if let Some(udp_transport) = transport.as_any().downcast_ref::<crate::transport::udp::UdpTransport>() {
                let local_addr = udp_transport.local_addr;
                let mut simulation_stream_tasks = self.simulation_stream_tasks.lock().await;
                let sim_keys: Vec<_> = simulation_stream_tasks.keys().cloned().collect();
                for sim_id in sim_keys {
                    // Get the connection for this simulation task
                    let sim_conn = {
                        let guard = self.connections.read().unwrap();
                        guard.get(&sim_id).cloned()
                    };
                    if let Some(sim_conn) = sim_conn {
                        if let Some(sim_udp) = sim_conn.as_any().downcast_ref::<crate::transport::udp::UdpTransport>() {
                            if sim_udp.local_addr == local_addr {
                                // Found a simulation streaming task using the same socket address
                                if let Some(handle) = simulation_stream_tasks.remove(&sim_id) {
                                    handle.abort();
                                }
                                // Also stop and remove the connection with timeout
                                let sim_transport = self.connections.write().unwrap().remove(&sim_id);
                                if let Some(sim_transport) = sim_transport {
                                    let _ = tokio::time::timeout(
                                        std::time::Duration::from_secs(3),
                                        sim_transport.stop()
                                    ).await;
                                }
                            }
                        }
                    }
                }
            }
            // Now stop the original connection with timeout
            let _ = tokio::time::timeout(
                std::time::Duration::from_secs(3),
                transport.stop()
            ).await;
            // Abort and remove all share tasks for this connection
            let mut share_tasks = self.share_tasks.lock().await;
            let keys: Vec<_> = share_tasks.keys().cloned().collect();
            for (share_id, conn_id) in keys {
                if conn_id == id {
                    if let Some(handle) = share_tasks.remove(&(share_id, conn_id)) {
                        handle.abort();
                    }
                }
            }
            println!("[manager] Successfully stopped connection {}", id);
            Ok(())
        } else {
            println!("[manager] Connection {} not found", id);
            Err(format!("Connection ID '{}' not found", id))
        }
    }

    pub async fn list_connections(&self) -> Vec<ConnectionInfo> {
        self.connections.read().unwrap().iter().map(|(id, transport)| {
            ConnectionInfo {
                id: id.clone(),
                name: transport.name(),
            }
        }).collect()
    }

    pub async fn set_udp_remote_addr(&self, id: &str, remote_addr: std::net::SocketAddr) -> Result<(), String> {
        let mut guard = self.connections.write().unwrap();
        if let Some(conn) = guard.get_mut(id) {
            // Downcast the Arc<dyn Transport> to UdpTransport
            if let Some(udp) = Arc::get_mut(&mut *conn)
                .and_then(|t| t.as_any_mut().downcast_mut::<crate::transport::udp::UdpTransport>())
            {
                udp.remote_addr = Some(remote_addr);
                Ok(())
            } else {
                Err("Connection is not a UdpTransport or is shared".to_string())
            }
        } else {
            Err(format!("No connection found for id {}", id))
        }
    }

    /// Check if a socket address is already in use by any connection
    pub async fn is_socket_address_in_use(&self, addr: std::net::SocketAddr) -> bool {
        for (_, transport) in self.connections.read().unwrap().iter() {
            if let Some(udp) = transport.as_any().downcast_ref::<crate::transport::udp::UdpTransport>() {
                if udp.local_addr == addr {
                    return true;
                }
            }
        }
        false
    }

    /// Initialize simulation, create UDP server, and start sending TargetPacket data
    pub async fn simulation_init_and_stream(
        &self,
        local_addr: std::net::SocketAddr,
        remote_addr: std::net::SocketAddr,
        interval_ms: u64,
        packets: Vec<crate::packet::TargetPacket>,
    ) -> Result<String, String> {
        use crate::transport::udp::UdpTransport;
        use crate::packet::{Packet, packet::Kind, TargetPacket, TargetPacketList};
        use prost::Message;
        use std::sync::Arc;
        use tokio::time;
        use uuid::Uuid;

        let id = format!("sim_udp_{}", Uuid::new_v4());
        let mut transport = UdpTransport::new(local_addr).await?;
        transport.remote_addr = Some(remote_addr);
        let transport = Arc::new(transport) as Arc<dyn crate::transport::Transport + Send + Sync>;
        self.add_connection(id.clone(), transport.clone()).await?;

        // Group packets by target_id and align by time step
        let mut target_map: std::collections::HashMap<u32, Vec<TargetPacket>> = std::collections::HashMap::new();
        for packet in packets {
            target_map.entry(packet.target_id).or_default().push(packet);
        }
        // Find the max number of time steps
        let max_steps = target_map.values().map(|v| v.len()).max().unwrap_or(0);
        let target_ids: Vec<u32> = target_map.keys().cloned().collect();

        let handle = tokio::spawn(async move {
            for step in 0..max_steps {
                let mut step_packets = Vec::new();
                for &target_id in &target_ids {
                    if let Some(packets) = target_map.get(&target_id) {
                        if let Some(packet) = packets.get(step) {
                            step_packets.push(packet.clone());
                        }
                    }
                }
                if !step_packets.is_empty() {
                    let mut buf = Vec::new();
                    let data = Packet {
                        kind: Some(Kind::TargetPacketList(TargetPacketList { packets: step_packets })),
                    };
                    if let Ok(()) = data.encode(&mut buf) {
                        let _ = transport.send(buf).await;
                    }
                }
                time::sleep(time::Duration::from_millis(interval_ms)).await;
            }
        });
        let mut simulation_stream_tasks = self.simulation_stream_tasks.lock().await;
        simulation_stream_tasks.insert(id.clone(), handle);
        Ok(id)
    }

    /// Stop simulation UDP streaming by aborting the spawned task and stopping the connection
    pub async fn stop_simulation_udp_streaming(&self, id: &str) -> Result<(), String> {
        println!("[manager] Stopping simulation UDP streaming for {}", id);
        
        // First, abort the simulation task immediately
        {
            let mut simulation_stream_tasks = self.simulation_stream_tasks.lock().await;
            if let Some(handle) = simulation_stream_tasks.remove(id) {
                println!("[manager] Aborting simulation task for {}", id);
                handle.abort();
            }
        }
        
        // Use a simpler, more direct approach to avoid hanging
        {
            let connections = self.connections.clone();
            if let Some(transport) = connections.write().unwrap().remove(id) {
                println!("[manager] Removing connection {} from map", id);
                // Don't call transport.stop() as it might hang, just drop it
            };
        }
        
        // Also clean up any share tasks for this connection
        {
            let mut share_tasks = self.share_tasks.lock().await;
            let keys: Vec<_> = share_tasks.keys().cloned().collect();
            for (share_id, conn_id) in keys {
                if conn_id == id {
                    if let Some(handle) = share_tasks.remove(&(share_id.clone(), conn_id)) {
                        println!("[manager] Aborting share task for {}", share_id);
                        handle.abort();
                    }
                }
            }
        }
        
        println!("[manager] Successfully stopped simulation UDP streaming for {}", id);
        Ok(())
    }
}
