use async_trait::async_trait;
use prost::bytes::BytesMut;
use prost::Message;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt, WriteHalf};
use tokio::sync::Mutex;
use tokio::sync::Notify;
use tokio_serial::{SerialPortBuilderExt, SerialStream};
use tracing::{error, info as trace_info};

use crate::storage::file_logger::log_sent_data;
use crate::transport::{StatableTransport, Transport, DELIMITER, DELIMITER_LEN};

#[derive(Clone)]
pub struct SerialTransport {
    pub port_name: String,
    pub baud_rate: u32,
    pub writer: Arc<Mutex<Option<WriteHalf<SerialStream>>>>,
    reader_task: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
    pub last_data: Arc<Mutex<Option<Vec<u8>>>>, // Per-connection last data
    pub notify: Arc<Notify>,                    // Notifies when new data is available
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

    fn reset_packet_counters(&self) {
        self.packet_received_count.store(0, Ordering::Relaxed);
        self.packet_sent_count.store(0, Ordering::Relaxed);
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
            // const MAX_BUFFER_SIZE: usize = 1024 * 1024; // 1MB max buffer size

            trace_info!("[{}] Starting serial reader task", reader_id);

            loop {
                let mut buf = BytesMut::with_capacity(1024);
                buf.resize(1024, 0);
                match reader.lock().await.as_mut().unwrap().read(&mut buf).await {
                    Ok(n) if n > 0 => {
                        buf.truncate(n);
                        buffer.extend_from_slice(&buf);

                        trace_info!(
                            "[{}] Received {} bytes, buffer size: {}",
                            reader_id,
                            n,
                            buffer.len()
                        );

                        // Process complete packets (those ending with delimiter)

                        while buffer.len() >= DELIMITER_LEN {
                            // Check if last 4 bytes are the delimiter
                            let potential_delimiter = &buffer[buffer.len() - DELIMITER_LEN..];

                            if potential_delimiter == DELIMITER.to_le_bytes() {
                                // Extract packet (excluding delimiter)
                                let packet_len = buffer.len() - DELIMITER_LEN;
                                let packet_data = &buffer[..];

                                match Message::decode(&*buffer) {
                                    Ok(packet) => {
                                        let packet: F = packet;
                                        trace_info!(
                                            "[{}] Decoded packet, size: {} bytes",
                                            reader_id,
                                            packet_len
                                        );

                                        packet_received_count.fetch_add(1, Ordering::Relaxed);
                                        on_packet(reader_id.clone(), packet);

                                        // Store raw data
                                        let mut ld = last_data.lock().await;
                                        *ld = Some(packet_data.to_vec());
                                        notify.notify_waiters();

                                        // Clear the buffer as we've processed this packet
                                        buffer.clear();
                                        break; // Exit processing loop to get new data
                                    }
                                    Err(e) => {
                                        error!("[{}] Protobuf decode error: {:?}", reader_id, e);
                                        // Remove the delimiter and try to find next one
                                        buffer.truncate(packet_len);
                                        break;
                                    }
                                }
                            } else {
                                // No delimiter found yet, wait for more data
                                break;
                            }
                        }
                    }
                    Ok(_) => continue, // No data received

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
