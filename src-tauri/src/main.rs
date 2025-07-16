// mod commands;
mod commands_async;
mod general;
mod logger;
mod packet;
mod serial;
pub mod simulation;
mod simulation_state;
mod storage;
mod transport;
mod zmq;
mod zmq_server_tokio;
use std::sync::Arc;

use commands_async::{
    add_sub, disconnect, init_zmq, list_ports, list_subs, list_subs_with_status, remove_sub,
    send_data, start_serial, AppState,
};
use general::{
    // commands::{
    //     list_connections, list_serial_ports, send_packet, start_connection, stop_connection,
    // },
    // serial::SerialManager,
    simulation_commands::{
        clear_simulation_data, get_simulation_data, simulation, SimulationDataState,
    },
    simulation_streaming::{
        check_simulation_data_available,
        get_active_sensor_streams,
        get_active_simulation_streams,
        get_available_simulation_connections,
        get_available_simulation_targets,
        get_udp_sensor_clients,
        start_sensor_streaming,
        start_simulation_streaming,
        stop_sensor_streaming,
        stop_sensor_target_stream,
        stop_simulation_streaming,
        stop_target_stream,
        // Sensor streaming
        SensorStreamer as UdpSensorStreamer,
        SimulationStreamer,
    },
};

use tokio::sync::OnceCell;

use crate::general::simulation_streaming::{
    map_udp_sensor_target, send_sensor_command, set_target_udp_addr, unmap_udp_sensor_target,
};
use crate::simulation_state::command::{
    reset_simulation_timer, start_simulation_timer, stop_simulation_timer, SimTimerState,
};
use crate::{
    general::sensor_udp_server::{SharedClientAddrMap, SharedSensorMap},
    transport::connection_manager::Manager,
};

// Global sensor map for UDP server
pub static SENSOR_MAP: OnceCell<SharedSensorMap> = OnceCell::const_new();

#[tokio::main]
async fn main() {
    logger::init_logging(); // initialize file logging
                            // console_subscriber::init(); // starts the Tokio console layer

    // Create serial manager and simulation streamer
    // Assume you have a `Manager` initialized already:
    let serial_manager = Manager::new(); // Or however it's created
    let simulation_streamer = Arc::new(SimulationStreamer::new(Arc::new(serial_manager.clone())));
    // Add sensor streamer
    let sensor_streamer = Arc::new(UdpSensorStreamer::new(Arc::new(serial_manager.clone())));

    // Initialize and start UDP server before Tauri runs
    let udp_socket = Arc::new(
        tokio::net::UdpSocket::bind("0.0.0.0:5001")
            .await
            .expect("could not bind UDP server"),
    );
    let sensor_map = SharedSensorMap::default();
    let client_addr_map = SharedClientAddrMap::default();

    // Clone for the closure
    let udp_socket_for_task = udp_socket.clone();
    let client_addr_map_for_task = client_addr_map.clone();
    let sensor_map_for_task = sensor_map.clone();
    SENSOR_MAP.set(sensor_map.clone()).unwrap();

    tauri::Builder::default()
        .setup(move |app| {
            let app_handle = app.handle().clone();
            tokio::spawn(async move {
                crate::general::sensor_udp_server::start_udp_server(
                    udp_socket_for_task,
                    sensor_map_for_task,
                    client_addr_map_for_task,
                    app_handle,
                )
                .await;
            });
            Ok(())
        })
        .plugin(tauri_plugin_shell::init())
        .manage(Arc::new(std::sync::Mutex::new(SimTimerState {
            handle: None,
            current_step: 0,
            running: false,
            total_steps: 0,
        })))
        .manage(serial_manager)
        .manage(simulation_streamer)
        .manage(sensor_streamer)
        .manage(AppState::default())
        .manage(SimulationDataState::default())
        // .manage(transport::commands::SimulationDataStateManager::default())
        .manage(client_addr_map)
        .manage(udp_socket)
        // .manage(transport::connection_manager::Manager::new())
        .invoke_handler(tauri::generate_handler![
            init_zmq,
            add_sub,
            remove_sub,
            list_subs,
            list_subs_with_status,
            list_ports,
            start_serial,
            disconnect,
            transport::commands::start_connection,
            transport::commands::start_udp_connection,
            transport::commands::stop_connection,
            transport::commands::send_packet,
            transport::commands::list_serial_ports,
            transport::commands::list_connections,
            transport::commands::disconnect_all_connections,
            transport::commands::start_serial_share,
            transport::commands::stop_share,
            transport::commands::stop_share_by_connection_id,
            transport::commands::set_udp_remote_addr,
            transport::commands::start_simulation_udp_streaming,
            transport::commands::stop_simulation_udp_streaming,
            transport::commands::share_target_to_udp_server,
            transport::commands::share_target_to_connection,
            transport::commands::stop_share_to_connection,
            transport::commands::list_active_shares,
            transport::commands::list_active_simulation_streams,
            transport::commands::list_udp_targets,
            transport::commands::share_udp_target_to_connection,
            transport::commands::get_total_udp_targets,
            transport::commands::get_serial_packet_received_count,
            transport::commands::get_udp_packet_received_count,
            transport::commands::get_total_packets_received,
            transport::commands::get_total_packets_sent,
            transport::commands::get_connection_packet_counts,
            transport::commands::get_connection_count,
            // general::commands::start_connection,
            // general::commands::stop_connection,
            // general::commands::send_packet,
            // general::commands::list_serial_ports,
            // general::commands::list_connections,
            // general::commands::disconnect_all_connections,
            // Add the new share commands
            // general::commands::start_share,
            // general::commands::stop_share,

            // Add data persistence commands
            storage::commands::read_log_file,
            storage::commands::list_log_files,
            storage::commands::get_logs_directory,
            storage::commands::get_app_root_directory,
            send_data,
            simulation,
            get_simulation_data,
            clear_simulation_data,
            start_simulation_timer,
            stop_simulation_timer,
            reset_simulation_timer,
            // Add simulation streaming commands
            start_simulation_streaming,
            stop_simulation_streaming,
            stop_target_stream,
            get_active_simulation_streams,
            get_available_simulation_connections,
            get_available_simulation_targets,
            check_simulation_data_available,
            get_udp_sensor_clients,
            start_sensor_streaming,
            stop_sensor_streaming,
            stop_sensor_target_stream,
            get_active_sensor_streams,
            send_sensor_command,
            map_udp_sensor_target,
            unmap_udp_sensor_target,
            set_target_udp_addr,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
