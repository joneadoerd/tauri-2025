use serde::{Deserialize, Serialize};

use crate::simulation::SimulationResultList;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationStreamConfig {
    pub target_id: u32,
    pub serial_connection_id: String,
    pub stream_interval_ms: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationStreamRequest {
    pub simulation_data: SimulationResultList,
    pub stream_configs: Vec<SimulationStreamConfig>,
    pub stream_interval_ms: u64,

}