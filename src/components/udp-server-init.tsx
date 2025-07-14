"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { startUdpConnection, listConnections, setUdpRemoteAddress } from "@/lib/communication-actions"
import { isValidAddress } from "@/utils/validation-utils"
import type { BaseComponentProps } from "@/types"

/**
 * Props for UdpServerInit component
 */
interface UdpServerInitProps extends BaseComponentProps {
  /** Callback to refresh connections after initialization */
  onRefreshConnections: () => Promise<void>
}

/**
 * UdpServerInit Component
 *
 * Provides functionality to initialize two UDP servers and connect them:
 * - Creates two UDP connections with specified addresses
 * - Automatically configures bidirectional communication
 * - Provides status feedback and error handling
 * - Validates address formats
 *
 * @param props - Component props
 * @returns JSX element for UDP server initialization
 *
 * @example
 * ```tsx
 * <UdpServerInit onRefreshConnections={handleRefresh} />
 * ```
 */
export function UdpServerInit({ onRefreshConnections, className }: UdpServerInitProps) {
  const [initA, setInitA] = useState("127.0.0.1:9000")
  const [initB, setInitB] = useState("127.0.0.1:9001")
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(false)

  /**
   * Validates both server addresses
   */
  const areAddressesValid = isValidAddress(initA) && isValidAddress(initB)

  /**
   * Initializes two UDP servers and connects them bidirectionally
   */
  const initTwoServers = async () => {
    if (!areAddressesValid) {
      setStatus("❌ Invalid address format. Use IP:PORT format.")
      return
    }

    setLoading(true)
    setStatus("Initializing servers...")

    try {
      // Start both UDP servers
      await Promise.all([
        startUdpConnection({ prefix: "udpA", localAddr: initA }),
        startUdpConnection({ prefix: "udpB", localAddr: initB }),
      ])

      // Refresh connections to get the new connection IDs
      await onRefreshConnections()
      const allConnections = await listConnections()

      // Find the newly created UDP connections
      const udpA = allConnections.find((c) => c.name.includes(initA))
      const udpB = allConnections.find((c) => c.name.includes(initB))

      if (udpA && udpB) {
        // Configure bidirectional communication
        await Promise.all([setUdpRemoteAddress(udpA.id, initB), setUdpRemoteAddress(udpB.id, initA)])

        setStatus(`✅ Started and connected ${initA} ↔ ${initB}`)
      } else {
        setStatus("❌ Could not find both UDP servers after starting.")
      }

      // Final refresh to update UI
      await onRefreshConnections()
    } catch (error: any) {
      const errorMsg = error?.message || error?.toString() || "Failed to initialize servers"

      if (errorMsg.includes("already in use")) {
        setStatus(`❌ ${errorMsg}. Please stop existing connections using these addresses first.`)
      } else {
        setStatus(`❌ Error: ${errorMsg}`)
      }

      console.error("Failed to initialize UDP servers:", error)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Gets status badge variant based on status message
   */
  const getStatusVariant = () => {
    if (status.includes("✅")) return "default"
    if (status.includes("❌")) return "destructive"
    return "secondary"
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Initialize Two UDP Servers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Server A Configuration */}
          <div className="flex flex-col">
            <Label htmlFor="server-a">Server A Address</Label>
            <Input
              id="server-a"
              value={initA}
              onChange={(e) => setInitA(e.target.value)}
              placeholder="127.0.0.1:9000"
              className={!isValidAddress(initA) && initA ? "border-red-500" : ""}
            />
            {initA && !isValidAddress(initA) && (
              <span className="text-xs text-red-500 mt-1">Invalid address format</span>
            )}
          </div>

          {/* Server B Configuration */}
          <div className="flex flex-col">
            <Label htmlFor="server-b">Server B Address</Label>
            <Input
              id="server-b"
              value={initB}
              onChange={(e) => setInitB(e.target.value)}
              placeholder="127.0.0.1:9001"
              className={!isValidAddress(initB) && initB ? "border-red-500" : ""}
            />
            {initB && !isValidAddress(initB) && (
              <span className="text-xs text-red-500 mt-1">Invalid address format</span>
            )}
          </div>
        </div>

        {/* Initialize Button */}
        <Button
          onClick={initTwoServers}
          disabled={loading || !initA || !initB || !areAddressesValid}
          className="w-full"
        >
          {loading ? "Initializing..." : "Initialize & Connect Two Servers"}
        </Button>

        {/* Status Display */}
        {status && (
          <div className="flex items-center gap-2">
            <Badge variant={getStatusVariant()} className="flex-shrink-0">
              Status
            </Badge>
            <span className="text-sm break-all">{status}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
