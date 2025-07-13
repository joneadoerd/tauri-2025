"use client"

import { useState, useCallback, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"

export interface ActiveShare {
  shareId: string
  connectionId: string
}

export interface UdpShare {
  shareId: string
  sourceId: string
  targetId: number
  destId: string
  interval: number
}

export function useShares() {
  const [allActiveShares, setAllActiveShares] = useState<ActiveShare[]>([])
  const [udpShareActive, setUdpShareActive] = useState<UdpShare[]>([])

  const fetchAllActiveShares = useCallback(async () => {
    try {
      const res = await invoke<[string, string][]>("list_active_shares")
      setAllActiveShares(res.map(([shareId, connectionId]) => ({ shareId, connectionId })))
    } catch (error) {
      console.error("Failed to fetch active shares:", error)
    }
  }, [])

  const stopShare = useCallback(
    async (shareId: string, connectionId: string) => {
      try {
        await invoke("stop_share_to_connection", { shareId, connectionId })
        await fetchAllActiveShares()
        // Also update UDP shares if needed
        setUdpShareActive((prev) => prev.filter((s) => s.shareId !== shareId))
      } catch (error) {
        console.error("Failed to stop share:", error)
      }
    },
    [fetchAllActiveShares],
  )

  const startUdpShare = useCallback(
    async (sourceId: string, targetId: number, destId: string, interval: number) => {
      try {
        const shareId = await invoke<string>("share_udp_target_to_connection", {
          udpConnectionId: sourceId,
          targetId,
          destConnectionId: destId,
          intervalMs: interval,
        })

        const newShare: UdpShare = {
          shareId,
          sourceId,
          targetId,
          destId,
          interval,
        }

        setUdpShareActive((prev) => [...prev, newShare])
        await fetchAllActiveShares()
        return shareId
      } catch (error) {
        console.error("Failed to start UDP share:", error)
        throw error
      }
    },
    [fetchAllActiveShares],
  )

  const stopUdpShare = useCallback(
    async (shareId: string, destId: string) => {
      try {
        await invoke("stop_share_to_connection", { shareId, connectionId: destId })
        setUdpShareActive((prev) => prev.filter((s) => s.shareId !== shareId))
        await fetchAllActiveShares()
      } catch (error) {
        console.error("Failed to stop UDP share:", error)
        throw error
      }
    },
    [fetchAllActiveShares],
  )

  const hasActiveShares = useCallback(
    (connectionId: string): boolean => {
      return allActiveShares.some((share) => share.connectionId === connectionId)
    },
    [allActiveShares],
  )

  const getActiveSharesCount = useCallback(
    (connectionId: string): number => {
      return allActiveShares.filter((share) => share.connectionId === connectionId).length
    },
    [allActiveShares],
  )

  const hasAnyActiveShares = useCallback((): boolean => {
    return allActiveShares.length > 0
  }, [allActiveShares])

  useEffect(() => {
    fetchAllActiveShares()
  }, [fetchAllActiveShares])

  return {
    allActiveShares,
    udpShareActive,
    fetchAllActiveShares,
    stopShare,
    startUdpShare,
    stopUdpShare,
    hasActiveShares,
    getActiveSharesCount,
    hasAnyActiveShares,
  }
}
