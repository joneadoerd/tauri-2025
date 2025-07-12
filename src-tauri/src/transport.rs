// transport/mod.rs

pub mod commands;
pub mod connection_manager;
pub mod serial;
use async_trait::async_trait;
use serde::Serialize;

#[derive(Serialize, Clone, Debug)]
pub struct ConnectionInfo {
    pub id: String,
    pub name: String,
}

#[async_trait]
pub trait Transport: Send + Sync {
    async fn send(&self, data: Vec<u8>) -> Result<(), String>;
    async fn stop(&self);
    fn name(&self) -> String; // ✅ Add this
}
