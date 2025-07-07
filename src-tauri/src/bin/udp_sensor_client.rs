use rand::Rng;
use std::env;
use std::sync::{Arc, Mutex};
use tokio::net::UdpSocket;
use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() {
    let server_addr = env::args().nth(1).unwrap_or_else(|| "127.0.0.1:5001".to_string());
    let initial_target_id: u32 = env::args().nth(2).unwrap_or_else(|| "0".to_string()).parse().expect("target_id must be a number");
    let socket = Arc::new(UdpSocket::bind("0.0.0.0:0").await.expect("could not bind client socket"));
    let target_id = Arc::new(Mutex::new(initial_target_id));
    let sensor_id: u32 = env::args().nth(3).unwrap_or_else(|| "1".to_string()).parse().expect("sensor_id must be a number");

    // Listen for mapping commands
    let socket2 = Arc::clone(&socket);
    let target_id2 = Arc::clone(&target_id);
    tokio::spawn(async move {
        let mut buf = [0u8; 1024];
        loop {
            if let Ok((amt, _src)) = socket2.recv_from(&mut buf).await {
                if let Ok(msg) = std::str::from_utf8(&buf[..amt]) {
                    if msg.starts_with("map:") {
                        if let Ok(new_id) = msg[4..].trim().parse() {
                            let mut tid = target_id2.lock().unwrap();
                            *tid = new_id;
                            println!("Mapped to target_id {}", new_id);
                        }
                    } else if msg.trim() == "unmap" {
                        let mut tid = target_id2.lock().unwrap();
                        *tid = 0;
                        println!("Unmapped from any target");
                    }
                }
            }
        }
    });

    // Main loop: send data only if mapped
    loop {
        let tid = *target_id.lock().unwrap();
        if tid != 0 {
            let temp = rand::thread_rng().gen_range(20.0..30.0);
            let lat = rand::thread_rng().gen_range(-90.0..90.0);
            let lon = rand::thread_rng().gen_range(-180.0..180.0);
            let alt = rand::thread_rng().gen_range(0.0..1000.0);
            let msg = format!("{},{},{},{},{},{}", tid, sensor_id, lat, lon, alt, temp);
            socket.send_to(msg.as_bytes(), &server_addr).await.expect("could not send data");
            println!("Sent: {}", msg);
        }
        sleep(Duration::from_millis(500)).await;
    }
} 