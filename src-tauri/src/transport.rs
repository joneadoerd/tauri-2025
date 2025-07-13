// transport/mod.rs

pub mod commands;
pub mod connection_manager;
pub mod serial;
pub mod streamer;
use std::sync::Arc;

use async_trait::async_trait;
use prost::Message;
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
    fn name(&self) -> String;

    /// Share data from a channel to this transport in an independent Tokio task
    fn share_data_channel(self: Arc<Self>, rx: tokio::sync::mpsc::Receiver<Vec<u8>>, interval_ms: u64)
    where
        Self: 'static,
    {
        let name = self.name();
        tokio::spawn(async move {
            Self::share_data_task(self, rx, interval_ms, name).await;
        });
    }

    /// Helper async task for sharing data
    async fn share_data_task(self: Arc<Self>, mut rx: tokio::sync::mpsc::Receiver<Vec<u8>>, interval_ms: u64, name: String)
    where
        Self: 'static,
    {
        while let Some(data) = rx.recv().await {
            if let Err(e) = self.send(data).await {
                tracing::error!("Failed to share data to {}: {}", name, e);
            }
            tokio::time::sleep(std::time::Duration::from_millis(interval_ms)).await;
        }
    }
}
pub trait StatableTransport: Transport {
    async fn start<F: Message + Default + serde::Serialize>(
        &mut self,
        id: String,
        on_packet: impl FnMut(String, F) + Send + 'static,
    ) -> Result<(), String>;
}
