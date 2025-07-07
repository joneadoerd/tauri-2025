use serde::{Deserialize, Serialize};
use tauri::Emitter;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::net::UdpSocket;
use tokio::sync::Mutex;
use std::net::SocketAddr;
use std::time::{Duration, Instant};
use tokio::time::interval;
use tokio::sync::mpsc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorData {
    pub sensor_id: u32,
    pub lat: f64,
    pub lon: f64,
    pub alt: f64,
    pub temp: f64,
}

pub type SharedSensorMap = Arc<Mutex<HashMap<u32, SensorData>>>;
pub type SharedClientAddrMap = Arc<Mutex<HashMap<u32, SocketAddr>>>;
pub type SharedLastSeenMap = Arc<Mutex<HashMap<u32, Instant>>>;

// Add a new mapping: target_id -> destination SocketAddr

lazy_static::lazy_static! {
    pub  static ref TARGET_UDP_ADDR_MAP: Arc<Mutex<HashMap<u32, SocketAddr>>> = Arc::new(Mutex::new(HashMap::new()));
    pub static ref FORWARDING_TASKS: crate::general::simulation_streaming::ForwardingMap = Arc::new(Mutex::new(HashMap::new()));
}

pub async fn start_udp_server(
    socket: Arc<UdpSocket>,
    sensor_map: SharedSensorMap,
    client_addr_map: SharedClientAddrMap,
    app_handle: tauri::AppHandle,
) {
    let last_seen_map: SharedLastSeenMap = Arc::new(Mutex::new(HashMap::new()));
    let last_seen_map_cleanup = last_seen_map.clone();
    let sensor_map_cleanup = sensor_map.clone();
    let client_addr_map_cleanup = client_addr_map.clone();

    // Spawn a cleanup task to remove stale clients
    tokio::spawn(async move {
        let mut cleanup_interval = interval(Duration::from_secs(2));
        loop {
            cleanup_interval.tick().await;
            let now = Instant::now();
            let mut last_seen = last_seen_map_cleanup.lock().await;
            let mut sensor_map = sensor_map_cleanup.lock().await;
            let mut client_addr_map = client_addr_map_cleanup.lock().await;
            let stale_ids: Vec<u32> = last_seen
                .iter()
                .filter(|(_, &t)| now.duration_since(t) > Duration::from_secs(5))
                .map(|(&id, _)| id)
                .collect();
            for id in &stale_ids {
                last_seen.remove(id);
                sensor_map.remove(id);
                client_addr_map.remove(id);
            }
        }
    });

    let mut buf = [0u8; 1024];
    loop {
        if let Ok((amt, src)) = socket.recv_from(&mut buf).await {
            if let Ok(msg) = std::str::from_utf8(&buf[..amt]) {
                // println!("UDP SERVER RECEIVED from {}: {}", src, msg);
                let parts: Vec<&str> = msg.trim().split(',').collect();
                if parts.len() == 5 {
                    // sensor_id,lat,lon,alt,temp (sensor data)
                    let parse = (
                        parts[0].parse::<u32>(),
                        parts[1].parse::<f64>(),
                        parts[2].parse::<f64>(),
                        parts[3].parse::<f64>(),
                        parts[4].parse::<f64>(),
                    );
                    if let (Ok(sensor_id), Ok(lat), Ok(lon), Ok(alt), Ok(temp)) = parse {
                        let data = SensorData { sensor_id, lat, lon, alt, temp };
                        let data_for_channels = data.clone();
                        sensor_map.lock().await.insert(sensor_id, data);
                        client_addr_map.lock().await.insert(sensor_id, src);
                        last_seen_map.lock().await.insert(sensor_id, Instant::now());
                        // Emit Tauri event for each mapped target
                        let map = crate::general::simulation_streaming::TARGET_SENSOR_MAP.lock().await;
                        for (&target_id, &mapped_sensor_id) in map.iter() {
                            if mapped_sensor_id == sensor_id {
                                let payload = serde_json::json!({
                                    "target_id": target_id,
                                    "sensor_id": sensor_id,
                                    "lat": lat,
                                    "lon": lon,
                                    "alt": alt,
                                    "temp": temp,
                                });
                                let _ = app_handle.emit("target_sensor_data", payload);
                                // Forward to the channel for this target
                                if let Some(channel) = crate::general::sensor_udp_server::FORWARDING_TASKS.lock().await.get(&target_id) {
                                    let _ = channel.sender.try_send(data_for_channels.clone());
                                }
                            }
                        }
                    } else {
                        eprintln!("[UDP] Malformed sensor data: {}", msg);
                    }
                } else if parts.len() == 6 {
                    // target_id,sensor_id,lat,lon,alt,temp (streaming data)
                    let parse = (
                        parts[0].parse::<u32>(),
                        parts[1].parse::<u32>(),
                        parts[2].parse::<f64>(),
                        parts[3].parse::<f64>(),
                        parts[4].parse::<f64>(),
                        parts[5].parse::<f64>(),
                    );
                    if let (Ok(target_id), Ok(sensor_id), Ok(lat), Ok(lon), Ok(alt), Ok(temp)) = parse {
                        let data = SensorData { sensor_id, lat, lon, alt, temp };
                        let data_for_channels = data.clone();
                        sensor_map.lock().await.insert(sensor_id, data);
                        client_addr_map.lock().await.insert(sensor_id, src);
                        last_seen_map.lock().await.insert(sensor_id, Instant::now());
                        // Emit Tauri event for this target
                        let payload = serde_json::json!({
                            "target_id": target_id,
                            "sensor_id": sensor_id,
                            "lat": lat,
                            "lon": lon,
                            "alt": alt,
                            "temp": temp,
                        });
                        let _ = app_handle.emit("target_sensor_data", payload);
                        // Forward mapped target data to another UDP client if mapped
                        let addr_map = crate::general::sensor_udp_server::TARGET_UDP_ADDR_MAP.lock().await;
                        if let Some(dest_addr) = addr_map.get(&target_id) {
                            let fwd_msg = format!("{},{},{},{},{},{}", target_id, sensor_id, lat, lon, alt, temp);
                            if let Err(e) = socket.send_to(fwd_msg.as_bytes(), dest_addr).await {
                                eprintln!("[UDP] Forwarding error: {}", e);
                            }
                        }
                    } else {
                        eprintln!("[UDP] Malformed streaming data: {}", msg);
                    }
                } else {
                    eprintln!("[UDP] Unknown data format: {}", msg);
                }
            }
        }
    }
}

// Send a command to a sensor and wait for a response (with timeout)
pub async fn send_command_to_sensor(
    socket: Arc<UdpSocket>,
    client_addr_map: SharedClientAddrMap,
    sensor_id: u32,
    command: &str,
) -> Result<String, String> {
    use tokio::time::{timeout, Duration};
    let addr = {
        let map = client_addr_map.lock().await;
        map.get(&sensor_id).cloned()
    };
    let addr = addr.ok_or("Sensor client not found")?;
    socket.send_to(command.as_bytes(), addr).await.map_err(|e| e.to_string())?;
    let mut buf = [0u8; 1024];
    // Wait for a response from this client (with timeout)
    let fut = async {
        loop {
            if let Ok((amt, src)) = socket.recv_from(&mut buf).await {
                if src == addr {
                    if let Ok(msg) = std::str::from_utf8(&buf[..amt]) {
                        return Ok(msg.to_string());
                    }
                }
            }
        }
    };
    timeout(Duration::from_secs(2), fut).await.map_err(|_| "Timeout waiting for response".to_string())?
}

pub async fn get_udp_sensor_clients(sensor_map: SharedSensorMap) -> Vec<SensorData> {
    let map = sensor_map.lock().await;
    map.values().cloned().collect()
}

pub async fn get_udp_sensor_client_by_id(sensor_id: u32, sensor_map: SharedSensorMap) -> Option<SensorData> {
    let map = sensor_map.lock().await;
    map.get(&sensor_id).cloned()
}
