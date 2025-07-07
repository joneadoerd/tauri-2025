# Simulation Streaming System

This system allows you to stream simulation target position data to multiple serial connections in real-time. Each target-connection pair runs in its own spawned task for optimal performance.

## Overview

The simulation streaming system consists of:

1. **Backend (Rust)**: `src-tauri/src/general/simulation_streaming.rs`
2. **Frontend (TypeScript)**: `src/lib/simulation-streaming.ts`
3. **UI Component**: `src/components/SimulationStreamingControl.tsx`
4. **Demo Page**: `src/app/SimulationStreamingDemo.tsx`

## Features

- **Multi-target streaming**: Stream different targets to different serial connections
- **Configurable intervals**: Set update frequency per stream (10ms - 10s)
- **Concurrent processing**: Each target-connection pair runs in its own spawned task
- **Real-time position data**: Stream latitude, longitude, and altitude
- **Individual control**: Start/stop specific streams or all streams
- **Error handling**: Comprehensive validation and error reporting
- **Protocol Buffer encoding**: Efficient binary data transmission

## Architecture

### Backend Structure

```rust
// Core streaming manager
pub struct SimulationStreamer {
    serial_manager: Arc<SerialManager>,
    active_streams: Arc<Mutex<HashMap<String, tokio::task::JoinHandle<()>>>>,
}

// Configuration for each stream
pub struct SimulationStreamConfig {
    pub target_id: u32,
    pub serial_connection_id: String,
    pub stream_interval_ms: u64,
}

// Complete streaming request
pub struct SimulationStreamRequest {
    pub simulation_data: SimulationResultList,
    pub stream_configs: Vec<SimulationStreamConfig>,
    pub stream_interval_ms: u64,
}
```

### Frontend Interface

```typescript
// Start streaming simulation data
async function startSimulationStreaming(request: SimulationStreamRequest): Promise<void>

// Stop all active streams
async function stopSimulationStreaming(): Promise<void>

// Stop specific target-connection stream
async function stopTargetStream(target_id: number, connection_id: string): Promise<void>

// Get list of active streams
async function getActiveSimulationStreams(): Promise<string[]>
```

## Usage

### 1. Basic Setup

First, ensure you have simulation data available and serial connections established:

```typescript
// Get simulation data
const simulationData = await invoke<SimulationResultList>("get_simulation_data");

// Get available serial connections
const connections = await invoke<string[]>("list_connections");
```

### 2. Create Stream Configuration

```typescript
import { createSimulationStreamRequest } from "@/lib/simulation-streaming";

const request = createSimulationStreamRequest(
  simulationData,
  [
    {
      target_id: 1,
      serial_connection_id: "COM3",
      stream_interval_ms: 100
    },
    {
      target_id: 2,
      serial_connection_id: "COM4",
      stream_interval_ms: 200
    }
  ],
  100 // default interval
);
```

### 3. Start Streaming

```typescript
import { startSimulationStreaming } from "@/lib/simulation-streaming";

try {
  await startSimulationStreaming(request);
  console.log("Streaming started successfully");
} catch (error) {
  console.error("Failed to start streaming:", error);
}
```

### 4. Monitor and Control

```typescript
// Get active streams
const activeStreams = await getActiveSimulationStreams();
console.log("Active streams:", activeStreams);

// Stop specific stream
await stopTargetStream(1, "COM3");

// Stop all streams
await stopSimulationStreaming();
```

## Data Format

Position data is encoded as Protocol Buffer messages:

```protobuf
message Position {
  double alt = 1;  // Altitude in meters
  double lat = 2;  // Latitude in radians
  double lon = 3;  // Longitude in radians
}
```

## UI Component Usage

The `SimulationStreamingControl` component provides a complete UI for managing simulation streaming:

```tsx
import { SimulationStreamingControl } from "@/components/SimulationStreamingControl";

function MyComponent() {
  const [simulationData, setSimulationData] = useState<SimulationResultList>();

  return (
    <SimulationStreamingControl
      simulationData={simulationData}
      onStreamingStateChange={(isStreaming) => {
        console.log("Streaming state:", isStreaming);
      }}
    />
  );
}
```

## Tauri Commands

The following Tauri commands are available:

- `start_simulation_streaming(request)` - Start streaming simulation data
- `stop_simulation_streaming()` - Stop all active streams
- `stop_target_stream(target_id, connection_id)` - Stop specific stream
- `get_active_simulation_streams()` - Get list of active streams

## Error Handling

The system includes comprehensive error handling:

1. **Validation**: Checks for valid target IDs, connection IDs, and intervals
2. **Connection errors**: Handles serial connection failures gracefully
3. **Data errors**: Validates simulation data availability
4. **Stream management**: Prevents duplicate streams and handles cleanup

## Performance Considerations

- **Concurrent streams**: Each target-connection pair runs in its own task
- **Configurable intervals**: Adjust update frequency based on requirements
- **Memory efficient**: Uses Arc for shared data to minimize memory usage
- **Error recovery**: Automatic cleanup on connection failures

## Example Workflow

1. **Run simulation** to generate position data
2. **Establish serial connections** to target devices
3. **Configure stream mappings** (target → connection)
4. **Start streaming** with desired intervals
5. **Monitor progress** through active streams list
6. **Stop streaming** when complete or on error

## Troubleshooting

### Common Issues

1. **"No simulation data available"**
   - Run a simulation first to generate data
   - Check that simulation completed successfully

2. **"Connection not found"**
   - Ensure serial connections are established
   - Verify connection IDs match available connections

3. **"Target ID not found"**
   - Check that target ID exists in simulation data
   - Verify simulation results contain the expected targets

4. **"Stream interval too fast/slow"**
   - Adjust interval to between 10ms and 10s
   - Consider system performance for very fast intervals

### Debug Information

Enable debug logging to see detailed stream information:

```rust
// In Rust code
info!("Sent position for target {} step {}/{} to {}: lat={:.6}, lon={:.6}, alt={:.1}",
    target_id, current_step + 1, total_steps, connection_id,
    state.lat, state.lon, state.alt);
```

## Integration with Existing Code

The simulation streaming system integrates with:

- **Serial Manager**: Uses existing serial connection infrastructure
- **Simulation Data**: Works with existing simulation result format
- **UI Components**: Compatible with existing React components
- **Tauri Commands**: Follows existing command pattern

This system provides a robust, scalable solution for streaming simulation position data to multiple serial connections with fine-grained control and comprehensive error handling. 