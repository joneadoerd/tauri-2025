"use client"

import { useState, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"

export interface UdpListener {
  id: string
  address: string
  connectionId: string | null
  status: string
  error: string | null
}

/**
 * Custom hook for managing UDP connections and listeners
 *
 * Provides functionality to:
 * - Start UDP connections
 * - Manage UDP listeners
 * - Track connection status
 * - Handle connection lifecycle
 *
 * @returns Object containing UDP connection state and management functions
 *
 * @example
 * \`\`\`typescript
 * const {
 *   udpListeners,
 *   startUdpConnection,
 *   addUdpListener,
 *   removeUdpListener
 * } = useUdpConnections()
 *
 * // Add UDP listener
 * await addUdpListener("127.0.0.1:5000")
 * \`\`\`
 */
export function useUdpConnections() {
  const [udpListeners, setUdpListeners] = useState<UdpListener[]>([])
  const [udpStatus, setUdpStatus] = useState("")

  const startUdpConnection = useCallback(async (localAddr: string) => {
    try {
      await invoke("start_udp_connection", {
        prefix: "udp",
        localAddr,
      })
      setUdpStatus("UDP connection started")
      return true
    } catch (e: any) {
      const errorMsg = e?.toString() || "Failed to start UDP connection"
      setUdpStatus("Error: " + errorMsg)
      return false
    }
  }, [])

  const addUdpListener = useCallback(
    async (address: string) => {
      if (udpListeners.some((listener) => listener.address === address)) {
        throw new Error("A listener on this address already exists!")
      }

      const listenerId = `listener_${Date.now()}`
      const newListener: UdpListener = {
        id: listenerId,
        address,
        connectionId: null,
        status: "Starting...",
        error: null,
      }

      setUdpListeners((prev) => [...prev, newListener])

      try {
        await invoke("start_udp_connection", {
          prefix: "udp_listener",
          localAddr: address,
        })

        // Refresh connections to get the new connection ID
        const updated = await invoke<{ id: string; name: string }[]>("list_connections")

        // Find the new UDP connection by address
        const udpConn = updated.find((c) => c.name && c.name.includes(address))

        setUdpListeners((prev) =>
          prev.map((listener) =>
            listener.id === listenerId
              ? {
                  ...listener,
                  connectionId: udpConn?.id || null,
                  status: udpConn ? `Listening on ${address}` : "Failed to get connection ID",
                  error: null,
                }
              : listener,
          ),
        )

        // Return the updated connections list so parent can update
        return updated
      } catch (e: any) {
        setUdpListeners((prev) =>
          prev.map((listener) =>
            listener.id === listenerId
              ? { ...listener, status: "Failed", error: e?.toString() || "Failed to start UDP listener" }
              : listener,
          ),
        )
        throw e
      }
    },
    [udpListeners],
  )

  const removeUdpListener = useCallback(
    async (listenerId: string) => {
      const listener = udpListeners.find((l) => l.id === listenerId)
      if (!listener) return

      if (listener.connectionId) {
        try {
          await invoke("stop_connection", { id: listener.connectionId })
        } catch (e) {
          console.error("Failed to stop connection:", e)
        }
      }

      setUdpListeners((prev) => prev.filter((l) => l.id !== listenerId))
    },
    [udpListeners],
  )

  return {
    /** Array of active UDP listeners */
    udpListeners,
    /** Current UDP connection status message */
    udpStatus,
    /** Function to start a UDP connection */
    startUdpConnection,
    /** Function to add a new UDP listener */
    addUdpListener,
    /** Function to remove a UDP listener */
    removeUdpListener,
  }
}
