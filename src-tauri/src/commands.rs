use crate::zmq::ZmqManager;
use std::sync::Mutex;
use tauri::{AppHandle, State};

pub struct AppState(pub Mutex<Option<ZmqManager>>);

#[tauri::command]
pub fn init_zmq(app: AppHandle, state: State<AppState>) {
    let mut zmq_state = state.0.lock().unwrap();
    if zmq_state.is_none() {
        let manager = ZmqManager::new();
        manager.load_config(app);
        *zmq_state = Some(manager);
    }
}

#[tauri::command]
pub fn add_sub(id: String, topic: String, app: AppHandle, state: State<AppState>) -> bool {
    if let Some(manager) = &*state.0.lock().unwrap() {
        if manager.add_subscription(id, topic, app) {
            manager.save_config();
            return true;
        }
    }
    false
}

#[tauri::command]
pub fn remove_sub(id: String, state: State<AppState>) -> bool {
    if let Some(manager) = &*state.0.lock().unwrap() {
        if manager.remove_subscription(id.as_str()) {
            manager.save_config();
            return true;
        }
    }
    false
}

#[tauri::command]
pub fn list_subs(state: State<AppState>) -> Vec<(String, String)> {
    if let Some(manager) = &*state.0.lock().unwrap() {
        return manager.list_subscriptions();
    }
    vec![]
}
#[tauri::command]
pub fn list_subs_with_status(state: State<AppState>) -> Vec<(String, String, bool)> {
    if let Some(manager) = &*state.0.lock().unwrap() {
        let subs = manager.subs.lock().unwrap();
        return subs
            .values()
            .map(|s| {
                let connected = *s.connected.lock().unwrap();
                (s.id.clone(), s.topic.clone(), connected)
            })
            .collect();
    }
    vec![]
}