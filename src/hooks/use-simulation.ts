"use client"

import { useState, useCallback, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import type { SimulationResultList } from "@/gen/simulation"

export function useSimulation() {
  const [simResults, setSimResults] = useState<SimulationResultList | null>(null)
  const [targetCount, setTargetCount] = useState(0)
  const [loadingSimResults, setLoadingSimResults] = useState(false)
  const [activeSimulationStreams, setActiveSimulationStreams] = useState<string[]>([])
  const [simUdpConnId, setSimUdpConnId] = useState<string | null>(null)
  const [simUdpError, setSimUdpError] = useState<string | null>(null)
  const [totalUdpTargets, setTotalUdpTargets] = useState(0)

  const fetchSimResults = useCallback(async () => {
    setLoadingSimResults(true)
    try {
      const res = await invoke("get_simulation_data")
      if (res && typeof res === "object" && Array.isArray((res as any).results)) {
        const simData = res as SimulationResultList
        setSimResults(simData)
        setTargetCount(simData.results.length)
      } else {
        setSimResults(null)
        setTargetCount(0)
      }
    } catch (e) {
      setSimResults(null)
      setTargetCount(0)
      console.error("Failed to fetch simulation results", e)
    } finally {
      setLoadingSimResults(false)
    }
  }, [])

  const fetchActiveSimulationStreams = useCallback(async () => {
    try {
      const streams = await invoke<string[]>("list_active_simulation_streams")
      setActiveSimulationStreams(streams)
    } catch (e) {
      console.error("Failed to fetch active simulation streams:", e)
      setActiveSimulationStreams([])
    }
  }, [])

  const fetchTotalUdpTargets = useCallback(async () => {
    try {
      const total = await invoke<number>("get_total_udp_targets")
      setTotalUdpTargets(total)
    } catch (e) {
      console.error("Failed to fetch total UDP targets:", e)
      setTotalUdpTargets(0)
    }
  }, [])

  const startSimulationUdp = useCallback(
    async (localAddr: string, remoteAddr: string, intervalMs: number) => {
      setSimUdpError(null)
      try {
        const id = await invoke<string>("start_simulation_udp_streaming", {
          localAddr,
          remoteAddr,
          intervalMs,
        })
        setSimUdpConnId(id)
        setTimeout(fetchActiveSimulationStreams, 1000)
        return id
      } catch (e: any) {
        const errorMsg = e?.toString() || "Failed to start UDP simulation streaming"
        setSimUdpError(errorMsg)
        throw e
      }
    },
    [fetchActiveSimulationStreams],
  )

  const stopSimulationUdp = useCallback(async () => {
    setSimUdpError(null)
    try {
      if (simUdpConnId) {
        await invoke("stop_simulation_udp_streaming", {
          connectionId: simUdpConnId,
        })
        setSimUdpConnId(null)
      }
      setTimeout(fetchActiveSimulationStreams, 1000)
    } catch (e: any) {
      setSimUdpError(e?.toString() || "Failed to stop UDP simulation streaming")
      throw e
    }
  }, [simUdpConnId, fetchActiveSimulationStreams])

  useEffect(() => {
    fetchSimResults()
    fetchActiveSimulationStreams()
    fetchTotalUdpTargets()
  }, [fetchSimResults, fetchActiveSimulationStreams, fetchTotalUdpTargets])

  return {
    simResults,
    targetCount,
    loadingSimResults,
    activeSimulationStreams,
    simUdpConnId,
    simUdpError,
    totalUdpTargets,
    fetchSimResults,
    fetchActiveSimulationStreams,
    fetchTotalUdpTargets,
    startSimulationUdp,
    stopSimulationUdp,
  }
}
