import { ConnectionListView } from "@/components/connection-list-view"

export default function ConnectionsPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Connection Management</h1>
        <p className="text-muted-foreground">
          View and manage all active connections with real-time statistics
        </p>
      </div>
      
      <ConnectionListView />
    </div>
  )
} 