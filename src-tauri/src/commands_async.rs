use crate::{packet::PacketHeader, serial::SerialManager,};
use derivative::Derivative;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;
use std::sync::Arc;
use crate::zmq_server_tokio::ZmqManager;
use tracing::{info, instrument};

#[derive(Clone, Derivative, Default)]
#[derivative(Debug)]

pub struct AppState {
     #[derivative(Debug = "ignore")]
    pub serial: SerialManager,
     #[derivative(Debug = "ignore")]
    pub zmq: Arc<Mutex<Option<ZmqManager>>>,
}

#[tauri::command]
#[instrument(skip(app))]
pub async fn init_zmq(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    info!("init_zmq called");
    let mut zmq_lock = state.zmq.lock().await;
    if zmq_lock.is_none() {
        let manager = ZmqManager::new();
        manager.load_config(app);
        *zmq_lock = Some(manager);
    }
    Ok(())
}

#[tauri::command]
#[instrument(skip(app))]
pub async fn add_sub(id: String, topic: String, app: AppHandle, state: State<'_, AppState>) -> Result<bool, String> {
    info!("add_sub called: id={}, topic={}", id, topic);
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
#[instrument]
pub async fn remove_sub(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    info!("remove_sub called: id={}", id);
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
#[instrument]
pub async fn list_subs(state: State<'_, AppState>) -> Result<Vec<(String, String)>, String> {
    info!("list_subs called");
    let zmq_lock = state.zmq.lock().await;
    if let Some(manager) = &*zmq_lock {
        return Ok(manager.list_subscriptions().await);
    }
    Ok(vec![])
}

#[tauri::command]
#[instrument]
pub async fn list_subs_with_status(state: State<'_, AppState>) -> Result<Vec<(String, String, bool)>, String> {
    info!("list_subs_with_status called");
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
#[instrument]
pub async fn list_ports() -> Result<Vec<String>, String> {
    info!("list_ports called");
    SerialManager::list_ports()
}

#[tauri::command]
#[instrument(skip(app))]
pub async fn start_serial(
    state: State<'_, AppState>,
    port_name: String,
    app: AppHandle,
    baud_rate: u32,
) -> Result<(), String> {
    info!("start_serial called: port_name={}, baud_rate={}", port_name, baud_rate);
    let serial = state.serial.clone();
    serial
        .start(&port_name, baud_rate, move |packet: PacketHeader| {
            app.emit("serial_packet", packet).unwrap();
        })
        .await
}

#[tauri::command]
#[instrument]
pub async fn send_data(state: State<'_, AppState>, json: String) -> Result<(), String> {
    info!("send_data called: json={}", json);
    let packet: PacketHeader =
        serde_json::from_str(&json).map_err(|e| format!("Invalid JSON: {}", e))?;

    state.serial.send(packet).await
}

#[tauri::command]
#[instrument]
pub async fn disconnect(state: State<'_, AppState>) -> Result<(), String> {
    info!("disconnect called");
    state.serial.stop().await;
    Ok(())
}