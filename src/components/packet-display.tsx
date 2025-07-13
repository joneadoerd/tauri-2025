"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import type { PacketData, PacketCounts } from "@/hooks/use-packet-data"

interface PacketDisplayProps {
  data: Record<string, PacketData[]>
  packetCounts: Record<string, PacketCounts>
  onClearAll: () => void
  onClearCurrent: (id: string) => void
}

export function PacketDisplay({ data, packetCounts, onClearAll, onClearCurrent }: PacketDisplayProps) {
  const [activeTab, setActiveTab] = useState<string>("")

  // Set first tab as active if none selected
  const connectionIds = Object.keys(data)
  if (!activeTab && connectionIds.length > 0) {
    setActiveTab(connectionIds[0])
  }

  if (connectionIds.length === 0) {
    return (
      <Card>
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
    <Card>
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
          <TabsList>
            {connectionIds.map((id) => (
              <TabsTrigger key={id} value={id}>
                Connection: {id}
              </TabsTrigger>
            ))}
          </TabsList>
          {connectionIds.map((id) => (
            <TabsContent key={id} value={id}>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>
                    Showing last {data[id].length} packets from {id}
                  </span>
                  <div className="flex gap-4">
                    <span className="text-blue-600 font-semibold">Total: {data[id].length}</span>
                    <span className="text-green-600 font-semibold">{packetCounts[id]?.count || 0} packets/sec</span>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto space-y-3">
                  {data[id]
                    .slice(-20)
                    .reverse()
                    .map(({ packet, timestamp, id: packetId }, index) => {
                      const kind: any = (packet as any).kind || {}
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
                        <div
                          key={packetId || `packet-${index}`}
                          className="p-4 border rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {new Date(timestamp).toLocaleTimeString()}
                              </span>
                              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                Packet #{data[id].length - index}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">{Object.keys(packet).length} fields</div>
                          </div>

                          <div className="space-y-2">
                            {isTargetPacket && (
                              <div className="bg-blue-50 p-3 rounded border">
                                <div className="font-bold text-blue-700 mb-1">TargetPacket</div>
                                <pre className="text-xs overflow-x-auto whitespace-pre-wrap bg-muted p-2 rounded">
                                  {JSON.stringify(targetPacket, null, 2)}
                                </pre>
                              </div>
                            )}

                            {isTargetPacketList && (
                              <div className="bg-green-50 p-3 rounded border">
                                <div className="font-bold text-green-700 mb-1">
                                  TargetPacketList (
                                  {Array.isArray(targetPacketList.packets) ? targetPacketList.packets.length : 0}{" "}
                                  packets)
                                </div>
                                <div className="space-y-1">
                                  {Array.isArray(targetPacketList.packets) &&
                                    targetPacketList.packets.map((tp: any, i: number) => (
                                      <div key={i} className="bg-white border rounded p-2 text-xs">
                                        <b>Target ID:</b> {tp.target_id}, <b>lat:</b> {tp.lat}, <b>lon:</b> {tp.lon},{" "}
                                        <b>alt:</b> {tp.alt}, <b>time:</b> {tp.time}
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}

                            {!isTargetPacket &&
                              !isTargetPacketList &&
                              Object.entries(packet).map(([key, value]) => (
                                <div key={key} className="bg-background p-3 rounded border">
                                  <div className="flex justify-between items-center mb-1">
                                    <div className="text-sm font-semibold text-blue-600">{key}</div>
                                    <div className="text-xs text-gray-500">
                                      {typeof value} • {Array.isArray(value) ? value.length : "N/A"} items
                                    </div>
                                  </div>
                                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap bg-muted p-2 rounded">
                                    {JSON.stringify(value, null, 2)}
                                  </pre>
                                </div>
                              ))}

                            {Object.keys(packet).length === 0 && !isTargetPacket && !isTargetPacketList && (
                              <div className="text-xs text-gray-500 italic">Empty packet</div>
                            )}
                          </div>
                        </div>
                      )
                    })}

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
