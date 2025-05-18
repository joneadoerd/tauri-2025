mod commands;
mod packet;
mod serial;
mod zmq;
use commands::{
    add_sub, disconnect, init_zmq, list_ports, list_subs, list_subs_with_status, remove_sub,
    send_data, start_serial, AppState,
};

#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            init_zmq,
            add_sub,
            remove_sub,
            list_subs,
            list_subs_with_status,
            list_ports,
            start_serial,
            disconnect,
            send_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
