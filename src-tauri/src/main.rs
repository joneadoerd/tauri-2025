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

use std::sync::{Arc, Mutex};

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
};

use crate::simulation_state::command::{
    stop_simulation_timer, start_simulation_timer, SimTimerState,reset_simulation_timer
};

#[tokio::main]
async fn main() {
    logger::init_logging(); // initialize file logging
                            // console_subscriber::init(); // starts the Tokio console layer
    tauri::Builder::default()
        .manage(Arc::new(Mutex::new(SimTimerState {
            handle: None,
            current_step: 0,
            running: false,
            total_steps: 0,
        })))
        .plugin(tauri_plugin_shell::init())
        .manage(SerialManager::default())
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
            reset_simulation_timer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
