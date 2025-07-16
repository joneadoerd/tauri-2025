import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Activity } from "lucide-react"
import { camelToReadable } from "@/utils/text-utils"
import type { BaseComponentProps } from "@/types"

/**
 * Props for PacketCounters component
 */
interface PacketCountersProps extends BaseComponentProps {
  /** Global packet type counts across all connections */
  globalPacketTypeCounts?: Record<string, number>
  /** Total packets received across all connections */
  totalPacketsReceived?: number
  /** Total packets sent across all connections */
  totalPacketsSent?: number
  /** Number of active connections */
  connectionCount?: number
}

/**
 * PacketCounters Component
 *
 * Displays global packet statistics across all connections with:
 * - Visual packet type counters
 * - Color-coded display
 * - Real-time updates
 * - Responsive grid layout
 * - Total packet statistics
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
 *   totalPacketsReceived={400}
 *   totalPacketsSent={200}
 *   connectionCount={3}
 * />
 * ```
 */
export function PacketCounters({ 
  globalPacketTypeCounts, 
  totalPacketsReceived = 0,
  totalPacketsSent = 0,
  connectionCount = 0,
  className 
}: PacketCountersProps) {
  // Don't render if no packet data and no connection stats
  const hasPacketTypeData = globalPacketTypeCounts && Object.keys(globalPacketTypeCounts).length > 0
  const hasConnectionStats = totalPacketsReceived > 0 || totalPacketsSent > 0 || connectionCount > 0
  
  if (!hasPacketTypeData && !hasConnectionStats) {
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
          Packet Statistics
        </CardTitle>
        <CardDescription>Real-time packet statistics across all connections</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connection Statistics */}
        {hasConnectionStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col items-center p-4 bg-green-50 rounded shadow">
              <span className="text-lg font-bold text-green-700">Received</span>
              <span className="text-2xl font-mono text-green-700">{totalPacketsReceived.toLocaleString()}</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-blue-50 rounded shadow">
              <span className="text-lg font-bold text-blue-700">Sent</span>
              <span className="text-2xl font-mono text-blue-700">{totalPacketsSent.toLocaleString()}</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-purple-50 rounded shadow">
              <span className="text-lg font-bold text-purple-700">Connections</span>
              <span className="text-2xl font-mono text-purple-700">{connectionCount}</span>
            </div>
          </div>
        )}

        {/* Packet Type Counters */}
        {hasPacketTypeData && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Packets by Type</h3>
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
          </div>
        )}
      </CardContent>
    </Card>
  )
}
