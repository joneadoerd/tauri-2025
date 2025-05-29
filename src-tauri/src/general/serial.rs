use prost::Message;
use serde::Serialize;
use tokio::io::{AsyncReadExt, AsyncWriteExt, WriteHalf};
use tokio::sync::Mutex;
use tokio_serial::{SerialPortBuilderExt, SerialStream};

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

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
    reader_task: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

#[derive(Clone, Default)]
pub struct SerialManager {
    connections: Arc<Mutex<HashMap<String, Connection>>>, // key = connection id
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

        let reader_id = id.clone();
        let task = tokio::spawn(async move {
            let mut reader = reader;
            loop {
                let mut buf = vec![0u8; 1024];
                match reader.read(&mut buf).await {
                    Ok(n) if n > 0 => {
                        buf.truncate(n);
                        match Message::decode(buf.as_slice()) {
                            Ok(packet) => on_packet(reader_id.clone(), packet),
                            Err(e) => eprintln!("[serialcom] Decode error: {}", e),
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
}
