use crate::{
    general::{serial::SerialConnectionInfo, simulation::SimulationResultList},
    packet::{PacketChecksum, PacketHeader},
};
use base64::{engine::general_purpose, Engine as _};
use prost::Message;
use std::str::FromStr;
use tauri::{AppHandle, State};
use tauri_plugin_shell::ShellExt;

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
#[tauri::command]
pub async fn simulation(app: tauri::AppHandle, message: String) -> String {
    let sidecar_command = app
        .shell()
        .sidecar("sim")
        .unwrap()
        .arg("--unit")
        .arg("meter")
        .arg("--json")
        .arg(message);
    let output = sidecar_command.output().await.unwrap();
    let b64 = String::from_utf8(output.stdout).unwrap();
    let buffer = general_purpose::STANDARD.decode(b64.trim()).unwrap();

    // Remove debug output
    // Remove newlines from output.stdout before decoding

    if !output.status.success() {
        return String::from_utf8_lossy(&output.stderr).to_string();
    }
    // eprintln!("[DEBUG] Received bytes: {}", buffer.len());
    // eprintln!(
    //     "[DEBUG] First 64 bytes: {:02x?}",
    //     &buffer[..64.min(buffer.len())]
    // );
    // eprintln!(
    //     "[DEBUG] Last 64 bytes: {:02x?}",
    //     &buffer[buffer.len().saturating_sub(64)..]
    // );
    // Try decode
    match SimulationResultList::decode(&*buffer) {
        Ok(sim_results) => serde_json::to_string(&sim_results)
            .unwrap_or_else(|e| format!("Failed to serialize simulation results: {}", e)),
        Err(e) => format!("Failed to decode simulation output: {}", e),
    }
}
#[tauri::command]
pub async fn ping(app: tauri::AppHandle, message: String) -> String {
    let sidecar_command = app
        .shell()
        .sidecar("ping")
        .unwrap()
        .arg("ping")
        .arg(message);
    let output = sidecar_command.output().await.unwrap();
    let response = String::from_utf8(output.stdout).unwrap();
    response
}
