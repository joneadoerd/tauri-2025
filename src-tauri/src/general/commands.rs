use crate::{
    general::{serial::SerialConnectionInfo},
    packet::{PacketChecksum, PacketHeader},
};
use std::str::FromStr;
use tauri::{AppHandle, State};

use super::{serial::SerialManager, start_dynamic_packet, PacketWrapper};

#[tauri::command]
pub async fn start_connection(
    state: State<'_, SerialManager>,
    id: String,
    port: String,
    baud: u32,
    packet_type: String,
    app: AppHandle,
) -> Result<(), String> {
    match PacketWrapper::from_str(&packet_type)? {
        PacketWrapper::Header(_packet) => {
            start_dynamic_packet::<PacketHeader>(&state, id, port, baud, app).await
        }
        PacketWrapper::Payload(_packet) => {
            start_dynamic_packet::<PacketChecksum>(&state, id, port, baud, app).await
        }
    }
}

#[tauri::command]
pub async fn send_packet(
    state: State<'_, SerialManager>,
    id: String,
    wrapper_json: String, // JSON string passed from UI
) -> Result<(), String> {
    let wrapper: PacketWrapper = serde_json::from_str(&wrapper_json).map_err(|e| e.to_string())?;
    let encoded = wrapper.encode_prost()?;
    state.send_raw(&id, encoded).await
}

#[tauri::command]
pub async fn stop_connection(state: State<'_, SerialManager>, id: String) -> Result<(), String> {
    state.stop(&id).await;
    Ok(())
}

#[tauri::command]
pub fn list_serial_ports() -> Result<Vec<String>, String> {
    SerialManager::list_ports()
}

#[tauri::command]
pub async fn list_connections(
    state: State<'_, SerialManager>,
) -> Result<Vec<SerialConnectionInfo>, String> {
    Ok(state.list_connections().await)
}

#[tauri::command]
pub async fn start_share(
    state: State<'_, SerialManager>,
    from_id: String,
    to_id: String,
) -> Result<(), String> {
    state.start_share(from_id, to_id).await
}

#[tauri::command]
pub async fn stop_share(state: State<'_, SerialManager>) -> Result<(), String> {
    state.stop_share().await;
    Ok(())
}
