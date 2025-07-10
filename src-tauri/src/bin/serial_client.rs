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
        let mut packet_count = 0;
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
                let mut writer_guard = writer_stream.lock().await;
                
                // Write protobuf data directly without length prefix
                if let Err(e) = writer_guard.write_all(&buf).await {
                    eprintln!("Streaming write error: {}", e);
                    break;
                }
                
                // Flush to ensure data is sent immediately
                if let Err(e) = writer_guard.flush().await {
                    eprintln!("Streaming flush error: {}", e);
                    break;
                }
                
                packet_count += 1;
                println!("Sent streaming header data ({} bytes) - Packet #{}", buf.len(), packet_count);
            }

            sleep(Duration::from_millis(1000)).await; // Send every 100ms
        }
    });

    // Main command loop
    let mut buffer = Vec::new();
    let mut packet_count = 0;
    const MAX_BUFFER_SIZE: usize = 1024 * 1024; // 1MB max buffer size
    
    loop {
        let mut buf = vec![0u8; 1024];
        match reader.read(&mut buf).await {
            Ok(n) if n > 0 => {
                buf.truncate(n);
                buffer.extend_from_slice(&buf);
                
                // Prevent buffer overflow
                if buffer.len() > MAX_BUFFER_SIZE {
                    eprintln!("Buffer overflow detected, clearing buffer");
                    buffer.clear();
                    continue;
                }
                
                println!("Received {} bytes, buffer size: {}", n, buffer.len());

                // Process all complete packets in buffer
                let mut processed_bytes = 0;
                while buffer.len() > processed_bytes {
                    let remaining_data = &buffer[processed_bytes..];
                    
                    // Try to decode as Packet
                    match Packet::decode(remaining_data) {
                        Ok(packet) => {
                            let packet_size = packet.encoded_len();
                            if packet_size <= remaining_data.len() {
                                packet_count += 1;
                                println!("Processing packet #{}", packet_count);
                                
                                                                        match packet.kind {
                                            Some(packet::packet::Kind::Header(header)) => {
                                                println!("Received HEADER: {:?}", header);
                                                // Send delayed response after 5 seconds
                                                let writer_resp = writer.clone();
                                                tokio::spawn(async move {
                                                    // Wait 5 seconds before sending response
                                                    sleep(Duration::from_secs(5)).await;
                                                    
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
                                                        let mut writer_guard = writer_resp.lock().await;
                                                        
                                                        // Write protobuf data directly without length prefix
                                                        if let Err(e) = writer_guard.write_all(&resp_buf).await {
                                                            eprintln!("Response write error: {}", e);
                                                        } else {
                                                            // Flush to ensure immediate transmission
                                                            if let Err(e) = writer_guard.flush().await {
                                                                eprintln!("Response flush error: {}", e);
                                                            } else {
                                                                println!("Sent delayed header response after 5 seconds ({} bytes)", resp_buf.len());
                                                            }
                                                        }
                                                    }
                                                });
                                            }
                                            Some(packet::packet::Kind::Payload(payload)) => {
                                                println!("Received PAYLOAD: {:?}", payload);
                                                // Send delayed response after 5 seconds
                                                let writer_resp = writer.clone();
                                                tokio::spawn(async move {
                                                    // Wait 5 seconds before sending response
                                                    sleep(Duration::from_secs(5)).await;
                                                    
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
                                                        let mut writer_guard = writer_resp.lock().await;
                                                        
                                                        // Write protobuf data directly without length prefix
                                                        if let Err(e) = writer_guard.write_all(&resp_buf).await {
                                                            eprintln!("Response write error: {}", e);
                                                        } else {
                                                            // Flush to ensure immediate transmission
                                                            if let Err(e) = writer_guard.flush().await {
                                                                eprintln!("Response flush error: {}", e);
                                                            } else {
                                                                println!("Sent delayed payload response after 5 seconds ({} bytes)", resp_buf.len());
                                                            }
                                                        }
                                                    }
                                                });
                                            }
                                            Some(packet::packet::Kind::Checksum(checksum)) => {
                                                println!("Received CHECKSUM: {:?}", checksum);
                                                // Send delayed response after 5 seconds
                                                let writer_resp = writer.clone();
                                                tokio::spawn(async move {
                                                    // Wait 5 seconds before sending response
                                                    sleep(Duration::from_secs(5)).await;
                                                    
                                                    let response = PacketChecksum {
                                                        algorithm: checksum.algorithm,
                                                        value: checksum.value.clone(),
                                                        length: checksum.length,
                                                    };

                                                    let resp_packet = Packet {
                                                        kind: Some(packet::packet::Kind::Checksum(
                                                            response,
                                                        )),
                                                    };

                                                    let mut resp_buf = Vec::new();
                                                    if let Ok(()) = resp_packet.encode(&mut resp_buf) {
                                                        let mut writer_guard = writer_resp.lock().await;
                                                        
                                                        // Write protobuf data directly without length prefix
                                                        if let Err(e) = writer_guard.write_all(&resp_buf).await {
                                                            eprintln!("Response write error: {}", e);
                                                        } else {
                                                            // Flush to ensure immediate transmission
                                                            if let Err(e) = writer_guard.flush().await {
                                                                eprintln!("Response flush error: {}", e);
                                                            } else {
                                                                println!("Sent delayed checksum response after 5 seconds ({} bytes)", resp_buf.len());
                                                            }
                                                        }
                                                    }
                                                });
                                            }
                                            _ => {
                                                println!("Received unknown packet type");
                                            }
                                        }
                                
                                processed_bytes += packet_size;
                            } else {
                                // Incomplete packet, wait for more data
                                break;
                            }
                        }
                        Err(_) => {
                            // If we can't decode, try to find a valid packet boundary
                            let mut found_packet = false;
                            for offset in 1..std::cmp::min(remaining_data.len(), 100) {
                                if let Ok(packet) = Packet::decode(&remaining_data[offset..]) {
                                    let packet_size = packet.encoded_len();
                                    if offset + packet_size <= remaining_data.len() {
                                        packet_count += 1;
                                        println!("Processing packet #{} (found at offset {})", packet_count, offset);
                                        
                                        // Process the packet (same logic as above)
                                        match packet.kind {
                                            Some(packet::packet::Kind::Header(header)) => {
                                                println!("Received HEADER: {:?}", header);
                                                // Send delayed response after 5 seconds
                                                let writer_resp = writer.clone();
                                                tokio::spawn(async move {
                                                    // Wait 5 seconds before sending response
                                                    sleep(Duration::from_secs(5)).await;
                                                    
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
                                                        let mut writer_guard = writer_resp.lock().await;
                                                        
                                                        if let Err(e) = writer_guard.write_all(&resp_buf).await {
                                                            eprintln!("Response write error: {}", e);
                                                        } else {
                                                            if let Err(e) = writer_guard.flush().await {
                                                                eprintln!("Response flush error: {}", e);
                                                            } else {
                                                                println!("Sent delayed header response after 5 seconds ({} bytes)", resp_buf.len());
                                                            }
                                                        }
                                                    }
                                                });
                                            }
                                            Some(packet::packet::Kind::Payload(payload)) => {
                                                println!("Received PAYLOAD: {:?}", payload);
                                                // Send delayed response after 5 seconds
                                                let writer_resp = writer.clone();
                                                tokio::spawn(async move {
                                                    // Wait 5 seconds before sending response
                                                    sleep(Duration::from_secs(5)).await;
                                                    
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
                                                        let mut writer_guard = writer_resp.lock().await;
                                                        
                                                        if let Err(e) = writer_guard.write_all(&resp_buf).await {
                                                            eprintln!("Response write error: {}", e);
                                                        } else {
                                                            if let Err(e) = writer_guard.flush().await {
                                                                eprintln!("Response flush error: {}", e);
                                                            } else {
                                                                println!("Sent delayed payload response after 5 seconds ({} bytes)", resp_buf.len());
                                                            }
                                                        }
                                                    }
                                                });
                                            }
                                            _ => {
                                                println!("Received packet at offset {}", offset);
                                            }
                                        }
                                        
                                        processed_bytes += offset + packet_size;
                                        found_packet = true;
                                        break;
                                    }
                                }
                            }
                            
                            if !found_packet {
                                // No valid packet found, remove one byte and try again
                                processed_bytes += 1;
                                if processed_bytes >= buffer.len() {
                                    // No more data to process
                                    break;
                                }
                            }
                        }
                    }
                }
                
                // Remove processed bytes from buffer
                if processed_bytes > 0 {
                    buffer.drain(0..processed_bytes);
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
