import { invoke } from "@tauri-apps/api/core";
import type { SimulationResultList, Position } from "@/gen/simulation";

export interface TargetPosition {
  target_id: number;
  lat: number;
  lon: number;
  alt: number;
  time: number;
}

export interface SimulationStreamConfig {
  target_id: number;
  serial_connection_id: string;
  stream_interval_ms: number;
}

export interface SimulationStreamRequest {
  simulation_data: SimulationResultList;
  stream_configs: SimulationStreamConfig[];
  stream_interval_ms: number;
}

/**
 * Start streaming simulation data to multiple serial connections
 * Each target-connection pair runs in its own spawned task
 */
export async function startSimulationStreaming(
  request: SimulationStreamRequest
): Promise<void> {
  return invoke("start_simulation_streaming", { request });
}

/**
 * Stop all active simulation streams
 */
export async function stopSimulationStreaming(): Promise<void> {
  return invoke("stop_simulation_streaming");
}

/**
 * Stop streaming for a specific target-connection pair
 */
export async function stopTargetStream(
  target_id: number,
  connection_id: string
): Promise<void> {
  return invoke("stop_target_stream", { targetId: target_id, connectionId: connection_id });
}

/**
 * Get list of active simulation streams
 */
export async function getActiveSimulationStreams(): Promise<string[]> {
  return invoke("get_active_simulation_streams");
}

/**
 * Get available serial connections for simulation streaming
 */
export async function getAvailableSimulationConnections(): Promise<string[]> {
  return invoke("get_available_simulation_connections");
}

/**
 * Get available targets from current simulation data
 */
export async function getAvailableSimulationTargets(): Promise<number[]> {
  return invoke("get_available_simulation_targets");
}

/**
 * Check if simulation data is available
 */
export async function checkSimulationDataAvailable(): Promise<boolean> {
  return invoke("check_simulation_data_available");
}

/**
 * Create a simulation stream request from simulation data and target-connection mappings
 */
export function createSimulationStreamRequest(
  simulationData: SimulationResultList,
  targetConnectionMappings: Array<{
    target_id: number;
    serial_connection_id: string;
    stream_interval_ms?: number;
  }>,
  defaultIntervalMs: number = 100
): SimulationStreamRequest {
  const stream_configs: SimulationStreamConfig[] = targetConnectionMappings.map(
    (mapping) => ({
      target_id: mapping.target_id,
      serial_connection_id: mapping.serial_connection_id,
      stream_interval_ms: mapping.stream_interval_ms || defaultIntervalMs,
    })
  );

  return {
    simulation_data: simulationData,
    stream_configs,
    stream_interval_ms: defaultIntervalMs,
  };
}

/**
 * Helper function to get available targets from simulation data
 */
export function getAvailableTargets(
  simulationData: SimulationResultList
): number[] {
  return simulationData.results.map((result) => result.target_id);
}

/**
 * Helper function to validate simulation stream request
 */
export function validateSimulationStreamRequest(
  request: SimulationStreamRequest
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!request.simulation_data || !request.simulation_data.results) {
    errors.push("Simulation data is required");
  }

  if (!request.stream_configs || request.stream_configs.length === 0) {
    errors.push("At least one stream configuration is required");
  }

  // Check if all target IDs exist in simulation data
  if (request.simulation_data?.results) {
    const availableTargets = getAvailableTargets(request.simulation_data);
    const requestedTargets = request.stream_configs.map((config) => config.target_id);
    
    for (const targetId of requestedTargets) {
      if (!availableTargets.includes(targetId)) {
        errors.push(`Target ID ${targetId} not found in simulation data`);
      }
    }
  }

  // Validate stream intervals
  for (const config of request.stream_configs) {
    if (config.stream_interval_ms < 10) {
      errors.push(`Stream interval for target ${config.target_id} is too fast (minimum 10ms)`);
    }
    if (config.stream_interval_ms > 10000) {
      errors.push(`Stream interval for target ${config.target_id} is too slow (maximum 10000ms)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
} 