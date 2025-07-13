"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { UdpListener } from "@/hooks/use-udp-connections"

interface UdpListenersProps {
  udpListeners: UdpListener[]
  onAddUdpListener: (address: string) => Promise<void>
  onRemoveUdpListener: (listenerId: string) => Promise<void>
  onRefreshConnections: () => Promise<void>
}

export function UdpListeners({
  udpListeners,
  onAddUdpListener,
  onRemoveUdpListener,
  onRefreshConnections,
}: UdpListenersProps) {
  const [newUdpListenAddr, setNewUdpListenAddr] = useState("127.0.0.1:5000")
  const [loading, setLoading] = useState(false)

  const handleAddListener = async () => {
    if (!newUdpListenAddr) return

    setLoading(true)
    try {
      await onAddUdpListener(newUdpListenAddr)
      await onRefreshConnections() // Refresh connections after adding listener
      setNewUdpListenAddr("")
    } catch (error: any) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveListener = async (listenerId: string) => {
    await onRemoveUdpListener(listenerId)
    await onRefreshConnections() // Refresh connections after removing listener
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>UDP Listeners</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <Label>Local Listen Address</Label>
            <Input
              value={newUdpListenAddr}
              onChange={(e) => setNewUdpListenAddr(e.target.value)}
              placeholder="127.0.0.1:5000"
              onKeyDown={(e) => e.key === "Enter" && handleAddListener()}
            />
          </div>
          <Button onClick={handleAddListener} disabled={!newUdpListenAddr || loading}>
            {loading ? "Adding..." : "Add Listener"}
          </Button>
        </div>

        {udpListeners.length > 0 && (
          <div className="space-y-2">
            <h5 className="font-semibold">Active Listeners ({udpListeners.length})</h5>
            <div className="grid gap-2">
              {udpListeners.map((listener) => (
                <div key={listener.id} className="flex items-center justify-between p-3 border rounded bg-muted/50">
                  <div className="flex-1">
                    <div className="font-mono text-sm" title={listener.address}>
                      {listener.address}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Status: {listener.status}
                      {listener.connectionId && <span className="ml-2">(ID: {listener.connectionId})</span>}
                    </div>
                    {listener.error && <div className="text-xs text-red-600 mt-1">{listener.error}</div>}
                  </div>
                  <Button onClick={() => handleRemoveListener(listener.id)} variant="outline" size="sm">
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {udpListeners.length === 0 && (
          <div className="text-muted-foreground text-center py-4 text-sm">
            No UDP listeners configured. Add one above to start listening for UDP data.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
