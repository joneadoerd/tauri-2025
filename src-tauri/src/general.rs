pub mod commands;
pub mod serial;

use std::str::FromStr;

use prost::Message;
use serde::{Deserialize, Serialize};
use serial::SerialManager;
use tauri::{AppHandle, Emitter};

use crate::packet::{PacketChecksum, PacketHeader};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum PacketWrapper {
    Header(PacketHeader),
    Payload(PacketChecksum),
    // Add other packet variants here
    // Command(PacketCommand),
}
impl FromStr for PacketWrapper {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "header" => Ok(PacketWrapper::Header(PacketHeader::default())),
            "payload" => Ok(PacketWrapper::Payload(PacketChecksum::default())),
            _ => Err(format!("Unknown packet type: {}", s)),
        }
    }
}
impl PacketWrapper {
    pub fn encode_prost(self) -> Result<Vec<u8>, String> {
        let mut buf = Vec::new();
        match self {
            PacketWrapper::Header(packet) => packet.encode(&mut buf),
            PacketWrapper::Payload(packet) => packet.encode(&mut buf),
            // PacketWrapper::Command(packet) => packet.encode(&mut buf),
        }
        .map(|_| buf)
        .map_err(|e| e.to_string())
    }
}

pub async fn start_dynamic_packet<T>(
    state: &SerialManager,
    id: String,
    port: String,
    baud: u32,
    app: AppHandle,
) -> Result<(), String>
where
    T: prost::Message + serde::Serialize + Default + Send + 'static + prost::Message + Clone,
{
    state
        .start::<T>(id.clone(), port, baud, move |conn_id, packet| {
            let _ = app.emit(format!("serial_packet_{}", conn_id).as_str(), packet);
        })
        .await
}
