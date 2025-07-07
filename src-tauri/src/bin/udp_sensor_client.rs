use rand::Rng;
use std::env;
use tokio::net::UdpSocket;
use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() {
    let server_addr = env::args().nth(1).unwrap_or_else(|| "127.0.0.1:5001".to_string());
    let socket = UdpSocket::bind("0.0.0.0:0").await.expect("could not bind client socket");
    let sensor_id = rand::thread_rng().gen_range(1..=1000); // Random sensor ID
    loop {
        let temp = rand::thread_rng().gen_range(20.0..30.0);
        let lat = rand::thread_rng().gen_range(-90.0..90.0);
        let lon = rand::thread_rng().gen_range(-180.0..180.0);
        let alt = rand::thread_rng().gen_range(0.0..1000.0);
        let msg = format!("{},{},{},{},{}", sensor_id, lat, lon, alt, temp);
        socket.send_to(msg.as_bytes(), &server_addr).await.expect("could not send data");
        println!("Sent: {}", msg);
        sleep(Duration::from_millis(500)).await;
    }
} 