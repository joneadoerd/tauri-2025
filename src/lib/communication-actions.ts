import { invoke } from "@tauri-apps/api/core"
import type {
  Connection,
  SerialConnectionParams,
  UdpConnectionParams,
  UdpShareParams,
  SimulationUdpParams,
  SimulationResultList,
} from "@/types"
import type { Packet } from "@/gen/packet"

export interface PacketStatistics {
  total_received: number
  total_sent: number
  connection_count: number
  connection_counts: Record<string, { received: number; sent: number }>
}

export interface ConnectionPacketCounts {
  [connectionId: string]: { received: number; sent: number }
}

/**
 * Lists all available serial ports
 * @returns Promise<string[]> Array of available port names
 */
export async function listSerialPorts(): Promise<string[]> {
  try {
    return await invoke<string[]>("list_serial_ports")
  } catch (error) {
    console.error("Failed to list serial ports:", error)
    throw new Error(`Failed to list serial ports: ${error}`)
  }
}

/**
 * Lists all active connections
 * @returns Promise<Connection[]> Array of active connections
 */
export async function listConnections(): Promise<Connection[]> {
  try {
    const connections = await invoke<{ id: string; name: string }[]>("list_connections")
    return connections.map((conn) => ({
      id: conn.id,
      name: conn.name,
    }))
  } catch (error) {
    console.error("Failed to list connections:", error)
    throw new Error(`Failed to list connections: ${error}`)
  }
}

/**
 * Starts a new serial connection
 * @param params - Serial connection parameters
 * @returns Promise<string> Connection ID
 */
export async function startSerialConnection(params: SerialConnectionParams): Promise<string> {
  try {
    return await invoke<string>("start_connection", {
      prefix: params.prefix,
      port: params.port,
      baud: params.baud,
      packetType: params.packetType,
    })
  } catch (error) {
    console.error("Failed to start serial connection:", error)
    throw new Error(`Failed to start serial connection: ${error}`)
  }
}

/**
 * Starts a new UDP connection
 * @param params - UDP connection parameters
 * @returns Promise<string> Connection ID
 */
export async function startUdpConnection(params: UdpConnectionParams): Promise<string> {
  try {
    return await invoke<string>("start_udp_connection", {
      prefix: params.prefix,
      localAddr: params.localAddr,
    })
  } catch (error) {
    console.error("Failed to start UDP connection:", error)
    throw new Error(`Failed to start UDP connection: ${error}`)
  }
}

/**
 * Stops a connection
 * @param connectionId - ID of connection to stop
 */
export async function stopConnection(connectionId: string): Promise<void> {
  try {
    await invoke("stop_connection", { id: connectionId })
  } catch (error) {
    console.error("Failed to stop connection:", error)
    throw new Error(`Failed to stop connection: ${error}`)
  }
}

/**
 * Disconnects all active connections
 */
export async function disconnectAllConnections(): Promise<void> {
  try {
    await invoke("disconnect_all_connections")
  } catch (error) {
    console.error("Failed to disconnect all connections:", error)
    throw new Error(`Failed to disconnect all connections: ${error}`)
  }
}

/**
 * Sends a packet to a specific connection
 * @param connectionId - Target connection ID
 * @param packet - Packet data to send
 */
export async function sendPacket(connectionId: string, packet: any): Promise<void> {
  try {
    await invoke("send_packet", {
      id: connectionId,
      packet: packet,
    })
  } catch (error) {
    console.error("Failed to send packet:", error)
    throw new Error(`Failed to send packet: ${error}`)
  }
}

/**
 * Sets remote address for UDP connection
 * @param connectionId - UDP connection ID
 * @param remoteAddr - Remote address to set
 */
export async function setUdpRemoteAddress(connectionId: string, remoteAddr: string): Promise<void> {
  try {
    await invoke("set_udp_remote_addr", {
      id: connectionId,
      remoteAddr: remoteAddr,
    })
  } catch (error) {
    console.error("Failed to set UDP remote address:", error)
    throw new Error(`Failed to set UDP remote address: ${error}`)
  }
}

/**
 * Lists UDP targets for a connection
 * @param connectionId - Connection ID to get targets for
 * @returns Promise<any[]> Array of UDP targets
 */
export async function listUdpTargets(connectionId: string): Promise<any[]> {
  try {
    return await invoke<any[]>("list_udp_targets", { connectionId })
  } catch (error) {
    console.error("Failed to list UDP targets:", error)
    throw new Error(`Failed to list UDP targets: ${error}`)
  }
}

/**
 * Gets total number of UDP targets across all connections
 * @returns Promise<number> Total UDP target count
 */
export async function getTotalUdpTargets(): Promise<number> {
  try {
    return await invoke<number>("get_total_udp_targets")
  } catch (error) {
    console.error("Failed to get total UDP targets:", error)
    return 0
  }
}

/**
 * Starts sharing UDP target data to another connection
 * @param params - UDP share parameters
 * @returns Promise<string> Share ID
 */
export async function startUdpTargetShare(params: UdpShareParams): Promise<string> {
  try {
    return await invoke<string>("share_udp_target_to_connection", {
      udpConnectionId: params.udpConnectionId,
      targetId: params.targetId,
      destConnectionId: params.destConnectionId,
      intervalMs: params.intervalMs,
    })
  } catch (error) {
    console.error("Failed to start UDP target share:", error)
    throw new Error(`Failed to start UDP target share: ${error}`)
  }
}

/**
 * Stops a data share
 * @param shareId - Share ID to stop
 * @param connectionId - Connection ID associated with the share
 */
export async function stopShare(shareId: string, connectionId: string): Promise<void> {
  try {
    await invoke("stop_share_to_connection", {
      shareId: shareId,
      connectionId: connectionId,
    })
  } catch (error) {
    console.error("Failed to stop share:", error)
    throw new Error(`Failed to stop share: ${error}`)
  }
}

/**
 * Lists all active shares
 * @returns Promise<[string, string][]> Array of [shareId, connectionId] pairs
 */
export async function listActiveShares(): Promise<[string, string][]> {
  try {
    return await invoke<[string, string][]>("list_active_shares")
  } catch (error) {
    console.error("Failed to list active shares:", error)
    throw new Error(`Failed to list active shares: ${error}`)
  }
}

/**
 * Gets simulation data
 * @returns Promise<SimulationResultList | null> Simulation results or null
 */
export async function getSimulationData(): Promise<SimulationResultList | null> {
  try {
    const result = await invoke("get_simulation_data")
    if (result && typeof result === "object" && Array.isArray((result as any).results)) {
      return result as SimulationResultList
    }
    return null
  } catch (error) {
    console.error("Failed to get simulation data:", error)
    return null
  }
}

/**
 * Lists active simulation streams
 * @returns Promise<string[]> Array of active stream IDs
 */
export async function listActiveSimulationStreams(): Promise<string[]> {
  try {
    return await invoke<string[]>("list_active_simulation_streams")
  } catch (error) {
    console.error("Failed to list active simulation streams:", error)
    return []
  }
}

/**
 * Starts simulation UDP streaming
 * @param params - Simulation UDP parameters
 * @returns Promise<string> Connection ID
 */
export async function startSimulationUdpStreaming(params: SimulationUdpParams): Promise<string> {
  try {
    return await invoke<string>("start_simulation_udp_streaming", {
      localAddr: params.localAddr,
      remoteAddr: params.remoteAddr,
      intervalMs: params.intervalMs,
    })
  } catch (error) {
    console.error("Failed to start simulation UDP streaming:", error)
    throw new Error(`Failed to start simulation UDP streaming: ${error}`)
  }
}

  /**
   * Stops simulation UDP streaming
   * @param connectionId - Connection ID to stop
   */
  export async function stopSimulationUdpStreaming(connectionId: string): Promise<void> {
    try {
      await invoke("stop_simulation_udp_streaming", {
        connectionId: connectionId,
      })
    } catch (error) {
      console.error("Failed to stop simulation UDP streaming:", error)
      throw new Error(`Failed to stop simulation UDP streaming: ${error}`)
    }
  }

  // ============================================================================
  // PACKET STATISTICS OPERATIONS
  // ============================================================================

  /**
   * Get comprehensive packet statistics from backend
   * This replaces multiple individual calls with a single consolidated call
   */
  export async function getPacketStatistics(): Promise<PacketStatistics> {
    try {
      const stats = await invoke<Record<string, any>>("get_packet_statistics")
      
      // Parse the connection counts from the JSON structure
      const connection_counts: ConnectionPacketCounts = {}
      if (stats.connection_counts && typeof stats.connection_counts === 'object') {
        Object.entries(stats.connection_counts).forEach(([id, data]) => {
          if (data && typeof data === 'object' && 'received' in data && 'sent' in data) {
            connection_counts[id] = {
              received: Number(data.received) || 0,
              sent: Number(data.sent) || 0
            }
          }
        })
      }

      return {
        total_received: Number(stats.total_received) || 0,
        total_sent: Number(stats.total_sent) || 0,
        connection_count: Number(stats.connection_count) || 0,
        connection_counts
      }
    } catch (error) {
      console.error("Failed to get packet statistics:", error)
      return {
        total_received: 0,
        total_sent: 0,
        connection_count: 0,
        connection_counts: {}
      }
    }
  }

  /**
   * Reset all packet counters
   */
  export async function resetPacketCounters(): Promise<void> {
    try {
      await invoke("reset_packet_counters")
    } catch (error) {
      console.error("Failed to reset packet counters:", error)
      throw new Error(`Failed to reset packet counters: ${error}`)
    }
  }

  /**
   * Get total packets received (legacy function for backward compatibility)
   */
  export async function getTotalPacketsReceived(): Promise<number> {
    try {
      return await invoke<number>("get_total_packets_received")
    } catch (error) {
      console.error("Failed to get total packets received:", error)
      return 0
    }
  }

  /**
   * Get total packets sent (legacy function for backward compatibility)
   */
  export async function getTotalPacketsSent(): Promise<number> {
    try {
      return await invoke<number>("get_total_packets_sent")
    } catch (error) {
      console.error("Failed to get total packets sent:", error)
      return 0
    }
  }

  /**
   * Get connection packet counts (legacy function for backward compatibility)
   */
  export async function getConnectionPacketCounts(): Promise<ConnectionPacketCounts> {
    try {
      const counts = await invoke<Record<string, [number, number]>>("get_connection_packet_counts")
      const result: ConnectionPacketCounts = {}
      
      Object.entries(counts).forEach(([id, [received, sent]]) => {
        result[id] = { received, sent }
      })
      
      return result
    } catch (error) {
      console.error("Failed to get connection packet counts:", error)
      return {}
    }
  }

  /**
   * Get connection count (legacy function for backward compatibility)
   */
  export async function getConnectionCount(): Promise<number> {
    try {
      return await invoke<number>("get_connection_count")
    } catch (error) {
      console.error("Failed to get connection count:", error)
      return 0
    }
  }
