use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use zmq::{Context, SocketType};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SensorData {
    pub sensor_id: String,
    pub value: f64,
    pub timestamp: i64,
}

#[derive(Default)]
pub struct ActiveSensors {
    pub sensors: Arc<Mutex<HashMap<String, bool>>>,
}

pub async fn zmq_server_task(app_handle: tauri::AppHandle) {
    let context = Context::new();
    let responder = context.socket(SocketType::REP).unwrap();
    let publisher = context.socket(SocketType::PUB).unwrap();
    
    responder.bind("tcp://*:5555").expect("Failed to bind REP socket");
    publisher.bind("tcp://*:5556").expect("Failed to bind PUB socket");
    
    let active_sensors: Arc<Mutex<HashMap<String, bool>>> = Arc::new(Mutex::new(HashMap::new()));
    
    loop {
        if let Ok(msg) = responder.recv_msg(0) {
            let msg_str = msg.as_str().unwrap();
            
            if msg_str == "REGISTER" {
                let sensor_id = format!("sensor-{}", rand::random::<u16>());
                active_sensors.lock().unwrap().insert(sensor_id.clone(), true);
                
                responder.send(&sensor_id, 0).unwrap();
                
                // Notify UI about new sensor
                app_handle.emit("sensor-connected", sensor_id).unwrap();
            } else if msg_str.starts_with("DATA:") {
                let data: SensorData = serde_json::from_str(&msg_str[5..]).unwrap();
                
                // Forward data to all subscribers
                publisher.send(&msg_str[5..], 0).unwrap();
                
                // Notify UI about new data
                app_handle.emit("sensor-data", data).unwrap();
                
                responder.send("ACK", 0).unwrap();
            } else if msg_str.starts_with("UNREGISTER:") {
                let sensor_id = msg_str["UNREGISTER:".len()..].to_string();
                active_sensors.lock().unwrap().remove(&sensor_id);
                
                // Notify UI about disconnected sensor
                app_handle.emit("sensor-disconnected", sensor_id).unwrap();
                
                responder.send("ACK", 0).unwrap();
            }
        }
    }
}

pub fn start_zmq_server(app_handle: tauri::AppHandle) {
    tokio::spawn(zmq_server_task(app_handle));
}