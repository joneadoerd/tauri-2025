"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { invoke } from "@tauri-apps/api/core"

interface UdpServerInitProps {
  onRefreshConnections: () => Promise<void>
}

export function UdpServerInit({ onRefreshConnections }: UdpServerInitProps) {
  const [initA, setInitA] = useState("127.0.0.1:9000")
  const [initB, setInitB] = useState("127.0.0.1:9001")
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(false)

  const initTwoServers = async () => {
    setLoading(true)
    setStatus("Initializing servers...")

    try {
      // Start A
      await invoke("start_udp_connection", {
        prefix: "udpA",
        localAddr: initA,
      })

      // Start B
      await invoke("start_udp_connection", {
        prefix: "udpB",
        localAddr: initB,
      })

      // Refresh and get IDs
      await onRefreshConnections()
      const all = await invoke<{ id: string; name: string }[]>("list_connections")

      const udpA = all.find((c) => c.name.includes(initA))
      const udpB = all.find((c) => c.name.includes(initB))

      if (udpA && udpB) {
        await invoke("set_udp_remote_addr", { id: udpA.id, remoteAddr: initB })
        await invoke("set_udp_remote_addr", { id: udpB.id, remoteAddr: initA })
        setStatus(`✅ Started and connected ${initA} ↔ ${initB}`)
      } else {
        setStatus("❌ Could not find both UDP servers after starting.")
      }

      await onRefreshConnections()
    } catch (e: any) {
      const errorMsg = e?.toString() || "Failed to initialize two servers"
      if (errorMsg.includes("already in use")) {
        setStatus(`❌ ${errorMsg}. Please stop existing connections using these addresses first.`)
      } else {
        setStatus(`❌ Error: ${errorMsg}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Initialize Two UDP Servers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Server A Address</Label>
            <Input value={initA} onChange={(e) => setInitA(e.target.value)} placeholder="127.0.0.1:9000" />
          </div>
          <div>
            <Label>Server B Address</Label>
            <Input value={initB} onChange={(e) => setInitB(e.target.value)} placeholder="127.0.0.1:9001" />
          </div>
        </div>

        <Button onClick={initTwoServers} disabled={loading || !initA || !initB} className="w-full">
          {loading ? "Initializing..." : "Initialize & Connect Two Servers"}
        </Button>

        {status && (
          <div
            className={`text-sm p-2 rounded ${
              status.includes("✅") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}
          >
            {status}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
