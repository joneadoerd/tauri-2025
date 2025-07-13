"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Activity, RefreshCw } from "lucide-react"

interface ConnectionFormProps {
  ports: string[]
  onConnect: (prefix: string, port: string, baud: number, packetType: string) => Promise<void>
  onInitComs: () => Promise<void>
  onRefresh: () => Promise<void>
  refreshing: boolean
}

const ID_PREFIXES = ["COM", "USB", "UART", "DEV"]

export function ConnectionForm({ ports, onConnect, onInitComs, onRefresh, refreshing }: ConnectionFormProps) {
  const [form, setForm] = useState({
    id: "",
    port: "",
    baud: "115200",
  })

  const handleConnect = async () => {
    const prefix = form.id || ID_PREFIXES[0]
    await onConnect(prefix, form.port, Number.parseInt(form.baud), "Header")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Serial Connection</span>
          <div className="flex items-center gap-2">
            <Button onClick={onInitComs} size="sm" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Init COM3 & COM6
            </Button>
            <Button onClick={onRefresh} variant="outline" size="sm" disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <Label>ID Prefix</Label>
            <Select value={form.id} onValueChange={(v) => setForm((f) => ({ ...f, id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select ID Prefix" />
              </SelectTrigger>
              <SelectContent>
                {ID_PREFIXES.map((prefix) => (
                  <SelectItem key={prefix} value={prefix}>
                    {prefix}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Port</Label>
            <Select value={form.port} onValueChange={(v) => setForm((f) => ({ ...f, port: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select Port" />
              </SelectTrigger>
              <SelectContent>
                {ports
                  .filter((port) => port !== "")
                  .map((port, index) => (
                    <SelectItem key={port + index} value={port}>
                      {port}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Baud</Label>
            <Input value={form.baud} onChange={(e) => setForm((f) => ({ ...f, baud: e.target.value }))} />
          </div>
          <Button onClick={handleConnect} className="self-end">
            Connect
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
