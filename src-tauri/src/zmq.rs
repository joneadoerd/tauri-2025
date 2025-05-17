use std::{
    collections::HashMap,
    sync::{mpsc::{channel, Receiver, Sender}, Arc, Mutex},
    thread::{self, JoinHandle},
};
use tauri::{AppHandle, Emitter};
use zmq::Context;

#[derive(Clone)]
pub struct ZmqManager {
    pub context: Arc<Context>,
    pub subs: Arc<Mutex<HashMap<String, Subscription>>>,
}

#[derive(Debug)]
pub struct Subscription {
    pub id: String,
    pub topic: String,
    pub handle: Option<JoinHandle<()>>,
    pub stop_tx: Option<Sender<()>>, // shutdown signal
}

impl ZmqManager {
    pub fn new() -> Self {
        ZmqManager {
            context: Arc::new(zmq::Context::new()),
            subs: Arc::new(Mutex::new(HashMap::new())),
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

    let handle = thread::spawn(move || {
        let sub_socket = context.socket(zmq::SUB).expect("Failed to create SUB socket");
        sub_socket.connect("tcp://127.0.0.1:7000").expect("Failed to connect SUB");
        sub_socket.set_subscribe(thread_topic.as_bytes()).expect("Failed to subscribe");

        loop {
            if rx.try_recv().is_ok() {
                println!("Stopping thread for {}", thread_id);
                break;
            }

            if let Ok(msg) = sub_socket.recv_string(zmq::DONTWAIT) {
                if let Ok(message) = msg {
                    let _ = app.emit(&format!("zmq-message-{}", thread_id), message);
                }
            } else {
                thread::sleep(std::time::Duration::from_millis(50)); // small sleep to prevent CPU spike
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
