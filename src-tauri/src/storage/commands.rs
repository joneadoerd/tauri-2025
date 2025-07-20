use std::{env, path::Path};

use crate::storage::file_logger::LOG_DIR;

fn get_app_root() -> std::path::PathBuf {
    if let Ok(exe_path) = env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            parent.to_path_buf()
        } else {
            Path::new(".").to_path_buf()
        }
    } else {
        Path::new(".").to_path_buf()
    }
}
#[tauri::command]
pub async fn read_log_file(connection_id: String) -> Result<Vec<String>, String> {
    // Get Tauri app root directory
    let app_root = get_app_root();

    let filename = app_root
        .join("logs")
        .join(format!("connection_{}.log", connection_id));
    match std::fs::read_to_string(&filename) {
        Ok(content) => {
            let lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
            Ok(lines)
        }
        Err(e) => Err(format!("Failed to read log file {:?}: {}", filename, e)),
    }
}

#[tauri::command]
pub async fn list_log_files() -> Result<Vec<String>, String> {
    // Use user-selected log directory if set, otherwise default to app root logs
    let log_dir = {
        let log_dir_guard = LOG_DIR.lock().unwrap();
        if let Some(ref user_path) = *log_dir_guard {
            std::path::PathBuf::from(user_path)
        } else {
            let app_root = get_app_root();
            app_root.join("logs")
        }
    };
    if !log_dir.exists() {
        return Ok(vec![]);
    }

    match std::fs::read_dir(&log_dir) {
        Ok(entries) => {
            let mut files = Vec::new();
            for entry in entries {
                if let Ok(entry) = entry {
                    if let Some(file_name) = entry.file_name().to_str() {
                        if file_name.ends_with(".log") {
                            files.push(file_name.to_string());
                        }
                    }
                }
            }
            Ok(files)
        }
        Err(e) => Err(format!(
            "Failed to read logs directory {:?}: {}",
            log_dir, e
        )),
    }
}

#[tauri::command]
pub async fn get_logs_directory() -> Result<String, String> {
    let log_dir_guard = LOG_DIR.lock().unwrap();
    if let Some(ref user_path) = *log_dir_guard {
        Ok(user_path.clone())
    } else {
        let app_root = get_app_root();
        let log_dir = app_root.join("logs");
        Ok(log_dir.to_string_lossy().to_string())
    }
}

#[tauri::command]
pub async fn get_app_root_directory() -> Result<String, String> {
    let app_root = get_app_root();
    Ok(app_root.to_string_lossy().to_string())
}
#[tauri::command]
pub fn set_log_directory(path: String) {
    let mut log_dir = LOG_DIR.lock().unwrap();
    *log_dir = Some(path);
}
