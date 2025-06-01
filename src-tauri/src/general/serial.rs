use prost::Message;
use serde::Serialize;
use tokio::io::{AsyncReadExt, AsyncWriteExt, WriteHalf};
use tokio::sync::Mutex;
use tokio_serial::{SerialPortBuilderExt, SerialStream};

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use once_cell::sync::Lazy;
use tokio::sync::Mutex as TokioMutex;

static LAST_DATA: Lazy<TokioMutex<HashMap<String, Vec<u8>>>> = Lazy::new(|| TokioMutex::new(HashMap::new()));

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
            loop {
                let mut buf = vec![0u8; 1024];
                match reader.read(&mut buf).await {
                    Ok(n) if n > 0 => {
                        buf.truncate(n);
                        // Forward the raw bytes to a channel for sharing, if enabled
                        match Message::decode(buf.as_slice()) {
                            Ok(packet) => on_packet(reader_id.clone(), packet),
                            Err(e) => eprintln!("[serialcom] Decode error: {}", e),
                        }
                        // Store the latest raw data for sharing
                        let mut last_data = LAST_DATA.lock().await;
                        last_data.insert(reader_id.clone(), buf.clone());
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
        let connections = self.connections.lock().await;
        let to_conn = connections.get(&to_id).cloned();
        drop(connections);
        if to_conn.is_none() {
            return Err("Destination connection not found".into());
        }
        let to_conn = to_conn.unwrap();
        let share_task = tokio::spawn(async move {
            loop {
                // Get the latest data received from 'from_id'
                let mut last_data = LAST_DATA.lock().await;
                if let Some(data) = last_data.get(&from_id) {
                    if !data.is_empty() {
                        // Write to 'to_conn'
                        let mut to_writer_guard = to_conn.writer.lock().await;
                        if let Some(writer) = to_writer_guard.as_mut() {
                            let _ = writer.write_all(data).await;
                        }
                    }
                }
                drop(last_data);
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        });
        let mut task_handle = self.share_task.lock().await;
        *task_handle = Some(share_task);
        Ok(())
    }

    /// Stop the sharing task
    pub async fn stop_share(&self) {
        if let Some(task) = self.share_task.lock().await.take() {
            task.abort();
        }
    }
}
