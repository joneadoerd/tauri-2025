"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Activity, RefreshCw } from "lucide-react"
import { truncateText } from "@/utils/text-utils"
import { isValidBaudRate } from "@/utils/validation-utils"
import type { ConnectionFormProps } from "@/types"
import { generateShortId } from '@/lib/utils';


/**
 * Form state interface for connection parameters
 */
interface ConnectionFormState {
  /** Selected serial port */
  port: string
  /** Baud rate for communication */
  baud: string
}

/**
 * ConnectionForm Component
 *
 * Provides a form interface for establishing serial connections with:
 * - Port selection from available ports
 * - Baud rate configuration
 * - Connection ID prefix selection
 * - Quick initialization for common ports
 *
 * @param props - Component props
 * @returns JSX element for connection form
 *
 * @example
 * ```tsx
 * <ConnectionForm
 *   ports={["COM1", "COM3"]}
 *   onConnect={handleConnect}
 *   onInitComs={handleInitComs}
 *   onRefresh={handleRefresh}
 *   refreshing={false}
 * />
 * ```
 */
export function ConnectionForm({
  ports,
  onConnect,
  onInitComs,
  onRefresh,
  refreshing,
  className,
}: ConnectionFormProps) {
  const [form, setForm] = useState<ConnectionFormState>({
    port: "",
    baud: "115200",
  })

  /**
   * Handles form submission to establish connection
   */
  const handleConnect = async () => {
    const baudRate = Number.parseInt(form.baud, 10)

    if (!isValidBaudRate(baudRate)) {
      console.error("Invalid baud rate:", form.baud)
      return
    }

    try {
      const id = generateShortId('serial');
      await onConnect(id, form.port, baudRate, "Header")
    } catch (error) {
      console.error("Failed to connect:", error)
    }
  }

  /**
   * Updates form field values
   */
  const updateForm = (field: keyof ConnectionFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const isConnectDisabled = !form.port || !form.baud

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Serial Connection</span>
          <div className="flex items-center gap-2">
            <Button
              onClick={onInitComs}
              size="sm"
              className="flex items-center gap-2"
              title="Initialize COM3 and COM6 connections"
            >
              <Activity className="h-4 w-4" />
              Init COM3 & COM6
            </Button>
            <Button
              onClick={onRefresh}
              variant="outline"
              size="sm"
              disabled={refreshing}
              title="Refresh available ports"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-4 gap-4">
          {/* Port Selection */}
          <div className="flex flex-col">
            <Label htmlFor="port-select">Port</Label>
            <Select value={form.port} onValueChange={(v) => updateForm("port", v)}>
              <SelectTrigger id="port-select" title={form.port}>
                <SelectValue placeholder="Select Port" />
              </SelectTrigger>
              <SelectContent>
                <div className="flex flex-col">
                  {ports
                    .filter((port) => port !== "")
                    .map((port, index) => (
                      <SelectItem key={port + index} value={port} title={port}>
                        <div className="flex items-center">
                          <span className="font-medium">{truncateText(port, 25)}</span>
                        </div>
                      </SelectItem>
                    ))}
                </div>
              </SelectContent>
            </Select>
          </div>

          {/* Baud Rate Input */}
          <div className="flex flex-col">
            <Label htmlFor="baud-rate">Baud Rate</Label>
            <Input
              id="baud-rate"
              type="number"
              value={form.baud}
              onChange={(e) => updateForm("baud", e.target.value)}
              placeholder="115200"
              min="110"
              max="921600"
            />
          </div>

          {/* Connect Button */}
          <Button
            onClick={handleConnect}
            className="self-end"
            disabled={isConnectDisabled}
            title={isConnectDisabled ? "Select port and baud rate" : "Establish connection"}
          >
            Connect
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
