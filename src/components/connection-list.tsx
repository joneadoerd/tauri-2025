"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"
import type { Connection } from "@/hooks/use-serial-connections"

interface ConnectionListProps {
  connections: Connection[]
  connectionPacketTypeCounts: Record<string, Record<string, number>>
  logData: Record<string, string[]>
  showLogData: Record<string, boolean>
  onSendHeader: (id: string, name: string) => void
  onSendPayload: (id: string, name: string) => void
  onClearData: (id: string) => void
  onDisconnect: (id: string, name: string) => void
  onLoadLogData: (connectionId: string) => Promise<void>
  onToggleLogData: (connectionId: string) => void
  hasActiveShares: (id: string) => boolean
  getActiveSharesCount: (id: string) => number
}

export function ConnectionList({
  connections,
  connectionPacketTypeCounts,
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
}: ConnectionListProps) {
  const [expandedConnections, setExpandedConnections] = useState<Record<string, boolean>>({})

  const toggleConnection = (id: string) => {
    setExpandedConnections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  if (connections.length === 0) {
    return (
      <Card>
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Active Connections ({connections.length})</h3>
      </div>

      {connections.map((conn) => (
        <Card key={conn.id} className="overflow-hidden">
          <Collapsible open={expandedConnections[conn.id]} onOpenChange={() => toggleConnection(conn.id)}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CollapsibleTrigger className="flex items-center gap-2 hover:bg-muted/50 p-2 rounded -m-2">
                  {expandedConnections[conn.id] ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <CardTitle className="text-base">{conn.id}</CardTitle>
                    {hasActiveShares(conn.id) && (
                      <Badge variant="secondary" className="text-xs">
                        {getActiveSharesCount(conn.id)} Share{getActiveSharesCount(conn.id) !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                </CollapsibleTrigger>

                <div className="flex items-center gap-1">
                  <Button
                    onClick={() => onSendHeader(conn.id, conn.name)}
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-xs"
                  >
                    Header
                  </Button>
                  <Button
                    onClick={() => onSendPayload(conn.id, conn.name)}
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-xs"
                  >
                    Payload
                  </Button>
                  <Button onClick={() => onClearData(conn.id)} variant="outline" size="sm" className="h-8 px-2 text-xs">
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
                {conn.name.length > 50 ? `${conn.name.substring(0, 50)}...` : conn.name}
              </CardDescription>
            </CardHeader>

            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                {/* Per-connection packet type counters */}
                {connectionPacketTypeCounts[conn.id] && (
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Packet Types</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {Object.entries(connectionPacketTypeCounts[conn.id]).map(([type, count]) => (
                        <div key={type} className="flex flex-col items-center p-2 bg-blue-50 rounded min-w-[60px]">
                          <span className="text-xs font-semibold text-blue-700 capitalize">{type}</span>
                          <span className="text-sm font-mono text-green-700">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Log Management */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button onClick={() => onLoadLogData(conn.id)} variant="outline" size="sm">
                      Load Log
                    </Button>
                    <Button onClick={() => onToggleLogData(conn.id)} variant="outline" size="sm">
                      {showLogData[conn.id] ? "Hide Log" : "Show Log"}
                    </Button>
                  </div>

                  {/* Log Data Display */}
                  {showLogData[conn.id] && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Log Data</Label>
                      <div className="h-48 overflow-auto rounded border bg-gray-50 text-xs font-mono p-3">
                        {(logData[conn.id] || []).map((logLine, index) => (
                          <div key={index} className="py-1 border-b border-gray-200 last:border-b-0">
                            <div className="text-gray-700">{logLine}</div>
                          </div>
                        ))}
                        {(!logData[conn.id] || logData[conn.id].length === 0) && (
                          <div className="text-gray-500 italic text-center py-8">No log data available</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Active Shares for this connection */}
                {hasActiveShares(conn.id) && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <div className="text-sm font-medium text-yellow-800 mb-1">
                      Active Shares ({getActiveSharesCount(conn.id)})
                    </div>
                    <div className="text-xs text-yellow-700">
                      This connection has active data shares. Stop all shares before disconnecting.
                    </div>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}
    </div>
  )
}
