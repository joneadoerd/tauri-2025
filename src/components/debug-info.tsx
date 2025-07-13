import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface DebugInfoProps {
  logsDirectory?: string
  appRootDirectory?: string
  connectionsCount: number
  totalPackets: number
  activeTabsCount: number
  totalUdpTargets: number
}

export function DebugInfo({
  logsDirectory,
  appRootDirectory,
  connectionsCount,
  totalPackets,
  activeTabsCount,
  totalUdpTargets,
}: DebugInfoProps) {
  if (!logsDirectory && !appRootDirectory) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-mono">Debug Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {appRootDirectory && (
          <div>
            <div className="text-xs font-semibold text-gray-600 mb-1">App Root Directory:</div>
            <div className="bg-blue-50 p-2 rounded font-mono text-sm break-all">{appRootDirectory}</div>
          </div>
        )}

        {logsDirectory && (
          <div>
            <div className="text-xs font-semibold text-gray-600 mb-1">Logs Directory:</div>
            <div className="bg-gray-100 p-2 rounded font-mono text-sm break-all">{logsDirectory}</div>
          </div>
        )}

        <div>
          <div className="text-xs font-semibold text-gray-600 mb-2">System Status:</div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Active Connections: {connectionsCount}</Badge>
            <Badge variant="outline">Total Packets: {totalPackets}</Badge>
            <Badge variant="outline">Active Tabs: {activeTabsCount}</Badge>
            {totalUdpTargets > 0 && <Badge variant="outline">UDP Targets: {totalUdpTargets}</Badge>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
