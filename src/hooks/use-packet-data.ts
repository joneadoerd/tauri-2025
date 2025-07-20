"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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

  // --- Throttling buffers and refs ---
  const bufferRef = useRef<{ [id: string]: PacketData[] }>({})
  const statsBufferRef = useRef<Partial<PacketStatistics> | null>(null)
  const countsBufferRef = useRef<{ [id: string]: Partial<PacketCounts> }>({})
  const rafRef = useRef<number | null>(null)

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

  // Listen to serial_packet events for real-time updates (throttled)
  useEffect(() => {
    const unlistenAll: UnlistenFn[] = []

    const scheduleFlush = () => {
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null
          // Flush packet data
          if (Object.keys(bufferRef.current).length > 0) {
            setData(prev => {
              const updated = { ...prev }
              for (const id in bufferRef.current) {
                const currentPackets = prev[id] || []
                // Only keep last 100
                updated[id] = [...currentPackets, ...bufferRef.current[id]].slice(-100)
              }
              return updated
            })
            bufferRef.current = {}
          }
          // Flush statistics
          if (statsBufferRef.current) {
            const stats = statsBufferRef.current;
            setStatistics(prev => ({
              ...prev,
              ...stats,
              globalPacketTypeCounts: {
                ...prev.globalPacketTypeCounts,
                ...((stats.globalPacketTypeCounts as object) || {}),
              },
              connectionPacketTypeCounts: {
                ...prev.connectionPacketTypeCounts,
                ...((stats.connectionPacketTypeCounts as object) || {}),
              },
            }))
            statsBufferRef.current = null;
          }
          // Flush packet counts
          if (Object.keys(countsBufferRef.current).length > 0) {
            setPacketCounts(prev => {
              const updated = { ...prev }
              for (const id in countsBufferRef.current) {
                updated[id] = { ...prev[id], ...countsBufferRef.current[id] }
              }
              return updated
            })
            countsBufferRef.current = {}
          }
        })
      }
    }

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

      // Buffer packet data
      if (!bufferRef.current[id]) bufferRef.current[id] = []
      const packetId = `${id}_${now}_${Math.random().toString(36).substr(2, 9)}`
      const newPacket: PacketData = {
        packet,
        timestamp: now,
        id: packetId,
        packetType,
      }
      bufferRef.current[id].push(newPacket)

      // Buffer statistics
      if (!statsBufferRef.current) statsBufferRef.current = {}
      // Update global packet type counter
      statsBufferRef.current.globalPacketTypeCounts = {
        ...(statsBufferRef.current.globalPacketTypeCounts || {}),
        [packetType]: ((statsBufferRef.current.globalPacketTypeCounts?.[packetType] || 0) + 1),
      }
      // Update connection packet type counter
      statsBufferRef.current.connectionPacketTypeCounts = {
        ...(statsBufferRef.current.connectionPacketTypeCounts || {}),
        [id]: {
          ...((statsBufferRef.current.connectionPacketTypeCounts?.[id] as object) || {}),
          [packetType]: ((statsBufferRef.current.connectionPacketTypeCounts?.[id]?.[packetType] || 0) + 1),
        },
      }

      // Buffer packet counts
      if (!countsBufferRef.current[id]) countsBufferRef.current[id] = {}
      // For simplicity, just increment totalCount and type counts (not full logic)
      countsBufferRef.current[id].count = (countsBufferRef.current[id].count || 0) + 1
      countsBufferRef.current[id].headerCount = (countsBufferRef.current[id].headerCount || 0) + (packetType === "header" ? 1 : 0)
      countsBufferRef.current[id].payloadCount = (countsBufferRef.current[id].payloadCount || 0) + (packetType === "payload" ? 1 : 0)
      countsBufferRef.current[id].totalCount = (countsBufferRef.current[id].totalCount || 0) + 1
      countsBufferRef.current[id].lastReset = Date.now()

      scheduleFlush()
    })

    unlisten.then((un) => unlistenAll.push(un))
    return () => {
      unlistenAll.forEach((fn) => fn())
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
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
