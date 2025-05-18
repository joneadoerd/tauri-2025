use crate::{packet::PacketHeader, serial::SerialManager, zmq::ZmqManager};
use std::sync::Mutex;
use tauri::{AppHandle, State};
#[derive(Default)]
pub struct AppState {
    pub serial: SerialManager,
    pub zmq: Mutex<Option<ZmqManager>>,
}

#[tauri::command]
pub fn init_zmq(app: AppHandle, state: State<AppState>) {
    let mut zmq_state = state.zmq.lock().unwrap();
    if zmq_state.is_none() {
        let manager = ZmqManager::new();
        manager.load_config(app);
        *zmq_state = Some(manager);
    }
}

#[tauri::command]
pub fn add_sub(id: String, topic: String, app: AppHandle, state: State<AppState>) -> bool {
    if let Some(manager) = &*state.zmq.lock().unwrap() {
        if manager.add_subscription(id, topic, app) {
            manager.save_config();
            return true;
        }
    }
    false
}

#[tauri::command]
pub fn remove_sub(id: String, state: State<AppState>) -> bool {
    if let Some(manager) = &*state.zmq.lock().unwrap() {
        if manager.remove_subscription(id.as_str()) {
            manager.save_config();
            return true;
        }
    }
    false
}

#[tauri::command]
pub fn list_subs(state: State<AppState>) -> Vec<(String, String)> {
    if let Some(manager) = &*state.zmq.lock().unwrap() {
        return manager.list_subscriptions();
    }
    vec![]
}
#[tauri::command]
pub fn list_subs_with_status(state: State<AppState>) -> Vec<(String, String, bool)> {
    if let Some(manager) = &*state.zmq.lock().unwrap() {
        let subs = manager.subs.lock().unwrap();
        return subs
            .values()
            .map(|s| {
                let connected = *s.connected.lock().unwrap();
                (s.id.clone(), s.topic.clone(), connected)
            })
            .collect();
    }
    vec![]
}
#[tauri::command]
pub async fn list_ports() -> Result<Vec<String>, String> {
    SerialManager::list_ports()
}

#[tauri::command]
pub async fn start_serial(
    state: State<'_, AppState>,
    port_name: String,
    baud_rate: u32,
) -> Result<(), String> {
    let serial = state.serial.clone();
    serial
        .start(&port_name, baud_rate, |packet: PacketHeader| {
            println!("Frontend would receive: {:?}", packet);
            // TODO: Emit via Tauri app_handle.emit_all(...) if needed
        })
        .await
}

#[tauri::command]
pub async fn send_data(state: State<'_, AppState>, json: String) -> Result<(), String> {
    let packet: PacketHeader =
        serde_json::from_str(&json).map_err(|e| format!("Invalid JSON: {}", e))?;

    state.serial.send(packet).await
}

#[tauri::command]
pub async fn disconnect(state: State<'_, AppState>) -> Result<(), String> {
    state.serial.stop().await;
    Ok(())
}
