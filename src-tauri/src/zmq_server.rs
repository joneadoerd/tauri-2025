use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};

use zmq::{Context, Socket, SocketType};
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SensorData {
    pub sensor_id: String,
    pub value: f64,
    pub timestamp: i64,
}
pub struct AppState {
    pub active_sensors: ActiveSensors,
    pub zmq_ctx: Mutex<ZmqContext>,
}

#[derive(Default)]
pub struct ActiveSensors {
    pub sensors: Arc<Mutex<HashMap<String, bool>>>,
}
#[derive(Clone)]
pub struct ZmqContext {
    pub cmd_publisher: Arc<Mutex<Option<Socket>>>,
}

pub async fn zmq_server_task(app_handle: tauri::AppHandle, zmq_ctx: Arc<Mutex<ZmqContext>>) {
    let context = Context::new();
    let responder = context.socket(SocketType::REP).unwrap();
    let data_publisher = context.socket(SocketType::PUB).unwrap();
    let cmd_publisher = context.socket(SocketType::PUB).unwrap();

    responder
        .bind("tcp://*:5555")
        .expect("Failed to bind REP socket");
    data_publisher
        .bind("tcp://*:5556")
        .expect("Failed to bind data PUB socket");
    cmd_publisher
        .bind("tcp://*:5557")
        .expect("Failed to bind command PUB socket");

    // Store the command publisher in the shared state
    zmq_ctx.lock().unwrap().cmd_publisher = Arc::new(Mutex::new(Some(cmd_publisher)));
    let state = app_handle.state::<AppState>();

    loop {
        if let Ok(msg) = responder.recv_msg(0) {
            let msg_str = msg.as_str().unwrap();

            if msg_str == "REGISTER" {
                let sensor_id = format!("sensor-{}", rand::random::<u16>());
                state
                    .active_sensors
                    .sensors
                    .lock()
                    .unwrap()
                    .insert(sensor_id.clone(), true);

                responder.send(&sensor_id, 0).unwrap();
                app_handle.emit("sensor-connected", &sensor_id).unwrap();
            } else if msg_str.starts_with("DATA:") {
                let data: SensorData = serde_json::from_str(&msg_str[5..]).unwrap();

                data_publisher.send(&msg_str[5..], 0).unwrap();
                app_handle.emit("sensor-data", &data).unwrap();

                responder.send("ACK", 0).unwrap();
            } else if msg_str.starts_with("UNREGISTER:") {
                let sensor_id = msg_str["UNREGISTER:".len()..].to_string();
                state
                    .active_sensors
                    .sensors
                    .lock()
                    .unwrap()
                    .remove(&sensor_id);

                app_handle.emit("sensor-disconnected", &sensor_id).unwrap();
                responder.send("ACK", 0).unwrap();
            }
        }
    }
}

pub fn start_zmq_server(app_handle: tauri::AppHandle, zmq_ctx: Arc<Mutex<ZmqContext>>) {
    tokio::spawn(zmq_server_task(app_handle, zmq_ctx));
}
