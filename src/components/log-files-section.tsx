"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface LogFilesSectionProps {
  logFiles: string[]
  onLoadLogFiles: () => Promise<void>
  onClearLogFiles: () => void
}

export function LogFilesSection({ logFiles, onLoadLogFiles, onClearLogFiles }: LogFilesSectionProps) {
  return (
    <Card>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {logFiles.map((file) => (
              <div key={file} className="flex items-center gap-2 p-2 bg-muted rounded">
                <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                <span className="font-mono text-sm text-blue-700 truncate" title={file}>
                  {file}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
