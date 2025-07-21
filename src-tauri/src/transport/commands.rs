use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use crate::general::simulation_commands::SimulationDataState;
use crate::packet::TargetPacket;
use crate::packet::{packet::Kind, Packet, SerialPacketEvent};
use crate::storage::file_logger::save_packet_fast;
use crate::transport::connection_manager::Manager;

use crate::transport::serial::SerialTransport;
use crate::transport::udp::UdpTransport;
use crate::transport::{ConnectionInfo, StatableTransport};

use prost::Message;
use std::collections::HashMap;
use tauri::{AppHandle, Emitter, State};
use tokio::time;
use uuid::Uuid;

use crate::packet::{Lla, Ned};
use crate::transport::convert::lla_to_ned;

#[tauri::command]
pub async fn start_connection(
    state: State<'_, Manager>,
    id: String,
    port: String,
    baud: u32,
    app: AppHandle,
) -> Result<(), String> {
    let mut transport = SerialTransport::new(port, baud);

    transport
        .start::<Packet>(id.clone(), move |conn_id: String, packet: Packet| {
            // Emit only the general event with id and packet
            let event = SerialPacketEvent {
                id: conn_id.clone(),
                packet: Some(packet.clone()),
            };
            let _ = app.emit("serial_packet", event);
            save_packet_fast(&conn_id, &packet);
        })
        .await
        .unwrap();

    state
        .add_connection(
            id.clone(),
            Arc::new(transport) as Arc<dyn crate::transport::Transport + Send + Sync>,
        )
        .await
        .map_err(|e| format!("Failed to add connection: {}", e))?;

    Ok(())
}

/// Start sharing data from one serial connection to another by connection IDs and interval (ms)
#[tauri::command]
pub async fn start_serial_share(
    state: State<'_, Manager>,
    from_id: String,
    to_id: String,
    interval_ms: u64,
) -> Result<(), String> {
    let _tx = state
        .share_data_between_ids(&from_id, &to_id, interval_ms)
        .await
        .map_err(|e| format!("Failed to start sharing: {}", e))?;
    Ok(())
}
/// Stop sharing data between serial connections
#[tauri::command]
pub async fn stop_share(
    state: State<'_, Manager>,
    from_id: String,
    to_id: String,
) -> Result<(), String> {
    state
        .stop_share(&from_id, &to_id)
        .await
        .map_err(|e| format!("Failed to stop sharing: {}", e))
}
#[tauri::command]
pub async fn stop_connection(state: State<'_, Manager>, id: String) -> Result<(), String> {
    let _ = state.stop(&id).await;
    Ok(())
}
#[tauri::command]
pub async fn send_packet(
    state: State<'_, Manager>,
    id: String,
    packet: Packet, // Accept as struct, not bytes or JSON
) -> Result<(), String> {
    let mut buf = Vec::new();
    prost::Message::encode(&packet, &mut buf).map_err(|e| e.to_string())?;
    state.send_to(&id, buf).await
}

#[tauri::command]
pub async fn disconnect_all_connections(state: State<'_, Manager>) -> Result<(), String> {
    state.stop_all().await;
    Ok(())
}

#[tauri::command]
pub fn list_serial_ports() -> Result<Vec<String>, String> {
    SerialTransport::list_ports()
}
#[tauri::command]
pub async fn list_connections(state: State<'_, Manager>) -> Result<Vec<ConnectionInfo>, String> {
    Ok(state.list_connections().await)
}
#[tauri::command]
pub async fn start_udp_connection(
    state: State<'_, Manager>,
    id: String,
    local_addr: String,
    app: AppHandle,
) -> Result<(), String> {
    let addr: std::net::SocketAddr = local_addr
        .parse()
        .map_err(|e| format!("Invalid address: {}", e))?;

    // Check if the socket address is already in use
    if state.is_socket_address_in_use(addr).await {
        return Err(format!("Socket address {} is already in use. Please stop any existing connections or simulation streaming using this address first.", local_addr));
    }

    let mut transport = UdpTransport::new(addr)
        .await
        .map_err(|e| format!("Failed to create UDP transport: {}", e))?;
    transport
        .start::<Packet>(id.clone(), move |conn_id: String, packet: Packet| {
            // Emit only the general event with id and packet
            let event = SerialPacketEvent {
                id: conn_id.clone(),
                packet: Some(packet.clone()),
            };
            let _ = app.emit("serial_packet", event);
            save_packet_fast(&conn_id, &packet);
        })
        .await
        .unwrap();

    state
        .add_connection(
            id.clone(),
            Arc::new(transport) as Arc<dyn crate::transport::Transport + Send + Sync>,
        )
        .await
        .map_err(|e| format!("Failed to add connection: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn set_udp_remote_addr(
    state: tauri::State<'_, crate::transport::connection_manager::Manager>,
    id: String,
    remote_addr: String,
) -> Result<(), String> {
    let addr: std::net::SocketAddr = remote_addr
        .parse()
        .map_err(|e| format!("Invalid remote address: {}", e))?;
    state.set_udp_remote_addr(&id, addr).await
}

#[tauri::command]
pub async fn start_simulation_udp_streaming(
    state: State<'_, Manager>,
    sim_state: tauri::State<'_, SimulationDataState>,
    local_addr: String,
    remote_addr: String,
    interval_ms: u64,
    origin_lat: f64,
    origin_lon: f64,
    origin_alt: f64,
) -> Result<String, String> {
    use crate::packet::{Lla, Ned, TargetPacket};
    use crate::transport::convert::lla_to_ned;
    use std::net::SocketAddr;
    let local_addr: SocketAddr = local_addr
        .parse()
        .map_err(|e| format!("Invalid local_addr: {}", e))?;
    let remote_addr: SocketAddr = remote_addr
        .parse()
        .map_err(|e| format!("Invalid remote_addr: {}", e))?;

    // Check if the socket address is already in use
    if state.is_socket_address_in_use(local_addr).await {
        return Err(format!("Socket address {} is already in use. Please stop any existing connections or simulation streaming using this address first.", local_addr));
    }

    // Extract simulation data before await
    let packets = {
        let sim_data_guard = sim_state.lock().await;
        let simulation_data = sim_data_guard
            .as_ref()
            .ok_or("No simulation results in state. Run a simulation first.")?;
        let mut packets = Vec::new();
        let origin = Lla {
            lat: origin_lat,
            lon: origin_lon,
            alt: origin_alt,
        };
        for result in &simulation_data.results {
            let mut prev_ned: Option<Ned> = None;
            let mut prev_time: Option<f64> = None;
            for state in &result.final_state {
                let lla = Lla {
                    lat: state.lat,
                    lon: state.lon,
                    alt: state.alt,
                };
                let ned = lla_to_ned(&origin, &lla);
                let (vn, ve, vd) =
                    if let (Some(prev), Some(prev_t)) = (prev_ned.as_ref(), prev_time) {
                        let dt = state.time.unwrap_or(0.0) - prev_t;
                        if dt > 0.0 {
                            (
                                (ned.north - prev.north) / dt,
                                (ned.east - prev.east) / dt,
                                (ned.down - prev.down) / dt,
                            )
                        } else {
                            (0.0, 0.0, 0.0)
                        }
                    } else {
                        (0.0, 0.0, 0.0)
                    };
                prev_ned = Some(ned.clone());
                prev_time = state.time;
                packets.push(TargetPacket {
                    target_id: result.target_id,
                    lla: Some(lla),
                    ned: Some(ned.clone()),
                    ned_velocity: Some(Ned {
                        north: vn,
                        east: ve,
                        down: vd,
                    }),
                    time: state.time.unwrap_or(0.0),
                    origin: Some(origin.clone()),
                });
            }
        }
        packets
    };

    state
        .simulation_init_and_stream(local_addr, remote_addr, interval_ms, packets)
        .await
}

#[tauri::command]
pub async fn stop_simulation_udp_streaming(
    state: State<'_, Manager>,
    connection_id: String,
) -> Result<(), String> {
    state.stop_simulation_udp_streaming(&connection_id).await
}

#[tauri::command]
pub async fn share_target_to_udp_server(
    state: State<'_, Manager>,
    sim_state: tauri::State<'_, SimulationDataState>,
    local_addr: String,
    remote_addr: String,
    interval_ms: u64,
    target_id: u32,
) -> Result<String, String> {
    use crate::packet::TargetPacket;
    use std::net::SocketAddr;
    let local_addr: SocketAddr = local_addr
        .parse()
        .map_err(|e| format!("Invalid local_addr: {}", e))?;
    let remote_addr: SocketAddr = remote_addr
        .parse()
        .map_err(|e| format!("Invalid remote_addr: {}", e))?;

    // Check if the socket address is already in use
    if state.is_socket_address_in_use(local_addr).await {
        return Err(format!("Socket address {} is already in use. Please stop any existing connections or simulation streaming using this address first.", local_addr));
    }

    let sim_data_guard = sim_state.lock().await;
    let simulation_data = sim_data_guard
        .as_ref()
        .ok_or("No simulation results in state. Run a simulation first.")?;
    let mut packets = Vec::new();
    let origin = Lla {
        lat: 0.0, // Default origin
        lon: 0.0, // Default origin
        alt: 0.0, // Default origin
    };
    for result in &simulation_data.results {
        if result.target_id == target_id {
            let mut prev_ned: Option<Ned> = None;
            let mut prev_time: Option<f64> = None;
            for state in &result.final_state {
                let lla = Lla {
                    lat: state.lat,
                    lon: state.lon,
                    alt: state.alt,
                };
                let ned = lla_to_ned(&origin, &lla);
                let (vn, ve, vd) =
                    if let (Some(prev), Some(prev_t)) = (prev_ned.as_ref(), prev_time) {
                        let dt = state.time.unwrap_or(0.0) - prev_t;
                        if dt > 0.0 {
                            (
                                (ned.north - prev.north) / dt,
                                (ned.east - prev.east) / dt,
                                (ned.down - prev.down) / dt,
                            )
                        } else {
                            (0.0, 0.0, 0.0)
                        }
                    } else {
                        (0.0, 0.0, 0.0)
                    };
                prev_ned = Some(ned.clone());
                prev_time = state.time;
                packets.push(TargetPacket {
                    target_id: result.target_id,
                    lla: Some(lla),
                    ned: Some(ned.clone()),
                    ned_velocity: Some(Ned {
                        north: vn,
                        east: ve,
                        down: vd,
                    }),
                    time: state.time.unwrap_or(0.0),
                    origin: Some(origin.clone()),
                });
            }
        }
    }
    if packets.is_empty() {
        return Err(format!("No data found for target_id {}", target_id));
    }
    state
        .simulation_init_and_stream(local_addr, remote_addr, interval_ms, packets)
        .await
}

#[tauri::command]
pub async fn stop_share_by_connection_id(
    state: State<'_, Manager>,
    connection_id: String,
) -> Result<(), String> {
    state.stop_simulation_udp_streaming(&connection_id).await
}

#[tauri::command]
pub async fn share_target_to_connection(
    state: State<'_, Manager>,
    sim_state: tauri::State<'_, crate::general::simulation_commands::SimulationDataState>,
    target_id: u32,
    connection_id: String,
    interval_ms: u64,
) -> Result<String, String> {
    let sim_data_guard = sim_state.lock().await;
    let simulation_data = sim_data_guard
        .as_ref()
        .ok_or("No simulation results in state. Run a simulation first.")?;
    let mut packets = Vec::new();
    let origin = Lla {
        lat: 0.0, // Default origin
        lon: 0.0, // Default origin
        alt: 0.0, // Default origin
    };
    for result in &simulation_data.results {
        if result.target_id == target_id {
            let mut prev_ned: Option<Ned> = None;
            let mut prev_time: Option<f64> = None;
            for state in &result.final_state {
                let lla = Lla {
                    lat: state.lat,
                    lon: state.lon,
                    alt: state.alt,
                };
                let ned = lla_to_ned(&origin, &lla);
                let (vn, ve, vd) =
                    if let (Some(prev), Some(prev_t)) = (prev_ned.as_ref(), prev_time) {
                        let dt = state.time.unwrap_or(0.0) - prev_t;
                        if dt > 0.0 {
                            (
                                (ned.north - prev.north) / dt,
                                (ned.east - prev.east) / dt,
                                (ned.down - prev.down) / dt,
                            )
                        } else {
                            (0.0, 0.0, 0.0)
                        }
                    } else {
                        (0.0, 0.0, 0.0)
                    };
                prev_ned = Some(ned.clone());
                prev_time = state.time;
                packets.push(TargetPacket {
                    target_id: result.target_id,
                    lla: Some(lla),
                    ned: Some(ned.clone()),
                    ned_velocity: Some(Ned {
                        north: vn,
                        east: ve,
                        down: vd,
                    }),
                    time: state.time.unwrap_or(0.0),
                    origin: Some(origin.clone()),
                });
            }
        }
    }
    if packets.is_empty() {
        return Err(format!("No data found for target_id {}", target_id));
    }
    let id = format!("share_{}_{}", target_id, Uuid::new_v4());
    let manager_arc = state.inner().clone(); // Get Arc<Manager>
    let conn_id = connection_id.clone();
    let handle = tokio::spawn(async move {
        for packet in packets {
            let mut buf = Vec::new();
            let data = Packet {
                kind: Some(Kind::TargetPacket(packet)),
            };
            if let Ok(()) = data.encode(&mut buf) {
                let _ = manager_arc.send_to(&conn_id, buf).await;
            }
            time::sleep(time::Duration::from_millis(interval_ms)).await;
        }
    });
    // Store the handle for stopping later
    let mut share_tasks = state.share_tasks.lock().await;
    share_tasks.insert((id.clone(), connection_id.clone()), handle);
    Ok(id)
}

#[tauri::command]
pub async fn stop_share_to_connection(
    state: State<'_, Manager>,
    share_id: String,
    connection_id: String,
) -> Result<(), String> {
    let mut share_tasks = state.share_tasks.lock().await;
    if let Some(handle) = share_tasks.remove(&(share_id, connection_id)) {
        handle.abort();
        Ok(())
    } else {
        Err("Share task not found".to_string())
    }
}

#[tauri::command]
pub async fn list_active_shares(
    state: State<'_, Manager>,
) -> Result<Vec<(String, String)>, String> {
    let share_tasks = state.share_tasks.lock().await;
    Ok(share_tasks.keys().cloned().collect())
}

#[tauri::command]
pub async fn list_active_simulation_streams(
    state: State<'_, Manager>,
) -> Result<Vec<String>, String> {
    let simulation_stream_tasks = state.simulation_stream_tasks.lock().await;
    Ok(simulation_stream_tasks.keys().cloned().collect())
}

#[tauri::command]
pub async fn list_udp_targets(
    state: State<'_, Manager>,
    connection_id: String,
) -> Result<Vec<crate::packet::TargetPacket>, String> {
    let connections = &state.connections;
    let conn = {
        let guard = connections.read().unwrap();
        guard.get(&connection_id).cloned()
    };
    if let Some(conn) = conn {
        if let Some(udp) = conn.as_any().downcast_ref::<UdpTransport>() {
            let td = udp.target_data.lock().await;
            Ok(td.values().cloned().collect())
        } else {
            Ok(vec![])
        }
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
pub async fn get_total_udp_targets(state: State<'_, Manager>) -> Result<u32, String> {
    let connections = &state.connections;
    let conns: Vec<_> = connections.read().unwrap().values().cloned().collect();
    let mut all_target_ids = std::collections::HashSet::new();
    for conn in conns {
        if let Some(udp) = conn.as_any().downcast_ref::<UdpTransport>() {
            let td = udp.target_data.lock().await;
            for target_id in td.keys() {
                all_target_ids.insert(*target_id);
            }
        }
    }
    Ok(all_target_ids.len() as u32)
}

#[cfg(target_os = "linux")]
fn set_realtime_priority() {
    use libc::{sched_param, sched_setscheduler, SCHED_FIFO};
    unsafe {
        let param = sched_param { sched_priority: 99 };
        sched_setscheduler(0, SCHED_FIFO, &param);
    }
}

#[cfg(windows)]
fn set_high_timer_resolution() {
    use winapi::um::timeapi;
    unsafe {
        timeapi::timeBeginPeriod(1); // Set 1ms resolution
    }
}

#[tauri::command]
pub async fn share_udp_target_to_connection(
    state: State<'_, Manager>,
    udp_connection_id: String,
    target_id: u32,
    dest_connection_id: String,
    interval_ms: u64,
) -> Result<String, String> {
    let id = format!(
        "udp_share_{}_{}_{}",
        udp_connection_id,
        target_id,
        Uuid::new_v4()
    );

    // Set up OS-specific optimizations
    #[cfg(target_os = "linux")]
    set_realtime_priority();
    #[cfg(windows)]
    set_high_timer_resolution();

    let manager_arc = state.inner().clone();
    let udp_conn_id = udp_connection_id.clone();
    let dest_conn_id = dest_connection_id.clone();
    let running = Arc::new(AtomicBool::new(true));
    let running_clone = running.clone();

    let handle = tokio::spawn(async move {
        let interval = Duration::from_millis(interval_ms);
        let mut next_time = Instant::now() + interval;
        let mut last_send_time = Instant::now();

        while running_clone.load(Ordering::Relaxed) {
            // PRECISION TIMING CONTROL
            let now = Instant::now();
            if now < next_time {
                let sleep_time = next_time - now;
                if sleep_time > Duration::from_micros(2000) {
                    tokio::time::sleep(sleep_time - Duration::from_micros(1000)).await;
                }
                while Instant::now() < next_time {
                    std::hint::spin_loop();
                }
            }

            // DATA SHARING LOGIC (FIXED)
            let connections = match manager_arc.connections.read() {
                Ok(lock) => lock.clone(),
                Err(_) => {
                    tracing::error!("Failed to acquire connections lock");
                    continue;
                }
            };

            // Get source UDP connection
            let Some(conn) = connections.get(&udp_conn_id) else {
                tracing::warn!("Source UDP connection not found: {}", udp_conn_id);
                next_time += interval;
                continue;
            };

            // Get destination connection
            let Some(_dest_conn) = connections.get(&dest_conn_id) else {
                tracing::warn!("Destination connection not found: {}", dest_conn_id);
                next_time += interval;
                continue;
            };

            // Downcast to UDP transport
            let Some(udp) = conn.as_any().downcast_ref::<UdpTransport>() else {
                tracing::warn!("Source is not a UDP transport");
                next_time += interval;
                continue;
            };

            // Lock and get target data
            let td = udp.target_data.lock().await;
            let Some(tp) = td.get(&target_id) else {
                tracing::warn!("Target data not found for ID: {}", target_id);
                next_time += interval;
                continue;
            };

            // Encode and send packet
            let mut buf = Vec::with_capacity(128);
            let data = Packet {
                kind: Some(Kind::TargetPacket(tp.clone())),
            };

            if let Err(e) = data.encode(&mut buf) {
                tracing::error!("Failed to encode packet: {}", e);
                next_time += interval;
                continue;
            }

            if let Err(e) = manager_arc.send_to(&dest_conn_id, buf).await {
                tracing::error!("Failed to send packet: {}", e);
            }

            // Log timing statistics
            let now_send = Instant::now();
            let actual_interval = now_send.duration_since(last_send_time);
            tracing::info!(
                "UDP Share - Target: {:.2}ms, Actual: {:.2}ms, Drift: {:.3}ms",
                interval.as_secs_f64() * 1000.0,
                actual_interval.as_secs_f64() * 1000.0,
                (actual_interval.as_secs_f64() - interval.as_secs_f64()) * 1000.0
            );
            last_send_time = now_send;

            // Schedule next iteration with drift compensation
            next_time += interval;
            if Instant::now() - next_time > interval * 2 {
                next_time = Instant::now() + interval;
            }
        }

        // Cleanup
        #[cfg(windows)]
        unsafe {
            winapi::um::timeapi::timeEndPeriod(1);
        }
    });

    // Store just the JoinHandle in share_tasks
    let mut share_tasks = state.share_tasks.lock().await;
    share_tasks.insert((id.clone(), dest_connection_id.clone()), handle);

    // Store the running flag separately if needed
    let mut running_flags = state.running_flags.lock().await;
    running_flags.insert((id.clone(), dest_connection_id), running);

    Ok(id)
}
#[tauri::command]
pub async fn get_packet_statistics(
    state: State<'_, Manager>,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let total_received = state.get_total_packets_received().await;
    let total_sent = state.get_total_packets_sent().await;
    let connection_count = state.get_connection_count().await;
    let connection_counts = state.get_connection_packet_counts().await;

    let mut stats = HashMap::new();
    stats.insert(
        "total_received".to_string(),
        serde_json::Value::Number(total_received.into()),
    );
    stats.insert(
        "total_sent".to_string(),
        serde_json::Value::Number(total_sent.into()),
    );
    stats.insert(
        "connection_count".to_string(),
        serde_json::Value::Number(connection_count.into()),
    );

    let connection_counts_json: HashMap<String, serde_json::Value> = connection_counts
        .into_iter()
        .map(|(id, (received, sent))| {
            let mut conn_stats = HashMap::new();
            conn_stats.insert(
                "received".to_string(),
                serde_json::Value::Number(received.into()),
            );
            conn_stats.insert("sent".to_string(), serde_json::Value::Number(sent.into()));
            (
                id,
                serde_json::Value::Object(serde_json::Map::from_iter(conn_stats)),
            )
        })
        .collect();

    stats.insert(
        "connection_counts".to_string(),
        serde_json::Value::Object(serde_json::Map::from_iter(connection_counts_json)),
    );

    Ok(stats)
}

// Keep individual commands for backward compatibility
#[tauri::command]
pub async fn get_total_packets_sent(state: State<'_, Manager>) -> Result<usize, String> {
    Ok(state.get_total_packets_sent().await)
}

#[tauri::command]
pub async fn get_total_packets_received(state: State<'_, Manager>) -> Result<usize, String> {
    Ok(state.get_total_packets_received().await)
}

#[tauri::command]
pub async fn get_connection_packet_counts(
    state: State<'_, Manager>,
) -> Result<HashMap<String, (usize, usize)>, String> {
    Ok(state.get_connection_packet_counts().await)
}

#[tauri::command]
pub async fn get_connection_count(state: State<'_, Manager>) -> Result<usize, String> {
    Ok(state.get_connection_count().await)
}

#[tauri::command]
pub async fn reset_packet_counters(state: State<'_, Manager>) -> Result<(), String> {
    state.reset_packet_counters().await;
    Ok(())
}
