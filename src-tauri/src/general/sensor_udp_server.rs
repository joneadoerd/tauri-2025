use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::net::UdpSocket;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorData {
    pub sensor_id: u32,
    pub lat: f64,
    pub lon: f64,
    pub alt: f64,
    pub temp: f64,
}

pub type SharedSensorMap = Arc<Mutex<HashMap<u32, SensorData>>>;

pub async fn start_udp_server(sensor_map: SharedSensorMap) {
    let socket = UdpSocket::bind("0.0.0.0:5001")
        .await
        .expect("could not bind UDP server");
    let mut buf = [0u8; 1024];
    loop {
        if let Ok((amt, _src)) = socket.recv_from(&mut buf).await {
            if let Ok(msg) = std::str::from_utf8(&buf[..amt]) {
                let parts: Vec<&str> = msg.trim().split(',').collect();
                if parts.len() == 5 {
                    if let (Ok(sensor_id), Ok(lat), Ok(lon), Ok(alt), Ok(temp)) = (
                        parts[0].parse(),
                        parts[1].parse(),
                        parts[2].parse(),
                        parts[3].parse(),
                        parts[4].parse(),
                    ) {
                        let data = SensorData {
                            sensor_id,
                            lat,
                            lon,
                            alt,
                            temp,
                        };
                        sensor_map.lock().await.insert(sensor_id, data);
                    }
                }
            }
        }
    }
}

pub async fn get_udp_sensor_clients(sensor_map: SharedSensorMap) -> Vec<SensorData> {
    let map = sensor_map.lock().await;
    map.values().cloned().collect()
}
