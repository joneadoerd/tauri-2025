"use client"

import { useState, useEffect, useCallback } from "react"
import { listen, type UnlistenFn, type Event } from "@tauri-apps/api/event"
import type { Packet, SerialPacketEvent } from "@/gen/packet"

export interface PacketData {
  packet: Packet
  timestamp: number
  id?: string
  packetType?: string
}

export interface PacketCounts {
  count: number
  lastReset: number
  headerCount: number
  payloadCount: number
  totalCount: number
}

/**
 * Custom hook for managing real-time packet data processing
 *
 * Handles:
 * - Real-time packet event listening
 * - Packet type classification and counting
 * - Data storage with connection-based organization
 * - Packet deduplication
 * - Statistics tracking
 *
 * @returns Object containing packet data state and management functions
 *
 * @example
 * \`\`\`typescript
 * const {
 *   data,
 *   packetCounts,
 *   globalPacketTypeCounts,
 *   connectionPacketTypeCounts,
 *   clearData,
 *   clearAllData,
 *   removeConnectionData
 * } = usePacketData()
 *
 * // Clear data for specific connection
 * clearData("connection-id")
 *
 * // Clear all packet data
 * clearAllData()
 * \`\`\`
 */
export function usePacketData() {
  const [data, setData] = useState<Record<string, PacketData[]>>({})
  const [packetCounts, setPacketCounts] = useState<Record<string, PacketCounts>>({})
  const [globalPacketTypeCounts, setGlobalPacketTypeCounts] = useState<Record<string, number>>({})
  const [connectionPacketTypeCounts, setConnectionPacketTypeCounts] = useState<Record<string, Record<string, number>>>(
    {},
  )
  const [processedPackets] = useState<Set<string>>(new Set())

  const clearData = useCallback((id: string) => {
    setData((prev) => {
      const updated = { ...prev }
      if (updated[id]) {
        updated[id] = []
      }
      return updated
    })

    setPacketCounts((prev) => {
      const updated = { ...prev }
      if (updated[id]) {
        updated[id] = {
          count: 0,
          lastReset: Date.now(),
          headerCount: 0,
          payloadCount: 0,
          totalCount: 0,
        }
      }
      return updated
    })

    setConnectionPacketTypeCounts((prev) => {
      const updated = { ...prev }
      if (updated[id]) {
        updated[id] = {}
      }
      return updated
    })
  }, [])

  const clearAllData = useCallback(() => {
    setData({})
    setPacketCounts({})
    setConnectionPacketTypeCounts({})
    setGlobalPacketTypeCounts({})
  }, [])

  const removeConnectionData = useCallback((id: string) => {
    setData((prev) => {
      const updated = { ...prev }
      delete updated[id]
      return updated
    })

    setPacketCounts((prev) => {
      const updated = { ...prev }
      delete updated[id]
      return updated
    })

    setConnectionPacketTypeCounts((prev) => {
      const updated = { ...prev }
      delete updated[id]
      return updated
    })
  }, [])

  useEffect(() => {
    const unlistenAll: UnlistenFn[] = []

    const unlisten = listen("serial_packet", (event: Event<SerialPacketEvent>) => {
      const { id, packet } = event.payload
      if (!packet) return

      const now = Date.now()
      const packetFingerprint = `${id}_${JSON.stringify(packet)}_${now}`

      if (processedPackets.has(packetFingerprint)) return
      processedPackets.add(packetFingerprint)

      // Determine packet type
      let packetType = "other"
      const packetAny = packet as any
      if (packetAny.kind) {
        if (packetAny.kind.Header) packetType = "header"
        else if (packetAny.kind.Payload) packetType = "payload"
        else if (packetAny.kind.Command) packetType = "command"
        else if (packetAny.kind.State) packetType = "state"
        else if (packetAny.kind.TargetPacket) packetType = "TargetPacket"
        else if (packetAny.kind.TargetPacketList) packetType = "TargetPacketList"
      }

      // Update global packet type counter
      setGlobalPacketTypeCounts((prev) => ({
        ...prev,
        [packetType]: (prev[packetType] || 0) + 1,
      }))

      // Update packet data
      setData((prev) => {
        const currentPackets = prev[id] || []
        const packetId = `${id}_${now}_${Math.random().toString(36).substr(2, 9)}`
        const newPacket: PacketData = {
          packet,
          timestamp: now,
          id: packetId,
          packetType,
        }
        const updatedPackets = [...currentPackets, newPacket].slice(-100)
        return { ...prev, [id]: updatedPackets }
      })

      // Update packet counts
      setPacketCounts((prev) => {
        const current = prev[id] || {
          count: 0,
          lastReset: now,
          headerCount: 0,
          payloadCount: 0,
          totalCount: 0,
        }
        const timeSinceReset = now - current.lastReset

        if (timeSinceReset >= 1000) {
          return {
            ...prev,
            [id]: {
              count: 1,
              lastReset: now,
              headerCount: packetType === "header" ? 1 : 0,
              payloadCount: packetType === "payload" ? 1 : 0,
              totalCount: current.totalCount + 1,
            },
          }
        } else {
          return {
            ...prev,
            [id]: {
              count: current.count + 1,
              lastReset: current.lastReset,
              headerCount: current.headerCount + (packetType === "header" ? 1 : 0),
              payloadCount: current.payloadCount + (packetType === "payload" ? 1 : 0),
              totalCount: current.totalCount + 1,
            },
          }
        }
      })

      // Update per-connection packet type counter
      setConnectionPacketTypeCounts((prev) => ({
        ...prev,
        [id]: {
          ...(prev[id] || {}),
          [packetType]: (prev[id]?.[packetType] || 0) + 1,
        },
      }))
    })

    unlisten.then((un) => unlistenAll.push(un))
    return () => unlistenAll.forEach((fn) => fn())
  }, [processedPackets])

  return {
    /** Packet data organized by connection ID */
    data,
    /** Real-time packet counts per connection */
    packetCounts,
    /** Global packet type statistics */
    globalPacketTypeCounts,
    /** Per-connection packet type statistics */
    connectionPacketTypeCounts,
    /** Function to clear data for specific connection */
    clearData,
    /** Function to clear all packet data */
    clearAllData,
    /** Function to remove connection data completely */
    removeConnectionData,
  }
}
