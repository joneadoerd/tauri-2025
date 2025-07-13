use std::sync::Arc;

use crate::packet::{Packet, SerialPacketEvent};
use crate::storage::file_logger::save_packet_fast;
use crate::transport::connection_manager::Manager;

use crate::transport::serial::SerialTransport;
use crate::transport::udp::UdpTransport;
use crate::transport::{ConnectionInfo, StatableTransport};

use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

#[tauri::command]
pub async fn start_connection(
    state: State<'_, Manager>,
    prefix: String,
    port: String,
    baud: u32,
    app: AppHandle,
) -> Result<(), String> {
    let id = format!("{}_{}", prefix, Uuid::new_v4());

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
        .add_connection(id.clone(), Arc::new(transport) as Arc<dyn crate::transport::Transport + Send + Sync>)
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
    prefix: String,
    local_addr: String,
    app: AppHandle,
) -> Result<(), String> {
    let id = format!("{}_{}", prefix, uuid::Uuid::new_v4());
    let addr: std::net::SocketAddr = local_addr
        .parse()
        .map_err(|e| format!("Invalid address: {}", e))?;
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
        .add_connection(id.clone(), Arc::new(transport) as Arc<dyn crate::transport::Transport + Send + Sync>)
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
