use crate::simulation::{Simulation, SimulationResultList};
use base64::{engine::general_purpose, Engine as _};

use prost::Message;
use tokio::sync::Mutex;
use std::sync::{Arc};
use tauri::State;
use tauri_plugin_shell::ShellExt;

pub type SimulationDataState = Arc<Mutex<Option<SimulationResultList>>>;

#[tauri::command]
pub async fn simulation(
    app: tauri::AppHandle,
    sim: Simulation,
    sim_state: State<'_, SimulationDataState>,
) -> Result<String, String> {
    let sidecar_command = app
        .shell()
        .sidecar("sim")
        .unwrap()
        .arg("--json")
        .arg(serde_json::to_string(&sim).map_err(|e| e.to_string())?);
    let output = sidecar_command.output().await.unwrap();
    let b64 = String::from_utf8(output.stdout).unwrap();
    let buffer = general_purpose::STANDARD.decode(b64.trim()).unwrap();
    eprintln!("[DEBUG] Decoded bytes: {}", buffer.len());
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    match SimulationResultList::decode(&*buffer) {
        Ok(sim_results) => {
            // Save to state
            let mut state = sim_state.lock().await;
            *state = Some(sim_results.clone());
            Ok(serde_json::to_string(&sim_results)
                .unwrap_or_else(|e| format!("Failed to serialize simulation results: {}", e)))
        }
        Err(e) => Err(format!("Failed to decode simulation output: {}", e)),
    }
}

#[tauri::command]
pub async fn get_simulation_data(
    sim_state: State<'_, SimulationDataState>,
) -> Result<Option<SimulationResultList>, String> {
    let state = sim_state.lock().await;
    Ok(state.clone())
}

#[tauri::command]
pub async fn clear_simulation_data(sim_state: State<'_, SimulationDataState>) -> Result<(), String> {
    let mut state = sim_state.lock().await;
    *state = None;
    Ok(())
}