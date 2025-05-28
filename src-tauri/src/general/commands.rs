use prost::Message;
use tauri::{AppHandle, Emitter, State};

use crate::general::serial::SerialConnectionInfo;

use super::serial::SerialManager;

#[tauri::command]
pub async fn start_connection(
    state: State<'_, SerialManager>,
    id: String,
    port: String,
    app: AppHandle,
    baud: u32,
) -> Result<(), String> {
    state
        .start(id.clone(), port, baud, move |conn_id, packet| {
            // println!("[UI] Data from {}: {:?}", conn_id, packet);
            app.emit(format!("serial_packet_{}", conn_id).as_str(), packet)
                .unwrap();
        })
        .await
}

#[tauri::command]
pub async fn send_packet(
    state: State<'_, SerialManager>,
    id: String,
    json: Vec<u8>, // encoded prost::Message
) -> Result<(), String> {
    use crate::packet::PacketHeader; // Replace with your actual type
    let msg = PacketHeader::decode(&*json).map_err(|e| e.to_string())?;
    state.send(&id, msg).await
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
