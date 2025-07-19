"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { isValidAddress, isValidInterval } from "@/utils/validation-utils"
import type { BaseComponentProps } from "@/types"

/**
 * Props for SimulationStreaming component
 */
interface SimulationStreamingProps extends BaseComponentProps {
  /** Array of active simulation stream IDs */
  activeSimulationStreams: string[]
  /** Current simulation UDP connection ID */
  simUdpConnId: string | null
  /** Current simulation UDP error message */
  simUdpError: string | null
  /** Function to start simulation UDP streaming */
  onStartSimulationUdp: (localAddr: string, remoteAddr: string, intervalMs: number, originLat: number, originLon: number, originAlt: number) => Promise<string>
  /** Function to stop simulation UDP streaming */
  onStopSimulationUdp: () => Promise<void>
}

/**
 * SimulationStreaming Component
 *
 * Provides interface for simulation UDP streaming with:
 * - Local and remote address configuration
 * - Streaming interval settings
 * - Active stream monitoring
 * - Error handling and status display
 *
 * @param props - Component props
 * @returns JSX element for simulation streaming controls
 *
 * @example
 * ```tsx
 * <SimulationStreaming
 *   activeSimulationStreams={streams}
 *   simUdpConnId={connectionId}
 *   onStartSimulationUdp={handleStart}
 *   onStopSimulationUdp={handleStop}
 * />
 * ```
 */
export function SimulationStreaming({
  activeSimulationStreams,
  simUdpConnId,
  simUdpError,
  onStartSimulationUdp,
  onStopSimulationUdp,
  className,
}: SimulationStreamingProps) {
  const [simLocalAddr, setSimLocalAddr] = useState("0.0.0.0:6000")
  const [simRemoteAddr, setSimRemoteAddr] = useState("127.0.0.1:9000")
  const [simInterval, setSimInterval] = useState(1000)
  const [isStartingSimUdp, setIsStartingSimUdp] = useState(false)
  const [isStoppingSimUdp, setIsStoppingSimUdp] = useState(false)
  const [originLat, setOriginLat] = useState(0.0);
  const [originLon, setOriginLon] = useState(0.0);
  const [originAlt, setOriginAlt] = useState(0.0);
  const [stopped, setStopped] = useState(false);

  /**
   * Validates form inputs
   */
  const isFormValid = isValidAddress(simLocalAddr) && isValidAddress(simRemoteAddr) && isValidInterval(simInterval)

  /**
   * Handles starting simulation UDP streaming
   */
  const handleStartSimUdp = async () => {
    if (isStartingSimUdp || !isFormValid) return

    setIsStartingSimUdp(true)
    setStopped(false)
    try {
      await onStartSimulationUdp(simLocalAddr, simRemoteAddr, simInterval, originLat, originLon, originAlt);
    } catch (error) {
      console.error("Failed to start simulation UDP:", error)
    } finally {
      setIsStartingSimUdp(false)
    }
  }

  /**
   * Handles stopping simulation UDP streaming
   */
  const handleStopSimUdp = async () => {
    if (isStoppingSimUdp) return

    setIsStoppingSimUdp(true)
    try {
      await onStopSimulationUdp()
      setStopped(true)
      // Optionally, update status or clear other local state here
    } catch (error) {
      console.error("Failed to stop simulation UDP:", error)
    } finally {
      setIsStoppingSimUdp(false)
    }
  }

  const hasActiveStreams = simUdpConnId || activeSimulationStreams.length > 0
  const canStart = !hasActiveStreams && !isStartingSimUdp && isFormValid
  const canStop = hasActiveStreams && !isStoppingSimUdp

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Simulation UDP Streaming</CardTitle>
        <CardDescription>Start or stop UDP streaming of simulation results</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 items-end">
          {/* Local Address */}
          <div className="flex flex-col">
            <Label htmlFor="sim-local-addr">Local Address</Label>
            <Input
              id="sim-local-addr"
              value={simLocalAddr}
              onChange={(e) => setSimLocalAddr(e.target.value)}
              placeholder="0.0.0.0:6000"
              className={!isValidAddress(simLocalAddr) && simLocalAddr ? "border-red-500" : ""}
            />
            {simLocalAddr && !isValidAddress(simLocalAddr) && (
              <span className="text-xs text-red-500 mt-1">Invalid address format</span>
            )}
          </div>

          {/* Remote Address */}
          <div className="flex flex-col">
            <Label htmlFor="sim-remote-addr">Remote Address</Label>
            <Input
              id="sim-remote-addr"
              value={simRemoteAddr}
              onChange={(e) => setSimRemoteAddr(e.target.value)}
              placeholder="127.0.0.1:9000"
              className={!isValidAddress(simRemoteAddr) && simRemoteAddr ? "border-red-500" : ""}
            />
            {simRemoteAddr && !isValidAddress(simRemoteAddr) && (
              <span className="text-xs text-red-500 mt-1">Invalid address format</span>
            )}
          </div>

          {/* Interval */}
          <div className="flex flex-col">
            <Label htmlFor="sim-interval">Interval (ms)</Label>
            <Input
              id="sim-interval"
              type="number"
              value={simInterval}
              onChange={(e) => setSimInterval(Number(e.target.value))}
              min={1}
              max={60000}
              className={!isValidInterval(simInterval) ? "border-red-500" : ""}
            />
            {!isValidInterval(simInterval) && <span className="text-xs text-red-500 mt-1">Must be 1-60000ms</span>}
          </div>

          {/* Origin Latitude */}
          <div className="flex flex-col">
            <Label htmlFor="origin-lat">Origin Latitude</Label>
            <Input
              id="origin-lat"
              type="number"
              value={originLat}
              onChange={(e) => setOriginLat(Number(e.target.value))}
              step="any"
            />
          </div>

          {/* Origin Longitude */}
          <div className="flex flex-col">
            <Label htmlFor="origin-lon">Origin Longitude</Label>
            <Input
              id="origin-lon"
              type="number"
              value={originLon}
              onChange={(e) => setOriginLon(Number(e.target.value))}
              step="any"
            />
          </div>

          {/* Origin Altitude */}
          <div className="flex flex-col">
            <Label htmlFor="origin-alt">Origin Altitude (m)</Label>
            <Input
              id="origin-alt"
              type="number"
              value={originAlt}
              onChange={(e) => setOriginAlt(Number(e.target.value))}
              step="any"
            />
          </div>

          {/* Start Button */}
          <Button
            onClick={handleStartSimUdp}
            disabled={!canStart}
            title={
              !isFormValid
                ? "Fix validation errors first"
                : hasActiveStreams
                  ? "Stop existing streams first"
                  : "Start Simulation UDP Streaming"
            }
          >
            {isStartingSimUdp ? "Starting..." : "Start"}
          </Button>

          {/* Stop Button */}
          <Button
            onClick={handleStopSimUdp}
            disabled={!canStop}
            variant="destructive"
            title={!hasActiveStreams ? "No simulation streaming to stop" : "Stop Simulation UDP Streaming"}
          >
            {isStoppingSimUdp ? "Stopping..." : "Stop"}
          </Button>
        </div>

        {/* Status Display */}
        {hasActiveStreams && (
          <div className="mt-4 flex flex-wrap gap-2">
            {simUdpConnId && <Badge variant="default">Connection: {simUdpConnId}</Badge>}
            {activeSimulationStreams.length > 0 && (
              <Badge variant="secondary">
                {activeSimulationStreams.length} Active Stream{activeSimulationStreams.length !== 1 ? "s" : ""}
              </Badge>
            )}
            {stopped && (
              <Badge variant="destructive">Streaming Stopped</Badge>
            )}
          </div>
        )}

        {/* Error Display */}
        {simUdpError && (
          <div className="mt-4 text-sm text-red-600 p-2 bg-red-50 rounded border border-red-200">{simUdpError}</div>
        )}

        {/* Active Streams List */}
        {activeSimulationStreams.length > 0 && (
          <div className="mt-4">
            <Label className="text-sm font-medium">Active Streams:</Label>
            <div className="mt-2 flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {activeSimulationStreams.map((streamId) => (
                <Badge key={streamId} variant="outline" className="font-mono text-xs">
                  {streamId}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
