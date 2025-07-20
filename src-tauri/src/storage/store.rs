use crate::general::simulation_commands::SimulationDataState;
use crate::simulation::SimulationResultList;
use crate::transport::commands::{start_connection, start_udp_connection};
use crate::transport::ConnectionInfo;
use crate::transport::{commands::set_udp_remote_addr, connection_manager::Manager};
use serde::{Deserialize, Serialize};
use serde_json;
use std::fs;
use tauri::AppHandle;
use tauri_plugin_store::StoreBuilder;

const MANAGER_STORE_FILE: &str = "manager_state.bin";
const SIM_STORE_FILE: &str = "simulation_state.bin";

#[derive(Serialize, Deserialize, Default, Debug)]
pub struct SerializableManager {
    pub connections: Vec<ConnectionInfo>,
}

impl SerializableManager {
    pub async fn from_manager(manager: &Manager) -> Self {
        let connections = manager.list_connections().await;
        SerializableManager { connections }
    }
}

#[tauri::command]
pub async fn save_manager_state(
    manager: tauri::State<'_, Manager>,
    app: AppHandle,
) -> Result<(), String> {
    let data_dir = tauri::Manager::path(&app)
        .app_local_data_dir()
        .map_err(|e| {
            let msg = format!("Could not resolve app local data dir: {e}");
            println!("{msg}");
            msg
        })?;
    let store = StoreBuilder::new(&app, data_dir.join(MANAGER_STORE_FILE))
        .build()
        .map_err(|e| {
            let msg = format!("Store build error: {e}");
            println!("{msg}");
            msg
        })?;
    let serializable = SerializableManager::from_manager(&manager).await;
    let value = serde_json::to_value(&serializable).map_err(|e| {
        let msg = format!("Serialization error: {e}");
        println!("{msg}");
        msg
    })?;
    store.set("manager", value);
    store.save().map_err(|e| {
        let msg = format!("Store save error: {e}");
        println!("{msg}");
        msg
    })?;
    Ok(())
}

#[tauri::command]
pub async fn load_manager_state(app: AppHandle) -> Result<SerializableManager, String> {
    let data_dir = tauri::Manager::path(&app)
        .app_local_data_dir()
        .map_err(|e| {
            let msg = format!("Could not resolve app local data dir: {e}");
            println!("{msg}");
            msg
        })?;
    let store = StoreBuilder::new(&app, data_dir.join(MANAGER_STORE_FILE))
        .build()
        .map_err(|e| {
            let msg = format!("Store build error: {e}");
            println!("{msg}");
            msg
        })?;
    store.reload().map_err(|e| {
        let msg = format!("Store reload error: {e}");
        println!("{msg}");
        msg
    })?;
    if let Some(loaded) = store.get("manager") {
        let loaded: SerializableManager = serde_json::from_value(loaded.clone()).map_err(|e| {
            let msg = format!("Deserialization error: {e}");
            println!("{msg}");
            msg
        })?;
        Ok(loaded)
    } else {
        let msg = "No manager state found in store".to_string();
        println!("{msg}");
        Err(msg)
    }
}

#[tauri::command]
pub async fn restore_all_connections(app: AppHandle) -> Result<(), String> {
    let manager_state = load_manager_state(app.clone()).await?;
    let manager = tauri::Manager::state::<Manager>(&app);
    for conn in manager_state.connections {
        match conn.connection_type {
            Some(crate::transport::ConnectionType::Serial) => {
                if let (Some(port), Some(baud_rate)) = (conn.port.clone(), conn.baud_rate) {
                    // Use id directly
                    let _ = start_connection(
                        manager.clone(),
                        conn.id.clone(),
                        port,
                        baud_rate,
                        app.clone(),
                    )
                    .await;
                }
            }
            Some(crate::transport::ConnectionType::Udp) => {
                if let Some(local_addr) = conn.local_addr.clone() {
                    let _ = start_udp_connection(
                        manager.clone(),
                        conn.id.clone(),
                        local_addr,
                        app.clone(),
                    )
                    .await;
                }
                let _ = set_udp_remote_addr(
                    manager.clone(),
                    conn.id.clone(),
                    conn.remote_addr.unwrap_or_default().clone(),
                )
                .await;
            }
            None => {}
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn save_simulation_state(
    sim_state: tauri::State<'_, SimulationDataState>,
    app: AppHandle,
) -> Result<(), String> {
    let data_dir = tauri::Manager::path(&app)
        .app_local_data_dir()
        .map_err(|e| {
            let msg = format!("Could not resolve app local data dir: {e}");
            println!("{msg}");
            msg
        })?;
    let store = StoreBuilder::new(&app, data_dir.join(SIM_STORE_FILE))
        .build()
        .map_err(|e| {
            let msg = format!("Store build error: {e}");
            println!("{msg}");
            msg
        })?;
    let sim = sim_state.lock().await.clone();
    let value = serde_json::to_value(&sim).map_err(|e| {
        let msg = format!("Serialization error: {e}");
        println!("{msg}");
        msg
    })?;
    store.set("simulation", value);
    store.save().map_err(|e| {
        let msg = format!("Store save error: {e}");
        println!("{msg}");
        msg
    })?;
    Ok(())
}

#[tauri::command]
pub async fn load_simulation_state(
    sim_state: tauri::State<'_, SimulationDataState>,
    app: AppHandle,
) -> Result<(), String> {
    let data_dir = tauri::Manager::path(&app)
        .app_local_data_dir()
        .map_err(|e| {
            let msg = format!("Could not resolve app local data dir: {e}");
            println!("{msg}");
            msg
        })?;
    let store = StoreBuilder::new(&app, data_dir.join(SIM_STORE_FILE))
        .build()
        .map_err(|e| {
            let msg = format!("Store build error: {e}");
            println!("{msg}");
            msg
        })?;
    store.reload().map_err(|e| {
        let msg = format!("Store reload error: {e}");
        println!("{msg}");
        msg
    })?;
    if let Some(loaded) = store.get("simulation") {
        let loaded: Option<SimulationResultList> =
            serde_json::from_value(loaded.clone()).map_err(|e| {
                let msg = format!("Deserialization error: {e}");
                println!("{msg}");
                msg
            })?;
        *sim_state.lock().await = loaded;
        Ok(())
    } else {
        let msg = "No simulation state found in store".to_string();
        println!("{msg}");
        Err(msg)
    }
}

#[tauri::command]
pub async fn reset_store(app: AppHandle) -> Result<(), String> {
    let data_dir = tauri::Manager::path(&app)
        .app_local_data_dir()
        .map_err(|e| {
            let msg = format!("Could not resolve app local data dir: {e}");
            println!("{msg}");
            msg
        })?;
    let manager_path = data_dir.join(MANAGER_STORE_FILE);
    let sim_path = data_dir.join(SIM_STORE_FILE);
    let mut errors = vec![];
    if manager_path.exists() {
        if let Err(e) = fs::remove_file(&manager_path) {
            let msg = format!("Failed to remove manager store: {e}");
            println!("{msg}");
            errors.push(msg);
        }
    }
    if sim_path.exists() {
        if let Err(e) = fs::remove_file(&sim_path) {
            let msg = format!("Failed to remove simulation store: {e}");
            println!("{msg}");
            errors.push(msg);
        }
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}
