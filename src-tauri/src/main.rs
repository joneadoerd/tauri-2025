mod commands;
mod zmq;

use commands::{add_sub, init_zmq, list_subs, list_subs_with_status, remove_sub, AppState};

#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .manage(AppState(Default::default()))
        .invoke_handler(tauri::generate_handler![
            init_zmq, add_sub, remove_sub, list_subs,list_subs_with_status 
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
