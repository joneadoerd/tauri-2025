use derivative::Derivative;
use prost::Message;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    env,
    fs::{create_dir_all, File},
    io::BufReader,
    sync::Arc,
};
use tauri::{AppHandle, Emitter};
use tokio::{
    sync::{mpsc, Mutex},
    task::JoinHandle,
};
use tracing::{error, info};
use zmq::Context;

use crate::packet::PacketHeader;

#[derive(Clone, Derivative)]
#[derivative(Debug)]
pub struct ZmqManager {
    #[derivative(Debug = "ignore")]
    pub context: Arc<Context>,
    pub subs: Arc<Mutex<HashMap<String, Subscription>>>,
}

const CONFIG_FILENAME: &str = "subscriptions.json";

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SubscriptionConfig {
    pub id: String,
    pub topic: String,
}

#[derive(Debug)]
pub struct Subscription {
    pub id: String,
    pub topic: String,
    pub handle: Option<JoinHandle<()>>,
    pub stop_tx: Option<mpsc::Sender<()>>,
    pub connected: Arc<Mutex<bool>>,
}

impl ZmqManager {
    pub fn new() -> Self {
        info!("ZmqManager created");
        Self {
            context: Arc::new(zmq::Context::new()),
            subs: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    fn config_path() -> std::path::PathBuf {
        let mut path = env::current_exe().expect("Failed to get current executable path");
        path.pop();
        let base = path.join("data");
        create_dir_all(&base).unwrap();
        base.join(CONFIG_FILENAME)
    }

    pub async fn save_config(&self) {
        let subs = self.subs.lock().await;
        let list: Vec<SubscriptionConfig> = subs
            .values()
            .map(|s| SubscriptionConfig {
                id: s.id.clone(),
                topic: s.topic.clone(),
            })
            .collect();

        match serde_json::to_string_pretty(&list) {
            Ok(json) => {
                if let Err(e) = tokio::fs::write(Self::config_path(), json).await {
                    error!("Failed to write config: {}", e);
                } else {
                    info!("Config saved");
                }
            }
            Err(e) => error!("Failed to serialize config: {}", e),
        }
    }

    pub fn load_config(&self, app: AppHandle) {
        let path = Self::config_path();
        if path.exists() {
            if let Ok(file) = File::open(path) {
                let reader = BufReader::new(file);
                match serde_json::from_reader::<_, Vec<SubscriptionConfig>>(reader) {
                    Ok(subs) => {
                        info!("Loaded {} subscriptions from config", subs.len());
                        for sub in subs {
                            let manager = self.clone();
                            let app_clone = app.clone();
                            tokio::spawn(async move {
                                manager.add_subscription(sub.id, sub.topic, app_clone).await;
                            });
                        }
                    }
                    Err(e) => error!("Failed to parse config: {}", e),
                }
            } else {
                error!("Failed to open config file");
            }
        }
    }

    pub async fn add_subscription(&self, id: String, topic: String, app: AppHandle) -> bool {
        info!("Adding subscription: id={}, topic={}", id, topic);
        let mut subs = self.subs.lock().await;
        if subs.contains_key(&id) {
            return false;
        }

        let context = Arc::clone(&self.context);
        let (tx, rx) = mpsc::channel::<()>(1);
        let connected = Arc::new(Mutex::new(false));

        let handle = spawn_zmq_subscription(
            context,
            id.clone(),
            topic.clone(),
            app,
            rx,
            Arc::clone(&connected),
        );

        subs.insert(
            id.clone(),
            Subscription {
                id,
                topic,
                handle: Some(handle),
                stop_tx: Some(tx),
                connected,
            },
        );

        true
    }

    // Helper function for the blocking ZeroMQ logic

    pub async fn remove_subscription(&self, id: &str) -> bool {
        info!("Removing subscription: id={}", id);
        let mut subs = self.subs.lock().await;
        if let Some(mut sub) = subs.remove(id) {
            if let Some(stop_tx) = sub.stop_tx.take() {
                let _ = stop_tx.send(()).await;
            }

            if let Some(handle) = sub.handle.take() {
                let _ = handle.await;
            }

            info!("Subscription '{}' stopped and removed", id);
            return true;
        }
        false
    }

    pub async fn list_subscriptions(&self) -> Vec<(String, String)> {
        info!("Listing subscriptions");
        let subs = self.subs.lock().await;
        subs.values()
            .map(|s| (s.id.clone(), s.topic.clone()))
            .collect()
    }
}

fn spawn_zmq_subscription(
    context: Arc<Context>,
    thread_id: String,
    thread_topic: String,
    app: AppHandle,
    mut rx: mpsc::Receiver<()>,
    connected: Arc<Mutex<bool>>,
) -> JoinHandle<()> {
    tokio::task::spawn_blocking(move || {
        let socket = match context.socket(zmq::SUB) {
            Ok(sock) => sock,
            Err(e) => {
                error!("Failed to create ZMQ socket: {}", e);
                return;
            }
        };
        if let Err(e) = socket.connect("tcp://127.0.0.1:7000") {
            error!("Failed to connect ZMQ socket: {}", e);
            return;
        }
        if let Err(e) = socket.set_subscribe(thread_topic.as_bytes()) {
            error!("Failed to subscribe to topic: {}", e);
            return;
        }

        {
            let mut conn = connected.blocking_lock();
            *conn = true;
        }

        loop {
            match rx.try_recv() {
                Ok(_) => {
                    info!("Subscription thread {} received stop signal", thread_id);
                    break;
                }
                Err(tokio::sync::mpsc::error::TryRecvError::Disconnected) => {
                    info!("Subscription thread {} channel closed", thread_id);
                    break;
                }
                Err(tokio::sync::mpsc::error::TryRecvError::Empty) => {
                    // continue as normal
                }
            }

            match socket.recv_multipart(zmq::DONTWAIT) {
                Ok(parts) => {
                    if parts.len() == 2 {
                        let _topic = String::from_utf8_lossy(&parts[0]);
                 
                        
                       let data =PacketHeader::decode(&*parts[1]).unwrap();
                        let _ = app.emit(&format!("zmq-message-{}", thread_id), data);  
                          
                    }
                }
                
                Err(_e) => {
                    let mut conn = connected.blocking_lock();
                    *conn = false;
                    // error!("Failed to receive message: {}",e);
                    std::thread::sleep(std::time::Duration::from_millis(50));
                }
                
            }
        }
    })
}
