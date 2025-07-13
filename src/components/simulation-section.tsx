"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

interface SimulationStreamingProps {
  activeSimulationStreams: string[]
  simUdpConnId: string | null
  simUdpError: string | null
  onStartSimulationUdp: (localAddr: string, remoteAddr: string, intervalMs: number) => Promise<string>
  onStopSimulationUdp: () => Promise<void>
}

export function SimulationStreaming({
  activeSimulationStreams,
  simUdpConnId,
  simUdpError,
  onStartSimulationUdp,
  onStopSimulationUdp,
}: SimulationStreamingProps) {
  const [simLocalAddr, setSimLocalAddr] = useState("0.0.0.0:6000")
  const [simRemoteAddr, setSimRemoteAddr] = useState("127.0.0.1:9000")
  const [simInterval, setSimInterval] = useState(1000)
  const [isStartingSimUdp, setIsStartingSimUdp] = useState(false)
  const [isStoppingSimUdp, setIsStoppingSimUdp] = useState(false)

  const handleStartSimUdp = async () => {
    if (isStartingSimUdp) return

    setIsStartingSimUdp(true)
    try {
      await onStartSimulationUdp(simLocalAddr, simRemoteAddr, simInterval)
    } catch (error) {
      console.error("Failed to start simulation UDP:", error)
    } finally {
      setIsStartingSimUdp(false)
    }
  }

  const handleStopSimUdp = async () => {
    if (isStoppingSimUdp) return

    setIsStoppingSimUdp(true)
    try {
      await onStopSimulationUdp()
    } catch (error) {
      console.error("Failed to stop simulation UDP:", error)
    } finally {
      setIsStoppingSimUdp(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Simulation UDP Streaming</CardTitle>
        <CardDescription>Start or stop UDP streaming of simulation results</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <Label>Local Address</Label>
            <Input value={simLocalAddr} onChange={(e) => setSimLocalAddr(e.target.value)} placeholder="0.0.0.0:6000" />
          </div>

          <div>
            <Label>Remote Address</Label>
            <Input
              value={simRemoteAddr}
              onChange={(e) => setSimRemoteAddr(e.target.value)}
              placeholder="127.0.0.1:9000"
            />
          </div>

          <div>
            <Label>Interval (ms)</Label>
            <Input type="number" value={simInterval} onChange={(e) => setSimInterval(Number(e.target.value))} min={1} />
          </div>

          <Button
            onClick={handleStartSimUdp}
            disabled={!!simUdpConnId || activeSimulationStreams.length > 0 || isStartingSimUdp}
            title={
              activeSimulationStreams.length > 0
                ? "Stop existing simulation streams first"
                : "Start Simulation UDP Streaming"
            }
          >
            {isStartingSimUdp ? "Starting..." : "Start"}
          </Button>

          <Button
            onClick={handleStopSimUdp}
            disabled={(!simUdpConnId && activeSimulationStreams.length === 0) || isStoppingSimUdp}
            variant="destructive"
            title={
              !simUdpConnId && activeSimulationStreams.length === 0
                ? "No simulation streaming to stop"
                : "Stop Simulation UDP Streaming"
            }
          >
            {isStoppingSimUdp ? "Stopping..." : "Stop"}
          </Button>
        </div>

        {(simUdpConnId || activeSimulationStreams.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {simUdpConnId && <Badge>Connection: {simUdpConnId}</Badge>}
            {activeSimulationStreams.length > 0 && (
              <Badge variant="secondary">
                {activeSimulationStreams.length} Active Stream{activeSimulationStreams.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        )}

        {simUdpError && <div className="mt-4 text-sm text-red-600 p-2 bg-red-50 rounded">{simUdpError}</div>}

        {activeSimulationStreams.length > 0 && (
          <div className="mt-4">
            <Label className="text-sm font-medium">Active Streams:</Label>
            <div className="mt-2 flex flex-wrap gap-2">
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
