import type React from "react"
/**
 * Core type definitions for the Serial Monitor application
 */

// Connection Types
export interface Connection {
  /** Unique identifier for the connection */
  id: string
  /** Human-readable name/description of the connection */
  name: string
}

// Packet Types
import type { Packet } from "@/gen/packet"

export interface PacketData {
  /** The actual packet data */
  packet: Packet
  /** Timestamp when packet was received */
  timestamp: number
  /** Unique packet identifier */
  id?: string
  /** Type of packet (header, payload, etc.) */
  packetType?: string
}

export interface PacketCounts {
  /** Current packets per second */
  count: number
  /** Last reset timestamp */
  lastReset: number
  /** Total header packets */
  headerCount: number
  /** Total payload packets */
  payloadCount: number
  /** Total packets received */
  totalCount: number
}

// Share Types
export interface ActiveShare {
  /** Unique share identifier */
  shareId: string
  /** Connection ID receiving the shared data */
  connectionId: string
}

export interface UdpShare {
  /** Unique share identifier */
  shareId: string
  /** Source connection ID */
  sourceId: string
  /** Target ID being shared */
  targetId: number
  /** Destination connection ID */
  destId: string
  /** Sharing interval in milliseconds */
  interval: number
}

// UDP Types
export interface UdpListener {
  /** Unique listener identifier */
  id: string
  /** Address the listener is bound to */
  address: string
  /** Associated connection ID if connected */
  connectionId: string | null
  /** Current status of the listener */
  status: string
  /** Error message if any */
  error: string | null
}

// Simulation Types
export interface SimulationResult {
  /** Target identifier */
  target_id: number
  /** Latitude coordinate */
  lat: number
  /** Longitude coordinate */
  lon: number
  /** Altitude */
  alt: number
  /** Timestamp */
  time: number
}

export interface SimulationResultList {
  /** Array of simulation results */
  results: SimulationResult[]
}

// Action Types
export interface SerialConnectionParams {
  /** Connection prefix/identifier */
  prefix: string
  /** Serial port name */
  port: string
  /** Baud rate */
  baud: number
  /** Packet type to handle */
  packetType: string
}

export interface UdpConnectionParams {
  /** Connection prefix/identifier */
  prefix: string
  /** Local address to bind to */
  localAddr: string
}

export interface UdpShareParams {
  /** UDP connection ID to share from */
  udpConnectionId: string
  /** Target ID to share */
  targetId: number
  /** Destination connection ID */
  destConnectionId: string
  /** Sharing interval in milliseconds */
  intervalMs: number
}

export interface SimulationUdpParams {
  /** Local address to bind to */
  localAddr: string;
  /** Remote address to send to */
  remoteAddr: string;
  /** Streaming interval in milliseconds */
  intervalMs: number;
  /** Origin latitude */
  originLat: number;
  /** Origin longitude */
  originLon: number;
  /** Origin altitude */
  originAlt: number;
}

// Component Props Types
export interface BaseComponentProps {
  /** Optional CSS class name */
  className?: string
  /** Optional children elements */
  children?: React.ReactNode
}

export interface ConnectionFormProps extends BaseComponentProps {
  /** Available serial ports */
  ports: string[]
  /** Callback when connecting to a port */
  onConnect: (prefix: string, port: string, baud: number, packetType: string) => Promise<void>
  /** Callback to initialize COM ports */
  onInitComs: () => Promise<void>
  /** Callback to refresh port list */
  onRefresh: () => Promise<void>
  /** Whether refresh is in progress */
  refreshing: boolean
}

export interface PacketDisplayProps extends BaseComponentProps {
  /** Packet data organized by connection ID */
  data: Record<string, PacketData[]>
  /** Packet counts by connection ID */
  packetCounts: Record<string, PacketCounts>
  /** Callback to clear all data */
  onClearAll: () => void
  /** Callback to clear data for specific connection */
  onClearCurrent: (id: string) => void
}

// Utility Types
export type PacketType = "header" | "payload" | "command" | "state" | "TargetPacket" | "TargetPacketList" | "other"

export type ConnectionType = "serial" | "udp" | "simulation"

export type ShareStatus = "active" | "stopped" | "error"
