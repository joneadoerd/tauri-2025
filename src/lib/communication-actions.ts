import { invoke } from "@tauri-apps/api/core"
import type {
  Connection,
  SerialConnectionParams,
  UdpConnectionParams,
  UdpShareParams,
  SimulationUdpParams,
  SimulationResultList,
} from "@/types"

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
