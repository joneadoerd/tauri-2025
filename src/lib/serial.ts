// src/lib/serial.ts
import { invoke } from "@tauri-apps/api/core";

export interface SerialConnectionInfo {
  id: string;
  port_name: string;
}

export async function startConnection(id: string, port: string, baud: number) {
  return invoke("start_connection", { id, port, baud });
}

export async function sendPacket(id: string, json: Uint8Array) {
  return invoke("send_packet", { id, json: Array.from(json) });
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
