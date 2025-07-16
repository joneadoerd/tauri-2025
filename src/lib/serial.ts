// src/lib/serial.ts
import { Simulation } from "@/gen/simulation";
import { invoke } from "@tauri-apps/api/core";
import { Packet } from "@/gen/packet";

export interface SerialConnectionInfo {
  id: string;
  name: string;
}

export async function startConnection(
  prefix: string,
  port: string,
  baud: number,
  packetType: string
) {
  return invoke("start_connection", { prefix, port, baud });
}

export async function sendPacket(id: string, packet: Packet) {
  return invoke("send_packet", { id, packet });
}

export async function stopConnection(id: string) {
  console.log("Stopping connection with ID:", id);
  return invoke("stop_connection", { id });
}

export async function listSerialPorts(): Promise<string[]> {
  return invoke("list_serial_ports");
}

export async function listConnections(): Promise<SerialConnectionInfo[]> {
  return invoke<SerialConnectionInfo[]>("list_connections");
}

export async function startShare(
  fromId: string,
  toId: string,
  intervalMs: number
) {
  return invoke("start_serial_share", { fromId, toId, intervalMs });
}

export async function stopShare(fromId: string, toId: string) {
  return invoke("stop_share", { fromId, toId });
}

export async function getSavedData(connectionId: string): Promise<string[]> {
  return invoke("get_saved_data", { connectionId });
}

export async function clearSavedData(connectionId: string) {
  return invoke("clear_saved_data", { connectionId });
}

export async function getAllSavedData(): Promise<Record<string, string[]>> {
  return invoke("get_all_saved_data");
}

export async function getStorageStats(): Promise<Record<string, number>> {
  return invoke("get_storage_stats");
}

export async function clearAllSavedData() {
  return invoke("clear_all_saved_data");
}

export async function readLogFile(connectionId: string): Promise<string[]> {
  return invoke("read_log_file", { connectionId });
}

export async function listLogFiles(): Promise<string[]> {
  return invoke("list_log_files");
}

export async function getLogsDirectory(): Promise<string> {
  return invoke("get_logs_directory");
}

export async function getAppRootDirectory(): Promise<string> {
  return invoke("get_app_root_directory");
}

export async function simulation(sim: Simulation): Promise<string> {
  console.log("Running simulation with state:", sim);
  return invoke("simulation", { sim });
}
