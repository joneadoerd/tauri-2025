use once_cell::sync::Lazy;
use std::env;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::Path;
use tokio::sync::mpsc;
use tracing::{error, info as trace_info};
use std::sync::Mutex;

// Holds the user-selected log directory, if set
pub static LOG_DIR: Lazy<Mutex<Option<String>>> = Lazy::new(|| Mutex::new(None));

static LOGGING_CHANNEL: Lazy<mpsc::UnboundedSender<(String, String, String)>> = Lazy::new(|| {
    let (tx, mut rx) = mpsc::unbounded_channel::<(String, String, String)>();

    // Spawn logging worker
    tokio::spawn(async move {
        // Get Tauri app root directory
        let app_root = if let Ok(exe_path) = env::current_exe() {
            if let Some(parent) = exe_path.parent() {
                parent.to_path_buf()
            } else {
                Path::new(".").to_path_buf()
            }
        } else {
            Path::new(".").to_path_buf()
        };

        // Use user-selected log directory if set, otherwise default to AppData/logs
        let log_dir = {
            let log_dir_guard = LOG_DIR.lock().unwrap();
            if let Some(ref user_path) = *log_dir_guard {
                std::path::PathBuf::from(user_path)
            } else {
                app_root.join("logs")
            }
        };
        if !log_dir.exists() {
            if let Err(e) = std::fs::create_dir_all(&log_dir) {
                error!("Failed to create logs directory at {:?}: {}", log_dir, e);
                return;
            }
        }
        trace_info!("Logs directory created at: {:?}", log_dir);

        while let Some((connection_id, json_data, timestamp)) = rx.recv().await {
            // Validate connection_id is not empty
            if connection_id.is_empty() {
                error!("Empty connection_id received for logging");
                continue;
            }

            // Write to log file in Tauri app root
            let filename = log_dir.join(format!("connection_{}.log", connection_id));

            // Ensure the log directory exists
            if let Err(e) = std::fs::create_dir_all(&log_dir) {
                error!("Failed to create logs directory at {:?}: {}", log_dir, e);
                continue;
            }

            match OpenOptions::new().create(true).append(true).open(&filename) {
                Ok(mut file) => {
                    if let Err(e) = writeln!(file, "[{}] {}", timestamp, json_data) {
                        error!("Failed to write to log file {:?}: {}", filename, e);
                    } else {
                        trace_info!(
                            "[{}] [{}] Logged packet to file: {:?}",
                            connection_id,
                            timestamp,
                            filename
                        );
                    }
                }
                Err(e) => {
                    error!("Failed to open log file {:?}: {}", filename, e);
                }
            }
        }
    });

    tx
});



pub fn save_packet_fast(connection_id: &str, packet: &impl serde::Serialize) {
    // Validate connection_id
    if connection_id.is_empty() {
        error!("Empty connection_id provided to save_packet_fast");
        return;
    }

    // Convert packet to JSON
    let json_data = match serde_json::to_string(packet) {
        Ok(json) => json,
        Err(e) => {
            error!(
                "Failed to serialize packet to JSON for {}: {}",
                connection_id, e
            );
            return;
        }
    };

    // Get current timestamp
    let timestamp = chrono::Utc::now()
        .format("%Y-%m-%d %H:%M:%S%.3f")
        .to_string();

    // Send to logging channel (non-blocking)
    if let Err(e) = LOGGING_CHANNEL.send((connection_id.to_string(), json_data, timestamp)) {
        error!(
            "Failed to send data to logging channel for {}: {}",
            connection_id, e
        );
    } else {
        trace_info!("[{}] Packet sent to logging channel", connection_id);
    }
}

// Function to log sent data
pub fn log_sent_data(connection_id: &str, data: &[u8]) {
    // Convert raw data to hex string for logging
    let hex_data = data
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<Vec<String>>()
        .join(" ");

    let timestamp = chrono::Utc::now()
        .format("%Y-%m-%d %H:%M:%S%.3f")
        .to_string();
    let log_entry = format!("SENT: {}", hex_data);

    // Send to logging channel (non-blocking)
    if let Err(e) = LOGGING_CHANNEL.send((connection_id.to_string(), log_entry, timestamp)) {
        error!("Failed to send sent data to logging channel: {}", e);
    }
}
