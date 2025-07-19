"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { formatTimestamp } from "@/utils/text-utils"
import type { PacketDisplayProps } from "@/types"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
  const [displayLimit, setDisplayLimit] = useState(100) // State to control display limit
  const [isEnabled, setIsEnabled] = useState(false) // Default disabled to reduce rendering

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
            <div className="font-bold text-blue-700 mb-2">TargetPacket</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="font-medium">Target ID:</span>
                <span className="text-blue-800">{targetPacket.target_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Time:</span>
                <span className="text-blue-800">{targetPacket.time}</span>
              </div>
              {targetPacket.lla && (
                <>
                  <div className="flex justify-between">
                    <span className="font-medium">LLA.Lat:</span>
                    <span className="text-blue-800">{targetPacket.lla.lat}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">LLA.Lon:</span>
                    <span className="text-blue-800">{targetPacket.lla.lon}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">LLA.Alt:</span>
                    <span className="text-blue-800">{targetPacket.lla.alt}</span>
                  </div>
                </>
              )}
              {targetPacket.ned && (
                <>
                  <div className="flex justify-between">
                    <span className="font-medium">NED.North:</span>
                    <span className="text-blue-800">{targetPacket.ned.north}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">NED.East:</span>
                    <span className="text-blue-800">{targetPacket.ned.east}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">NED.Down:</span>
                    <span className="text-blue-800">{targetPacket.ned.down}</span>
                  </div>
                </>
              )}
              {targetPacket.ned_velocity && (
                <>
                  <div className="flex justify-between">
                    <span className="font-medium">NED Vel North:</span>
                    <span className="text-blue-800">{targetPacket.ned_velocity.north}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">NED Vel East:</span>
                    <span className="text-blue-800">{targetPacket.ned_velocity.east}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">NED Vel Down:</span>
                    <span className="text-blue-800">{targetPacket.ned_velocity.down}</span>
                  </div>
                </>
              )}
              {targetPacket.origin && (
                <>
                  <div className="flex justify-between">
                    <span className="font-medium">Origin Lat:</span>
                    <span className="text-blue-800">{targetPacket.origin.lat}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Origin Lon:</span>
                    <span className="text-blue-800">{targetPacket.origin.lon}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Origin Alt:</span>
                    <span className="text-blue-800">{targetPacket.origin.alt}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Target Packet List Display */}
        {isTargetPacketList && (
          <div className="bg-green-50 p-3 rounded border">
            <div className="font-bold text-green-700 mb-2 flex items-center gap-2">
              <span>TargetPacketList</span>
              <Badge variant="secondary" className="text-xs">
                {Array.isArray(targetPacketList.packets) ? targetPacketList.packets.length : 0} packets
              </Badge>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {Array.isArray(targetPacketList.packets) &&
                targetPacketList.packets.map((tp: any, i: number) => (
                  <div key={i} className="bg-white border rounded p-2 text-xs">
                    <div className="grid grid-cols-2 gap-1">
                      <div className="flex justify-between">
                        <span className="font-medium">Target ID:</span>
                        <span className="text-green-800">{tp.target_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Time:</span>
                        <span className="text-green-800">{tp.time}</span>
                      </div>
                      {tp.lla && (
                        <>
                          <div className="flex justify-between">
                            <span className="font-medium">LLA.Lat:</span>
                            <span className="text-green-800">{tp.lla.lat}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">LLA.Lon:</span>
                            <span className="text-green-800">{tp.lla.lon}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">LLA.Alt:</span>
                            <span className="text-green-800">{tp.lla.alt}</span>
                          </div>
                        </>
                      )}
                      {tp.ned && (
                        <>
                          <div className="flex justify-between">
                            <span className="font-medium">NED.North:</span>
                            <span className="text-green-800">{tp.ned.north}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">NED.East:</span>
                            <span className="text-green-800">{tp.ned.east}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">NED.Down:</span>
                            <span className="text-green-800">{tp.ned.down}</span>
                          </div>
                        </>
                      )}
                      {tp.ned_velocity && (
                        <>
                          <div className="flex justify-between">
                            <span className="font-medium">NED Vel North:</span>
                            <span className="text-green-800">{tp.ned_velocity.north}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">NED Vel East:</span>
                            <span className="text-green-800">{tp.ned_velocity.east}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">NED Vel Down:</span>
                            <span className="text-green-800">{tp.ned_velocity.down}</span>
                          </div>
                        </>
                      )}
                      {tp.origin && (
                        <>
                          <div className="flex justify-between">
                            <span className="font-medium">Origin Lat:</span>
                            <span className="text-green-800">{tp.origin.lat}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">Origin Lon:</span>
                            <span className="text-green-800">{tp.origin.lon}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">Origin Alt:</span>
                            <span className="text-green-800">{tp.origin.alt}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Regular Packet Display */}
        {!isTargetPacket &&
          !isTargetPacketList && (
            <div className="bg-background p-3 rounded border">
              <div className="space-y-3">
                {Object.entries(packet).map(([key, value]) => (
                  <div key={key} className="border-b border-gray-200 pb-3 last:border-b-0">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm font-semibold text-blue-600">{key}</div>
                      <div className="text-xs text-gray-500 flex gap-2">
                        <span>{typeof value}</span>
                        <span>•</span>
                        <span>
                          {Array.isArray(value) 
                            ? `${value.length} items` 
                            : typeof value === 'object' && value !== null 
                              ? `${Object.keys(value).length} fields`
                              : "N/A"
                          }
                        </span>
                      </div>
                    </div>
                    <div className="text-xs">
                      {value === null ? (
                        <div className="bg-red-50 p-2 rounded text-red-700 border border-red-200">
                          null
                        </div>
                      ) : value === undefined ? (
                        <div className="bg-yellow-50 p-2 rounded text-yellow-700 border border-yellow-200">
                          undefined
                        </div>
                      ) : typeof value === 'string' ? (
                        <div className="bg-green-50 p-2 rounded text-green-800 border border-green-200">
                          "{value}"
                        </div>
                      ) : typeof value === 'number' ? (
                        <div className="bg-blue-50 p-2 rounded text-blue-800 border border-blue-200">
                          {value}
                        </div>
                      ) : typeof value === 'boolean' ? (
                        <div className={`p-2 rounded border ${value ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
                          {value.toString()}
                        </div>
                      ) : Array.isArray(value) ? (
                        <div className="bg-purple-50 p-2 rounded border border-purple-200">
                          <div className="font-medium text-purple-800 mb-2">Array ({value.length} items):</div>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {value.map((item, index) => (
                              <div key={index} className="bg-white p-2 rounded border text-xs">
                                <div className="font-medium text-purple-600 mb-1">[{index}]:</div>
                                <div className="pl-2">
                                  {typeof item === 'object' && item !== null ? (
                                    <pre className="whitespace-pre-wrap text-xs">
                                      {JSON.stringify(item, null, 2)}
                                    </pre>
                                  ) : (
                                    <span>{JSON.stringify(item)}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : typeof value === 'object' ? (
                        <div className="bg-orange-50 p-2 rounded border border-orange-200">
                          <div className="font-medium text-orange-800 mb-2">Object ({Object.keys(value).length} fields):</div>
                          <div className="max-h-40 overflow-y-auto">
                            <pre className="text-xs whitespace-pre-wrap bg-white p-2 rounded border">
                              {JSON.stringify(value, null, 2)}
                            </pre>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 p-2 rounded text-gray-800 border border-gray-200">
                          {String(value)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
          <div className="flex items-center gap-4">
            <span>Live Packet Stream</span>
            <div className="flex items-center gap-2">
              <Switch
                id="packet-display-enabled"
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
              />
              <Label htmlFor="packet-display-enabled" className="text-sm">
                {isEnabled ? 'Enabled' : 'Disabled'}
              </Label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClearAll} disabled={!isEnabled}>
              Clear All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => activeTab && onClearCurrent(activeTab)}
              disabled={!activeTab || !isEnabled}
            >
              Clear Current
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!isEnabled ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-lg">Packet Display Disabled</p>
            <p className="text-sm">Enable the switch above to view real-time packet data</p>
            <p className="text-xs mt-2 text-gray-500">
              This reduces rendering overhead when packet monitoring is not needed
            </p>
          </div>
        ) : (
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
                      Showing last {Math.min(displayLimit, data[id].length)} of {data[id].length} packets from {id}
                    </span>
                    <div className="flex flex-wrap gap-4 items-center">
                      <Badge variant="outline" className="text-blue-600">
                        Total: {data[id].length}
                      </Badge>
                      <Badge variant="outline" className="text-green-600">
                        {packetCounts[id]?.count || 0} packets/sec
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="display-limit" className="text-xs">Show:</Label>
                        <Select value={displayLimit.toString()} onValueChange={(v) => setDisplayLimit(Number(v))}>
                          <SelectTrigger id="display-limit" className="w-20 h-6 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                            <SelectItem value="200">200</SelectItem>
                            <SelectItem value="500">500</SelectItem>
                            <SelectItem value="1000">1000</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Packet List */}
                  <div className="max-h-96 overflow-y-auto space-y-3">
                    {data[id].length > 0 ? (
                      data[id].slice(-displayLimit).reverse().map(({ packet, timestamp, id: packetId }, index) => (
                        <div
                          key={packetId || `packet-${index}`}
                          className="p-3 border rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                        >
                          {/* Packet Header */}
                          <div className="flex justify-between items-start mb-2">
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
                      ))
                    ) : (
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
        )}
      </CardContent>
    </Card>
  )
}
