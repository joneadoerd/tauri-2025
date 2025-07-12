use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::transport::{ConnectionInfo, Transport};

#[derive(Default , Clone)]
pub struct Manager {
    pub connections: Arc<Mutex<HashMap<String, Arc<dyn Transport>>>>,
}

impl Manager {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(Mutex::new(HashMap::new())),
        }
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
