use prost::Message;
use rand::rngs::StdRng;
use rand::{Rng, SeedableRng};

use std::env;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::Mutex;
use tokio::time::sleep;
use tokio_serial::SerialPortBuilderExt;
#[path = "../packet.rs"]
pub mod packet;
// Import your packet types
use packet::{Packet, PacketChecksum, PacketHeader, PacketPayload};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 2 {
        println!("Usage: {} <serial_port>", args[0]);
        println!("Example: {} COM3", args[0]);
        return Ok(());
    }

    let port_name = &args[1];
    println!("Starting serial client on port: {}", port_name);

    // Open serial port
    let port = tokio_serial::new(port_name, 115200)
        .timeout(Duration::from_millis(100))
        .open_native_async()?;

    println!("Serial port opened successfully!");

    // Split into reader and writer
    let (mut reader, writer) = tokio::io::split(port);
    let writer = Arc::new(Mutex::new(writer));

    // Spawn streaming task
    let writer_stream = writer.clone();
    tokio::spawn(async move {
        let mut rng = StdRng::from_entropy();
        loop {
            // Generate random streaming data
            let header = PacketHeader {
                id: rng.gen_range(1..1000),
                length: rng.gen_range(10..100),
                checksum: rng.gen_range(1000..9999),
                version: 1,
                flags: rng.gen_range(0..16),
            };

            let packet = Packet {
                kind: Some(packet::packet::Kind::Header(header)),
            };

            let mut buf = Vec::new();
            if let Ok(()) = packet.encode(&mut buf) {
                // Add length prefix (4 bytes, big-endian)
                let length = buf.len() as u32;
                let length_bytes = length.to_be_bytes();
                
                let mut writer_guard = writer_stream.lock().await;
                // Write length prefix
                if let Err(e) = writer_guard.write_all(&length_bytes).await {
                    eprintln!("Streaming write error: {}", e);
                    break;
                }
                // Write protobuf data
                if let Err(e) = writer_guard.write_all(&buf).await {
                    eprintln!("Streaming write error: {}", e);
                    break;
                }
                println!("Sent streaming header data ({} bytes)", length);
            }

            sleep(Duration::from_millis(1000)).await; // Send every 1 second
        }
    });

    // Main command loop
    let mut buffer = Vec::new();
    loop {
        let mut buf = vec![0u8; 1024];
        match reader.read(&mut buf).await {
            Ok(n) if n > 0 => {
                buf.truncate(n);
                buffer.extend_from_slice(&buf);
                println!("Received {} bytes, buffer size: {}", n, buffer.len());

                // Try to decode complete messages from buffer
                while buffer.len() >= 4 {
                    // Read message length (first 4 bytes)
                    let length = u32::from_be_bytes([buffer[0], buffer[1], buffer[2], buffer[3]]) as usize;
                    
                    if buffer.len() >= 4 + length {
                        // Extract the complete message (skip the 4-byte length prefix)
                        let message = buffer[4..4+length].to_vec();
                        buffer.drain(0..4+length);
                        
                        // Try to decode as Packet
                        match Packet::decode(message.as_slice()) {
                            Ok(packet) => {
                                match packet.kind {
                                    Some(packet::packet::Kind::Header(header)) => {
                                        println!("Received HEADER: {:?}", header);
                                        // Send response after 10 seconds
                                        let writer_resp = writer.clone();
                                        tokio::spawn(async move {
                                            sleep(Duration::from_secs(10)).await;

                                            let response = PacketHeader {
                                                id: header.id + 1000,
                                                length: header.length,
                                                checksum: header.checksum + 1,
                                                version: header.version,
                                                flags: header.flags,
                                            };

                                            let resp_packet = Packet {
                                                kind: Some(packet::packet::Kind::Header(response)),
                                            };

                                            let mut resp_buf = Vec::new();
                                            if let Ok(()) = resp_packet.encode(&mut resp_buf) {
                                                // Add length prefix (4 bytes, big-endian)
                                                let length = resp_buf.len() as u32;
                                                let length_bytes = length.to_be_bytes();
                                                
                                                let mut writer_guard = writer_resp.lock().await;
                                                // Write length prefix
                                                if let Err(e) = writer_guard.write_all(&length_bytes).await {
                                                    eprintln!("Response write error: {}", e);
                                                } else {
                                                    // Write protobuf data
                                                    if let Err(e) = writer_guard.write_all(&resp_buf).await {
                                                        eprintln!("Response write error: {}", e);
                                                    } else {
                                                        println!("Sent response after 10 seconds ({} bytes)", length);
                                                    }
                                                }
                                            }
                                        });
                                    }
                                    Some(packet::packet::Kind::Payload(payload)) => {
                                        println!("Received PAYLOAD: {:?}", payload);
                                        // Send response after 10 seconds
                                        let writer_resp = writer.clone();
                                        tokio::spawn(async move {
                                            sleep(Duration::from_secs(10)).await;

                                            let response = PacketPayload {
                                                type_value: payload.type_value + 1,
                                                data: payload.data.clone(),
                                                size: payload.size,
                                                encoding: payload.encoding.clone(),
                                            };

                                            let resp_packet = Packet {
                                                kind: Some(packet::packet::Kind::Payload(response)),
                                            };

                                            let mut resp_buf = Vec::new();
                                            if let Ok(()) = resp_packet.encode(&mut resp_buf) {
                                                // Add length prefix (4 bytes, big-endian)
                                                let length = resp_buf.len() as u32;
                                                let length_bytes = length.to_be_bytes();
                                                
                                                let mut writer_guard = writer_resp.lock().await;
                                                // Write length prefix
                                                if let Err(e) = writer_guard.write_all(&length_bytes).await {
                                                    eprintln!("Response write error: {}", e);
                                                } else {
                                                    // Write protobuf data
                                                    if let Err(e) = writer_guard.write_all(&resp_buf).await {
                                                        eprintln!("Response write error: {}", e);
                                                    } else {
                                                        println!("Sent payload response after 10 seconds ({} bytes)", length);
                                                    }
                                                }
                                            }
                                        });
                                    }
                                    Some(packet::packet::Kind::Checksum(checksum)) => {
                                        println!("Received CHECKSUM: {:?}", checksum);
                                        // Send response after 10 seconds
                                        let writer_resp = writer.clone();
                                        tokio::spawn(async move {
                                            sleep(Duration::from_secs(10)).await;

                                            let response = PacketChecksum {
                                                algorithm: checksum.algorithm,
                                                value: checksum.value.clone(),
                                                length: checksum.length,
                                            };

                                            let resp_packet = Packet {
                                                kind: Some(packet::packet::Kind::Checksum(response)),
                                            };

                                            let mut resp_buf = Vec::new();
                                            if let Ok(()) = resp_packet.encode(&mut resp_buf) {
                                                // Add length prefix (4 bytes, big-endian)
                                                let length = resp_buf.len() as u32;
                                                let length_bytes = length.to_be_bytes();
                                                
                                                let mut writer_guard = writer_resp.lock().await;
                                                // Write length prefix
                                                if let Err(e) = writer_guard.write_all(&length_bytes).await {
                                                    eprintln!("Response write error: {}", e);
                                                } else {
                                                    // Write protobuf data
                                                    if let Err(e) = writer_guard.write_all(&resp_buf).await {
                                                        eprintln!("Response write error: {}", e);
                                                    } else {
                                                        println!("Sent checksum response after 10 seconds ({} bytes)", length);
                                                    }
                                                }
                                            }
                                        });
                                    }
                                    _ => {
                                        println!("Received unknown packet type");
                                    }
                                }
                            }
                            Err(e) => {
                                println!("Failed to decode packet: {}", e);
                            }
                        }
                    } else {
                        // Not enough data for complete message, wait for more
                        break;
                    }
                }
            }
            Ok(_) => continue,
            Err(e) => {
                eprintln!("Read error: {}", e);
                return Ok(());
            }
        }
    }
}
