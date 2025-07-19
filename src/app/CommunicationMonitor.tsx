"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings, Activity } from "lucide-react";
import { useSerialConnections } from "@/hooks/use-serial-connections";
import { usePacketData } from "@/hooks/use-packet-data";
import { useUdpConnections } from "@/hooks/use-udp-connections";
import { useSimulation } from "@/hooks/use-simulation";
import { useShares } from "@/hooks/use-shares";
import { useUdpTargets } from "@/hooks/use-udp-targets";
import { useLogFiles } from "@/hooks/use-log-files";
import { ConnectionForm } from "@/components/connection-form";
import { PacketCounters } from "@/components/packet-counters";
import { PacketDisplay } from "@/components/packet-display";
import { UdpListeners } from "@/components/udp-config";
import { UdpServerInit } from "@/components/udp-server-init";
import { SimulationStreaming } from "@/components/simulation-section";
import { SimulationConfigDialog } from "@/components/simulation-config-dialog";
import { UdpTargetSharing } from "@/components/udp-target-sharing";
import { ActiveSharesTable } from "@/components/active-shares-table";
import { LogFilesSection } from "@/components/log-files-section";
import { DebugInfo } from "@/components/debug-info";
import { sendHeaderPacket, sendPayloadPacket } from "./actions/packet-actions";
import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

export default function CommunicationMonitor() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [resetting, setResetting] = useState(false);

  // Custom hooks
  const {
    ports,
    connections,
    refreshing,
    refreshConnections,
    connect,
    disconnect,
    disconnectAll,
  } = useSerialConnections();

  const {
    data,
    packetCounts,
    statistics,
    clearData,
    clearAllData,
    removeConnectionData,
    resetCounters,
  } = usePacketData();

  const { udpListeners, addUdpListener, removeUdpListener } =
    useUdpConnections();

  const {
    activeSimulationStreams,
    simUdpConnId,
    simUdpError,
    totalUdpTargets,
    startSimulationUdp,
    stopSimulationUdp,
  } = useSimulation();

  const {
    allActiveShares,
    udpShareActive,
    stopShare,
    startUdpShare,
    stopUdpShare,
    hasActiveShares,
    getActiveSharesCount,
    hasAnyActiveShares,
  } = useShares();

  const {
    udpShareTargets,
    udpShareLoadingTargets,
    fetchUdpTargets,
    fetchTotalUdpTargets,
  } = useUdpTargets();

  const {
    logFiles,
    logData,
    showLogData,
    logsDirectory,
    appRootDirectory,
    loadLogFiles,
    loadLogData,
    toggleLogData,
    loadLogsDirectory,
    loadAppRootDirectory,
    clearLogFiles,
  } = useLogFiles();

  // Actions
  const handleInitComs = useCallback(async () => {
    await connect("com3_id", "COM3", 115200, "Header");
    await connect("com6_id", "COM6", 115200, "Header");
  }, [connect]);

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
    },
    [disconnect, removeConnectionData]
  );

  const handleDisconnectAll = useCallback(async () => {
    await disconnectAll();
    clearAllData();
  }, [disconnectAll, clearAllData]);

  const handleResetCounters = useCallback(async () => {
    setResetting(true);
    try {
      await resetCounters();
      // Refresh connections to get updated backend state
      setTimeout(() => {
        refreshConnections();
        setResetting(false);
      }, 300);
    } catch (error) {
      setResetting(false);
      console.error("Failed to reset counters:", error);
    }
  }, [refreshConnections, resetCounters]);

  const totalPackets = Object.values(data).reduce(
    (sum, packets) => sum + packets.length,
    0
  );

  // Function to open simulation config in a new window
  const openSimulationConfigWindow = () => {
    const label = "simulation-config";
    const url = "/simulation-config"; // Adjust if using a different route
    new WebviewWindow(label, {
      url,
      width: 1200,
      height: 900,
      title: "Simulation Configuration",
      resizable: true,
      center: true,
    });
  };

  // Function to open connections page in a new window
  const openConnectionsWindow = () => {
    const label = "connections";
    const url = "/connections";
    new WebviewWindow(label, {
      url,
      width: 1400,
      height: 1000,
      title: "Connection Management",
      resizable: true,
      center: true,
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Communication Monitor
          </h1>
          <p className="text-muted-foreground">
            Real-time packet monitoring and analysis
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setAutoRefresh((v) => !v)}
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
          >
            Auto-refresh {autoRefresh ? "ON" : "OFF"}
          </Button>
          <Button onClick={loadLogsDirectory} variant="outline" size="sm">
            Logs Path
          </Button>
          <Button onClick={loadAppRootDirectory} variant="outline" size="sm">
            App Root
          </Button>
          {totalUdpTargets > 0 && (
            <Badge variant="outline">{totalUdpTargets} UDP targets</Badge>
          )}
        </div>
      </div>

      {/* Connection Form */}
      <ConnectionForm
        ports={ports}
        onConnect={connect}
        onInitComs={handleInitComs}
        onRefresh={refreshConnections}
        refreshing={refreshing}
      />

      {/* Quick Actions */}
      <div className="flex items-center gap-2 mb-4">
        <Button
          onClick={handleDisconnectAll}
          variant="destructive"
          size="sm"
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
          onClick={handleResetCounters}
          variant="outline"
          size="sm"
          disabled={resetting}
        >
          {resetting ? "Resetting..." : "Reset Counters"}
        </Button>
        {hasAnyActiveShares() && (
          <Badge variant="secondary" className="text-xs">
            {allActiveShares.length} active share
            {allActiveShares.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* UDP Target Sharing */}
          <UdpTargetSharing
            connections={connections}
            udpShareTargets={udpShareTargets}
            udpShareLoadingTargets={udpShareLoadingTargets}
            udpShareActive={udpShareActive}
            onFetchUdpTargets={fetchUdpTargets}
            onStartUdpShare={startUdpShare}
            onStopUdpShare={stopUdpShare}
          />

          {/* Active Shares Table */}
          <ActiveSharesTable
            allActiveShares={allActiveShares}
            onStopShare={stopShare}
          />

          {/* UDP Listeners */}
          <UdpListeners
            udpListeners={udpListeners}
            onAddUdpListener={addUdpListener}
            onRemoveUdpListener={removeUdpListener}
            onRefreshConnections={refreshConnections}
          />

          {/* UDP Server Initialization */}
          <UdpServerInit onRefreshConnections={refreshConnections} />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Configuration Buttons */}
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={openSimulationConfigWindow}
            >
              <Settings className="h-4 w-4" />
              Simulation Config
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={openConnectionsWindow}
            >
              <Activity className="h-4 w-4" />
              Connection Management
            </Button>
          </div>

          {/* Simulation Streaming */}
          <SimulationStreaming
            activeSimulationStreams={activeSimulationStreams}
            simUdpConnId={simUdpConnId}
            simUdpError={simUdpError}
            onStartSimulationUdp={startSimulationUdp}
            onStopSimulationUdp={stopSimulationUdp}
          />

          {/* Log Files */}
          <LogFilesSection
            logFiles={logFiles}
            onLoadLogFiles={loadLogFiles}
            onClearLogFiles={clearLogFiles}
          />

          {/* Debug Information */}
          <DebugInfo
            logsDirectory={logsDirectory}
            appRootDirectory={appRootDirectory}
            connectionsCount={connections.length}
            totalPackets={totalPackets}
            activeTabsCount={Object.keys(data).length}
            totalUdpTargets={totalUdpTargets}
          />
        </div>
      </div>

      {/* Global Packet Counters */}
      <PacketCounters
        globalPacketTypeCounts={statistics.globalPacketTypeCounts}
        totalPacketsReceived={statistics.totalPacketsReceived}
        totalPacketsSent={statistics.totalPacketsSent}
        connectionCount={statistics.connectionCount}
      />

      <Separator />

      {/* Packet Display */}
      <PacketDisplay
        data={data}
        packetCounts={packetCounts}
        onClearAll={clearAllData}
        onClearCurrent={clearData}
      />

      {/* Scroll to top button */}
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          size="sm"
          variant="outline"
          className="rounded-full w-10 h-10 p-0 shadow-lg"
        >
          ↑
        </Button>
      </div>
    </div>
  );
}
