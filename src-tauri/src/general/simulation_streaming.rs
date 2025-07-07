use crate::general::serial::SerialManager;
use crate::general::simulation_commands::SimulationDataState;
use crate::simulation::{F16State, Position, SimulationResultList};
use prost::Message;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::time;
use tracing::{error, info, warn};
use tauri::{Emitter, Manager};
use base64;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetPosition {
    pub target_id: u32,
    pub lat: f64,
    pub lon: f64,
    pub alt: f64,
    pub time: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationStreamConfig {
    pub target_id: u32,
    pub serial_connection_id: String,
    pub stream_interval_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationStreamRequest {
    pub simulation_data: SimulationResultList,
    pub stream_configs: Vec<SimulationStreamConfig>,
    pub stream_interval_ms: u64,
}

pub struct SimulationStreamer {
    serial_manager: Arc<SerialManager>,
    active_streams: Arc<Mutex<HashMap<String, tokio::task::JoinHandle<()>>>>,
}

impl SimulationStreamer {
    pub fn new(serial_manager: Arc<SerialManager>) -> Self {
        Self {
            serial_manager,
            active_streams: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Start streaming simulation data to multiple serial connections
    /// Each target-connection pair runs in its own spawned task
    pub async fn start_simulation_streaming(
        &self,
        app_handle: tauri::AppHandle,
        request: SimulationStreamRequest,
    ) -> Result<(), String> {
        // Stop any existing streams first
        self.stop_all_streams().await;

        // Validate the request
        self.validate_stream_request(&request).await?;

        let stream_interval = Duration::from_millis(request.stream_interval_ms);
        let config_count = request.stream_configs.len();

        // Create a shared state for the simulation data
        let simulation_data = Arc::new(request.simulation_data);
        let serial_manager = self.serial_manager.clone();
        let active_streams = self.active_streams.clone();

        // Start a stream for each target-connection configuration
        for config in request.stream_configs {
            let target_id = config.target_id;
            let connection_id = config.serial_connection_id.clone();
            let interval_ms = config.stream_interval_ms;

            // Clone the data for this stream
            let sim_data = simulation_data.clone();
            let serial_mgr = serial_manager.clone();
            let streams = active_streams.clone();
            let connection_id_handle = connection_id.clone();
            let app_handle = app_handle.clone();

            // Spawn a task for this target-connection pair
            let task_handle = tokio::spawn(async move {
                Self::stream_target_to_connection(
                    app_handle,
                    target_id,
                    connection_id_handle.clone(),
                    sim_data,
                    serial_mgr,
                    interval_ms,
                )
                .await;
            });

            // Store the task handle
            let mut streams_guard = streams.lock().await;
            let stream_key = format!("{}_{}", target_id, connection_id.clone());
            streams_guard.insert(stream_key, task_handle);
        }

        info!(
            "Started simulation streaming for {} target-connection pairs",
            config_count
        );
        Ok(())
    }

    /// Stream a specific target's position data to a specific serial connection
    async fn stream_target_to_connection(
        app_handle: tauri::AppHandle,
        target_id: u32,
        connection_id: String,
        simulation_data: Arc<SimulationResultList>,
        serial_manager: Arc<SerialManager>,
        interval_ms: u64,
    ) {
        info!(
            "Starting stream for target {} to connection {}",
            target_id, connection_id
        );

        // Find the target data
        let target_data = simulation_data
            .results
            .iter()
            .find(|result| result.target_id == target_id);

        if let Some(target_result) = target_data {
            let mut current_step = 0;
            let total_steps = target_result.final_state.len();

            if total_steps == 0 {
                error!("No simulation data for target {}", target_id);
                return;
            }

            let interval = Duration::from_millis(interval_ms);
            let mut next_wake = time::Instant::now();

            loop {
                // Update next wake time
                next_wake += interval;

                // Get current position data
                if current_step < total_steps {
                    let state = &target_result.final_state[current_step];

                    // Create position message
                    let position = Position {
                        lat: state.lat,
                        lon: state.lon,
                        alt: state.alt,
                    };

                    // Encode and send the position data
                    let mut buf = Vec::new();
                    if let Ok(()) = position.encode(&mut buf) {
                        if let Err(e) = serial_manager.send_raw(&connection_id, buf.clone()).await {
                            error!("Failed to send position data to {}: {}", connection_id, e);
                            break;
                        }

                        info!(
                            "Sent position for target {} step {}/{} to {}: lat={:.6}, lon={:.6}, alt={:.1}",
                            target_id, current_step + 1, total_steps, connection_id,
                            state.lat, state.lon, state.alt
                        );

                        // Emit Tauri event to frontend
                        let event_payload = serde_json::json!({
                            "target_id": target_id,
                            "connection_id": connection_id,
                            "position": {
                                "lat": state.lat,
                                "lon": state.lon,
                                "alt": state.alt,
                            },
                            "step": current_step + 1,
                            "total_steps": total_steps,
                            "raw_data": base64::encode(&buf),
                        });
                        let _ = app_handle.emit("simulation_stream_update", event_payload);
                    } else {
                        error!("Failed to encode position data for target {}", target_id);
                        break;
                    }

                    current_step += 1;
                } else {
                    // Simulation complete for this target
                    info!(
                        "Simulation complete for target {} on connection {}",
                        target_id, connection_id
                    );
                    break;
                }

                // Sleep until next interval
                let now = time::Instant::now();
                if now < next_wake {
                    let sleep_time = next_wake - now;
                    time::sleep(sleep_time).await;
                }
            }
        } else {
            error!("Target {} not found in simulation data", target_id);
        }
    }

    /// Stop all active simulation streams
    pub async fn stop_all_streams(&self) {
        let mut streams_guard = self.active_streams.lock().await;

        for (stream_key, handle) in streams_guard.drain() {
            info!("Stopping simulation stream: {}", stream_key);
            handle.abort();
        }

        info!("Stopped all simulation streams");
    }

    /// Stop streaming for a specific target-connection pair
    pub async fn stop_stream(&self, target_id: u32, connection_id: &str) {
        let stream_key = format!("{}_{}", target_id, connection_id);
        let mut streams_guard = self.active_streams.lock().await;

        if let Some(handle) = streams_guard.remove(&stream_key) {
            info!("Stopping simulation stream: {}", stream_key);
            handle.abort();
        }
    }

    /// Get list of active streams
    pub async fn get_active_streams(&self) -> Vec<String> {
        let streams_guard = self.active_streams.lock().await;
        streams_guard.keys().cloned().collect()
    }

    /// Get available serial connections
    pub async fn get_available_connections(&self) -> Vec<String> {
        let connections = self.serial_manager.list_connections().await;
        connections.iter().map(|c| c.id.clone()).collect()
    }

    /// Get available targets from simulation data
    pub fn get_available_targets(simulation_data: &SimulationResultList) -> Vec<u32> {
        simulation_data
            .results
            .iter()
            .map(|r| r.target_id)
            .collect()
    }

    /// Validate stream request before starting
    pub async fn validate_stream_request(
        &self,
        request: &SimulationStreamRequest,
    ) -> Result<(), String> {
        // Check if simulation data is available
        if request.simulation_data.results.is_empty() {
            return Err("No simulation data available. Run a simulation first.".to_string());
        }

        // Check if stream configs are provided
        if request.stream_configs.is_empty() {
            return Err("No stream configurations provided.".to_string());
        }

        // Validate connections exist
        let available_connections = self.get_available_connections().await;
        for config in &request.stream_configs {
            if !available_connections.contains(&config.serial_connection_id) {
                return Err(format!(
                    "Serial connection '{}' not found. Available: {:?}",
                    config.serial_connection_id, available_connections
                ));
            }
        }

        // Validate target IDs exist in simulation data
        let available_targets = Self::get_available_targets(&request.simulation_data);
        for config in &request.stream_configs {
            if !available_targets.contains(&config.target_id) {
                return Err(format!(
                    "Target ID {} not found in simulation data. Available: {:?}",
                    config.target_id, available_targets
                ));
            }
        }

        // Validate stream intervals
        for config in &request.stream_configs {
            if config.stream_interval_ms < 10 {
                return Err(format!(
                    "Stream interval for target {} is too fast (minimum 10ms)",
                    config.target_id
                ));
            }
            if config.stream_interval_ms > 10000 {
                return Err(format!(
                    "Stream interval for target {} is too slow (maximum 10000ms)",
                    config.target_id
                ));
            }
        }

        Ok(())
    }
}

// Tauri commands for simulation streaming
#[tauri::command]
pub async fn start_simulation_streaming(
    app: tauri::AppHandle,
    request: SimulationStreamRequest,
    serial_manager: tauri::State<'_, Arc<SerialManager>>,
    streamer: tauri::State<'_, Arc<SimulationStreamer>>,
) -> Result<(), String> {
    streamer.start_simulation_streaming(app, request).await
}

#[tauri::command]
pub async fn stop_simulation_streaming(
    streamer: tauri::State<'_, Arc<SimulationStreamer>>,
) -> Result<(), String> {
    streamer.stop_all_streams().await;
    Ok(())
}

#[tauri::command]
pub async fn stop_target_stream(
    target_id: u32,
    connection_id: String,
    streamer: tauri::State<'_, Arc<SimulationStreamer>>,
) -> Result<(), String> {
    streamer.stop_stream(target_id, &connection_id).await;
    Ok(())
}

#[tauri::command]
pub async fn get_active_simulation_streams(
    streamer: tauri::State<'_, Arc<SimulationStreamer>>,
) -> Result<Vec<String>, String> {
    Ok(streamer.get_active_streams().await)
}

#[tauri::command]
pub async fn get_available_simulation_connections(
    streamer: tauri::State<'_, Arc<SimulationStreamer>>,
) -> Result<Vec<String>, String> {
    Ok(streamer.get_available_connections().await)
}

#[tauri::command]
pub async fn get_available_simulation_targets(
    simulation_data: tauri::State<'_, SimulationDataState>,
) -> Result<Vec<u32>, String> {
    let data_guard = simulation_data.lock().unwrap();
    if let Some(data) = data_guard.as_ref() {
        Ok(SimulationStreamer::get_available_targets(data))
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
pub async fn check_simulation_data_available(
    simulation_data: tauri::State<'_, SimulationDataState>,
) -> Result<bool, String> {
    let data_guard = simulation_data.lock().unwrap();
    Ok(data_guard.is_some() && data_guard.as_ref().unwrap().results.len() > 0)
}
