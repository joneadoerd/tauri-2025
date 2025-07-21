"use client"

import { useState, useEffect, useCallback } from "react"
import {
  listSerialPorts,
  listConnections,
  startSerialConnection,
  stopConnection,
  disconnectAllConnections,
} from "@/lib/communication-actions"
import type { Connection, SerialConnectionParams } from "@/types"
import { generateShortId } from '@/lib/utils';

/**
 * Custom hook for managing serial connections
 *
 * Provides functionality to:
 * - List available serial ports
 * - Manage active connections
 * - Connect/disconnect from serial ports
 * - Refresh connection status
 *
 * @returns Object containing connection state and management functions
 *
 * @example
 * ```typescript
 * const {
 *   ports,
 *   connections,
 *   refreshing,
 *   refreshConnections,
 *   connect,
 *   disconnect,
 *   disconnectAll
 * } = useSerialConnections()
 *
 * // Connect to a serial port
 * await connect("COM", "COM3", 115200, "Header")
 *
 * // Disconnect from a specific connection
 * await disconnect("connection-id")
 * ```
 */
export function useSerialConnections() {
  const [ports, setPorts] = useState<string[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [refreshing, setRefreshing] = useState(false)

  /**
   * Refreshes the list of available ports and active connections
   * @throws Error if refresh operation fails
   */
  const refreshConnections = useCallback(async () => {
    setRefreshing(true)
    try {
      const [availablePorts, activeConnections] = await Promise.all([listSerialPorts(), listConnections()])
      setPorts(availablePorts)
      setConnections(activeConnections)
    } catch (error) {
      console.error("Failed to refresh connections:", error)
      throw new Error(`Failed to refresh connections: ${error}`)
    } finally {
      setRefreshing(false)
    }
  }, [])

  /**
   * Establishes a new serial connection
   * @param prefix - Connection identifier prefix
   * @param port - Serial port name
   * @param baud - Baud rate for communication
   * @param packetType - Type of packets to handle
   * @throws Error if connection fails
   */
  const connect = useCallback(
    async (_prefix: string, port: string, baud: number, packetType: string) => {
      const id = generateShortId('serial', port);
      const params: SerialConnectionParams = { id, port, baud, packetType };
      await startSerialConnection(params);
      await refreshConnections();
    },
    [refreshConnections],
  )

  /**
   * Disconnects from a specific connection
   * @param id - Connection ID to disconnect
   * @throws Error if disconnection fails
   */
  const disconnect = useCallback(
    async (id: string) => {
      await stopConnection(id)
      await refreshConnections()
    },
    [refreshConnections],
  )

  /**
   * Disconnects from all active connections
   * @throws Error if disconnection fails
   */
  const disconnectAll = useCallback(async () => {
    await disconnectAllConnections()
    setConnections([])
  }, [])

  // Initialize connections on mount
  useEffect(() => {
    refreshConnections()
  }, [refreshConnections])

  return {
    /** Array of available serial ports */
    ports,
    /** Array of active connections */
    connections,
    /** Whether refresh operation is in progress */
    refreshing,
    /** Function to refresh ports and connections */
    refreshConnections,
    /** Function to establish new connection */
    connect,
    /** Function to disconnect specific connection */
    disconnect,
    /** Function to disconnect all connections */
    disconnectAll,
  }
}
