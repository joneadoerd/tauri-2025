"use client"

import { useState, useCallback, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"

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
    udpShareTargets,
    udpShareLoadingTargets,
    totalUdpTargets,
    fetchUdpTargets,
    fetchTotalUdpTargets,
  }
}
