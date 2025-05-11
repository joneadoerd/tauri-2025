mod zmq_server;

use std::sync::{Arc, Mutex};

use tauri::{Manager, State};
use zmq_server::{start_zmq_server, ActiveSensors, AppState, ZmqContext};


#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .manage(AppState {
            active_sensors: ActiveSensors::default(),
            zmq_ctx: Mutex::new(ZmqContext {
                cmd_publisher: Arc::new(Mutex::new(None)),
            }),
        })
        .invoke_handler(tauri::generate_handler![
            get_active_sensors,
            send_command_to_sensor
        ])
        .setup(|app| {
            let state = app.state::<AppState>();
            start_zmq_server(
                app.handle().clone(),
                Arc::new(Mutex::new(state.zmq_ctx.lock().unwrap().clone())),
            );
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
async fn get_active_sensors(state: tauri::State<'_, AppState>) -> Result<Vec<String>, String> {
    let sensors = state.active_sensors.sensors.lock().map_err(|e| e.to_string())?;
    Ok(sensors.keys().cloned().collect())
}

#[tauri::command]
async fn send_command_to_sensor(
    sensor_id: String,
    command: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let sensors = state.active_sensors.sensors.lock().unwrap();
    println!("sensors: {:#?}", sensors);
    // if !sensors.contains_key(&sensor_id) {
    //     return Err("Sensor not found".into());
    // }

    if let Some(cmd_pub) = &*state.zmq_ctx.lock().unwrap().cmd_publisher.lock().unwrap() {
        cmd_pub
            .send_multipart(&[sensor_id.as_bytes(), command.as_bytes()], 0)
            .map_err(|e| format!("Failed to send command: {}", e))?;
    } else {
        return Err("Command publisher not initialized".into());
    }

    Ok(())
}
