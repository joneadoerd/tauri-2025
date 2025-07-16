"use client"

import { useState, useEffect, useCallback } from "react"
import { listen, Event, UnlistenFn } from "@tauri-apps/api/event"
import type { Packet, SerialPacketEvent } from "@/gen/packet"
import { getPacketStatistics, resetPacketCounters } from "@/app/actions/packet-statistics-actions"

export interface PacketData {
  packet: Packet
  timestamp: number
  id: string
  packetType: string
}

export interface PacketCounts {
  count: number
  lastReset: number
  headerCount: number
  payloadCount: number
  totalCount: number
}

export interface PacketStatistics {
  totalPacketsReceived: number
  totalPacketsSent: number
  connectionCount: number
  connectionPacketCounts: Record<string, { received: number; sent: number }>
  globalPacketTypeCounts: Record<string, number>
  connectionPacketTypeCounts: Record<string, Record<string, number>>
}

/**
 * Unified hook for managing packet data and statistics using event emission
 * 
 * This hook:
 * - Listens to "serial_packet" events for real-time packet counting
 * - Provides centralized packet statistics across all connections
 * - Uses backend manager for packet counting instead of individual hooks
 * - Supports both serial and UDP connections
 * 
 * @returns Object containing packet data, statistics, and management functions
 */
export function usePacketData() {
  const [data, setData] = useState<Record<string, PacketData[]>>({})
  const [packetCounts, setPacketCounts] = useState<Record<string, PacketCounts>>({})
  const [statistics, setStatistics] = useState<PacketStatistics>({
    totalPacketsReceived: 0,
    totalPacketsSent: 0,
    connectionCount: 0,
    connectionPacketCounts: {},
    globalPacketTypeCounts: {},
    connectionPacketTypeCounts: {},
  })
  const [processedPackets] = useState<Set<string>>(new Set())

  // Fetch packet statistics from backend
  const fetchPacketStatistics = useCallback(async () => {
    try {
      const stats = await getPacketStatistics()

      setStatistics(prev => ({
        ...prev,
        totalPacketsReceived: stats.total_received,
        totalPacketsSent: stats.total_sent,
        connectionCount: stats.connection_count,
        connectionPacketCounts: stats.connection_counts,
      }))
    } catch (error) {
      console.error("Failed to fetch packet statistics:", error)
    }
  }, [])

  // Clear data for specific connection
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

    setStatistics(prev => ({
      ...prev,
      connectionPacketTypeCounts: {
        ...prev.connectionPacketTypeCounts,
        [id]: {},
      }
    }))
  }, [])

  // Clear all packet data
  const clearAllData = useCallback(() => {
    setData({})
    setPacketCounts({})
    setStatistics({
      totalPacketsReceived: 0,
      totalPacketsSent: 0,
      connectionCount: 0,
      connectionPacketCounts: {},
      globalPacketTypeCounts: {},
      connectionPacketTypeCounts: {},
    })
  }, [])

  // Remove connection data
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

    setStatistics(prev => {
      const updated = { ...prev }
      delete updated.connectionPacketTypeCounts[id]
      delete updated.connectionPacketCounts[id]
      return updated
    })
  }, [])

  // Listen to serial_packet events for real-time updates
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
      setStatistics(prev => ({
        ...prev,
        globalPacketTypeCounts: {
          ...prev.globalPacketTypeCounts,
          [packetType]: (prev.globalPacketTypeCounts[packetType] || 0) + 1,
        },
        connectionPacketTypeCounts: {
          ...prev.connectionPacketTypeCounts,
          [id]: {
            ...(prev.connectionPacketTypeCounts[id] || {}),
            [packetType]: (prev.connectionPacketTypeCounts[id]?.[packetType] || 0) + 1,
          },
        },
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
    })

    unlisten.then((un) => unlistenAll.push(un))
    return () => unlistenAll.forEach((fn) => fn())
  }, [processedPackets])

  // Periodically fetch packet statistics from backend
  useEffect(() => {
    fetchPacketStatistics()
    const interval = setInterval(fetchPacketStatistics, 1000) // Update every second
    return () => clearInterval(interval)
  }, [fetchPacketStatistics])

  // Reset all packet counters
  const resetCounters = useCallback(async () => {
    try {
      await resetPacketCounters()
      // Clear frontend data after reset
      clearAllData()
      // Refresh statistics
      await fetchPacketStatistics()
    } catch (error) {
      console.error("Failed to reset packet counters:", error)
      throw error
    }
  }, [clearAllData, fetchPacketStatistics])

  return {
    data,
    packetCounts,
    statistics,
    clearData,
    clearAllData,
    removeConnectionData,
    fetchPacketStatistics,
    resetCounters,
  }
}
