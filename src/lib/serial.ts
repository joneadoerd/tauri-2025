// src/lib/serial.ts
import { invoke } from "@tauri-apps/api/core";

export interface SerialConnectionInfo {
  id: string;
  port_name: string;
}

export async function startConnection(id: string, port: string, baud: number ,packetType: string) {
  return invoke("start_connection", { id, port, baud, packetType });
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
