use log::info;
use prost::Message;
use serde::Serialize;
use tokio::io::{AsyncReadExt, AsyncWriteExt, WriteHalf};
use tokio::sync::Mutex;
use tokio::time;
use tokio_serial::{SerialPortBuilderExt, SerialStream};

use chrono;
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::sync::Mutex as TokioMutex;
use tracing::{error, info as trace_info, warn};

use std::env;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::Path;

#[cfg(windows)]
use super::timer_res::win_timer;

static LAST_DATA: Lazy<TokioMutex<HashMap<String, Vec<u8>>>> =
    Lazy::new(|| TokioMutex::new(HashMap::new()));

// Add persistent data storage using Tauri store
static PERSISTENT_DATA: Lazy<TokioMutex<HashMap<String, Vec<String>>>> =
    Lazy::new(|| TokioMutex::new(HashMap::new()));

// Channel for fast data storage
static STORAGE_CHANNEL: Lazy<mpsc::UnboundedSender<(String, String)>> = Lazy::new(|| {
    let (tx, mut rx) = mpsc::unbounded_channel::<(String, String)>();

    // Spawn storage worker
    tokio::spawn(async move {
        while let Some((connection_id, json_data)) = rx.recv().await {
            // Validate connection_id
            if connection_id.is_empty() {
                error!("Empty connection_id received in storage worker");
                continue;
            }
            
            // Fast storage operation
            let mut persistent_data = PERSISTENT_DATA.lock().await;
            if let Some(connection_data) = persistent_data.get_mut(&connection_id) {
                connection_data.push(json_data);
                // Keep only last 1000 packets per connection to prevent memory issues
                if connection_data.len() > 1000 {
                    connection_data.drain(0..connection_data.len() - 1000);
                }
                trace_info!("[{}] Stored packet, total: {}", connection_id, connection_data.len());
            } else {
                persistent_data.insert(connection_id.clone(), vec![json_data]);
                trace_info!("[{}] Created new storage entry", connection_id);
            }
        }
    });

    tx
});

// Channel for database/file logging
static LOGGING_CHANNEL: Lazy<mpsc::UnboundedSender<(String, String, String)>> = Lazy::new(|| {
    let (tx, mut rx) = mpsc::unbounded_channel::<(String, String, String)>();

    // Spawn logging worker
    tokio::spawn(async move {
        // Get Tauri app root directory
        let app_root = if let Ok(exe_path) = env::current_exe() {
            if let Some(parent) = exe_path.parent() {
                parent.to_path_buf()
            } else {
                Path::new(".").to_path_buf()
            }
        } else {
            Path::new(".").to_path_buf()
        };

        // Create logs directory in Tauri app root
        let log_dir = app_root.join("logs");
        if !log_dir.exists() {
            if let Err(e) = std::fs::create_dir_all(&log_dir) {
                error!("Failed to create logs directory at {:?}: {}", log_dir, e);
                return;
            }
        }

        trace_info!("Logs directory created at: {:?}", log_dir);

        while let Some((connection_id, json_data, timestamp)) = rx.recv().await {
            // Validate connection_id is not empty
            if connection_id.is_empty() {
                error!("Empty connection_id received for logging");
                continue;
            }
            
            // Write to log file in Tauri app root
            let filename = log_dir.join(format!("connection_{}.log", connection_id));
            
            // Ensure the log directory exists
            if let Err(e) = std::fs::create_dir_all(&log_dir) {
                error!("Failed to create logs directory at {:?}: {}", log_dir, e);
                continue;
            }
            
            match OpenOptions::new().create(true).append(true).open(&filename) {
                Ok(mut file) => {
                    if let Err(e) = writeln!(file, "[{}] {}", timestamp, json_data) {
                        error!("Failed to write to log file {:?}: {}", filename, e);
                    } else {
                        trace_info!(
                            "[{}] [{}] Logged packet to file: {:?}",
                            connection_id,
                            timestamp,
                            filename
                        );
                    }
                }
                Err(e) => {
                    error!("Failed to open log file {:?}: {}", filename, e);
                }
            }
        }
    });

    tx
});

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
    reader: Arc<Mutex<Option<tokio::io::ReadHalf<SerialStream>>>>,
    reader_task: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

#[derive(Clone, Default)]
pub struct SerialManager {
    connections: Arc<Mutex<HashMap<String, Connection>>>,
    share_task: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

impl SerialManager {
    // Fast channel-based storage function
    fn save_packet_fast(connection_id: &str, packet: &impl serde::Serialize) {
        // Validate connection_id
        if connection_id.is_empty() {
            error!("Empty connection_id provided to save_packet_fast");
            return;
        }

        // Convert packet to JSON
        let json_data = match serde_json::to_string(packet) {
            Ok(json) => json,
            Err(e) => {
                error!("Failed to serialize packet to JSON for {}: {}", connection_id, e);
                return;
            }
        };

        // Get current timestamp
        let timestamp = chrono::Utc::now()
            .format("%Y-%m-%d %H:%M:%S%.3f")
            .to_string();

        // Send to storage channel (non-blocking)
        if let Err(e) = STORAGE_CHANNEL.send((connection_id.to_string(), json_data.clone())) {
            error!("Failed to send data to storage channel for {}: {}", connection_id, e);
        } else {
            trace_info!("[{}] Packet sent to storage channel", connection_id);
        }

        // Send to logging channel (non-blocking)
        if let Err(e) = LOGGING_CHANNEL.send((connection_id.to_string(), json_data, timestamp)) {
            error!("Failed to send data to logging channel for {}: {}", connection_id, e);
        } else {
            trace_info!("[{}] Packet sent to logging channel", connection_id);
        }
    }

    // Function to log sent data
    fn log_sent_data(connection_id: &str, data: &[u8]) {
        // Convert raw data to hex string for logging
        let hex_data = data
            .iter()
            .map(|b| format!("{:02x}", b))
            .collect::<Vec<String>>()
            .join(" ");

        let timestamp = chrono::Utc::now()
            .format("%Y-%m-%d %H:%M:%S%.3f")
            .to_string();
        let log_entry = format!("SENT: {}", hex_data);

        // Send to logging channel (non-blocking)
        if let Err(e) = LOGGING_CHANNEL.send((connection_id.to_string(), log_entry, timestamp)) {
            error!("Failed to send sent data to logging channel: {}", e);
        }
    }

    // Helper function to save packet as JSON to Tauri store
    async fn save_packet_json(connection_id: &str, packet: &impl serde::Serialize) {
        // Convert packet to JSON
        let json_data = match serde_json::to_string(packet) {
            Ok(json) => json,
            Err(e) => {
                error!("Failed to serialize packet to JSON: {}", e);
                return;
            }
        };

        // Save to persistent storage
        let mut persistent_data = PERSISTENT_DATA.lock().await;
        if let Some(connection_data) = persistent_data.get_mut(connection_id) {
            connection_data.push(json_data);
            // Keep only last 1000 packets per connection to prevent memory issues
            if connection_data.len() > 1000 {
                connection_data.drain(0..connection_data.len() - 1000);
            }
        } else {
            persistent_data.insert(connection_id.to_string(), vec![json_data]);
        }

        trace_info!(
            "[{}] Saved packet as JSON to persistent storage",
            connection_id
        );
    }

    // Helper function to save data to Tauri store
    async fn save_to_tauri_store(connection_id: &str, data: &[String]) {
        // This would be called when we want to persist data to Tauri store
        // For now, we'll keep it in memory, but this can be extended to use Tauri store
        trace_info!("[{}] Data ready for Tauri store persistence", connection_id);
    }

    pub async fn start<F: Message + Default + serde::Serialize>(
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
            const MAX_BUFFER_SIZE: usize = 1024 * 1024; // 1MB max buffer size

            trace_info!("[{}] Starting serial reader task", reader_id);

            loop {
                let mut buf = vec![0u8; 1024];
                match reader.read(&mut buf).await {
                    Ok(n) if n > 0 => {
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
                                            serde_json::to_string(&packet).unwrap_or_else(|_| "serialization failed".to_string())
                                        );

                                        // Process packet only once
                                        Self::save_packet_fast(&reader_id, &packet);
                                        on_packet(reader_id.clone(), packet);

                                        // Store the latest raw data for sharing
                                        let mut last_data = LAST_DATA.lock().await;
                                        last_data.insert(
                                            reader_id.clone(),
                                            remaining_data[..packet_size].to_vec(),
                                        );

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
                                        if let Ok(packet) = Message::decode(&remaining_data[offset..]) {
                                            let packet: F = packet;
                                            let packet_size = packet.encoded_len();
                                            if offset + packet_size <= remaining_data.len() {
                                                trace_info!(
                                                    "[{}] Found packet at offset {}, size: {} bytes",
                                                    reader_id,
                                                    offset,
                                                    packet_size
                                                );

                                                // Process packet only once
                                                Self::save_packet_fast(&reader_id, &packet);
                                                on_packet(reader_id.clone(), packet);

                                                // Store the latest raw data for sharing
                                                let mut last_data = LAST_DATA.lock().await;
                                                last_data.insert(
                                                    reader_id.clone(),
                                                    remaining_data[offset..offset + packet_size]
                                                        .to_vec(),
                                                );

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
                            buffer.drain(0..processed_bytes);
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

        connections.insert(
            id.clone(),
            Connection {
                id: id.clone(),
                port_name: port_name.clone(),
                writer,
                reader,
                reader_task: Arc::new(Mutex::new(Some(task))),
            },
        );

        trace_info!("[{}] Serial connection started on port {}", id, port_name);
        Ok(())
    }

    pub async fn send(&self, id: &str, msg: impl prost::Message) -> Result<(), String> {
        let mut buf = Vec::new();
        msg.encode(&mut buf).map_err(|e| e.to_string())?;

        trace_info!("[{}] Sending packet, size: {} bytes", id, buf.len());

        let connections = self.connections.lock().await;
        if let Some(conn) = connections.get(id) {
            if let Some(writer) = conn.writer.lock().await.as_mut() {
                writer.write_all(&buf).await.map_err(|e| e.to_string())?;
                writer.flush().await.map_err(|e| e.to_string())?;
                Self::log_sent_data(id, &buf);
                trace_info!("[{}] Successfully sent packet", id);
                Ok(())
            } else {
                Err("Writer not available".into())
            }
        } else {
            Err(format!("No connection with ID '{}'", id))
        }
    }

    pub async fn stop(&self, id: &str) {
        if let Some(conn) = self.connections.lock().await.remove(id) {
            // Save current data to Tauri store before stopping
            let persistent_data = PERSISTENT_DATA.lock().await;
            if let Some(data) = persistent_data.get(id) {
                Self::save_to_tauri_store(id, data).await;
            }

            *conn.writer.lock().await = None;
            if let Some(task) = conn.reader_task.lock().await.take() {
                task.abort();
            }
        }
    }

    pub async fn stop_all(&self) {
        let mut conns = self.connections.lock().await;
        for (id, conn) in conns.drain() {
            // Save current data to Tauri store before stopping
            let persistent_data = PERSISTENT_DATA.lock().await;
            if let Some(data) = persistent_data.get(&id) {
                Self::save_to_tauri_store(&id, data).await;
            }

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
        trace_info!("[{}] Sending raw data, size: {} bytes", id, data.len());
        
        let conn = self.connections.lock().await.get(id).cloned();
        if let Some(conn) = conn {
            if let Some(writer) = conn.writer.lock().await.as_mut() {
                writer.write_all(&data).await.map_err(|e| e.to_string())?;
                writer.flush().await.map_err(|e| e.to_string())?;
                Self::log_sent_data(id, &data);
                trace_info!("[{}] Successfully sent raw data", id);
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
            connections
                .get(&to_id)
                .cloned()
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

    // Add function to get saved data for a connection
    pub async fn get_saved_data(&self, connection_id: &str) -> Vec<String> {
        let persistent_data = PERSISTENT_DATA.lock().await;
        persistent_data
            .get(connection_id)
            .cloned()
            .unwrap_or_default()
    }

    // Add function to clear saved data for a connection
    pub async fn clear_saved_data(&self, connection_id: &str) {
        let mut persistent_data = PERSISTENT_DATA.lock().await;
        persistent_data.remove(connection_id);
    }

    // Add function to get all saved data
    pub async fn get_all_saved_data(&self) -> HashMap<String, Vec<String>> {
        let persistent_data = PERSISTENT_DATA.lock().await;
        persistent_data.clone()
    }

    // Add function to get storage statistics
    pub async fn get_storage_stats(&self) -> HashMap<String, usize> {
        let persistent_data = PERSISTENT_DATA.lock().await;
        persistent_data
            .iter()
            .map(|(id, data)| (id.clone(), data.len()))
            .collect()
    }

    // Add function to clear all saved data
    pub async fn clear_all_saved_data(&self) {
        let mut persistent_data = PERSISTENT_DATA.lock().await;
        persistent_data.clear();
    }
}
