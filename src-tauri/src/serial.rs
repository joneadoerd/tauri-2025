use prost::Message;
use tokio::io::{AsyncReadExt, AsyncWriteExt, WriteHalf};
use tokio::sync::Mutex;
use tokio_serial::{SerialPortBuilderExt, SerialStream};


use std::sync::Arc;
use std::time::Duration;

use crate::packet::PacketHeader;

#[derive(Default,Clone)]
pub struct SerialManager {
    pub writer: Arc<Mutex<Option<WriteHalf<SerialStream>>>>,
    pub reader_task: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

impl SerialManager {
    pub async fn start(
        &self,
        port_name: &str,
        baud_rate: u32,
        mut on_packet: impl FnMut(PacketHeader) + Send + 'static,
    ) -> Result<(), String> {
        let port = tokio_serial::new(port_name, baud_rate)
            .timeout(Duration::from_millis(100))
            .open_native_async()
            .map_err(|e| e.to_string())?;

        let (reader, writer) = tokio::io::split(port);
        *self.writer.lock().await = Some(writer);

        let task = tokio::spawn(async move {
            let mut reader = reader;
            loop {
                let mut buf = vec![0u8; 1024];
                match reader.read(&mut buf).await {
                    Ok(n) if n > 0 => {
                        buf.truncate(n);
                        match PacketHeader::decode(&*buf) {
                            Ok(packet) => {
                                println!("[serialcom] Received: {:?}", packet);
                                on_packet(packet);
                            },
                            Err(e) => eprintln!("[serialcom] Decode error: {}", e),
                        }
                    }
                    Ok(_) => continue,
                    Err(e) => {
                        eprintln!("[serialcom] Read error: {}", e);
                        break;
                    }
                }
            }
        });

        *self.reader_task.lock().await = Some(task);
        Ok(())
    }

    pub async fn send(&self, json: impl prost::Message) -> Result<(), String> {
        let mut buf = Vec::new();
        json.encode(&mut buf).map_err(|e| e.to_string())?;

        if let Some(writer) = self.writer.lock().await.as_mut() {
            writer.write_all(&buf).await.map_err(|e| e.to_string())?;
            println!("[serialcom] Sent: {:?}", json);
            Ok(())
        } else {
            Err("Writer not initialized.".into())
        }
    }

    pub async fn stop(&self) {
        *self.writer.lock().await = None;
        if let Some(task) = self.reader_task.lock().await.take() {
            task.abort();
        }
    }

    pub fn list_ports() -> Result<Vec<String>, String> {
        serialport::available_ports()
            .map(|ports| ports.into_iter().map(|p| p.port_name).collect())
            .map_err(|e| e.to_string())
    }
}
