use crate::zmq::ZmqManager;
use std::sync::Mutex;
use tauri::{AppHandle, State};

pub struct AppState(pub Mutex<Option<ZmqManager>>);

#[tauri::command]
pub fn init_zmq(state: State<AppState>) {
    let mut zmq_state = state.0.lock().unwrap();
    if zmq_state.is_none() {
        *zmq_state = Some(ZmqManager::new());
        println!("ZMQ context initialized");
    }
}

#[tauri::command]
pub fn add_sub(id: String, topic: String, app: AppHandle, state: State<AppState>) -> bool {
    if let Some(manager) = &*state.0.lock().unwrap() {
        return manager.add_subscription(id, topic, app);
    }
    false
}

#[tauri::command]
pub fn remove_sub(id: String, state: State<AppState>) -> bool {
    if let Some(manager) = &*state.0.lock().unwrap() {
        return manager.remove_subscription(&id);
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
