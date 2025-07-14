"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { truncateText } from "@/utils/text-utils"
import type { ActiveShare, BaseComponentProps } from "@/types"

/**
 * Props for ActiveSharesTable component
 */
interface ActiveSharesTableProps extends BaseComponentProps {
  /** Array of all active shares */
  allActiveShares: ActiveShare[]
  /** Function to stop a specific share */
  onStopShare: (shareId: string, connectionId: string) => Promise<void>
}

/**
 * ActiveSharesTable Component
 *
 * Displays and manages all active data shares with:
 * - Separation of simulation and regular shares
 * - Scrollable lists for large numbers of shares
 * - Truncated display with hover tooltips
 * - Individual share management
 *
 * @param props - Component props
 * @returns JSX element for active shares table or null if no shares
 *
 * @example
 * ```tsx
 * <ActiveSharesTable
 *   allActiveShares={shares}
 *   onStopShare={handleStopShare}
 * />
 * ```
 */
export function ActiveSharesTable({ allActiveShares, onStopShare, className }: ActiveSharesTableProps) {
  // Don't render if no active shares
  if (allActiveShares.length === 0) {
    return null
  }

  // Separate simulation and regular shares
  const simulationShares = allActiveShares.filter((s) => s.connectionId.startsWith("sim_udp_"))
  const regularShares = allActiveShares.filter((s) => !s.connectionId.startsWith("sim_udp_"))

  /**
   * Renders a share item with consistent styling
   */
  const renderShareItem = (share: ActiveShare, isSimulation = false) => (
    <div
      key={share.shareId + share.connectionId}
      className={`flex items-center justify-between p-2 rounded ${isSimulation ? "bg-blue-50" : "bg-muted/50"}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono flex-shrink-0" title={share.shareId}>
            {truncateText(share.shareId, 15)}
          </Badge>
          <span className="text-sm text-muted-foreground truncate" title={share.connectionId}>
            {truncateText(share.connectionId, 20)}
          </span>
        </div>
      </div>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => onStopShare(share.shareId, share.connectionId)}
        className="flex-shrink-0"
      >
        Stop
      </Button>
    </div>
  )

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Simulation UDP Streams */}
      {simulationShares.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>Active Simulation UDP Streams</span>
              <Badge variant="secondary">{simulationShares.length}</Badge>
            </CardTitle>
            <CardDescription>Currently running simulation UDP streaming shares</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {simulationShares.map((share) => renderShareItem(share, true))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Regular Active Shares */}
      {regularShares.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>All Active Shares</span>
              <Badge variant="secondary">{regularShares.length}</Badge>
            </CardTitle>
            <CardDescription>Currently running data shares between connections</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto">
              <div className="space-y-2">
                {regularShares.map((share) => (
                  <div
                    key={share.shareId + share.connectionId}
                    className="flex items-center justify-between p-2 border rounded bg-muted/50"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="font-mono text-xs truncate" title={share.shareId}>
                        {truncateText(share.shareId, 25)}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm truncate" title={share.connectionId}>
                          {truncateText(share.connectionId, 20)}
                        </span>
                        <Badge variant="secondary" className="text-xs flex-shrink-0">
                          {share.connectionId.startsWith("udp") ? "UDP" : "Serial"}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onStopShare(share.shareId, share.connectionId)}
                      className="flex-shrink-0"
                    >
                      Stop
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
