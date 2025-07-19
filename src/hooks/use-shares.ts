"use client"

import { useState, useCallback, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen, UnlistenFn } from "@tauri-apps/api/event"

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
 * - Active share tracking with real-time updates
 * - UDP target sharing
 * - Share lifecycle management
 * - Share status monitoring
 * - Cross-window synchronization
 *
 * @returns Object containing share state and management functions
 *
 * @example
 * ```typescript
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
 * ```
 */
export function useShares() {
  const [allActiveShares, setAllActiveShares] = useState<ActiveShare[]>([])
  const [udpShareActive, setUdpShareActive] = useState<UdpShare[]>([])

  const fetchAllActiveShares = useCallback(async () => {
    try {
      const res = await invoke<[string, string][]>("list_active_shares")
      const shares = res.map(([shareId, connectionId]) => ({ shareId, connectionId }))
      setAllActiveShares(shares)
      console.log("Fetched active shares:", shares)
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
        console.log(`Stopped share: ${shareId} from ${connectionId}`)
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
        console.log(`Started UDP share: ${shareId}`)
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
        console.log(`Stopped UDP share: ${shareId}`)
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

  // Real-time updates for shares across all windows
  useEffect(() => {
    let unlistenFns: UnlistenFn[] = []

    const setupEventListeners = async () => {
      try {
        // Listen for share events
        const unlistenShareStarted = await listen("share_started", () => {
          console.log("Share started event received")
          fetchAllActiveShares()
        })
        
        const unlistenShareStopped = await listen("share_stopped", () => {
          console.log("Share stopped event received")
          fetchAllActiveShares()
        })

        // Listen for connection events that might affect shares
        const unlistenConnectionEvent = await listen("connection_event", () => {
          console.log("Connection event received, refreshing shares")
          fetchAllActiveShares()
        })

        unlistenFns = [unlistenShareStarted, unlistenShareStopped, unlistenConnectionEvent]
      } catch (error) {
        console.error("Failed to setup share event listeners:", error)
      }
    }

    setupEventListeners()

    // Fallback polling every 3 seconds
    const pollInterval = setInterval(fetchAllActiveShares, 3000)

    return () => {
      unlistenFns.forEach(fn => fn())
      clearInterval(pollInterval)
    }
  }, [fetchAllActiveShares])

  // Initial fetch
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
