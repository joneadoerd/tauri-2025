import {
  startSerialConnection,
  startUdpConnection,
  stopConnection,
  disconnectAllConnections,
  listConnections,
  setUdpRemoteAddress,
} from "@/lib/communication-actions"
import type { SerialConnectionParams, UdpConnectionParams, Connection } from "@/types"

/**
 * Establishes a serial connection with error handling
 * @param params - Serial connection parameters
 * @returns Promise<string> Connection ID
 * @throws Error if connection fails
 *
 * @example
 * ```typescript
 * const connectionId = await connectToSerial({
 *   prefix: "COM",
 *   port: "COM3",
 *   baud: 115200,
 *   packetType: "Header"
 * })
 * ```
 */
export async function connectToSerial(params: SerialConnectionParams): Promise<string> {
  try {
    const connectionId = await startSerialConnection(params)
    console.log(`Serial connection established: ${connectionId}`)
    return connectionId
  } catch (error) {
    console.error("Failed to establish serial connection:", error)
    throw new Error(`Failed to connect to ${params.port}: ${error}`)
  }
}

/**
 * Establishes a UDP connection with error handling
 * @param params - UDP connection parameters
 * @returns Promise<string> Connection ID
 * @throws Error if connection fails
 *
 * @example
 * ```typescript
 * const connectionId = await connectToUdp({
 *   prefix: "UDP",
 *   localAddr: "127.0.0.1:5000"
 * })
 * ```
 */
export async function connectToUdp(params: UdpConnectionParams): Promise<string> {
  try {
    const connectionId = await startUdpConnection(params)
    console.log(`UDP connection established: ${connectionId}`)
    return connectionId
  } catch (error) {
    console.error("Failed to establish UDP connection:", error)
    throw new Error(`Failed to connect to ${params.localAddr}: ${error}`)
  }
}

/**
 * Safely disconnects a connection with cleanup
 * @param connectionId - ID of connection to disconnect
 * @param connectionName - Name of connection for logging
 * @throws Error if disconnection fails
 *
 * @example
 * ```typescript
 * await disconnectConnection("conn_123", "COM3")
 * ```
 */
export async function disconnectConnection(connectionId: string, connectionName?: string): Promise<void> {
  try {
    await stopConnection(connectionId)
    console.log(`Connection disconnected: ${connectionName || connectionId}`)
  } catch (error) {
    console.error("Failed to disconnect connection:", error)
    throw new Error(`Failed to disconnect ${connectionName || connectionId}: ${error}`)
  }
}

/**
 * Disconnects all connections with error handling
 * @throws Error if disconnection fails
 *
 * @example
 * ```typescript
 * await disconnectAllConnections()
 * ```
 */
export async function disconnectAll(): Promise<void> {
  try {
    await disconnectAllConnections()
    console.log("All connections disconnected")
  } catch (error) {
    console.error("Failed to disconnect all connections:", error)
    throw new Error(`Failed to disconnect all connections: ${error}`)
  }
}

/**
 * Initializes common COM port connections (COM3 and COM6)
 * @returns Promise<string[]> Array of connection IDs
 * @throws Error if initialization fails
 *
 * @example
 * ```typescript
 * const connectionIds = await initializeComPorts()
 * ```
 */
export async function initializeComPorts(): Promise<string[]> {
  const connectionIds: string[] = []

  try {
    // Initialize COM3
    const com3Id = await connectToSerial({
      prefix: "com3_id",
      port: "COM3",
      baud: 115200,
      packetType: "Header",
    })
    connectionIds.push(com3Id)

    // Initialize COM6
    const com6Id = await connectToSerial({
      prefix: "com6_id",
      port: "COM6",
      baud: 115200,
      packetType: "Header",
    })
    connectionIds.push(com6Id)

    console.log("COM ports initialized successfully")
    return connectionIds
  } catch (error) {
    console.error("Failed to initialize COM ports:", error)
    // Clean up any successful connections
    for (const id of connectionIds) {
      try {
        await stopConnection(id)
      } catch (cleanupError) {
        console.error("Failed to cleanup connection:", cleanupError)
      }
    }
    throw new Error(`Failed to initialize COM ports: ${error}`)
  }
}

/**
 * Sets up bidirectional UDP communication between two addresses
 * @param addressA - First UDP address
 * @param addressB - Second UDP address
 * @returns Promise<[string, string]> Array of connection IDs [A, B]
 * @throws Error if setup fails
 *
 * @example
 * ```typescript
 * const [connA, connB] = await setupUdpPair(
 *   "127.0.0.1:9000",
 *   "127.0.0.1:9001"
 * )
 * ```
 */
export async function setupUdpPair(addressA: string, addressB: string): Promise<[string, string]> {
  let connAId: string | null = null
  let connBId: string | null = null

  try {
    // Start both UDP connections
    connAId = await connectToUdp({ prefix: "udpA", localAddr: addressA })
    connBId = await connectToUdp({ prefix: "udpB", localAddr: addressB })

    // Configure bidirectional communication
    await setUdpRemoteAddress(connAId, addressB)
    await setUdpRemoteAddress(connBId, addressA)

    console.log(`UDP pair established: ${addressA} ↔ ${addressB}`)
    return [connAId, connBId]
  } catch (error) {
    console.error("Failed to setup UDP pair:", error)

    // Clean up any successful connections
    if (connAId) {
      try {
        await stopConnection(connAId)
      } catch (cleanupError) {
        console.error("Failed to cleanup connection A:", cleanupError)
      }
    }
    if (connBId) {
      try {
        await stopConnection(connBId)
      } catch (cleanupError) {
        console.error("Failed to cleanup connection B:", cleanupError)
      }
    }

    throw new Error(`Failed to setup UDP pair: ${error}`)
  }
}

/**
 * Gets connection information by ID
 * @param connectionId - ID of connection to find
 * @returns Promise<Connection | null> Connection info or null if not found
 *
 * @example
 * ```typescript
 * const connection = await getConnectionById("conn_123")
 * ```
 */
export async function getConnectionById(connectionId: string): Promise<Connection | null> {
  try {
    const connections = await listConnections()
    return connections.find((conn) => conn.id === connectionId) || null
  } catch (error) {
    console.error("Failed to get connection by ID:", error)
    return null
  }
}

/**
 * Checks if a connection exists and is active
 * @param connectionId - ID of connection to check
 * @returns Promise<boolean> True if connection exists
 *
 * @example
 * ```typescript
 * const exists = await isConnectionActive("conn_123")
 * ```
 */
export async function isConnectionActive(connectionId: string): Promise<boolean> {
  try {
    const connection = await getConnectionById(connectionId)
    return connection !== null
  } catch (error) {
    console.error("Failed to check connection status:", error)
    return false
  }
}
