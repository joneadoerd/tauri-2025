// mod commands;
mod commands_async;
mod general;
mod logger;
mod packet;
mod serial;
pub mod simulation;
mod simulation_state;
mod zmq;
mod zmq_server_tokio;

use std::sync::Arc;

use commands_async::{
    add_sub, disconnect, init_zmq, list_ports, list_subs, list_subs_with_status, remove_sub,
    send_data, start_serial, AppState,
};
use general::{
    commands::{
        list_connections, list_serial_ports, send_packet, start_connection, stop_connection,
    },
    serial::SerialManager,
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

use crate::general::sensor_udp_server::{start_udp_server, SharedSensorMap};
use crate::simulation_state::command::{
    reset_simulation_timer, start_simulation_timer, stop_simulation_timer, SimTimerState,
};

// Global sensor map for UDP server
pub static SENSOR_MAP: OnceCell<SharedSensorMap> = OnceCell::const_new();

#[tokio::main]
async fn main() {
    logger::init_logging(); // initialize file logging
                            // console_subscriber::init(); // starts the Tokio console layer

    // Create serial manager and simulation streamer
    let serial_manager = Arc::new(SerialManager::default());
    let simulation_streamer = Arc::new(SimulationStreamer::new(serial_manager.clone()));
    // Add sensor streamer
    let sensor_streamer = Arc::new(UdpSensorStreamer::new(serial_manager.clone()));

    // Create AppState with the same serial manager

    // Initialize and start UDP server before Tauri runs
    let sensor_map = SharedSensorMap::default();
    let sensor_map_clone = sensor_map.clone();
    tokio::spawn(async move {
        start_udp_server(sensor_map_clone).await;
    });
    SENSOR_MAP.set(sensor_map).unwrap();

    tauri::Builder::default()
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
        .invoke_handler(tauri::generate_handler![
            init_zmq,
            add_sub,
            remove_sub,
            list_subs,
            list_subs_with_status,
            list_ports,
            start_serial,
            start_connection,
            disconnect,
            stop_connection,
            send_packet,
            list_serial_ports,
            list_connections,
            send_data,
            // Add the new share commands
            general::commands::start_share,
            general::commands::stop_share,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
