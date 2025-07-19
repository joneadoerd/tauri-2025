"use client"

import { useCallback, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshCw, Activity } from "lucide-react"
import { ConnectionList } from "@/components/connection-list"
import { ActiveSharesTable } from "@/components/active-shares-table"
import { useSerialConnections } from "@/hooks/use-serial-connections"
import { usePacketData } from "@/hooks/use-packet-data"
import { useShares } from "@/hooks/use-shares"
import { useLogFiles } from "@/hooks/use-log-files"
import { sendHeaderPacket, sendPayloadPacket } from "@/app/actions/packet-actions"
import { invoke } from "@tauri-apps/api/core"
import { listen, UnlistenFn } from "@tauri-apps/api/event"

export default function ConnectionsPage() {
  const [resetting, setResetting] = useState(false)

  // Custom hooks
  const {
    connections,
    disconnect,
    disconnectAll,
    refreshConnections,
  } = useSerialConnections();

  const {
    statistics,
    clearData,
    removeConnectionData,
    resetCounters,
  } = usePacketData();

  const {
    hasActiveShares,
    getActiveSharesCount,
    hasAnyActiveShares,
    allActiveShares,
    stopShare,
    fetchAllActiveShares,
  } = useShares();

  const {
    logData,
    showLogData,
    loadLogData,
    toggleLogData,
  } = useLogFiles();

  // Auto-refresh on connection events
  useEffect(() => {
    const unlistenPromise = listen("connection_event", () => {
      refreshConnections();
    });
    return () => {
      unlistenPromise.then((fn: UnlistenFn) => fn());
    };
  }, [refreshConnections]);

  // Auto-refresh on packet events
  useEffect(() => {
    const unlistenPromise = listen("serial_packet", () => {
      refreshConnections();
    });
    return () => {
      unlistenPromise.then((fn: UnlistenFn) => fn());
    };
  }, [refreshConnections]);

  // Handlers
  const handleSendHeader = useCallback(async (id: string, name: string) => {
    try {
      await sendHeaderPacket(id);
    } catch (error) {
      console.error("Error sending header:", error);
    }
  }, []);

  const handleSendPayload = useCallback(async (id: string, name: string) => {
    try {
      await sendPayloadPacket(id);
    } catch (error) {
      console.error("Error sending payload:", error);
    }
  }, []);

  const handleDisconnect = useCallback(
    async (id: string, name: string) => {
      await disconnect(id);
      removeConnectionData(id);
      setTimeout(() => refreshConnections(), 100);
    },
    [disconnect, removeConnectionData, refreshConnections]
  );

  const handleDisconnectAll = useCallback(async () => {
    await disconnectAll();
    setTimeout(() => refreshConnections(), 100);
  }, [disconnectAll, refreshConnections]);

  const handleResetCounters = useCallback(async () => {
    setResetting(true);
    try {
      await resetCounters();
      setTimeout(() => {
        refreshConnections();
        setResetting(false);
      }, 300);
    } catch (error) {
      setResetting(false);
      console.error("Failed to reset counters:", error);
    }
  }, [refreshConnections, resetCounters]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Connection Management</h1>
        <p className="text-muted-foreground">
          View and manage all active connections with real-time statistics
        </p>
      </div>

      {/* Connection Statistics Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Connection Overview
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshConnections}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDisconnectAll}
                disabled={hasAnyActiveShares()}
                title={
                  hasAnyActiveShares()
                    ? "Cannot disconnect all connections while shares are running. Stop all shares first."
                    : "Disconnect All Connections"
                }
                className={
                  hasAnyActiveShares() ? "opacity-50 cursor-not-allowed" : ""
                }
              >
                Disconnect All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetCounters}
                disabled={resetting}
              >
                {resetting ? "Resetting..." : "Reset Counters"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex flex-col items-center p-4 bg-blue-50 rounded-lg">
              <span className="text-lg font-bold text-blue-700">Total Connections</span>
              <span className="text-2xl font-mono text-blue-700">{connections.length}</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-green-50 rounded-lg">
              <span className="text-lg font-bold text-green-700">Total Received</span>
              <span className="text-2xl font-mono text-green-700">{statistics.totalPacketsReceived.toLocaleString()}</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-purple-50 rounded-lg">
              <span className="text-lg font-bold text-purple-700">Total Sent</span>
              <span className="text-2xl font-mono text-purple-700">{statistics.totalPacketsSent.toLocaleString()}</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-orange-50 rounded-lg">
              <span className="text-lg font-bold text-orange-700">Active Types</span>
              <span className="text-2xl font-mono text-orange-700">{Object.keys(statistics.connectionPacketTypeCounts).length}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* All Active Shares Section */}
      <ActiveSharesTable 
        allActiveShares={allActiveShares} 
        onStopShare={stopShare}
        showCard={true}
        showRefreshButton={true}
        onRefresh={fetchAllActiveShares}
      />

      {/* Global Packet Type Statistics */}
      {Object.keys(statistics.globalPacketTypeCounts).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Packets by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {Object.entries(statistics.globalPacketTypeCounts).map(([type, count]) => (
                <div
                  key={type}
                  className="flex flex-col items-center p-3 bg-blue-50 rounded-lg min-w-[100px]"
                >
                  <span className="text-sm font-semibold text-blue-700 capitalize">
                    {type}
                  </span>
                  <span className="text-xl font-mono text-blue-700">
                    {count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      <ConnectionList
        connections={connections}
        connectionPacketTypeCounts={statistics.connectionPacketTypeCounts}
        connectionPacketCounts={statistics.connectionPacketCounts}
        logData={logData}
        showLogData={showLogData}
        onSendHeader={handleSendHeader}
        onSendPayload={handleSendPayload}
        onClearData={clearData}
        onDisconnect={handleDisconnect}
        onLoadLogData={loadLogData}
        onToggleLogData={toggleLogData}
        hasActiveShares={hasActiveShares}
        getActiveSharesCount={getActiveSharesCount}
      />
    </div>
  )
} 