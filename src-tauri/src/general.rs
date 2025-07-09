pub mod commands;
pub mod sensor_udp_server;
pub mod serial;
pub mod simulation_commands;
pub mod simulation_streaming;
pub mod timer_res;
use std::str::FromStr;
use std::sync::Arc;

use prost::Message;
use serde::{Deserialize, Serialize};
use serial::SerialManager;
use tauri::{AppHandle, Emitter};

use crate::packet::{self, Packet, PacketChecksum, PacketHeader, PacketPayload};
use crate::packet::SerialPacketEvent;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum PacketWrapper {
    Header(PacketHeader),
    Checksum(PacketChecksum),
    Payload(PacketPayload),
    // Add other packet variants here
    // Command(PacketCommand),
}
impl FromStr for PacketWrapper {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "header" => Ok(PacketWrapper::Header(PacketHeader::default())),
            "payload" => Ok(PacketWrapper::Payload(PacketPayload::default())),
            "checksum" => Ok(PacketWrapper::Checksum(PacketChecksum::default())),
            _ => Err(format!("Unknown packet type: {}", s)),
        }
    }
}
impl PacketWrapper {
    pub fn encode_prost(self) -> Result<Vec<u8>, String> {
        let packet = match self {
            PacketWrapper::Header(header) => Packet {
                kind: Some(packet::packet::Kind::Header(header)),
            },
            PacketWrapper::Payload(payload) => Packet {
                kind: Some(packet::packet::Kind::Payload(payload)),
            },
            PacketWrapper::Checksum(checksum) => Packet {
                kind: Some(packet::packet::Kind::Checksum(checksum)),
            },
            // PacketWrapper::Command(command) => Packet {
            //     kind: Some(packet::packet::Kind::Command(command)),
            // },
        };
        
        let mut buf = Vec::new();
        packet.encode(&mut buf)
            .map(|_| buf)
            .map_err(|e| e.to_string())
    }
}

pub async fn start_dynamic_packet(
    state: &Arc<SerialManager>,
    id: String,
    port: String,
    baud: u32,
    app: AppHandle,
) -> Result<(), String> {
    state
        .start(
            id.clone(),
            port,
            baud,
            move |conn_id: String, packet: Packet| {
                // Emit only the general event with id and packet
                let event = SerialPacketEvent {
                    id: conn_id.clone(),
                    packet: Some(packet.clone()),
                };
                let _ = app.emit("serial_packet", event);
            },
        )
        .await
}
