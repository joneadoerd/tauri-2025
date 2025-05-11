mod zmq_server;

use zmq_server::{start_zmq_server, ActiveSensors};

#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .manage(ActiveSensors::default())
        .invoke_handler(tauri::generate_handler![
            get_active_sensors,
            send_command_to_sensor
        ])
        .setup(|app| {
            start_zmq_server(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
async fn get_active_sensors(state: tauri::State<'_, ActiveSensors>) -> Result<Vec<String>, String> {
    let sensors = state.sensors.lock().map_err(|e| e.to_string())?;
    Ok(sensors.keys().cloned().collect())
}

#[tauri::command]
async fn send_command_to_sensor(sensor_id: String, command: String) -> Result<(), String> {
    println!("Sending command '{}' to sensor {}", command, sensor_id);
    Ok(())
}