"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Connection } from "@/hooks/use-serial-connections"
import type { UdpShare } from "@/hooks/use-shares"

interface UdpTargetSharingProps {
  connections: Connection[]
  udpShareTargets: any[]
  udpShareLoadingTargets: boolean
  udpShareActive: UdpShare[]
  onFetchUdpTargets: (connectionId: string) => Promise<any[]>
  onStartUdpShare: (sourceId: string, targetId: number, destId: string, interval: number) => Promise<string>
  onStopUdpShare: (shareId: string, destId: string) => Promise<void>
}

export function UdpTargetSharing({
  connections,
  udpShareTargets,
  udpShareLoadingTargets,
  udpShareActive,
  onFetchUdpTargets,
  onStartUdpShare,
  onStopUdpShare,
}: UdpTargetSharingProps) {
  const [udpShareSourceId, setUdpShareSourceId] = useState("")
  const [udpShareSelectedTargetId, setUdpShareSelectedTargetId] = useState<number | null>(null)
  const [udpShareDestConnId, setUdpShareDestConnId] = useState("")
  const [udpShareInterval, setUdpShareInterval] = useState(100)
  const [udpShareError, setUdpShareError] = useState<string | null>(null)

  // Filter UDP connections
  const udpConnections = connections.filter((c) => c.name && c.name.startsWith("Udp("))

  // Auto-select first UDP connection
  useEffect(() => {
    if (!udpShareSourceId && udpConnections.length > 0) {
      setUdpShareSourceId(udpConnections[0].id)
    }
  }, [udpConnections, udpShareSourceId])

  // Auto-select first destination connection
  useEffect(() => {
    if (!udpShareDestConnId && connections.length > 0) {
      setUdpShareDestConnId(connections[0].id)
    }
  }, [connections, udpShareDestConnId])

  // Fetch targets when source changes
  useEffect(() => {
    if (udpShareSourceId) {
      onFetchUdpTargets(udpShareSourceId)
    }
  }, [udpShareSourceId, onFetchUdpTargets])

  // Auto-select first target
  useEffect(() => {
    if (udpShareTargets.length > 0 && !udpShareSelectedTargetId) {
      setUdpShareSelectedTargetId(udpShareTargets[0].target_id)
    }
  }, [udpShareTargets, udpShareSelectedTargetId])

  const handleStartUdpShare = async () => {
    setUdpShareError(null)
    if (!udpShareSourceId || !udpShareSelectedTargetId || !udpShareDestConnId) {
      setUdpShareError("Select UDP source, target, and destination")
      return
    }

    // Prevent duplicate share
    if (
      udpShareActive.some(
        (s) =>
          s.sourceId === udpShareSourceId && s.targetId === udpShareSelectedTargetId && s.destId === udpShareDestConnId,
      )
    ) {
      setUdpShareError("This share is already active.")
      return
    }

    try {
      await onStartUdpShare(udpShareSourceId, udpShareSelectedTargetId, udpShareDestConnId, udpShareInterval)
    } catch (error: any) {
      setUdpShareError(error?.toString() || "Failed to start UDP share")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Share Target from UDP Data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <Label>UDP Source Connection</Label>
            <Select value={udpShareSourceId} onValueChange={setUdpShareSourceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select UDP connection" />
              </SelectTrigger>
              <SelectContent>
                {udpConnections.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Target</Label>
            <Select
              value={udpShareSelectedTargetId?.toString() ?? ""}
              onValueChange={(v) => setUdpShareSelectedTargetId(Number(v))}
              disabled={udpShareLoadingTargets || udpShareTargets.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={udpShareLoadingTargets ? "Loading..." : "Select target"} />
              </SelectTrigger>
              <SelectContent>
                {udpShareTargets.map((t) => (
                  <SelectItem key={t.target_id} value={t.target_id.toString()}>
                    Target {t.target_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Destination Connection</Label>
            <Select value={udpShareDestConnId} onValueChange={setUdpShareDestConnId}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination" />
              </SelectTrigger>
              <SelectContent>
                {connections.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Interval (ms)</Label>
            <Input
              type="number"
              min={1}
              value={udpShareInterval}
              onChange={(e) => setUdpShareInterval(Number(e.target.value))}
            />
          </div>

          <Button
            onClick={handleStartUdpShare}
            disabled={!udpShareSourceId || !udpShareSelectedTargetId || !udpShareDestConnId}
          >
            Start Share
          </Button>
        </div>

        {udpShareError && <div className="text-sm text-red-600 p-2 bg-red-50 rounded">{udpShareError}</div>}

        {udpShareTargets.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Latest targets received: {udpShareTargets.map((t) => t.target_id).join(", ")}
          </div>
        )}

        {/* Active UDP Shares */}
        {udpShareActive.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Active UDP Shares ({udpShareActive.length})</Label>
            <div className="space-y-2">
              {udpShareActive.map((share) => (
                <div key={share.shareId} className="flex items-center justify-between p-2 bg-muted rounded">
                  <div className="text-sm">
                    <span className="font-mono">{share.shareId}</span>
                    <span className="text-muted-foreground ml-2">
                      Target {share.targetId} → {share.destId} ({share.interval}ms)
                    </span>
                  </div>
                  <Button size="sm" variant="destructive" onClick={() => onStopUdpShare(share.shareId, share.destId)}>
                    Stop
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {udpShareActive.length === 0 && (
          <div className="text-xs text-muted-foreground">
            No active UDP shares. Start sharing targets from UDP connections to other connections.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
