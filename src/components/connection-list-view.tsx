"use client"

import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { RefreshCw, Activity, Wifi, Usb, Server } from "lucide-react"
import { usePacketData } from "@/hooks/use-packet-data"
import type { Connection } from "@/types"

interface ConnectionListViewProps {
  className?: string
}

export function ConnectionListView({ className }: ConnectionListViewProps) {
  const [connections, setConnections] = useState<Connection[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const { statistics } = usePacketData()
  const [resetting, setResetting] = useState(false)

  const fetchConnections = async () => {
    setRefreshing(true)
    try {
      const allConnections = await invoke<{ id: string; name: string }[]>("list_connections")
      setConnections(allConnections)
    } catch (error) {
      console.error("Failed to fetch connections:", error)
    } finally {
      setRefreshing(false)
    }
  }

  const disconnectConnection = async (id: string) => {
    try {
      await invoke("stop_connection", { id })
      await fetchConnections()
    } catch (error) {
      console.error("Failed to disconnect:", error)
    }
  }

  const disconnectAll = async () => {
    try {
      await invoke("disconnect_all_connections")
      setConnections([])
    } catch (error) {
      console.error("Failed to disconnect all:", error)
    }
  }

  const resetCounters = async () => {
    setResetting(true)
    try {
      await invoke("reset_packet_counters")
      // Give the backend a moment to reset before refreshing
      setTimeout(() => {
        fetchConnections()
        setResetting(false)
      }, 300)
    } catch (error) {
      setResetting(false)
      console.error("Failed to reset counters:", error)
    }
  }

  const getConnectionType = (name: string) => {
    if (name.startsWith("Udp(")) return "udp"
    if (name.startsWith("Serial(")) return "serial"
    if (name.startsWith("Sim(")) return "simulation"
    return "other"
  }

  const getConnectionIcon = (type: string) => {
    switch (type) {
      case "udp":
        return <Wifi className="h-4 w-4" />
      case "serial":
        return <Usb className="h-4 w-4" />
      case "simulation":
        return <Server className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  const getConnectionTypeColor = (type: string) => {
    switch (type) {
      case "udp":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "serial":
        return "bg-green-100 text-green-800 border-green-200"
      case "simulation":
        return "bg-purple-100 text-purple-800 border-purple-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  useEffect(() => {
    fetchConnections()
  }, [])

  const groupedConnections = connections.reduce((acc, conn) => {
    const type = getConnectionType(conn.name)
    if (!acc[type]) acc[type] = []
    acc[type].push(conn)
    return acc
  }, {} as Record<string, Connection[]>)

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with global statistics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Connection Overview
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchConnections}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={disconnectAll}
                disabled={connections.length === 0}
              >
                Disconnect All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={resetCounters}
                disabled={resetting}
              >
                {resetting ? "Resetting..." : "Reset Counters"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex flex-col items-center p-4 bg-blue-50 rounded-lg">
              <span className="text-lg font-bold text-blue-700">Total Connections</span>
              <span className="text-2xl font-mono text-blue-700">{connections.length}</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-green-50 rounded-lg">
              <span className="text-lg font-bold text-green-700">Total Received</span>
              <span className="text-2xl font-mono text-green-700">{statistics.totalPacketsReceived.toLocaleString()}</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-purple-50 rounded-lg">
              <span className="text-lg font-bold text-purple-700">Total Sent</span>
              <span className="text-2xl font-mono text-purple-700">{statistics.totalPacketsSent.toLocaleString()}</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-orange-50 rounded-lg">
              <span className="text-lg font-bold text-orange-700">Active Types</span>
              <span className="text-2xl font-mono text-orange-700">{Object.keys(groupedConnections).length}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connection groups */}
      {Object.keys(groupedConnections).length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No active connections</p>
              <p className="text-sm">Start connections to see them listed here</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedConnections).map(([type, typeConnections]) => (
          <Card key={type}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getConnectionIcon(type)}
                <span className="capitalize">{type} Connections</span>
                <Badge variant="secondary">{typeConnections.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {typeConnections.map((conn) => {
                  const connectionStats = statistics.connectionPacketCounts[conn.id]
                  const packetTypeCounts = statistics.connectionPacketTypeCounts[conn.id]
                  
                  return (
                    <div
                      key={conn.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse flex-shrink-0"></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm truncate" title={conn.id}>
                              {conn.id}
                            </span>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${getConnectionTypeColor(type)}`}
                            >
                              {type}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground truncate" title={conn.name}>
                            {conn.name}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        {/* Packet Statistics */}
                        <div className="flex flex-col items-end gap-1">
                          {connectionStats && (
                            <div className="flex gap-2">
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                                R: {connectionStats.received.toLocaleString()}
                              </Badge>
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                S: {connectionStats.sent.toLocaleString()}
                              </Badge>
                            </div>
                          )}
                          {packetTypeCounts && Object.keys(packetTypeCounts).length > 0 && (
                            <div className="flex gap-1">
                              {Object.entries(packetTypeCounts).slice(0, 3).map(([type, count]) => (
                                <Badge key={type} variant="secondary" className="text-xs">
                                  {type}: {count}
                                </Badge>
                              ))}
                              {Object.keys(packetTypeCounts).length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{Object.keys(packetTypeCounts).length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>

                        <Separator orientation="vertical" className="h-8" />

                        {/* Actions */}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => disconnectConnection(conn.id)}
                          className="h-8 px-2 text-xs"
                        >
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Global packet type statistics */}
      {Object.keys(statistics.globalPacketTypeCounts).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Global Packet Type Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {Object.entries(statistics.globalPacketTypeCounts).map(([type, count]) => (
                <div
                  key={type}
                  className="flex flex-col items-center p-3 bg-blue-50 rounded-lg min-w-[100px]"
                >
                  <span className="text-sm font-semibold text-blue-700 capitalize">
                    {type}
                  </span>
                  <span className="text-xl font-mono text-blue-700">
                    {count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 