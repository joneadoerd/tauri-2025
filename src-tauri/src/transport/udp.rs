use async_trait::async_trait;
use prost::Message;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::UdpSocket;
use tokio::sync::{Mutex, oneshot};
use once_cell::sync::Lazy;
use tokio::sync::Mutex as TokioMutex;
use std::collections::HashMap;
use crate::packet::{Packet, packet::Kind, TargetPacket, TargetPacketList};

use crate::transport::{serial::LAST_DATA, StatableTransport, Transport};

// Store latest TargetPacket for each target_id, per UDP connection
pub static UDP_TARGET_DATA: Lazy<TokioMutex<HashMap<String, HashMap<u32, TargetPacket>>>> = Lazy::new(|| TokioMutex::new(HashMap::new()));

#[derive(Clone)]
pub struct UdpTransport {
    pub local_addr: SocketAddr,
    pub remote_addr: Option<SocketAddr>,
    pub socket: Arc<UdpSocket>,
    pub running: Arc<Mutex<bool>>,
    pub cancel_tx: Arc<Mutex<Option<oneshot::Sender<()>>>>,
}

impl UdpTransport {
    pub async fn new(local_addr: SocketAddr) -> Result<Self, String> {
        let socket = UdpSocket::bind(local_addr)
            .await
            .map_err(|e| e.to_string())?;
        Ok(Self {
            local_addr,
            remote_addr: None,
            socket: Arc::new(socket),
            running: Arc::new(Mutex::new(false)),
            cancel_tx: Arc::new(Mutex::new(None)),
        })
    }
}

#[async_trait]
impl Transport for UdpTransport {
    async fn send(&self, data: Vec<u8>) -> Result<(), String> {
        if let Some(addr) = self.remote_addr {
            self.socket
                .send_to(&data, addr)
                .await
                .map_err(|e| e.to_string())?;
            Ok(())
        } else {
            Err("Remote address not set".to_string())
        }
    }

    async fn stop(&self) {
        let mut running = self.running.lock().await;
        *running = false;
        drop(running);
        // Send cancel signal to the receive loop
        if let Some(tx) = self.cancel_tx.lock().await.take() {
            let _ = tx.send(());
        }
    }

    fn name(&self) -> String {
        format!("Udp({})", self.local_addr)
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
    fn as_any_mut(&mut self) -> &mut dyn std::any::Any {
        self
    }
}

impl StatableTransport for UdpTransport {
    async fn start<F: Message + Default + serde::Serialize>(
        &mut self,
        id: String,
        mut on_packet: impl FnMut(String, F) + Send + 'static,
    ) -> Result<(), String> {
        let socket = self.socket.clone();
        let running = self.running.clone();
        *running.lock().await = true;
        let local_addr = self.local_addr;
        let id_clone = id.clone();
        let (cancel_tx, mut cancel_rx) = oneshot::channel();
        *self.cancel_tx.lock().await = Some(cancel_tx);
        tokio::spawn(async move {
            let mut buf = vec![0u8; 2048];
            loop {
                tokio::select! {
                    biased;
                    _ = &mut cancel_rx => {
                        println!("[udp] Cancel signal received for {}", local_addr);
                        break;
                    }
                    res = socket.recv_from(&mut buf) => {
                        match res {
                            Ok((n, addr)) => {
                                println!("[udp] Received {} bytes from {}", n, addr);
                                // Save last received data
                                let mut last_data = LAST_DATA.lock().await;
                                last_data.insert(id_clone.clone(), buf[..n].to_vec());
                                drop(last_data);
                                // Try to decode as Packet (for TargetPacket/TargetPacketList)
                                if let Ok(packet) = Packet::decode(&buf[..n]) {
                                    // If it's a TargetPacket or TargetPacketList, update UDP_TARGET_DATA
                                    let mut udp_map = UDP_TARGET_DATA.lock().await;
                                    let entry = udp_map.entry(id_clone.clone()).or_default();
                                    match &packet.kind {
                                        Some(Kind::TargetPacket(tp)) => {
                                            entry.insert(tp.target_id, tp.clone());
                                        },
                                        Some(Kind::TargetPacketList(tpl)) => {
                                            for tp in &tpl.packets {
                                                entry.insert(tp.target_id, tp.clone());
                                            }
                                        },
                                        _ => {}
                                    }
                                }
                                // Also call the original on_packet for generic F
                                if let Ok(packet) = F::decode(&buf[..n]) {
                                    on_packet(id_clone.clone(), packet);
                                }
                            }
                            Err(e) => {
                                println!("[udp] Error: {}", e);
                                break;
                            }
                        }
                    }
                }
            }
            println!("[udp] Listener stopped for {}", local_addr);
        });
        Ok(())
    }
}
