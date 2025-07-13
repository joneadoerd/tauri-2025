use std::collections::HashMap;
use std::sync::Arc;

use crate::transport::{ConnectionInfo, Transport};

#[derive(Default, Clone)]
pub struct Manager {
    pub connections: Arc<tokio::sync::Mutex<HashMap<String, Arc<dyn Transport + Send + Sync>>>>,
    pub active_shares: Arc<tokio::sync::Mutex<HashMap<(String, String), tokio::sync::mpsc::Sender<Vec<u8>>>>>,
    pub share_tasks: Arc<tokio::sync::Mutex<HashMap<(String, String), tokio::task::JoinHandle<()>>>>,
    pub simulation_stream_tasks: Arc<tokio::sync::Mutex<HashMap<String, tokio::task::JoinHandle<()>>>>,
}

impl Manager {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(tokio::sync::Mutex::new(HashMap::new())),
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
        let connections = self.connections.lock().await;
        let to = connections
            .get(to_id)
            .ok_or_else(|| format!("No transport found for ID: {}", to_id))?;
        // Create channel and start sharing
        let (tx, rx) = tokio::sync::mpsc::channel(100);
        to.clone().share_data_channel(rx, interval_ms);
        // Store sender for stop
        let mut active = self.active_shares.lock().await;
        active.insert((from_id.to_string(), to_id.to_string()), tx.clone());

        // Spawn a task to forward packets from 'from' to the share channel as streaming
        let from_id_owned = from_id.to_string();
        let to_id_owned = to_id.to_string();
        let tx_clone = tx.clone();
        let from_id_for_task = from_id_owned.clone();
        let handle = tokio::spawn(async move {
            loop {
                use crate::transport::serial::LAST_DATA;
                let last_data = LAST_DATA.lock().await;
                if let Some(data) = last_data.get(&from_id_for_task) {
                    let _ = tx_clone.send(data.clone()).await;
                }
                drop(last_data);
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
        let mut connections = self.connections.lock().await;
        if connections.contains_key(&id) {
            return Err(format!("Connection ID '{}' already exists", id.clone()));
        }

        connections.insert(id, transport);
        Ok(())
    }

    pub async fn send_to(&self, id: &str, data: Vec<u8>) -> Result<(), String> {
        let connections = self.connections.lock().await;
        if let Some(transport) = connections.get(id) {
            transport.send(data).await
        } else {
            Err(format!("No transport found for ID: {}", id))
        }
    }

    pub async fn stop_all(&self) {
        let mut connections = self.connections.lock().await;
        let ids: Vec<_> = connections.keys().cloned().collect();
        for id in &ids {
            if let Some(transport) = connections.remove(id) {
                transport.stop().await;
            }
        }
        // Abort and remove all share tasks
        let mut share_tasks = self.share_tasks.lock().await;
        for (_key, handle) in share_tasks.drain() {
            handle.abort();
        }
        connections.clear();
    }
    pub async fn stop(&self, id: &str) -> Result<(), String> {
        let mut connections = self.connections.lock().await;
        if let Some(transport) = connections.remove(id) {
            transport.stop().await;
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
            Ok(())
        } else {
            Err(format!("Connection ID '{}' not found", id))
        }
    }

    pub async fn list_connections(&self) -> Vec<ConnectionInfo> {
        let connections = self.connections.lock().await;
        connections
            .iter()
            .map(|(id, transport)| ConnectionInfo {
                id: id.clone(),
                name: transport.name(),
            })
            .collect()
    }

    pub async fn set_udp_remote_addr(&self, id: &str, remote_addr: std::net::SocketAddr) -> Result<(), String> {
        let mut connections = self.connections.lock().await;
        if let Some(conn) = connections.get_mut(id) {
            // Try to get a mutable reference to the underlying UdpTransport
            if let Some(udp) = Arc::get_mut(conn)
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
        let mut simulation_stream_tasks = self.simulation_stream_tasks.lock().await;
        if let Some(handle) = simulation_stream_tasks.remove(id) {
            handle.abort();
        }
        self.stop(id).await
    }
}
