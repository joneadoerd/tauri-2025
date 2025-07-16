use async_trait::async_trait;
use prost::Message;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt, WriteHalf};
use tokio::sync::Mutex;
use tokio_serial::{SerialPortBuilderExt, SerialStream};
use tracing::{error, info as trace_info};
use prost::bytes::BytesMut;
use prost::bytes::Buf;
use tokio::sync::Notify;
use std::sync::atomic::{AtomicUsize, Ordering};

use crate::storage::file_logger::log_sent_data;
use crate::transport::{StatableTransport, Transport};

#[derive(Clone)]
pub struct SerialTransport {
    pub port_name: String,
    pub baud_rate: u32,
    pub writer: Arc<Mutex<Option<WriteHalf<SerialStream>>>>,
    reader_task: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
    pub last_data: Arc<Mutex<Option<Vec<u8>>>>, // Per-connection last data
    pub notify: Arc<Notify>, // Notifies when new data is available
    pub packet_received_count: Arc<AtomicUsize>,
    pub packet_sent_count: Arc<AtomicUsize>, // Add packet sent counter
}

impl SerialTransport {
    pub fn new(port_name: String, baud_rate: u32) -> Self {
        Self {
            port_name,
            baud_rate,
            writer: Arc::new(Mutex::new(None)),
            reader_task: Arc::new(Mutex::new(None)),
            last_data: Arc::new(Mutex::new(None)),
            notify: Arc::new(Notify::new()),
            packet_received_count: Arc::new(AtomicUsize::new(0)),
            packet_sent_count: Arc::new(AtomicUsize::new(0)),
        }
    }
    
    pub fn list_ports() -> Result<Vec<String>, String> {
        serialport::available_ports()
            .map(|ports| ports.into_iter().map(|p| p.port_name).collect())
            .map_err(|e| e.to_string())
    }
    pub fn get_packet_received_count(&self) -> usize {
        self.packet_received_count.load(Ordering::Relaxed)
    }
    
    pub fn get_packet_sent_count(&self) -> usize {
        self.packet_sent_count.load(Ordering::Relaxed)
    }
}

#[async_trait]
impl Transport for SerialTransport {
    async fn send(&self, data: Vec<u8>) -> Result<(), String> {
        if let Some(writer) = self.writer.lock().await.as_mut() {
            writer.write_all(&data).await.map_err(|e| e.to_string())?;
            writer.flush().await.map_err(|e| e.to_string())?;
            log_sent_data(self.name().as_str(), &data);
            // Increment packet sent counter
            self.packet_sent_count.fetch_add(1, Ordering::Relaxed);
            Ok(())
        } else {
            Err("Writer not initialized.".to_string())
        }
    }

    async fn stop(&self) {
        *self.writer.lock().await = None;
        if let Some(task) = self.reader_task.lock().await.take() {
            task.abort();
        }
    }
    fn name(&self) -> String {
        format!("Serial({}:{})", self.port_name, self.baud_rate)
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
}

impl StatableTransport for SerialTransport {
    async fn start<F: Message + Default + serde::Serialize>(
        &mut self,
        id: String,
        mut on_packet: impl FnMut(String, F) + Send + 'static,
    ) -> Result<(), String> {
        let port = tokio_serial::new(&self.port_name, self.baud_rate)
            .open_native_async()
            .map_err(|e| e.to_string())?;
        trace_info!("[{}] Connected to {}", id, self.port_name);
        let (reader, writer) = tokio::io::split(port);

        let reader = Arc::new(Mutex::new(Some(reader)));
        *self.writer.lock().await = Some(writer);
        let last_data = self.last_data.clone();
        let reader_id = id.clone();
        let notify = self.notify.clone();
        let packet_received_count = self.packet_received_count.clone();

        let task = tokio::spawn(async move {
            let mut buffer = BytesMut::with_capacity(4096);
            const MAX_BUFFER_SIZE: usize = 1024 * 1024; // 1MB max buffer size

            trace_info!("[{}] Starting serial reader task", reader_id);

            loop {
                let mut buf = BytesMut::with_capacity(1024);
                buf.resize(1024, 0);
                match reader.lock().await.as_mut().unwrap().read(&mut buf).await {
                    Ok(n) if n > 0 => {
                        packet_received_count.fetch_add(1, Ordering::Relaxed);
                        buf.truncate(n);
                        buffer.extend_from_slice(&buf);

                        trace_info!(
                            "[{}] Received {} bytes, buffer size: {}",
                            reader_id,
                            n,
                            buffer.len()
                        );

                        // Prevent buffer overflow
                        if buffer.len() > MAX_BUFFER_SIZE {
                            error!(
                                "[serialcom] Buffer overflow on {}, clearing buffer",
                                reader_id
                            );
                            buffer.clear();
                            continue;
                        }

                        // Process all complete packets in buffer
                        let mut processed_bytes = 0;
                        while buffer.len() > processed_bytes {
                            let remaining_data = &buffer[processed_bytes..];

                            // Try to decode as protobuf message
                            match Message::decode(remaining_data) {
                                Ok(packet) => {
                                    let packet: F = packet;
                                    let packet_size = packet.encoded_len();
                                    if packet_size <= remaining_data.len() {
                                        trace_info!(
                                            "[{}] Decoded packet, size: {} bytes, fields: {:?}",
                                            reader_id,
                                            packet_size,
                                            serde_json::to_string(&packet).unwrap_or_else(|_| {
                                                "serialization failed".to_string()
                                            })
                                        );

                                        on_packet(reader_id.clone(), packet);

                                        // Store the latest raw data for sharing
                                        let mut ld = last_data.lock().await;
                                        *ld = Some(remaining_data[..packet_size].to_vec());
                                        notify.notify_waiters();

                                        processed_bytes += packet_size;

                                        trace_info!(
                                            "[{}] Successfully processed packet, moving {} bytes",
                                            reader_id,
                                            packet_size
                                        );
                                    } else {
                                        // Incomplete packet, wait for more data
                                        trace_info!(
                                            "[{}] Incomplete packet (size: {}, available: {}), waiting for more data",
                                            reader_id,
                                            packet_size,
                                            remaining_data.len()
                                        );
                                        break;
                                    }
                                }
                                Err(e) => {
                                    trace_info!(
                                        "[{}] Failed to decode packet at offset {}, error: {:?}",
                                        reader_id,
                                        processed_bytes,
                                        e
                                    );

                                    // If we can't decode, try to find a valid packet boundary
                                    // Look for potential packet start by trying different offsets
                                    let mut found_packet = false;
                                    let search_limit = std::cmp::min(remaining_data.len(), 100);

                                    for offset in 1..search_limit {
                                        if let Ok(packet) =
                                            Message::decode(&remaining_data[offset..])
                                        {
                                            let packet: F = packet;
                                            let packet_size = packet.encoded_len();
                                            if offset + packet_size <= remaining_data.len() {
                                                trace_info!(
                                                    "[{}] Found packet at offset {}, size: {} bytes",
                                                    reader_id,
                                                    offset,
                                                    packet_size
                                                );

                                                on_packet(reader_id.clone(), packet);

                                                // Store the latest raw data for sharing
                                                let mut ld = last_data.lock().await;
                                                *ld = Some(remaining_data[offset..offset + packet_size].to_vec());
                                                notify.notify_waiters();

                                                processed_bytes += offset + packet_size;
                                                found_packet = true;
                                                break;
                                            }
                                        }
                                    }

                                    if !found_packet {
                                        // No valid packet found, remove one byte and try again
                                        processed_bytes += 1;
                                        if processed_bytes >= buffer.len() {
                                            trace_info!(
                                                "[{}] No valid packets found in buffer, clearing {} bytes",
                                                reader_id,
                                                buffer.len()
                                            );
                                            // No more data to process, clear the buffer
                                            buffer.clear();
                                            break;
                                        }
                                    }
                                }
                            }
                        }

                        // Remove processed bytes from buffer
                        if processed_bytes > 0 {
                            buffer.advance(processed_bytes);
                            trace_info!(
                                "[{}] Processed {} bytes, remaining buffer: {}",
                                reader_id,
                                processed_bytes,
                                buffer.len()
                            );
                        }
                    }
                    Ok(_) => continue,
                    Err(e) => {
                        error!("[serialcom] Read error on {}: {}", reader_id, e);
                        break;
                    }
                }
            }

            trace_info!("[{}] Serial reader task ended", reader_id);
        });
        *self.reader_task.lock().await = Some(task);

        Ok(())
    }
}
