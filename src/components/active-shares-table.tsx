"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { ActiveShare } from "@/hooks/use-shares"

interface ActiveSharesTableProps {
  allActiveShares: ActiveShare[]
  onStopShare: (shareId: string, connectionId: string) => Promise<void>
}

export function ActiveSharesTable({ allActiveShares, onStopShare }: ActiveSharesTableProps) {
  if (allActiveShares.length === 0) {
    return null
  }

  const simulationShares = allActiveShares.filter((s) => s.connectionId.startsWith("sim_udp_"))
  const regularShares = allActiveShares.filter((s) => !s.connectionId.startsWith("sim_udp_"))

  return (
    <div className="space-y-4">
      {/* Simulation UDP Streams */}
      {simulationShares.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Simulation UDP Streams</CardTitle>
            <CardDescription>Currently running simulation UDP streaming shares</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {simulationShares.map((share) => (
                <div
                  key={share.shareId + share.connectionId}
                  className="flex items-center justify-between p-2 bg-blue-50 rounded"
                >
                  <div>
                    <Badge variant="outline" className="mr-2">
                      {share.shareId}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{share.connectionId}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onStopShare(share.shareId, share.connectionId)}
                  >
                    Stop
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Regular Active Shares */}
      {regularShares.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>All Active Shares</CardTitle>
            <CardDescription>Currently running data shares between connections</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Share ID</th>
                    <th className="text-left p-2">Connection ID</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-right p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {regularShares.map((share) => (
                    <tr key={share.shareId + share.connectionId} className="border-b">
                      <td className="p-2 font-mono text-xs">{share.shareId}</td>
                      <td className="p-2">{share.connectionId}</td>
                      <td className="p-2">
                        <Badge variant="secondary" className="text-xs">
                          {share.connectionId.startsWith("udp") ? "UDP" : "Serial"}
                        </Badge>
                      </td>
                      <td className="p-2 text-right">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onStopShare(share.shareId, share.connectionId)}
                        >
                          Stop
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
