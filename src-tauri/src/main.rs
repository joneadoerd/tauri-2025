// mod commands;
mod commands_async;
mod general;
mod logger;
mod packet;
mod serial;
mod zmq;
mod zmq_server_tokio;

use commands_async::{
    add_sub, disconnect, init_zmq, list_ports, list_subs, list_subs_with_status, remove_sub,
    send_data, start_serial, AppState,
};
use general::{
    commands::{
        list_connections, list_serial_ports, send_packet, start_connection, stop_connection,
    },
    serial::SerialManager,
};

#[tokio::main]
async fn main() {
    logger::init_logging(); // initialize file logging
                            // console_subscriber::init(); // starts the Tokio console layer
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(SerialManager::default())
        .manage(AppState::default())
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
            general::commands::simulation,
            general::commands::ping,
            general::commands::stop_share,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
