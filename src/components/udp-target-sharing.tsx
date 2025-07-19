"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { truncateText } from "@/utils/text-utils"
import { isValidInterval } from "@/utils/validation-utils"
import type { Connection, UdpShare, BaseComponentProps } from "@/types"

/**
 * Props for UdpTargetSharing component
 */
interface UdpTargetSharingProps extends BaseComponentProps {
  /** Array of all available connections */
  connections: Connection[]
  /** Available UDP targets for sharing */
  udpShareTargets: any[]
  /** Whether UDP targets are currently loading */
  udpShareLoadingTargets: boolean
  /** Array of currently active UDP shares */
  udpShareActive: UdpShare[]
  /** Function to fetch UDP targets for a connection */
  onFetchUdpTargets: (connectionId: string) => Promise<any[]>
  /** Function to start a new UDP share */
  onStartUdpShare: (sourceId: string, targetId: number, destId: string, interval: number) => Promise<string>
  /** Function to stop an active UDP share */
  onStopUdpShare: (shareId: string, destId: string) => Promise<void>
}

/**
 * UdpTargetSharing Component
 *
 * Provides interface for sharing UDP target data between connections:
 * - Source connection selection (UDP connections only)
 * - Target selection from available targets
 * - Destination connection selection
 * - Interval configuration
 * - Active share management
 *
 * @param props - Component props
 * @returns JSX element for UDP target sharing
 *
 * @example
 * ```tsx
 * <UdpTargetSharing
 *   connections={connections}
 *   udpShareTargets={targets}
 *   udpShareActive={activeShares}
 *   onStartUdpShare={handleStartShare}
 *   onStopUdpShare={handleStopShare}
 * />
 * ```
 */
export function UdpTargetSharing({
  connections,
  udpShareTargets,
  udpShareLoadingTargets,
  udpShareActive,
  onFetchUdpTargets,
  onStartUdpShare,
  onStopUdpShare,
  className,
}: UdpTargetSharingProps) {
  const [udpShareSourceId, setUdpShareSourceId] = useState("")
  const [udpShareSelectedTargetId, setUdpShareSelectedTargetId] = useState<number | null>(null)
  const [udpShareDestConnId, setUdpShareDestConnId] = useState("")
  const [udpShareInterval, setUdpShareInterval] = useState(100)
  const [udpShareError, setUdpShareError] = useState<string | null>(null)

  // Filter UDP connections for source selection
  const udpConnections = connections.filter((c) => c.name && c.name.startsWith("Udp("))

  // Auto-select first UDP connection as source
  useEffect(() => {
    if (!udpShareSourceId && udpConnections.length > 0) {
      setUdpShareSourceId(udpConnections[0].id)
    }
  }, [udpConnections, udpShareSourceId])

  // Auto-select first connection as destination
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

  /**
   * Handles starting a new UDP share
   */
  const handleStartUdpShare = async () => {
    setUdpShareError(null)

    // Validation
    if (!udpShareSourceId || !udpShareSelectedTargetId || !udpShareDestConnId) {
      setUdpShareError("Select UDP source, target, and destination")
      return
    }

    if (!isValidInterval(udpShareInterval)) {
      setUdpShareError("Invalid interval. Must be between 1ms and 60000ms")
      return
    }

    try {
      await onStartUdpShare(udpShareSourceId, udpShareSelectedTargetId, udpShareDestConnId, udpShareInterval)
    } catch (error: any) {
      setUdpShareError(error?.message || error?.toString() || "Failed to start UDP share")
    }
  }

  /**
   * Renders connection option with truncated name
   */
  const renderConnectionOption = (connection: Connection) => (
    <SelectItem key={connection.id} value={connection.id} title={connection.name}>
      <div className="flex flex-col">
        <span className="font-medium">{truncateText(connection.name, 25)}</span>
        <span className="text-xs text-muted-foreground">({connection.id})</span>
      </div>
    </SelectItem>
  )

  const isStartDisabled = !udpShareSourceId || !udpShareSelectedTargetId || !udpShareDestConnId

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Share Target from UDP Data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Configuration Form */}
        <div className="flex flex-wrap gap-4 items-end">
          {/* UDP Source Selection */}
          <div className="flex flex-col">
            <Label htmlFor="udp-source">UDP Source Connection</Label>
            <Select value={udpShareSourceId} onValueChange={setUdpShareSourceId}>
              <SelectTrigger id="udp-source" title={udpConnections.find((c) => c.id === udpShareSourceId)?.name || ""}>
                <SelectValue placeholder="Select UDP connection" />
              </SelectTrigger>
              <SelectContent>
                <div className="flex flex-col">{udpConnections.map(renderConnectionOption)}</div>
              </SelectContent>
            </Select>
          </div>

          {/* Target Selection */}
          <div className="flex flex-col">
            <Label htmlFor="target-select">Target</Label>
            <Select
              value={udpShareSelectedTargetId?.toString() ?? ""}
              onValueChange={(v) => setUdpShareSelectedTargetId(Number(v))}
              disabled={udpShareLoadingTargets || udpShareTargets.length === 0}
            >
              <SelectTrigger id="target-select">
                <SelectValue placeholder={udpShareLoadingTargets ? "Loading..." : "Select target"} />
              </SelectTrigger>
              <SelectContent>
                <div className="flex flex-col">
                  {udpShareTargets.map((t) => (
                    <SelectItem key={t.target_id} value={t.target_id.toString()}>
                      <div className="flex items-center">
                        <span>Target {t.target_id}</span>
                      </div>
                    </SelectItem>
                  ))}
                </div>
              </SelectContent>
            </Select>
          </div>

          {/* Destination Selection */}
          <div className="flex flex-col">
            <Label htmlFor="destination-select">Destination Connection</Label>
            <Select value={udpShareDestConnId} onValueChange={setUdpShareDestConnId}>
              <SelectTrigger
                id="destination-select"
                title={connections.find((c) => c.id === udpShareDestConnId)?.name || ""}
              >
                <SelectValue placeholder="Select destination" />
              </SelectTrigger>
              <SelectContent>
                <div className="flex flex-col">{connections.map(renderConnectionOption)}</div>
              </SelectContent>
            </Select>
          </div>

          {/* Interval Configuration */}
          <div className="flex flex-col">
            <Label htmlFor="interval-input">Interval (ms)</Label>
            <Input
              id="interval-input"
              type="number"
              min={1}
              max={60000}
              value={udpShareInterval}
              onChange={(e) => setUdpShareInterval(Number(e.target.value))}
              className={!isValidInterval(udpShareInterval) ? "border-red-500" : ""}
            />
          </div>

          {/* Start Share Button */}
          <Button
            onClick={handleStartUdpShare}
            disabled={isStartDisabled}
            title={isStartDisabled ? "Select all required fields" : "Start sharing UDP target"}
          >
            Start Share
          </Button>
        </div>

        {/* Error Display */}
        {udpShareError && (
          <div className="text-sm text-red-600 p-2 bg-red-50 rounded border border-red-200">{udpShareError}</div>
        )}

        {/* Available Targets Info */}
        {udpShareTargets.length > 0 && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Latest targets received: </span>
            {udpShareTargets.map((t) => t.target_id).join(", ")}
          </div>
        )}

        {/* Empty State */}
        {udpShareActive.length === 0 && (
          <div className="text-xs text-muted-foreground">
            No active UDP shares. Start sharing targets from UDP connections to other connections.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
