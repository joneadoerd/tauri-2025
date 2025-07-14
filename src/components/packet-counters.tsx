import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Activity } from "lucide-react"
import { camelToReadable } from "@/utils/text-utils"
import type { BaseComponentProps } from "@/types"

/**
 * Props for PacketCounters component
 */
interface PacketCountersProps extends BaseComponentProps {
  /** Global packet type counts across all connections */
  globalPacketTypeCounts: Record<string, number>
}

/**
 * PacketCounters Component
 *
 * Displays global packet statistics across all connections with:
 * - Visual packet type counters
 * - Color-coded display
 * - Real-time updates
 * - Responsive grid layout
 *
 * @param props - Component props
 * @returns JSX element for packet counters or null if no data
 *
 * @example
 * ```tsx
 * <PacketCounters
 *   globalPacketTypeCounts={{
 *     header: 150,
 *     payload: 200,
 *     targetPacket: 50
 *   }}
 * />
 * ```
 */
export function PacketCounters({ globalPacketTypeCounts, className }: PacketCountersProps) {
  // Don't render if no packet data
  if (Object.keys(globalPacketTypeCounts).length === 0) {
    return null
  }

  /**
   * Formats packet type labels for display
   */
  const formatPacketTypeLabel = (type: string): string => {
    const specialCases: Record<string, string> = {
      targetpacket: "TargetPacket",
      targetpacketlist: "TargetPacketList",
      other: "Other",
    }

    const lowerType = type.toLowerCase()
    return specialCases[lowerType] || camelToReadable(type)
  }

  return (
    <Card className={className}>
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
            const label = formatPacketTypeLabel(type)

            return (
              <div
                key={type}
                className="flex flex-col items-center p-4 bg-blue-50 rounded shadow min-w-[100px] hover:bg-blue-100 transition-colors"
                title={`${label}: ${count} packets`}
              >
                <span className="text-lg font-bold text-blue-700 capitalize text-center">{label}</span>
                <span className="text-2xl font-mono text-green-700">{count.toLocaleString()}</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
