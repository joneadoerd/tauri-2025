use crate::{packet::PacketHeader, serial::SerialManager,};
use tauri::{AppHandle, State};
use tokio::sync::Mutex;
use std::sync::Arc;
use crate::zmq_server_tokio::ZmqManager;

#[derive(Default)]
pub struct AppState {
    pub serial: SerialManager,
    pub zmq: Arc<Mutex<Option<ZmqManager>>>,
}

#[tauri::command]
pub async fn init_zmq(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let mut zmq_lock = state.zmq.lock().await;
    if zmq_lock.is_none() {
        let manager = ZmqManager::new();
        manager.load_config(app);
        *zmq_lock = Some(manager);
    }
    Ok(())
}

#[tauri::command]
pub async fn add_sub(id: String, topic: String, app: AppHandle, state: State<'_, AppState>) -> Result<bool, String> {
    let zmq_opt = state.zmq.lock().await;
    if let Some(manager) = &*zmq_opt {
        if manager.add_subscription(id, topic, app).await {
            manager.save_config().await;
            return Ok(true);
        }
    }
    Ok(false)
}

#[tauri::command]
pub async fn remove_sub(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    let zmq_lock = state.zmq.lock().await;
    if let Some(manager) = &*zmq_lock {
        if manager.remove_subscription(&id).await {
            manager.save_config().await;
            return Ok(true);
        }
    }
    Ok(false)
}

#[tauri::command]
pub async fn list_subs(state: State<'_, AppState>) -> Result<Vec<(String, String)>, String> {
    let zmq_lock = state.zmq.lock().await;
    if let Some(manager) = &*zmq_lock {
        return Ok(manager.list_subscriptions().await);
    }
    Ok(vec![])
}

#[tauri::command]
pub async fn list_subs_with_status(state: State<'_, AppState>) -> Result<Vec<(String, String, bool)>, String> {
    let zmq_lock = state.zmq.lock().await;
    if let Some(manager) = &*zmq_lock {
        let subs = manager.subs.lock().await;
        let result: Vec<_> = futures::future::join_all(
            subs.values().map(|s| async {
                let connected = s.connected.lock().await;
                (s.id.clone(), s.topic.clone(), *connected)
            })
        )
            .await;
        return Ok(result);
    }
    Ok(vec![])
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