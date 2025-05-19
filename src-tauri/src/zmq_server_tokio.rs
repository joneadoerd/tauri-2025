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
use zmq::Context;

#[derive(Clone)]
pub struct ZmqManager {
    pub context: Arc<Context>,
    pub subs: Arc<Mutex<HashMap<String, Subscription>>>,
}

const CONFIG_FILENAME: &str = "subscriptions.json";

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SubscriptionConfig {
    pub id: String,
    pub topic: String,
}

pub struct Subscription {
    pub id: String,
    pub topic: String,
    pub handle: Option<JoinHandle<()>>,
    pub stop_tx: Option<mpsc::Sender<()>>,
    pub connected: Arc<Mutex<bool>>,
}

impl ZmqManager {
    pub fn new() -> Self {
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

        if let Ok(json) = serde_json::to_string_pretty(&list) {
            let _ = tokio::fs::write(Self::config_path(), json).await;
        }
    }

    pub fn load_config(&self, app: AppHandle) {
        let path = Self::config_path();
        if path.exists() {
            if let Ok(file) = File::open(path) {
                let reader = BufReader::new(file);
                if let Ok(subs) = serde_json::from_reader::<_, Vec<SubscriptionConfig>>(reader) {
                    for sub in subs {
                        let manager = self.clone();
                        let app_clone = app.clone();
                        tokio::spawn(async move {
                            manager.add_subscription(sub.id, sub.topic, app_clone).await;
                        });
                    }
                }
            }
        }
    }

    pub async fn add_subscription(&self, id: String, topic: String, app: AppHandle) -> bool {
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
        let mut subs = self.subs.lock().await;
        if let Some(mut sub) = subs.remove(id) {
            if let Some(stop_tx) = sub.stop_tx.take() {
                let _ = stop_tx.send(()).await;
            }

            if let Some(handle) = sub.handle.take() {
                let _ = handle.await;
            }

            println!("Subscription '{}' stopped and removed", id);
            return true;
        }
        false
    }

    pub async fn list_subscriptions(&self) -> Vec<(String, String)> {
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
            Err(_) => return,
        };
        if socket.connect("tcp://127.0.0.1:7000").is_err() {
            return;
        }
        if socket.set_subscribe(thread_topic.as_bytes()).is_err() {
            return;
        }

        {
            let mut conn = connected.blocking_lock();
            *conn = true;
        }

        loop {
            if rx.try_recv().is_ok() {
                break;
            }

            match socket.recv_bytes(zmq::DONTWAIT) {
                Ok(msg_bytes) => {
                    let encoded = base64::encode(&msg_bytes);
                    let _ = app.emit(&format!("zmq-message-{}", thread_id), encoded);
                }
                Err(e) if e == zmq::Error::EAGAIN => {
                    std::thread::sleep(std::time::Duration::from_millis(10));
                }
                Err(_) => {
                    let mut conn = connected.blocking_lock();
                    *conn = false;
                    std::thread::sleep(std::time::Duration::from_secs(1));
                }
            }
        }
    })
}