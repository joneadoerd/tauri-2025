use crate::{
    general::serial::SerialConnectionInfo,
    packet::SerialPacketEvent,
};

use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

use super::serial::SerialManager;
use crate::packet::Packet;
use uuid::Uuid;


#[tauri::command]
pub async fn start_connection(
    state: State<'_, Arc<SerialManager>>,
    prefix: String,
    port: String,
    baud: u32,
    app: AppHandle,
) -> Result<(), String> {
    let id = format!("{}_{}", prefix, Uuid::new_v4());
    state
        .start(
            id,
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

#[tauri::command]
pub async fn send_packet(
    state: State<'_, Arc<SerialManager>>,
    id: String,
    packet: Packet, // Accept as struct, not bytes or JSON
) -> Result<(), String> {
    // Encode to protobuf binary for serial
    let mut buf = Vec::new();
    prost::Message::encode(&packet, &mut buf).map_err(|e| e.to_string())?;
    state.send_raw(&id, buf).await
}

#[tauri::command]
pub async fn stop_connection(
    state: State<'_, Arc<SerialManager>>,
    id: String,
) -> Result<(), String> {
    state.stop(&id).await;
    Ok(())
}

#[tauri::command]
pub fn list_serial_ports() -> Result<Vec<String>, String> {
    SerialManager::list_ports()
}

#[tauri::command]
pub async fn list_connections(
    state: State<'_, Arc<SerialManager>>,
) -> Result<Vec<SerialConnectionInfo>, String> {
    Ok(state.list_connections().await)
}

#[tauri::command]
pub async fn start_share(
    state: State<'_, Arc<SerialManager>>,
    from_id: String,
    to_id: String,
) -> Result<(), String> {
    state.start_share(from_id, to_id).await
}

#[tauri::command]
pub async fn stop_share(state: State<'_, Arc<SerialManager>>) -> Result<(), String> {
    state.stop_share().await;
    Ok(())
}
