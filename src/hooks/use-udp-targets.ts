"use client"

import { useState, useCallback, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"

/**
 * Custom hook for managing UDP target data
 *
 * Provides functionality to:
 * - Fetch UDP targets for connections
 * - Track total UDP target count
 * - Manage loading states
 *
 * @returns Object containing UDP target state and management functions
 *
 * @example
 * \`\`\`typescript
 * const {
 *   udpShareTargets,
 *   totalUdpTargets,
 *   fetchUdpTargets
 * } = useUdpTargets()
 *
 * // Fetch targets for connection
 * const targets = await fetchUdpTargets("connection-id")
 * \`\`\`
 */
export function useUdpTargets() {
  const [udpShareTargets, setUdpShareTargets] = useState<any[]>([])
  const [udpShareLoadingTargets, setUdpShareLoadingTargets] = useState(false)
  const [totalUdpTargets, setTotalUdpTargets] = useState(0)

  const fetchUdpTargets = useCallback(async (connectionId: string) => {
    setUdpShareLoadingTargets(true)
    setUdpShareTargets([])
    try {
      const targets = await invoke<any[]>("list_udp_targets", { connectionId })
      setUdpShareTargets(targets)
      return targets
    } catch (error) {
      console.error("Failed to fetch UDP targets:", error)
      setUdpShareTargets([])
      return []
    } finally {
      setUdpShareLoadingTargets(false)
    }
  }, [])

  const fetchTotalUdpTargets = useCallback(async () => {
    try {
      const total = await invoke<number>("get_total_udp_targets")
      setTotalUdpTargets(total)
    } catch (error) {
      console.error("Failed to fetch total UDP targets:", error)
      setTotalUdpTargets(0)
    }
  }, [])

  useEffect(() => {
    fetchTotalUdpTargets()
  }, [fetchTotalUdpTargets])

  return {
    /** Array of UDP targets for selected connection */
    udpShareTargets,
    /** Whether UDP targets are currently loading */
    udpShareLoadingTargets,
    /** Total number of UDP targets across all connections */
    totalUdpTargets,
    /** Function to fetch UDP targets for a connection */
    fetchUdpTargets,
    /** Function to fetch total UDP target count */
    fetchTotalUdpTargets,
  }
}
