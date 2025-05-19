use std::{
    collections::HashMap,
    env,
    sync::{
        mpsc::{channel, Receiver, Sender},
        Arc, Mutex,
    },
    thread::{self, JoinHandle},
};
use tauri::{AppHandle, Emitter};
use zmq::Context;

use serde::{Deserialize, Serialize};
use std::fs::{create_dir_all, File};
use std::io::BufReader;
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
#[derive(Debug)]
pub struct Subscription {
    pub id: String,
    pub topic: String,
    pub handle: Option<JoinHandle<()>>,
    pub stop_tx: Option<Sender<()>>,
    pub connected: Arc<Mutex<bool>>,
}

impl ZmqManager {
    pub fn new() -> Self {
        ZmqManager {
            context: Arc::new(zmq::Context::new()),
            subs: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    fn config_path() -> std::path::PathBuf {
        let mut path = env::current_exe().expect("Failed to get current executable path");
        path.pop(); // remove executable name

        let base = path.join("data");

        create_dir_all(&base).unwrap();
        base.join(CONFIG_FILENAME)
    }

    pub fn save_config(&self) {
        let subs = self.subs.lock().unwrap();
        let list: Vec<SubscriptionConfig> = subs.values().map(|s| SubscriptionConfig {
            id: s.id.clone(),
            topic: s.topic.clone(),
        }).collect();

        if let Ok(json) = serde_json::to_string_pretty(&list) {
            let _ = std::fs::write(Self::config_path(), json);
        }
    }

    pub fn load_config(&self, app: AppHandle) {
        let path = Self::config_path();
        if path.exists() {
            if let Ok(file) = File::open(path) {
                let reader = BufReader::new(file);
                if let Ok(subs) = serde_json::from_reader::<_, Vec<SubscriptionConfig>>(reader) {
                    for sub in subs {
                        self.add_subscription(sub.id, sub.topic, app.clone());
                    }
                }
            }
        }
    }
    pub fn add_subscription(&self, id: String, topic: String, app: AppHandle) -> bool {
        let mut subs = self.subs.lock().unwrap();
        if subs.contains_key(&id) {
            return false;
        }

        let context = Arc::clone(&self.context);
        let thread_id = id.clone();
        let thread_topic = topic.clone();
        let (tx, rx): (Sender<()>, Receiver<()>) = channel();
        let connected = Arc::new(Mutex::new(false));
        let connected_clone = Arc::clone(&connected);

        let handle = thread::spawn(move || {
            let sub_socket = context
                .socket(zmq::SUB)
                .expect("Failed to create SUB socket");
            if sub_socket.connect("tcp://127.0.0.1:7000").is_err() {
                return;
            }
            if sub_socket.set_subscribe(thread_topic.as_bytes()).is_err() {
                return;
            }
            *connected_clone.lock().unwrap() = true;

            loop {
                if rx.try_recv().is_ok() {
                    break;
                }

                match sub_socket.recv_string(zmq::DONTWAIT) {
                    Ok(Ok(message)) => {
                        let _ = app.emit(&format!("zmq-message-{}", thread_id), message);
                    }
                    Err(_) => {
                        *connected_clone.lock().unwrap() = false;
                        thread::sleep(std::time::Duration::from_secs(1));
                    }
                    _ => {
                        thread::sleep(std::time::Duration::from_millis(50));
                    }
                }
            }
        });

        subs.insert(
            id.clone(),
            Subscription {
                id,
                topic,
                handle: Some(handle),
                stop_tx: Some(tx),
                connected: Arc::clone(&connected),
            },
        );

        true
    }

    pub fn remove_subscription(&self, id: &str) -> bool {
        let mut subs = self.subs.lock().unwrap();
        if let Some(mut sub) = subs.remove(id) {
            if let Some(stop_tx) = sub.stop_tx.take() {
                let _ = stop_tx.send(()); // ask thread to exit
            }

            if let Some(handle) = sub.handle.take() {
                let _ = handle.join(); // wait for it to cleanly exit
            }

            println!("Subscription '{}' stopped and removed", id);
            return true;
        }

        false
    }

    pub fn list_subscriptions(&self) -> Vec<(String, String)> {
        let subs = self.subs.lock().unwrap();
        subs.values()
            .map(|s| (s.id.clone(), s.topic.clone()))
            .collect()
    }
}
