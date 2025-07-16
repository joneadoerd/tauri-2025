use async_trait::async_trait;
use prost::Message;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::UdpSocket;
use tokio::sync::{oneshot, Mutex};

use crate::packet::{packet::Kind, Packet, TargetPacket};
use prost::bytes::BytesMut;
use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use tokio::sync::Notify;

use crate::transport::{StatableTransport, Transport};

#[derive(Clone)]
pub struct UdpTransport {
    pub local_addr: SocketAddr,
    pub remote_addr: Option<SocketAddr>,
    pub socket: Arc<UdpSocket>,
    pub running: Arc<Mutex<bool>>,
    pub cancel_tx: Arc<Mutex<Option<oneshot::Sender<()>>>>,
    pub target_data: Arc<Mutex<HashMap<u32, TargetPacket>>>, // Per-connection target data
    pub notify: Arc<Notify>, // Notifies when new target data is available
    pub packet_received_count: Arc<AtomicUsize>,
    pub packet_sent_count: Arc<AtomicUsize>, // Add packet sent counter
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
            target_data: Arc::new(Mutex::new(HashMap::new())),
            notify: Arc::new(Notify::new()),
            packet_received_count: Arc::new(AtomicUsize::new(0)),
            packet_sent_count: Arc::new(AtomicUsize::new(0)),
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
            // Increment packet sent counter
            self.packet_sent_count.fetch_add(1, Ordering::Relaxed);
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

    fn get_packet_received_count(&self) -> usize {
        self.packet_received_count.load(Ordering::Relaxed)
    }

    fn get_packet_sent_count(&self) -> usize {
        self.packet_sent_count.load(Ordering::Relaxed)
    }

    fn reset_packet_counters(&self) {
        self.packet_received_count.store(0, Ordering::Relaxed);
        self.packet_sent_count.store(0, Ordering::Relaxed);
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
        let target_data = self.target_data.clone();
        let notify = self.notify.clone();
        let packet_received_count = self.packet_received_count.clone();
        *running.lock().await = true;
        let local_addr = self.local_addr;
        let id_clone = id.clone();
        let (cancel_tx, mut cancel_rx) = oneshot::channel();
        *self.cancel_tx.lock().await = Some(cancel_tx);
        tokio::spawn(async move {
            let mut buf = BytesMut::with_capacity(65535);
            buf.resize(65535, 0);
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
                                buf.truncate(n);
                                println!("[udp] Received {} bytes from {}", n, addr);
                                // Try to decode as Packet (for TargetPacket/TargetPacketList)
                                if let Ok(packet) = Packet::decode(&buf[..]) {
                                    // If it's a TargetPacket or TargetPacketList, update per-connection target_data
                                    let mut td = target_data.lock().await;
                                    match &packet.kind {
                                        Some(Kind::TargetPacket(tp)) => {
                                            td.insert(tp.target_id, tp.clone());
                                            notify.notify_waiters();
                                        },
                                        Some(Kind::TargetPacketList(tpl)) => {
                                            for tp in &tpl.packets {
                                                td.insert(tp.target_id, tp.clone());
                                                notify.notify_waiters();
                                            }
                                        },
                                        _ => {}
                                    }
                                }
                                // Also call the original on_packet for generic F
                                if let Ok(packet) = F::decode(&buf[..]) {
                                    on_packet(id_clone.clone(), packet);
                                }

                                // Increment packet counter for successful receives
                                // Note: We increment for any successful decode, whether Packet or F
                                if Packet::decode(&buf[..]).is_ok() || F::decode(&buf[..]).is_ok() {
                                    packet_received_count.fetch_add(1, Ordering::Relaxed);
                                }
                                buf.clear();
                                buf.resize(65535, 0); // Ensure buffer is always the right size
                            }
                            Err(e) => {
                                println!("[udp] Error: {}. Continuing...", e);
                                buf.clear();
                                buf.resize(65535, 0);
                                continue; // Do not break, just continue
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
