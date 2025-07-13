"use client"

import { useState, useEffect, useCallback } from "react"
import { listSerialPorts, listConnections, startConnection, stopConnection } from "@/lib/serial"
import { invoke } from "@tauri-apps/api/core"

export interface Connection {
  id: string
  name: string
}

export function useSerialConnections() {
  const [ports, setPorts] = useState<string[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const refreshConnections = useCallback(async () => {
    setRefreshing(true)
    try {
      const [availablePorts, activeConnections] = await Promise.all([listSerialPorts(), listConnections()])
      setPorts(availablePorts)
      setConnections(activeConnections)
    } catch (error) {
      console.error("Failed to refresh connections:", error)
    } finally {
      setRefreshing(false)
    }
  }, [])

  const connect = useCallback(
    async (prefix: string, port: string, baud: number, packetType: string) => {
      await startConnection(prefix, port, baud, packetType)
      await refreshConnections()
    },
    [refreshConnections],
  )

  const disconnect = useCallback(
    async (id: string) => {
      await stopConnection(id)
      await refreshConnections()
    },
    [refreshConnections],
  )

  const disconnectAll = useCallback(async () => {
    await invoke("disconnect_all_connections")
    setConnections([])
  }, [])

  useEffect(() => {
    refreshConnections()
  }, [refreshConnections])

  return {
    ports,
    connections,
    refreshing,
    refreshConnections,
    connect,
    disconnect,
    disconnectAll,
  }
}
