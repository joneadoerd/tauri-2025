// src/lib/serial.ts
import { Simulation } from "@/gen/simulation";
import { invoke } from "@tauri-apps/api/core";

export interface SerialConnectionInfo {
  id: string;
  port_name: string;
}

export async function startConnection(
  id: string,
  port: string,
  baud: number,
  packetType: string
) {
  return invoke("start_connection", { id, port, baud });
}

export async function sendPacket(id: string, wrapper_json: string) {
  return invoke("send_packet", { id, wrapperJson: wrapper_json });
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

export async function startShare(fromId: string, toId: string) {
  return invoke("start_share", { fromId, toId });
}

export async function stopShare() {
  return invoke("stop_share");
}

export async function simulation(sim: Simulation): Promise<string> {
  console.log("Running simulation with state:", sim);
  return invoke("simulation", { sim });
}
