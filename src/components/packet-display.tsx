"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { formatTimestamp } from "@/utils/text-utils"
import type { PacketDisplayProps } from "@/types"

/**
 * PacketDisplay Component
 *
 * Provides real-time packet visualization with:
 * - Tabbed interface for multiple connections
 * - Real-time packet streaming display
 * - Packet type classification and highlighting
 * - JSON formatting for packet data
 * - Performance statistics
 *
 * @param props - Component props
 * @returns JSX element for packet display
 *
 * @example
 * ```tsx
 * <PacketDisplay
 *   data={packetData}
 *   packetCounts={packetCounts}
 *   onClearAll={handleClearAll}
 *   onClearCurrent={handleClearCurrent}
 * />
 * ```
 */
export function PacketDisplay({ data, packetCounts, onClearAll, onClearCurrent, className }: PacketDisplayProps) {
  const [activeTab, setActiveTab] = useState<string>("")

  const connectionIds = Object.keys(data)

  // Set first tab as active if none selected
  if (!activeTab && connectionIds.length > 0) {
    setActiveTab(connectionIds[0])
  }

  /**
   * Renders packet content based on packet type
   */
  const renderPacketContent = (packet: any, index: number, connectionId: string) => {
    const kind: any = packet.kind || {}
    let isTargetPacket = false
    let isTargetPacketList = false
    let targetPacket: any = null
    let targetPacketList: any = null

    if (kind.TargetPacket) {
      isTargetPacket = true
      targetPacket = kind.TargetPacket
    } else if (kind.TargetPacketList) {
      isTargetPacketList = true
      targetPacketList = kind.TargetPacketList
    }

    return (
      <div className="space-y-2">
        {/* Target Packet Display */}
        {isTargetPacket && (
          <div className="bg-blue-50 p-3 rounded border">
            <div className="font-bold text-blue-700 mb-1">TargetPacket</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><b>Target ID:</b> {targetPacket.target_id}</div>
              <div><b>Time:</b> {targetPacket.time}</div>
              <div><b>Lat:</b> {targetPacket.lat}</div>
              <div><b>Lon:</b> {targetPacket.lon}</div>
              <div><b>Alt:</b> {targetPacket.alt}</div>
            </div>
          </div>
        )}

        {/* Target Packet List Display */}
        {isTargetPacketList && (
          <div className="bg-green-50 p-3 rounded border">
            <div className="font-bold text-green-700 mb-1 flex items-center gap-2">
              <span>TargetPacketList</span>
              <Badge variant="secondary" className="text-xs">
                {Array.isArray(targetPacketList.packets) ? targetPacketList.packets.length : 0} packets
              </Badge>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {Array.isArray(targetPacketList.packets) &&
                targetPacketList.packets.map((tp: any, i: number) => (
                  <div key={i} className="bg-white border rounded p-2 text-xs">
                    <div className="flex flex-wrap gap-2">
                      <span><b>Target ID:</b> {tp.target_id}</span>
                      <span><b>Time:</b> {tp.time}</span>
                      <span><b>Lat:</b> {tp.lat}</span>
                      <span><b>Lon:</b> {tp.lon}</span>
                      <span><b>Alt:</b> {tp.alt}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Regular Packet Display */}
        {!isTargetPacket &&
          !isTargetPacketList &&
          Object.entries(packet).map(([key, value]) => (
            <div key={key} className="bg-background p-3 rounded border">
              <div className="flex justify-between items-center mb-1">
                <div className="text-sm font-semibold text-blue-600">{key}</div>
                <div className="text-xs text-gray-500 flex gap-2">
                  <span>{typeof value}</span>
                  <span>•</span>
                  <span>{Array.isArray(value) ? `${value.length} items` : "N/A"}</span>
                </div>
              </div>
              <pre className="text-xs overflow-x-auto whitespace-pre-wrap bg-muted p-2 rounded max-h-32 overflow-y-auto">
                {JSON.stringify(value, null, 2)}
              </pre>
            </div>
          ))}

        {/* Empty Packet Display */}
        {Object.keys(packet).length === 0 && !isTargetPacket && !isTargetPacketList && (
          <div className="text-xs text-gray-500 italic text-center py-4">Empty packet</div>
        )}
      </div>
    )
  }

  // No connections state
  if (connectionIds.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Real-time Packet Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-lg">No connections available</p>
            <p className="text-sm">Connect to a serial port to see packet data</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Live Packet Stream</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClearAll}>
              Clear All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => activeTab && onClearCurrent(activeTab)}
              disabled={!activeTab}
            >
              Clear Current
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap">
            {connectionIds.map((id) => (
              <TabsTrigger key={id} value={id} className="flex items-center gap-2">
                <span>Connection: {id}</span>
                <Badge variant="secondary" className="text-xs">
                  {data[id].length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {connectionIds.map((id) => (
            <TabsContent key={id} value={id}>
              <div className="space-y-4">
                {/* Connection Statistics */}
                <div className="flex flex-wrap justify-between items-center text-sm text-muted-foreground gap-4">
                  <span>
                    Showing last {data[id].length} packets from {id}
                  </span>
                  <div className="flex flex-wrap gap-4">
                    <Badge variant="outline" className="text-blue-600">
                      Total: {data[id].length}
                    </Badge>
                    <Badge variant="outline" className="text-green-600">
                      {packetCounts[id]?.count || 0} packets/sec
                    </Badge>
                  </div>
                </div>

                {/* Packet List */}
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {data[id]
                    .slice(-20)
                    .reverse()
                    .map(({ packet, timestamp, id: packetId }, index) => (
                      <div
                        key={packetId ? `${packetId}-${index}` : `packet-${index}-${timestamp}`}
                        className="p-4 border rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                      >
                        {/* Packet Header */}
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{formatTimestamp(timestamp)}</span>
                            <Badge variant="outline" className="text-xs">
                              Packet #{data[id].length - index}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">{Object.keys(packet).length} fields</div>
                        </div>

                        {/* Packet Content */}
                        {renderPacketContent(packet, index, id)}
                      </div>
                    ))}

                  {/* Empty State */}
                  {data[id].length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-lg">No packets received yet</p>
                      <p className="text-sm">Packets will appear here in real-time as they are received</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}
