use rand::Rng;
use std::env;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::UdpSocket;
use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() {
    let sensor_id: u32 = env::args()
        .nth(1)
        .unwrap_or_else(|| "1".to_string())
        .parse()
        .expect("sensor_id must be a number");
    let server_addr: SocketAddr = env::args()
        .nth(2)
        .unwrap_or_else(|| "127.0.0.1:5001".to_string())
        .parse()
        .expect("server_addr must be a valid address");
    let listen_port = env::args().nth(3).unwrap_or_else(|| "0".to_string()); // 0 = OS assigns port
    let listen_addr = format!("0.0.0.0:{}", listen_port);
    let socket = Arc::new(
        UdpSocket::bind(&listen_addr)
            .await
            .expect("could not bind client socket"),
    );
    println!(
        "UDP sensor client {} listening on {} (sending to {})",
        sensor_id, listen_addr, server_addr
    );

    let socket2 = Arc::clone(&socket);
    // Task to listen for commands and respond
    tokio::spawn(async move {
        let mut buf = [0u8; 1024];
        loop {
            if let Ok((amt, src)) = socket2.recv_from(&mut buf).await {
                if let Ok(msg) = std::str::from_utf8(&buf[..amt]) {
                    println!("[UDP RECEIVED] from {}: {}", src, msg);
                    // Optionally, keep the health-check response logic
                    if msg.trim() == "health-check" {
                        let temp = rand::thread_rng().gen_range(20.0..30.0);
                        let response = format!("health:OK,temp:{}", temp);
                        socket2
                            .send_to(response.as_bytes(), &src)
                            .await
                            .expect("send failed");
                        println!("Responded to health-check with: {}", response);
                    }
                }
            }
        }
    });

    // Main loop: periodically send sensor data to server
    loop {
        let lat = rand::thread_rng().gen_range(-90.0..90.0);
        let lon = rand::thread_rng().gen_range(-180.0..180.0);
        let alt = rand::thread_rng().gen_range(0.0..1000.0);
        let temp = rand::thread_rng().gen_range(20.0..30.0);
        let msg = format!("{},{},{},{},{}", sensor_id, lat, lon, alt, temp);
        // println!("Sending to {}: {}", server_addr, msg);
        let _ = socket.send_to(msg.as_bytes(), server_addr).await;
        println!("Sent: {} to {}", msg, server_addr);
        sleep(Duration::from_millis(500)).await;
    }
}
