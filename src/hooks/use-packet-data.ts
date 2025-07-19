"use client"

import { useState, useEffect, useRef, useCallback } from "react"
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

  // === Refs to store intermediate high-frequency data without triggering re-render
  const dataBufferRef = useRef<Record<string, PacketData[]>>({})
  const countBufferRef = useRef<Record<string, PacketCounts>>({})
  const statsBufferRef = useRef<PacketStatistics>(statistics)
  const processedPackets = useRef<Set<string>>(new Set())

  const fetchPacketStatistics = useCallback(async () => {
    try {
      const stats = await getPacketStatistics()
      setStatistics((prev) => {
        const updated = {
          ...prev,
          totalPacketsReceived: stats.total_received,
          totalPacketsSent: stats.total_sent,
          connectionCount: stats.connection_count,
          connectionPacketCounts: stats.connection_counts,
        }
        statsBufferRef.current = updated
        return updated
      })
    } catch (error) {
      console.error("Failed to fetch packet statistics:", error)
    }
  }, [])

  const clearData = useCallback((id: string) => {
    setData((prev) => {
      const updated = { ...prev, [id]: [] }
      dataBufferRef.current[id] = []
      return updated
    })

    setPacketCounts((prev) => {
      const reset = {
        count: 0,
        lastReset: Date.now(),
        headerCount: 0,
        payloadCount: 0,
        totalCount: 0,
      }
      countBufferRef.current[id] = reset
      return { ...prev, [id]: reset }
    })

    setStatistics((prev) => {
      const updated = {
        ...prev,
        connectionPacketTypeCounts: {
          ...prev.connectionPacketTypeCounts,
          [id]: {},
        },
      }
      statsBufferRef.current = updated
      return updated
    })
  }, [])

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
    dataBufferRef.current = {}
    countBufferRef.current = {}
    statsBufferRef.current = {
      totalPacketsReceived: 0,
      totalPacketsSent: 0,
      connectionCount: 0,
      connectionPacketCounts: {},
      globalPacketTypeCounts: {},
      connectionPacketTypeCounts: {},
    }
  }, [])

  const removeConnectionData = useCallback((id: string) => {
    setData((prev) => {
      const updated = { ...prev }
      delete updated[id]
      delete dataBufferRef.current[id]
      return updated
    })

    setPacketCounts((prev) => {
      const updated = { ...prev }
      delete updated[id]
      delete countBufferRef.current[id]
      return updated
    })

    setStatistics((prev) => {
      const updated = { ...prev }
      delete updated.connectionPacketCounts[id]
      delete updated.connectionPacketTypeCounts[id]
      statsBufferRef.current = updated
      return updated
    })
  }, [])

  // Event listener
  useEffect(() => {
    let isMounted = true

    const handlePacket = (event: Event<SerialPacketEvent>) => {
      const { id, packet } = event.payload
      if (!packet) return

      const now = Date.now()
      // Use a unique field in packet for deduplication if available, otherwise skip deduplication
      let uniquePacketId: string | undefined = undefined
      if (typeof packet === 'object' && packet !== null) {
        if ('id' in packet && typeof (packet as any).id === 'string') {
          uniquePacketId = `${id}_$ {(packet as any).id}`
        }
      }
      if (uniquePacketId) {
        if (processedPackets.current.has(uniquePacketId)) return
        processedPackets.current.add(uniquePacketId)
        // Prevent memory leak: clear set if too large
        if (processedPackets.current.size > 10000) {
          processedPackets.current.clear()
        }
      }

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

      // === Buffer packet data (queue new packets)
      const packetId = `${id}_${now}_${Math.random().toString(36).substr(2, 9)}`;
      const newPacket: PacketData = { packet, timestamp: now, id: packetId, packetType };
      if (!dataBufferRef.current[id]) dataBufferRef.current[id] = [];
      dataBufferRef.current[id].push(newPacket);

      // === Buffer packet counts
      const counts = countBufferRef.current[id] || {
        count: 0,
        lastReset: now,
        headerCount: 0,
        payloadCount: 0,
        totalCount: 0,
      }

      const updatedCounts: PacketCounts = {
        ...counts,
        count: counts.count + 1,
        headerCount: counts.headerCount + (packetType === "header" ? 1 : 0),
        payloadCount: counts.payloadCount + (packetType === "payload" ? 1 : 0),
        totalCount: counts.totalCount + 1,
      }

      countBufferRef.current[id] = updatedCounts

      // === Buffer statistics
      const stats = statsBufferRef.current;
      // Determine direction (received or sent). If not available, default to received.
      let isSent = false;
      if (typeof packet === 'object' && packet !== null) {
        if ('direction' in packet && (packet as any).direction === 'sent') {
          isSent = true;
        }
      }
      // Update per-connection counts
      const prevConnStats = stats.connectionPacketCounts[id] || { received: 0, sent: 0 };
      const newConnStats = {
        received: prevConnStats.received + (isSent ? 0 : 1),
        sent: prevConnStats.sent + (isSent ? 1 : 0),
      };
      const newConnectionPacketCounts = {
        ...stats.connectionPacketCounts,
        [id]: newConnStats,
      };
      // Update connection count (number of keys)
      const newConnectionCount = Object.keys(newConnectionPacketCounts).length;
      // Update type counters for both sent and received
      const prevTypeCount = stats.globalPacketTypeCounts[packetType] || 0;
      const prevConnTypeCount = (stats.connectionPacketTypeCounts[id]?.[packetType] || 0);
      statsBufferRef.current = {
        ...stats,
        totalPacketsReceived: (stats.totalPacketsReceived || 0) + (isSent ? 0 : 1),
        totalPacketsSent: (stats.totalPacketsSent || 0) + (isSent ? 1 : 0),
        connectionPacketCounts: newConnectionPacketCounts,
        connectionCount: newConnectionCount,
        globalPacketTypeCounts: {
          ...stats.globalPacketTypeCounts,
          [packetType]: prevTypeCount + 1,
        },
        connectionPacketTypeCounts: {
          ...stats.connectionPacketTypeCounts,
          [id]: {
            ...(stats.connectionPacketTypeCounts[id] || {}),
            [packetType]: prevConnTypeCount + 1,
          },
        },
      };
    }

    const startListening = async () => {
      const unlisten = await listen("serial_packet", handlePacket)
      return unlisten
    }

    let unlistenFn: UnlistenFn
    startListening().then(unlisten => {
      if (isMounted) unlistenFn = unlisten
    })

    return () => {
      isMounted = false
      unlistenFn?.()
    }
  }, [])

  // Periodically flush buffered data into React state using setInterval (minimize re-renders)
  useEffect(() => {
    let isMounted = true;
    const FLUSH_INTERVAL = 50; // ms, adjust as needed
    const interval = setInterval(() => {
      if (!isMounted) return;
      let hasData = false;
      setData(prev => {
        const updated = { ...prev };
        for (const id in dataBufferRef.current) {
          if (dataBufferRef.current[id].length > 0) {
            updated[id] = [...(prev[id] || []), ...dataBufferRef.current[id]];
            updated[id] = updated[id].slice(-5000);
            dataBufferRef.current[id] = [];
            hasData = true;
          }
        }
        return updated;
      });
      setPacketCounts({ ...countBufferRef.current });
      setStatistics({ ...statsBufferRef.current });
    }, FLUSH_INTERVAL);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    fetchPacketStatistics()
    const interval = setInterval(fetchPacketStatistics, 1000)
    return () => clearInterval(interval)
  }, [fetchPacketStatistics])

  const resetCounters = useCallback(async () => {
    try {
      await resetPacketCounters()
      clearAllData()
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
