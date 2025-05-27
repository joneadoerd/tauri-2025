use prost::Message;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio_serial::{SerialPortBuilderExt, SerialStream};
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::packet::PacketHeader;

#[derive(Clone)]
pub struct SerialManager {
    pub connections: Arc<Mutex<Vec<SerialConnection>>>,
}

pub struct SerialConnection {
    pub id: u32,
    pub path: String,
    pub baud: u32,
    pub port: SerialStream,
}

impl SerialManager {
    pub async fn send_to(&self, id: u32, packet: PacketHeader) -> anyhow::Result<()> {
        let mut conns = self.connections.lock().await;
        if let Some(conn) = conns.iter_mut().find(|c| c.id == id) {
            let mut buf = Vec::new();
            packet.encode(&mut buf)?;
            conn.port.write_all(&buf).await?;
            conn.port.flush().await?;
        }
        Ok(())
    }

    pub async fn read_loop(&self) {
        let mut conns = self.connections.lock().await;
        for conn in conns.iter_mut() {
            let id = conn.id;
            let mut buf = [0u8; 1024];
            if let Ok(n) = conn.port.read(&mut buf).await {
                if let Ok(packet) = PacketHeader::decode(&buf[..n]) {
                    println!("Received on {}: {:?}", id, packet);
                    // optionally emit to frontend via tauri::event
                }
            }
        }
    }

pub async fn add_connection(&self, id: u32, path: &str, baud: u32) -> anyhow::Result<()> {
    let stream = tokio_serial::new(path, baud).open_native_async()?;
    self.connections.lock().await.push(SerialConnection {
        id,
        path: path.to_string(),
        baud,
        port: stream,
    });
    Ok(())
}
}