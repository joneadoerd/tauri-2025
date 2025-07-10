use crate::{
    general::serial::SerialConnectionInfo,
    packet::SerialPacketEvent,
};

use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

use super::serial::SerialManager;
use crate::packet::Packet;
use uuid::Uuid;
use std::collections::HashMap;
use std::path::Path;
use std::env;

// Helper function to get Tauri app root directory
fn get_app_root() -> std::path::PathBuf {
    if let Ok(exe_path) = env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            parent.to_path_buf()
        } else {
            Path::new(".").to_path_buf()
        }
    } else {
        Path::new(".").to_path_buf()
    }
}

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
pub async fn get_saved_data(
    state: State<'_, Arc<SerialManager>>,
    connection_id: String,
) -> Result<Vec<String>, String> {
    Ok(state.get_saved_data(&connection_id).await)
}

#[tauri::command]
pub async fn clear_saved_data(
    state: State<'_, Arc<SerialManager>>,
    connection_id: String,
) -> Result<(), String> {
    state.clear_saved_data(&connection_id).await;
    Ok(())
}

#[tauri::command]
pub async fn get_all_saved_data(
    state: State<'_, Arc<SerialManager>>,
) -> Result<HashMap<String, Vec<String>>, String> {
    Ok(state.get_all_saved_data().await)
}

#[tauri::command]
pub async fn get_storage_stats(
    state: State<'_, Arc<SerialManager>>,
) -> Result<HashMap<String, usize>, String> {
    Ok(state.get_storage_stats().await)
}

#[tauri::command]
pub async fn clear_all_saved_data(
    state: State<'_, Arc<SerialManager>>,
) -> Result<(), String> {
    state.clear_all_saved_data().await;
    Ok(())
}

#[tauri::command]
pub async fn read_log_file(connection_id: String) -> Result<Vec<String>, String> {
    // Get Tauri app root directory
    let app_root = get_app_root();
    
    let filename = app_root.join("logs").join(format!("connection_{}.log", connection_id));
    match std::fs::read_to_string(&filename) {
        Ok(content) => {
            let lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
            Ok(lines)
        }
        Err(e) => {
            Err(format!("Failed to read log file {:?}: {}", filename, e))
        }
    }
}

#[tauri::command]
pub async fn list_log_files() -> Result<Vec<String>, String> {
    // Get Tauri app root directory
    let app_root = get_app_root();
    
    let log_dir = app_root.join("logs");
    if !log_dir.exists() {
        return Ok(vec![]);
    }
    
    match std::fs::read_dir(&log_dir) {
        Ok(entries) => {
            let mut files = Vec::new();
            for entry in entries {
                if let Ok(entry) = entry {
                    if let Some(file_name) = entry.file_name().to_str() {
                        if file_name.ends_with(".log") {
                            files.push(file_name.to_string());
                        }
                    }
                }
            }
            Ok(files)
        }
        Err(e) => {
            Err(format!("Failed to read logs directory {:?}: {}", log_dir, e))
        }
    }
}

#[tauri::command]
pub async fn get_logs_directory() -> Result<String, String> {
    let app_root = get_app_root();
    let log_dir = app_root.join("logs");
    Ok(log_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_app_root_directory() -> Result<String, String> {
    let app_root = get_app_root();
    Ok(app_root.to_string_lossy().to_string())
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
