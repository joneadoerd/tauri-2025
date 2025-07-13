import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Activity } from "lucide-react"

interface PacketCountersProps {
  globalPacketTypeCounts: Record<string, number>
}

export function PacketCounters({ globalPacketTypeCounts }: PacketCountersProps) {
  if (Object.keys(globalPacketTypeCounts).length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          All Packets Received by Type
        </CardTitle>
        <CardDescription>Total packets received, grouped by type (all connections)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4">
          {Object.entries(globalPacketTypeCounts).map(([type, count]) => {
            let label = type
            if (type.toLowerCase() === "targetpacket") label = "TargetPacket"
            if (type.toLowerCase() === "targetpacketlist") label = "TargetPacketList"
            if (type.toLowerCase() === "other") label = "Other"

            return (
              <div key={type} className="flex flex-col items-center p-4 bg-blue-50 rounded shadow min-w-[100px]">
                <span className="text-lg font-bold text-blue-700 capitalize">{label}</span>
                <span className="text-2xl font-mono text-green-700">{count}</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
