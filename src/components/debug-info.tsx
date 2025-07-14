import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatBytes } from "@/utils/text-utils"
import type { BaseComponentProps } from "@/types"

/**
 * Props for DebugInfo component
 */
interface DebugInfoProps extends BaseComponentProps {
  /** Path to logs directory */
  logsDirectory?: string
  /** Path to application root directory */
  appRootDirectory?: string
  /** Number of active connections */
  connectionsCount: number
  /** Total number of packets processed */
  totalPackets: number
  /** Number of active tabs/connections with data */
  activeTabsCount: number
  /** Total number of UDP targets */
  totalUdpTargets: number
}

/**
 * DebugInfo Component
 *
 * Displays system debug information and statistics:
 * - Directory paths for logs and app root
 * - System status with connection counts
 * - Performance metrics
 * - Resource usage indicators
 *
 * @param props - Component props
 * @returns JSX element for debug info or null if no data
 *
 * @example
 * ```tsx
 * <DebugInfo
 *   logsDirectory="/path/to/logs"
 *   appRootDirectory="/path/to/app"
 *   connectionsCount={5}
 *   totalPackets={1500}
 *   activeTabsCount={3}
 *   totalUdpTargets={10}
 * />
 * ```
 */
export function DebugInfo({
  logsDirectory,
  appRootDirectory,
  connectionsCount,
  totalPackets,
  activeTabsCount,
  totalUdpTargets,
  className,
}: DebugInfoProps) {
  // Don't render if no directory information available
  if (!logsDirectory && !appRootDirectory) {
    return null
  }

  /**
   * Renders a directory path with proper formatting
   */
  const renderDirectoryPath = (label: string, path: string, bgColor = "bg-gray-100") => (
    <div>
      <div className="text-xs font-semibold text-gray-600 mb-1">{label}:</div>
      <div className={`${bgColor} p-2 rounded font-mono text-sm break-all hover:bg-opacity-80 transition-colors`}>
        {path}
      </div>
    </div>
  )

  /**
   * Gets badge variant based on count values
   */
  const getBadgeVariant = (count: number, threshold = 10) => {
    if (count === 0) return "outline"
    if (count > threshold) return "default"
    return "secondary"
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm font-mono flex items-center gap-2">
          <span>Debug Information</span>
          <Badge variant="outline" className="text-xs">
            System Status
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Directory Paths */}
        {appRootDirectory && renderDirectoryPath("App Root Directory", appRootDirectory, "bg-blue-50")}
        {logsDirectory && renderDirectoryPath("Logs Directory", logsDirectory)}

        {/* System Statistics */}
        <div>
          <div className="text-xs font-semibold text-gray-600 mb-2">System Status:</div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={getBadgeVariant(connectionsCount, 5)}>Active Connections: {connectionsCount}</Badge>
            <Badge variant={getBadgeVariant(totalPackets, 100)}>Total Packets: {totalPackets.toLocaleString()}</Badge>
            <Badge variant={getBadgeVariant(activeTabsCount, 3)}>Active Tabs: {activeTabsCount}</Badge>
            {totalUdpTargets > 0 && (
              <Badge variant={getBadgeVariant(totalUdpTargets, 20)}>UDP Targets: {totalUdpTargets}</Badge>
            )}
          </div>
        </div>

        {/* Performance Indicators */}
        {totalPackets > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-600 mb-2">Performance:</div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                Avg per Connection: {connectionsCount > 0 ? Math.round(totalPackets / connectionsCount) : 0}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Memory Usage: ~{formatBytes(totalPackets * 1024)} (estimated)
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
