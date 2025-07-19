"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity } from "lucide-react"
import { truncateText } from "@/utils/text-utils"
import type { ActiveShare } from "@/hooks/use-shares"

interface ActiveSharesTableProps {
  /** Array of all active shares */
  allActiveShares: ActiveShare[]
  /** Function to stop a specific share */
  onStopShare: (shareId: string, connectionId: string) => void
  /** Optional className for styling */
  className?: string
  /** Whether to show the card wrapper (default: true) */
  showCard?: boolean
  /** Whether to show the refresh button (default: false) */
  showRefreshButton?: boolean
  /** Function to refresh shares (optional) */
  onRefresh?: () => void
}

/**
 * ActiveSharesTable Component
 *
 * Displays and manages all active data shares with:
 * - Separation of simulation and regular shares
 * - Scrollable lists for large numbers of shares
 * - Truncated display with hover tooltips
 * - Individual share management
 * - Consistent styling across pages
 *
 * @param props - Component props
 * @returns JSX element for active shares table or null if no shares
 *
 * @example
 * ```tsx
 * <ActiveSharesTable
 *   allActiveShares={shares}
 *   onStopShare={handleStopShare}
 *   showCard={true}
 *   showRefreshButton={true}
 *   onRefresh={handleRefresh}
 * />
 * ```
 */
export function ActiveSharesTable({ 
  allActiveShares, 
  onStopShare, 
  className,
  showCard = true,
  showRefreshButton = false,
  onRefresh
}: ActiveSharesTableProps) {
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
      className={`flex items-center justify-between p-3 rounded-lg border ${
        isSimulation ? "bg-blue-50 border-blue-200" : "bg-muted/50 border-border"
      } hover:bg-muted/70 transition-colors`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono flex-shrink-0" title={share.shareId}>
            {truncateText(share.shareId, 15)}
          </Badge>
          <span className="text-sm text-muted-foreground truncate" title={share.connectionId}>
            {truncateText(share.connectionId, 20)}
          </span>
          {isSimulation && (
            <Badge variant="secondary" className="text-xs">
              Simulation
            </Badge>
          )}
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

  const content = (
    <div className={`space-y-4 ${className}`}>
      {/* Simulation Shares */}
      {simulationShares.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-blue-700">Simulation Shares</h3>
            <Badge variant="secondary" className="text-xs">
              {simulationShares.length}
            </Badge>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {simulationShares.map((share) => renderShareItem(share, true))}
          </div>
        </div>
      )}

      {/* Regular Shares */}
      {regularShares.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-700">Regular Shares</h3>
            <Badge variant="secondary" className="text-xs">
              {regularShares.length}
            </Badge>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {regularShares.map((share) => renderShareItem(share, false))}
          </div>
        </div>
      )}
    </div>
  )

  // Return with or without card wrapper
  if (showCard) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              All Active Shares
              <Badge variant="secondary">{allActiveShares.length}</Badge>
            </CardTitle>
            {showRefreshButton && onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
              >
                Refresh
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {content}
        </CardContent>
      </Card>
    )
  }

  return content
}
