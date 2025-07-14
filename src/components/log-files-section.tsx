"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { truncateText } from "@/utils/text-utils"
import type { BaseComponentProps } from "@/types"

/**
 * Props for LogFilesSection component
 */
interface LogFilesSectionProps extends BaseComponentProps {
  /** Array of available log file names */
  logFiles: string[]
  /** Function to load log files */
  onLoadLogFiles: () => Promise<void>
  /** Function to clear log files */
  onClearLogFiles: () => void
}

/**
 * LogFilesSection Component
 *
 * Manages log file display and operations:
 * - Load available log files
 * - Display log files in a grid layout
 * - Clear log file list
 * - Scrollable container for many files
 *
 * @param props - Component props
 * @returns JSX element for log files section
 *
 * @example
 * ```tsx
 * <LogFilesSection
 *   logFiles={files}
 *   onLoadLogFiles={handleLoad}
 *   onClearLogFiles={handleClear}
 * />
 * ```
 */
export function LogFilesSection({ logFiles, onLoadLogFiles, onClearLogFiles, className }: LogFilesSectionProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>Log Files</span>
            <Badge variant="secondary">{logFiles.length}</Badge>
          </div>
          <div className="flex gap-2">
            <Button onClick={onLoadLogFiles} variant="outline" size="sm">
              Load Log Files
            </Button>
            {logFiles.length > 0 && (
              <Button onClick={onClearLogFiles} variant="destructive" size="sm">
                Clear
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      {logFiles.length > 0 && (
        <CardContent>
          <div className="max-h-48 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {logFiles.map((file) => (
                <div
                  key={file}
                  className="flex items-center gap-2 p-2 bg-muted rounded hover:bg-muted/80 transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  <span className="font-mono text-sm text-blue-700 truncate" title={file}>
                    {truncateText(file, 25)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
