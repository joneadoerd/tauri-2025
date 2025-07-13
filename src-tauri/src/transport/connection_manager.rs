use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::transport::{ConnectionInfo, Transport};

#[derive(Default, Clone)]
pub struct Manager {
    pub connections: Arc<Mutex<HashMap<String, Arc<dyn Transport>>>>,
    pub active_shares: Arc<Mutex<HashMap<(String, String), tokio::sync::mpsc::Sender<Vec<u8>>>>>,
    pub share_tasks: Arc<Mutex<HashMap<(String, String), tokio::task::JoinHandle<()>>>>,
}

impl Manager {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(Mutex::new(HashMap::new())),
            active_shares: Arc::new(Mutex::new(HashMap::new())),
            share_tasks: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    /// Share data from one connection to another by id, with interval
    pub async fn share_data_between_ids(
        &self,
        from_id: &str,
        to_id: &str,
        interval_ms: u64,
    ) -> Result<tokio::sync::mpsc::Sender<Vec<u8>>, String> {
        let connections = self.connections.lock().await;
        let to = connections
            .get(to_id)
            .ok_or_else(|| format!("No transport found for ID: {}", to_id))?;
        // Create channel and start sharing
        let (tx, rx) = tokio::sync::mpsc::channel(100);
        to.clone().share_data_channel(rx, interval_ms);
        // Store sender for stop
        let mut active = self.active_shares.lock().await;
        active.insert((from_id.to_string(), to_id.to_string()), tx.clone());

        // Spawn a task to forward packets from 'from' to the share channel as streaming
        let from_id_owned = from_id.to_string();
        let to_id_owned = to_id.to_string();
        let tx_clone = tx.clone();
        let from_id_for_task = from_id_owned.clone();
        let handle = tokio::spawn(async move {
            loop {
                use crate::transport::serial::LAST_DATA;
                let last_data = LAST_DATA.lock().await;
                if let Some(data) = last_data.get(&from_id_for_task) {
                    let _ = tx_clone.send(data.clone()).await;
                }
                drop(last_data);
                tokio::time::sleep(std::time::Duration::from_millis(interval_ms)).await;
            }
        });
        let mut share_tasks = self.share_tasks.lock().await;
        share_tasks.insert((from_id_owned, to_id_owned), handle);
        Ok(tx)
    }

    /// Stop sharing by aborting the share task and dropping the sender for a specific from/to pair
    pub async fn stop_share(&self, from_id: &str, to_id: &str) -> Result<(), String> {
        let mut share_tasks = self.share_tasks.lock().await;
        if let Some(handle) = share_tasks.remove(&(from_id.to_string(), to_id.to_string())) {
            handle.abort();
        }
        let mut active = self.active_shares.lock().await;
        active.remove(&(from_id.to_string(), to_id.to_string()));
        Ok(())
    }

    pub async fn add_connection(
        &self,
        id: String,
        transport: Arc<dyn Transport>,
    ) -> Result<(), String> {
        let mut connections = self.connections.lock().await;
        if connections.contains_key(&id) {
            return Err(format!("Connection ID '{}' already exists", id.clone()));
        }

        connections.insert(id, transport);
        Ok(())
    }

    pub async fn send_to(&self, id: &str, data: Vec<u8>) -> Result<(), String> {
        let connections = self.connections.lock().await;
        if let Some(transport) = connections.get(id) {
            transport.send(data).await
        } else {
            Err(format!("No transport found for ID: {}", id))
        }
    }

    pub async fn stop_all(&self) {
        let mut connections = self.connections.lock().await;
        for (_id, transport) in connections.drain() {
            transport.stop().await;
        }
        connections.clear();
    }
    pub async fn stop(&self, id: &str) -> Result<(), String> {
        let mut connections = self.connections.lock().await;
        if let Some(transport) = connections.remove(id) {
            transport.stop().await;
            Ok(())
        } else {
            Err(format!("Connection ID '{}' not found", id))
        }
    }

    pub async fn list_connections(&self) -> Vec<ConnectionInfo> {
        let connections = self.connections.lock().await;
        connections
            .iter()
            .map(|(id, transport)| ConnectionInfo {
                id: id.clone(),
                name: transport.name(),
            })
            .collect()
    }
}
