use crate::general::sensor_udp_server::{start_udp_server, SensorData, SharedSensorMap};

use crate::general::simulation_commands::SimulationDataState;
#[cfg(windows)]
use crate::general::timer_res::win_timer;
use crate::packet::{Packet, PacketHeader};
use crate::simulation::SimulationResultList;
use crate::transport::connection_manager::Manager;
use crate::SENSOR_MAP;
use base64;
use once_cell::sync::Lazy;
use prost::Message;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tauri::Emitter;
use tokio::sync::mpsc;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;
use tokio::time;
use tracing::{error, info};

pub struct ForwardingChannel {
    pub sender: mpsc::Sender<SensorData>,
    pub handle: tokio::task::JoinHandle<()>,
}
pub type ForwardingMap = Arc<Mutex<HashMap<u32, ForwardingChannel>>>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetPacketHeader {
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
pub enum DataSourceType {
    Simulation,
    Sensor,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationStreamRequest {
    pub simulation_data: SimulationResultList,
    pub stream_configs: Vec<SimulationStreamConfig>,
    pub stream_interval_ms: u64,
    pub data_source: DataSourceType,
}

pub trait TargetDataSource: Send + Sync {
    fn get_next(&mut self, target_id: u32) -> Option<PacketHeader>;
}

pub struct SimulationDataSource {
    target_result: Option<crate::simulation::SimulationResult>,
    current_step: usize,
}

impl SimulationDataSource {
    pub fn new(simulation_data: &SimulationResultList, target_id: u32) -> Self {
        let target_result = simulation_data
            .results
            .iter()
            .find(|r| r.target_id == target_id)
            .cloned();
        Self {
            target_result,
            current_step: 0,
        }
    }
}

impl TargetDataSource for SimulationDataSource {
    fn get_next(&mut self, _target_id: u32) -> Option<PacketHeader> {
        if let Some(ref result) = self.target_result {
            if self.current_step < result.final_state.len() {
                let state = &result.final_state[self.current_step];
                self.current_step += 1;
                Some(PacketHeader {
                    id: state.alpha as u32,
                    length: state.alt as u32,
                    checksum: state.lon as u32,
                    version: state.lat as u32,
                    flags: state.psi as u32,
                })
            } else {
                None
            }
        } else {
            None
        }
    }
}

pub struct SensorDataSource {
    sensor_id: u32,
    sensor_map: SharedSensorMap,
}

impl SensorDataSource {
    pub fn new(sensor_id: u32, sensor_map: SharedSensorMap) -> Self {
        Self {
            sensor_id,
            sensor_map,
        }
    }
}

impl TargetDataSource for SensorDataSource {
    fn get_next(&mut self, _target_id: u32) -> Option<PacketHeader> {
        let map = self.sensor_map.blocking_lock();
        map.get(&self.sensor_id).map(|data| PacketHeader {
            id: data.sensor_id,
            length: data.alt as u32,
            checksum: data.lon as u32,
            version: data.lat as u32,
            flags: data.temp as u32,
        })
    }
}

pub struct SimulationStreamer {
    serial_manager: Arc<Manager>,
    active_streams: Arc<Mutex<HashMap<String, tokio::task::JoinHandle<()>>>>,
}

impl SimulationStreamer {
    pub fn new(serial_manager: Arc<Manager>) -> Self {
        // UDP server is started in main.rs, so no need to start it here.
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

        let config_count = request.stream_configs.len();
        let serial_manager = self.serial_manager.clone();
        let active_streams = self.active_streams.clone();
        let simulation_data = Arc::new(request.simulation_data.clone());

        // Start a stream for each target-connection configuration
        for config in request.stream_configs {
            let target_id = config.target_id;
            let connection_id = config.serial_connection_id.clone();
            let interval_ms = config.stream_interval_ms;
            let serial_mgr = serial_manager.clone();
            let streams = active_streams.clone();
            let connection_id_handle = connection_id.clone();
            let app_handle = app_handle.clone();
            // Choose data source
            let sensor_map = SENSOR_MAP
                .get()
                .expect("Sensor map not initialized")
                .clone();

            let data_source: Box<dyn TargetDataSource> = match request.data_source {
                DataSourceType::Simulation => {
                    Box::new(SimulationDataSource::new(&simulation_data, target_id))
                }
                DataSourceType::Sensor => Box::new(SensorDataSource::new(target_id, sensor_map)),
            };
            let task_handle = tokio::spawn(async move {
                Self::stream_target_to_connection(
                    app_handle,
                    target_id,
                    connection_id_handle.clone(),
                    data_source,
                    serial_mgr,
                    interval_ms,
                )
                .await;
            });
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

    /// Stream a specific target's PacketHeader data to a specific serial connection
    async fn stream_target_to_connection(
        app_handle: tauri::AppHandle,
        target_id: u32,
        connection_id: String,
        mut data_source: Box<dyn TargetDataSource>,
        serial_manager: Arc<Manager>,
        interval_ms: u64,
    ) {
        info!(
            "Starting stream for target {} to connection {}",
            target_id, connection_id
        );

        #[cfg(windows)]
        if let Err(e) = win_timer::enable() {
            error!("Timer resolution error: {}", e);
            return;
        }

        let interval = Duration::from_millis(interval_ms);
        let mut next_wake = time::Instant::now();
        let mut step = 0;

        let result = async {
            loop {
                next_wake += interval;

                if let Some(packet_header) = data_source.get_next(target_id) {
                    let mut buf = Vec::new();
                    let data = Packet {
                        kind: Some(crate::packet::packet::Kind::Header(packet_header)),
                    };
                    if let Ok(()) = data.encode(&mut buf) {
                        if let Err(e) = serial_manager.send_to(&connection_id, buf.clone()).await {
                            error!(
                                "Failed to send PacketHeader data to {}: {}",
                                connection_id, e
                            );
                            break;
                        }

                        step += 1;
                        let event_payload = serde_json::json!({
                            "target_id": target_id,
                            "connection_id": connection_id,
                            "PacketHeader": {
                                "id": packet_header.id,
                                "length": packet_header.length,
                                "checksum": packet_header.checksum,
                                "version": packet_header.version,
                                "flags": packet_header.flags
                            },
                            "step": step,
                            "total_steps": 0,
                            "raw_data": base64::encode(&buf),
                        });
                        let _ = app_handle.emit("simulation_stream_update", event_payload);
                    } else {
                        error!(
                            "Failed to encode PacketHeader data for target {}",
                            target_id
                        );
                        break;
                    }
                } else {
                    info!(
                        "No more data for target {} on connection {}",
                        target_id, connection_id
                    );
                    break;
                }

                let now = time::Instant::now();
                if now < next_wake {
                    let sleep_time = next_wake - now - Duration::from_micros(1500);
                    if !sleep_time.is_zero() {
                        time::sleep(sleep_time).await;
                    }

                    #[cfg(windows)]
                    while time::Instant::now() < next_wake {
                        std::hint::spin_loop();
                    }
                }
            }
        };

        result.await;

        #[cfg(windows)]
        win_timer::disable();
    }

    /// Stop all active simulation streams
    pub async fn stop_all_streams(&self) {
        let mut streams_guard = self.active_streams.lock().await;

        for (stream_key, handle) in streams_guard.drain() {
            info!("Stopping simulation stream: {}", stream_key);

            handle.abort();
        }
        #[cfg(windows)]
        win_timer::disable();
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
        #[cfg(windows)]
        win_timer::disable();
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

// --- Sensor Streaming (UDP to Serial) ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorStreamConfig {
    pub sensor_id: u32,
    pub serial_connection_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorStreamRequest {
    pub stream_configs: Vec<SensorStreamConfig>,
    // Optionally, add interval_ms if you want to make it configurable
}

pub struct SensorStreamer {
    serial_manager: Arc<Manager>,
    active_streams: Arc<Mutex<HashMap<String, tokio::task::JoinHandle<()>>>>,
}

impl SensorStreamer {
    pub fn new(serial_manager: Arc<Manager>) -> Self {
        Self {
            serial_manager,
            active_streams: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn start_sensor_streaming(
        &self,
        request: SensorStreamRequest,
        app_handle: tauri::AppHandle,
    ) -> Result<(), String> {
        self.stop_all_streams().await;
        let serial_manager = self.serial_manager.clone();
        let active_streams = self.active_streams.clone();
        let sensor_map = SENSOR_MAP
            .get()
            .expect("Sensor map not initialized")
            .clone();
        for config in request.stream_configs {
            let sensor_id = config.sensor_id;
            let connection_id = config.serial_connection_id.clone();
            let serial_mgr = serial_manager.clone();
            let streams = active_streams.clone();
            let sensor_map = sensor_map.clone();
            let connection_id_handle = connection_id.clone();
            let app_handle = app_handle.clone();
            let task_handle = tokio::spawn(async move {
                loop {
                    // Get latest sensor data
                    let data = {
                        let map = sensor_map.lock().await;
                        map.get(&sensor_id).cloned()
                    };
                    if let Some(sensor) = data {
                        let packet_header = PacketHeader {
                            id: sensor_id,
                            length: sensor.alt as u32,
                            checksum: sensor.lon as u32,
                            version: sensor.lat as u32,
                            flags: sensor.temp as u32,
                        };
                        let mut buf = Vec::new();
                        let data = Packet {
                            kind: Some(crate::packet::packet::Kind::Header(packet_header)),
                        };
                        if let Ok(()) = data.encode(&mut buf) {
                            let _ = serial_mgr.send_to(&connection_id_handle, buf.clone()).await;
                            // Emit debug event for frontend log

                            let event_payload = serde_json::json!({
                                "target_id": sensor_id,
                                "connection_id": connection_id_handle,
                                "PacketHeader": {
                                    "lat": sensor.lat,
                                    "lon": sensor.lon,
                                    "alt": sensor.alt,
                                },
                                "step": 0,
                                "total_steps": 0,
                                "raw_data": base64::encode(&buf),
                            });
                            let _ = app_handle.emit("simulation_stream_update", event_payload);
                        }
                    }
                    tokio::time::sleep(Duration::from_millis(100)).await;
                }
            });
            let mut streams_guard = streams.lock().await;
            let stream_key = format!("{}_{}", sensor_id, connection_id.clone());
            streams_guard.insert(stream_key, task_handle);
        }
        Ok(())
    }

    pub async fn stop_all_streams(&self) {
        let mut streams_guard = self.active_streams.lock().await;

        for (stream_key, handle) in streams_guard.drain() {
            info!("Stopping Sensor stream: {}", stream_key);
            handle.abort();
        }

        info!("Stopped all Sensor streams");
    }

    pub async fn stop_stream(&self, sensor_id: u32, connection_id: &str) {
        let stream_key = format!("{}_{}", sensor_id, connection_id);
        let mut streams_guard = self.active_streams.lock().await;

        if let Some(handle) = streams_guard.remove(&stream_key) {
            info!("Stopping Sensor stream: {}", stream_key);
            handle.abort();
        }
    }

    pub async fn get_active_streams(&self) -> Vec<String> {
        let streams_guard = self.active_streams.lock().await;
        streams_guard.keys().cloned().collect()
    }
}

// --- Tauri commands for sensor streaming ---
#[tauri::command]
pub async fn start_sensor_streaming(
    app_handle: tauri::AppHandle,
    request: SensorStreamRequest,
    sensor_streamer: tauri::State<'_, Arc<SensorStreamer>>,
) -> Result<(), String> {
    sensor_streamer
        .start_sensor_streaming(request, app_handle)
        .await
}

#[tauri::command]
pub async fn stop_sensor_streaming(
    sensor_streamer: tauri::State<'_, Arc<SensorStreamer>>,
) -> Result<(), String> {
    sensor_streamer.stop_all_streams().await;
    Ok(())
}

#[tauri::command]
pub async fn stop_sensor_target_stream(
    sensor_id: u32,
    connection_id: String,
    sensor_streamer: tauri::State<'_, Arc<SensorStreamer>>,
) -> Result<(), String> {
    sensor_streamer.stop_stream(sensor_id, &connection_id).await;
    Ok(())
}

#[tauri::command]
pub async fn get_active_sensor_streams(
    sensor_streamer: tauri::State<'_, Arc<SensorStreamer>>,
) -> Result<Vec<String>, String> {
    Ok(sensor_streamer.get_active_streams().await)
}

#[tauri::command]
pub async fn send_sensor_command(
    sensor_id: u32,
    command: String,
    udp_socket: tauri::State<'_, Arc<tokio::net::UdpSocket>>,
    client_addr_map: tauri::State<'_, crate::general::sensor_udp_server::SharedClientAddrMap>,
) -> Result<String, String> {
    crate::general::sensor_udp_server::send_command_to_sensor(
        udp_socket.inner().clone(),
        client_addr_map.inner().clone(),
        sensor_id,
        &command,
    )
    .await
}

#[tauri::command]
pub async fn map_udp_sensor_target(
    sensor_id: u32,
    target_id: u32,
    udp_socket: tauri::State<'_, Arc<tokio::net::UdpSocket>>,
    client_addr_map: tauri::State<'_, crate::general::sensor_udp_server::SharedClientAddrMap>,
) -> Result<(), String> {
    let addr = {
        let map = client_addr_map.lock().await;
        map.get(&sensor_id).cloned()
    };
    let addr = addr.ok_or("Sensor client not found")?;
    // let msg = format!("map:{}", target_id);
    // udp_socket.send_to(msg.as_bytes(), addr).await.map_err(|e| e.to_string())?;
    // Update backend mapping
    TARGET_SENSOR_MAP.lock().await.insert(target_id, sensor_id);

    // Spawn forwarding task
    let udp_socket = udp_socket.inner().clone();

    let (sender, mut receiver) = mpsc::channel(100); // Create a channel for data
    let handle = tokio::spawn(async move {
        loop {
            let data: SensorData = receiver.recv().await.unwrap(); // Explicit type annotation
            let msg = format!(
                "{},{},{},{},{}",
                target_id, data.lat, data.lon, data.alt, data.temp
            );
            println!("{:?}", msg);
            let _ = udp_socket.send_to(msg.as_bytes(), addr).await;
        }
    });
    let channel = ForwardingChannel { sender, handle };
    crate::general::sensor_udp_server::FORWARDING_TASKS
        .lock()
        .await
        .insert(target_id, channel);

    Ok(())
}

#[tauri::command]
pub async fn unmap_udp_sensor_target(
    sensor_id: u32,
    udp_socket: tauri::State<'_, Arc<tokio::net::UdpSocket>>,
    client_addr_map: tauri::State<'_, crate::general::sensor_udp_server::SharedClientAddrMap>,
) -> Result<(), String> {
    let addr = {
        let map = client_addr_map.lock().await;
        map.get(&sensor_id).cloned()
    };
    let addr = addr.ok_or("Sensor client not found")?;
    let msg = "unmap";
    udp_socket
        .send_to(msg.as_bytes(), addr)
        .await
        .map_err(|e| e.to_string())?;
    // Remove all mappings for this sensor
    let mut map = TARGET_SENSOR_MAP.lock().await;
    let targets: Vec<u32> = map
        .iter()
        .filter_map(|(&t, &s)| if s == sensor_id { Some(t) } else { None })
        .collect();
    for target_id in &targets {
        if let Some(channel) = crate::general::sensor_udp_server::FORWARDING_TASKS
            .lock()
            .await
            .remove(target_id)
        {
            channel.handle.abort();
        }
        map.remove(target_id);
    }
    Ok(())
}

#[tauri::command]
pub async fn set_target_udp_addr(target_id: u32, addr: String) -> Result<(), String> {
    use crate::general::sensor_udp_server::TARGET_UDP_ADDR_MAP;
    use std::net::SocketAddr;
    let addr: SocketAddr = addr
        .parse()
        .map_err(|e| format!("Invalid address: {}", e))?;
    TARGET_UDP_ADDR_MAP.lock().await.insert(target_id, addr);
    Ok(())
}

// --- API Documentation ---
// start_sensor_streaming(SensorStreamRequest) - Start streaming UDP sensor data to serial
// stop_sensor_streaming() - Stop all sensor streams
// stop_sensor_target_stream(sensor_id, connection_id) - Stop a specific sensor stream
// get_active_sensor_streams() - List active sensor-to-serial streams
//
// SensorStreamRequest: { stream_configs: [{ sensor_id, serial_connection_id }] }

// Tauri commands for simulation streaming
#[tauri::command]
pub async fn start_simulation_streaming(
    app_handle: tauri::AppHandle,
    request: SimulationStreamRequest,

    streamer: tauri::State<'_, Arc<SimulationStreamer>>,
) -> Result<(), String> {
    streamer
        .start_simulation_streaming(app_handle, request)
        .await
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

#[tauri::command]
pub async fn get_udp_sensor_clients() -> Result<Vec<SensorData>, String> {
    let map = SENSOR_MAP
        .get()
        .expect("Sensor map not initialized")
        .clone();
    Ok(crate::general::sensor_udp_server::get_udp_sensor_clients(map).await)
}

pub static TARGET_SENSOR_MAP: Lazy<Arc<Mutex<HashMap<u32, u32>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));
