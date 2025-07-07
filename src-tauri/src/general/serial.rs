use log::info;
use prost::Message;
use serde::Serialize;
use tokio::io::{AsyncReadExt, AsyncWriteExt, WriteHalf};
use tokio::sync::Mutex;
use tokio::time;
use tokio_serial::{SerialPortBuilderExt, SerialStream};

use once_cell::sync::Lazy;
use tracing::{error, warn};
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex as TokioMutex;

use super::timer_res::win_timer;


static LAST_DATA: Lazy<TokioMutex<HashMap<String, Vec<u8>>>> =
    Lazy::new(|| TokioMutex::new(HashMap::new()));

#[derive(Serialize, Clone, Debug)]
pub struct SerialConnectionInfo {
    pub id: String,
    pub port_name: String,
}

#[derive(Clone)]
struct Connection {
    id: String,
    port_name: String,
    writer: Arc<Mutex<Option<WriteHalf<SerialStream>>>>,
    reader: Arc<Mutex<Option<tokio::io::ReadHalf<SerialStream>>>>, // Add reader
    reader_task: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

#[derive(Clone, Default)]
pub struct SerialManager {
    connections: Arc<Mutex<HashMap<String, Connection>>>, // key = connection id
    share_task: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>, // Add a handle for the share task
}

impl SerialManager {
    pub async fn start<F: Message + Default>(
        &self,
        id: String,
        port_name: String,
        baud_rate: u32,
        mut on_packet: impl FnMut(String, F) + Send + 'static,
    ) -> Result<(), String> {
        let mut connections = self.connections.lock().await;
        if connections.contains_key(&id) {
            return Err(format!("Connection ID '{}' already exists", id));
        }

        let port = tokio_serial::new(&port_name, baud_rate)
            .timeout(Duration::from_millis(100))
            .open_native_async()
            .map_err(|e| e.to_string())?;

        let (reader, writer) = tokio::io::split(port);
        let writer = Arc::new(Mutex::new(Some(writer)));
        let reader = Arc::new(Mutex::new(Some(reader)));

        let reader_id = id.clone();
        let reader_for_task = reader.clone();
        let task = tokio::spawn(async move {
            let mut reader = reader_for_task.lock().await.take().unwrap();
            let mut buffer = Vec::new();
            loop {
                let mut buf = vec![0u8; 1024];
                match reader.read(&mut buf).await {
                    Ok(n) if n > 0 => {
                        buf.truncate(n);
                        buffer.extend_from_slice(&buf);
                        
                        // Try to decode complete messages from buffer
                        while buffer.len() >= 4 {
                            // Read message length (first 4 bytes)
                            let length = u32::from_be_bytes([buffer[0], buffer[1], buffer[2], buffer[3]]) as usize;
                            
                            if buffer.len() >= 4 + length {
                                // Extract the complete message (skip the 4-byte length prefix)
                                let message = buffer[4..4+length].to_vec();
                                buffer.drain(0..4+length);
                                
                                // Try to decode as protobuf message
                                match Message::decode(message.as_slice()) {
                                    Ok(packet) => {
                                        on_packet(reader_id.clone(), packet);
                                        // Store the latest raw data for sharing
                                        let mut last_data = LAST_DATA.lock().await;
                                        last_data.insert(reader_id.clone(), message);
                                    }
                                    Err(e) => eprintln!("[serialcom] Decode error: {}", e),
                                }
                            } else {
                                // Not enough data for complete message, wait for more
                                break;
                            }
                        }
                    }
                    Ok(_) => continue,
                    Err(e) => {
                        eprintln!("[serialcom] Read error on {}: {}", reader_id, e);
                        break;
                    }
                }
            }
        });

        connections.insert(
            id.clone(),
            Connection {
                id,
                port_name,
                writer,
                reader,
                reader_task: Arc::new(Mutex::new(Some(task))),
            },
        );

        Ok(())
    }

    pub async fn send(&self, id: &str, msg: impl prost::Message) -> Result<(), String> {
        let mut buf = Vec::new();
        msg.encode(&mut buf).map_err(|e| e.to_string())?;

        let connections = self.connections.lock().await;
        if let Some(conn) = connections.get(id) {
            if let Some(writer) = conn.writer.lock().await.as_mut() {
                writer.write_all(&buf).await.map_err(|e| e.to_string())
            } else {
                Err("Writer not available".into())
            }
        } else {
            Err(format!("No connection with ID '{}'", id))
        }
    }

    pub async fn stop(&self, id: &str) {
        if let Some(conn) = self.connections.lock().await.remove(id) {
            *conn.writer.lock().await = None;
            if let Some(task) = conn.reader_task.lock().await.take() {
                task.abort();
            }
        }
    }

    pub async fn stop_all(&self) {
        let mut conns = self.connections.lock().await;
        for (_, conn) in conns.drain() {
            *conn.writer.lock().await = None;
            if let Some(task) = conn.reader_task.lock().await.take() {
                task.abort();
            }
        }
    }

    pub fn list_ports() -> Result<Vec<String>, String> {
        serialport::available_ports()
            .map(|ports| ports.into_iter().map(|p| p.port_name).collect())
            .map_err(|e| e.to_string())
    }
    pub async fn send_raw(&self, id: &str, data: Vec<u8>) -> Result<(), String> {
        let conn = self.connections.lock().await.get(id).cloned();
        if let Some(conn) = conn {
            if let Some(writer) = conn.writer.lock().await.as_mut() {
                // Add length prefix (4 bytes, big-endian)
                let length = data.len() as u32;
                let length_bytes = length.to_be_bytes();
                
                // Write length prefix
                writer.write_all(&length_bytes).await.map_err(|e| e.to_string())?;
                // Write protobuf data
                writer.write_all(&data).await.map_err(|e| e.to_string())?;
                return Ok(());
            }
            return Err("Writer not initialized.".into());
        }
        Err("Connection not found.".into())
    }
    pub async fn list_connections(&self) -> Vec<SerialConnectionInfo> {
        self.connections
            .lock()
            .await
            .iter()
            .map(|(id, conn)| SerialConnectionInfo {
                id: id.clone(),
                port_name: conn.port_name.clone(),
            })
            .collect()
    }
    /// Start sharing data between two serial connections every 10ms
pub async fn start_share(&self, from_id: String, to_id: String) -> Result<(), String> {
        // Get destination connection
        let to_conn = {
            let connections = self.connections.lock().await;
            connections.get(&to_id).cloned()
                .ok_or_else(|| format!("Connection {} not found", to_id))?
        };

        // Enable high-resolution timer on Windows
        #[cfg(windows)]
        win_timer::enable().map_err(|e| {
            error!("Timer resolution error: {}", e);
            e
        })?;

        let share_task = tokio::spawn(async move {
            let mut next_wake = time::Instant::now();
            let interval = Duration::from_millis(10);
            let mut last_data = Vec::new();

            loop {
                // Update next wake time
                next_wake += interval;

                // Get the data to send (minimize lock time)
                {
                    let data_guard = LAST_DATA.lock().await;
                    if let Some(data) = data_guard.get(&from_id) {
                        last_data = data.clone();
                    }
                }

                // Skip if no data
                if last_data.is_empty() {
                    time::sleep_until(next_wake).await;
                    continue;
                }

                // Sleep most of the interval
                let now = time::Instant::now();
                if now < next_wake {
                    let sleep_time = next_wake - now - Duration::from_micros(1500);
                    if !sleep_time.is_zero() {
                        time::sleep(sleep_time).await;
                    }

                    // Precise wait for remaining time
                    #[cfg(windows)]
                    while time::Instant::now() < next_wake {
                        std::hint::spin_loop();
                    }
                }

                // Send data
                let mut writer_guard = to_conn.writer.lock().await;
                if let Some(writer) = writer_guard.as_mut() {
                    if let Err(e) = writer.write_all(&last_data).await {
                        error!("Write error: {}", e);
                        break;
                    }
                } else {
                    warn!("Writer disconnected");
                    break;
                }

                // Log timing info
                let elapsed = time::Instant::now().duration_since(next_wake - interval);
                info!(
                    "Interval: target={}ms, actual={}ms",
                    interval.as_secs_f64() * 1000.0,
                    elapsed.as_secs_f64() * 1000.0
                );
            }

            // Clean up Windows timer
            #[cfg(windows)]
            win_timer::disable();
        });

        // Store the task handle
        *self.share_task.lock().await = Some(share_task);
        Ok(())
    }

    pub async fn stop_share(&self) {
        if let Some(task) = self.share_task.lock().await.take() {
            task.abort();
        }
        #[cfg(windows)]
        win_timer::disable();
    }
}
