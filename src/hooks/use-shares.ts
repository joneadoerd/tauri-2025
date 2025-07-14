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

/**
 * Custom hook for managing data sharing between connections
 *
 * Handles:
 * - Active share tracking
 * - UDP target sharing
 * - Share lifecycle management
 * - Share status monitoring
 *
 * @returns Object containing share state and management functions
 *
 * @example
 * \`\`\`typescript
 * const {
 *   allActiveShares,
 *   udpShareActive,
 *   startUdpShare,
 *   stopUdpShare,
 *   hasActiveShares
 * } = useShares()
 *
 * // Start sharing UDP target
 * await startUdpShare("source-id", 123, "dest-id", 1000)
 * \`\`\`
 */
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
    /** Array of all active shares */
    allActiveShares,
    /** Array of active UDP shares */
    udpShareActive,
    /** Function to fetch all active shares */
    fetchAllActiveShares,
    /** Function to stop a specific share */
    stopShare,
    /** Function to start UDP target sharing */
    startUdpShare,
    /** Function to stop UDP target sharing */
    stopUdpShare,
    /** Function to check if connection has active shares */
    hasActiveShares,
    /** Function to get active shares count for connection */
    getActiveSharesCount,
    /** Function to check if any shares are active */
    hasAnyActiveShares,
  }
}
