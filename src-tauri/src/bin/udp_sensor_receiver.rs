use rand::Rng;
use std::env;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::UdpSocket;
use tokio::time::{sleep, Duration};
use prost::Message;

#[path = "../packet.rs"]
pub mod packet;
// Import the protobuf types from your generated code
use crate::packet::{Packet, packet::Kind, PacketHeader, PacketPayload, TargetPacket};

#[tokio::main]
async fn main() {
    let sensor_id: u32 = env::args()
        .nth(1)
        .unwrap_or_else(|| "1".to_string())
        .parse()
        .expect("sensor_id must be a number");
    let server_addr: SocketAddr = env::args()
        .nth(2)
        .unwrap_or_else(|| "127.0.0.1:7000".to_string())
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
    let mut packet_counter = 0u32;
    loop {
        packet_counter += 1;
        
        // Create a Header packet
        let header_packet = Packet {
            kind: Some(Kind::Header(PacketHeader {
                id: packet_counter,
                length: 42,
                checksum: 1234,
                version: 1,
                flags: 0,
            })),
        };
        
        // Create a Payload packet with sensor data
        let sensor_data = format!("sensor_{},lat:{},lon:{},alt:{},temp:{}", 
            sensor_id, 
            rand::thread_rng().gen_range(-90.0..90.0),
            rand::thread_rng().gen_range(-180.0..180.0),
            rand::thread_rng().gen_range(0.0..1000.0),
            rand::thread_rng().gen_range(20.0..30.0)
        );
        
        let payload_packet = Packet {
            kind: Some(Kind::Payload(PacketPayload {
                type_value: 2,
                data: sensor_data.as_bytes().to_vec(),
                size: sensor_data.len() as u32,
                encoding: "utf8".to_string(),
            })),
        };
        
        // Create a TargetPacket with location data
        let target_packet = Packet {
            kind: Some(Kind::TargetPacket(TargetPacket {
                target_id: sensor_id,
                lat: rand::thread_rng().gen_range(-90.0..90.0),
                lon: rand::thread_rng().gen_range(-180.0..180.0),
                alt: rand::thread_rng().gen_range(0.0..1000.0),
                time: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs_f64(),
            })),
        };
        
        // Send Header packet
        let mut header_buf = Vec::new();
        if header_packet.encode(&mut header_buf).is_ok() {
            let _ = socket.send_to(&header_buf, server_addr).await;
            println!("Sent Header packet (ID: {}) to {}", packet_counter, server_addr);
        }
        
        sleep(Duration::from_millis(200)).await;
        
        // Send Payload packet
        let mut payload_buf = Vec::new();
        if payload_packet.encode(&mut payload_buf).is_ok() {
            let _ = socket.send_to(&payload_buf, server_addr).await;
            println!("Sent Payload packet to {}", server_addr);
        }
        
        sleep(Duration::from_millis(200)).await;
        
        // Send TargetPacket
        let mut target_buf = Vec::new();
        if target_packet.encode(&mut target_buf).is_ok() {
            let _ = socket.send_to(&target_buf, server_addr).await;
            println!("Sent TargetPacket (ID: {}) to {}", sensor_id, server_addr);
        }
        
        sleep(Duration::from_millis(100)).await;
    }
}
