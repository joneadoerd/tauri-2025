"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"
import { truncateText } from "@/utils/text-utils"
import type { Connection, BaseComponentProps } from "@/types"

/**
 * Props for ConnectionList component
 */
interface ConnectionListProps extends BaseComponentProps {
  /** Array of active connections */
  connections: Connection[]
  /** Packet type counts organized by connection ID */
  connectionPacketTypeCounts: Record<string, Record<string, number>>
  /** Backend connection packet counts (received, sent) */
  connectionPacketCounts?: Record<string, { received: number; sent: number }>
  /** Log data organized by connection ID */
  logData: Record<string, string[]>
  /** Log visibility state by connection ID */
  showLogData: Record<string, boolean>
  /** Function to send header packet to connection */
  onSendHeader: (id: string, name: string) => void
  /** Function to send payload packet to connection */
  onSendPayload: (id: string, name: string) => void
  /** Function to clear data for connection */
  onClearData: (id: string) => void
  /** Function to disconnect connection */
  onDisconnect: (id: string, name: string) => void
  /** Function to load log data for connection */
  onLoadLogData: (connectionId: string) => Promise<void>
  /** Function to toggle log data visibility */
  onToggleLogData: (connectionId: string) => void
  /** Function to check if connection has active shares */
  hasActiveShares: (id: string) => boolean
  /** Function to get active shares count for connection */
  getActiveSharesCount: (id: string) => number
}

/**
 * ConnectionList Component
 *
 * Displays and manages all active connections with:
 * - Collapsible connection cards with detailed information
 * - Per-connection packet statistics and controls
 * - Log management with scrollable display
 * - Share status indicators and warnings
 * - Connection lifecycle management
 *
 * @param props - Component props
 * @returns JSX element for connection list
 *
 * @example
 * ```tsx
 * <ConnectionList
 *   connections={connections}
 *   connectionPacketTypeCounts={packetCounts}
 *   onSendHeader={handleSendHeader}
 *   onDisconnect={handleDisconnect}
 *   hasActiveShares={hasActiveShares}
 * />
 * ```
 */
export function ConnectionList({
  connections,
  connectionPacketTypeCounts,
  connectionPacketCounts,
  logData,
  showLogData,
  onSendHeader,
  onSendPayload,
  onClearData,
  onDisconnect,
  onLoadLogData,
  onToggleLogData,
  hasActiveShares,
  getActiveSharesCount,
  className,
}: ConnectionListProps) {
  const [expandedConnections, setExpandedConnections] = useState<Record<string, boolean>>({})

  /**
   * Toggles the expanded state of a connection
   */
  const toggleConnection = (id: string) => {
    setExpandedConnections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  /**
   * Renders packet count badge for a connection
   */
  const renderPacketCountBadge = (connectionId: string) => {
    const packetCount = connectionPacketCounts?.[connectionId]
    if (!packetCount || packetCount.received === 0) return null

    return (
      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
        {packetCount.received.toLocaleString()} packets
      </Badge>
    )
  }

  /**
   * Renders detailed packet statistics for a connection
   */
  const renderDetailedPacketStats = (connectionId: string) => {
    const packetCount = connectionPacketCounts?.[connectionId]
    if (!packetCount) return null

    return (
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Packet Statistics</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center p-3 bg-green-50 rounded">
            <span className="text-xs font-semibold text-green-700">Received</span>
            <span className="text-lg font-mono text-green-700">{packetCount.received.toLocaleString()}</span>
          </div>
          <div className="flex flex-col items-center p-3 bg-blue-50 rounded">
            <span className="text-xs font-semibold text-blue-700">Sent</span>
            <span className="text-lg font-mono text-blue-700">{packetCount.sent.toLocaleString()}</span>
          </div>
        </div>
      </div>
    )
  }

  /**
   * Renders packet type counters for a connection
   */
  const renderPacketCounters = (connectionId: string) => {
    const counts = connectionPacketTypeCounts[connectionId]
    if (!counts) return null

    return (
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Packet Types</Label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(counts).map(([type, count]) => (
            <div
              key={type}
              className="flex flex-col items-center p-2 bg-blue-50 rounded min-w-[60px] hover:bg-blue-100 transition-colors"
              title={`${type}: ${count} packets`}
            >
              <span className="text-xs font-semibold text-blue-700 capitalize">{type}</span>
              <span className="text-sm font-mono text-green-700">{count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  /**
   * Renders log management section for a connection
   */
  const renderLogManagement = (connectionId: string) => {
    const logs = logData[connectionId] || []
    const isLogVisible = showLogData[connectionId]

    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button onClick={() => onLoadLogData(connectionId)} variant="outline" size="sm">
            Load Log
          </Button>
          <Button onClick={() => onToggleLogData(connectionId)} variant="outline" size="sm">
            {isLogVisible ? "Hide Log" : "Show Log"}
          </Button>
        </div>

        {isLogVisible && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium text-muted-foreground">Log Data</Label>
              <Badge variant="secondary" className="text-xs">
                {logs.length} entries
              </Badge>
            </div>
            <div className="h-64 overflow-auto rounded border bg-gray-50 text-xs font-mono">
              <div className="p-3 space-y-1">
                {logs.map((logLine, index) => (
                  <div
                    key={index}
                    className="py-1 px-2 border-b border-gray-200 last:border-b-0 hover:bg-gray-100 rounded transition-colors"
                  >
                    <div className="text-gray-700 break-all">{logLine}</div>
                  </div>
                ))}
                {logs.length === 0 && (
                  <div className="text-gray-500 italic text-center py-8">No log data available</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  /**
   * Renders active shares warning for a connection
   */
  const renderActiveSharesWarning = (connectionId: string) => {
    if (!hasActiveShares(connectionId)) return null

    const shareCount = getActiveSharesCount(connectionId)

    return (
      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
        <div className="text-sm font-medium text-yellow-800 mb-1 flex items-center gap-2">
          <span>Active Shares</span>
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
            {shareCount}
          </Badge>
        </div>
        <div className="text-xs text-yellow-700">
          This connection has active data shares. Stop all shares before disconnecting.
        </div>
      </div>
    )
  }

  // Empty state
  if (connections.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Active Connections</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-lg">No active connections</p>
            <p className="text-sm">Connect to a serial port or start a UDP connection to begin</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span>Active Connections</span>
          <Badge variant="secondary">{connections.length}</Badge>
        </h3>
      </div>

      {connections.map((conn) => (
        <Card key={conn.id} className="overflow-hidden">
          <Collapsible open={expandedConnections[conn.id]} onOpenChange={() => toggleConnection(conn.id)}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CollapsibleTrigger className="flex items-center gap-2 hover:bg-muted/50 p-2 rounded -m-2 flex-1 min-w-0">
                  {expandedConnections[conn.id] ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-shrink-0" />
                  )}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse flex-shrink-0"></div>
                    <CardTitle className="text-base truncate" title={conn.id}>
                      {conn.id}
                    </CardTitle>
                    {renderPacketCountBadge(conn.id)}
                    {hasActiveShares(conn.id) && (
                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                        {getActiveSharesCount(conn.id)} Share{getActiveSharesCount(conn.id) !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                </CollapsibleTrigger>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    onClick={() => onSendHeader(conn.id, conn.name)}
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-xs"
                    title="Send header packet"
                  >
                    Header
                  </Button>
                  <Button
                    onClick={() => onSendPayload(conn.id, conn.name)}
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-xs"
                    title="Send payload packet"
                  >
                    Payload
                  </Button>
                  <Button
                    onClick={() => onClearData(conn.id)}
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    title="Clear connection data"
                  >
                    Clear
                  </Button>
                  <Button
                    onClick={() => onDisconnect(conn.id, conn.name)}
                    variant="destructive"
                    size="sm"
                    disabled={hasActiveShares(conn.id)}
                    title={hasActiveShares(conn.id) ? "Stop shares first" : "Disconnect"}
                    className={`h-8 px-2 text-xs ${hasActiveShares(conn.id) ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>

              <CardDescription className="text-sm" title={conn.name}>
                {truncateText(conn.name, 60)}
              </CardDescription>
            </CardHeader>

            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                {/* Packet Type Counters */}
                {renderPacketCounters(conn.id)}

                {/* Detailed Packet Statistics */}
                {renderDetailedPacketStats(conn.id)}

                {/* Log Management */}
                {renderLogManagement(conn.id)}

                {/* Active Shares Warning */}
                {renderActiveSharesWarning(conn.id)}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}
    </div>
  )
}
