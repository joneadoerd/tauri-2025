// src/app/serial-tab.tsx
"use client";

import { useEffect, useState } from "react";
import {
  startConnection,
  stopConnection,
  sendPacket,
  listSerialPorts,
  listConnections,
  startShare,
  stopShare,
  getSavedData,
  clearSavedData,
  getAllSavedData,
  getStorageStats,
  clearAllSavedData,
  readLogFile,
  listLogFiles,
  getLogsDirectory,
  getAppRootDirectory,
  SerialConnectionInfo,
} from "@/lib/serial";
import { listen } from "@tauri-apps/api/event";
import { UnlistenFn, Event } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

// Update these imports to the correct paths for your project structure
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Packet } from "@/gen/packet";
import { Check, Activity } from "lucide-react";
import { SerialPacketEvent } from "@/gen/packet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import React from "react"; // Added for React.Fragment

export default function SerialTabGeneral() {
  const [ports, setPorts] = useState<string[]>([]);
  const [connections, setConnections] = useState<SerialConnectionInfo[]>([]);
  const [data, setData] = useState<
    Record<string, { packet: Packet; timestamp: number; id?: string }[]>
  >({});
  const [activeTab, setActiveTab] = useState<string>("");
  // Define allowed ID prefixes
  const idPrefixes = ["COM", "USB", "UART", "DEV"];
  // Track processed packets to prevent duplicates
  const [processedPackets] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    id: "", // This will be the prefix
    port: "",
    baud: "115200",
    json: '{ "id": 1, "length": 2, "checksum": 3, "version": 4, "flags": 5 }',
  });
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [packetType, setPacketType] = useState("Header");
  const [shareFrom, setShareFrom] = useState("");
  const [shareTo, setShareTo] = useState("");
  const [sharing, setSharing] = useState(false);
  const [packetTypes, setPacketTypes] = useState<string[]>([
    "Header",
    "Payload",
    "Command",
    "State",
  ]);
  const [packetCounts, setPacketCounts] = useState<
    Record<
      string,
      {
        count: number;
        lastReset: number;
        headerCount: number;
        payloadCount: number;
        totalCount: number;
      }
    >
  >({});
  const [savedData, setSavedData] = useState<Record<string, string[]>>({});
  const [showSavedData, setShowSavedData] = useState<Record<string, boolean>>(
    {}
  );
  const [storageStats, setStorageStats] = useState<Record<string, number>>({});
  const [logFiles, setLogFiles] = useState<string[]>([]);
  const [logData, setLogData] = useState<Record<string, string[]>>({});
  const [showLogData, setShowLogData] = useState<Record<string, boolean>>({});
  const [logsDirectory, setLogsDirectory] = useState<string>("");
  // Add global packet type counter state
  const [globalPacketTypeCounts, setGlobalPacketTypeCounts] = useState<
    Record<string, number>
  >({});
  // Add per-connection packet type counter state
  const [connectionPacketTypeCounts, setConnectionPacketTypeCounts] = useState<
    Record<string, Record<string, number>>
  >({});

  useEffect(() => {
    const init = async () => {
      const available = await listSerialPorts();
      const conns = await listConnections();
      setPorts(available);
      setConnections(conns);
    };
    init();
  }, []);

  useEffect(() => {
    const unlistenAll: UnlistenFn[] = [];

    const unlisten = listen(
      "serial_packet",
      (event: Event<SerialPacketEvent>) => {
        const { id, packet } = event.payload;
        if (!packet) {
          console.log("Received event with no packet");
          return;
        }

        console.log(`Received packet for ${id}:`, packet);

        // Process the packet - keep original structure
        let normalizedPacket: Packet = packet;

        // Determine packet type from the kind structure first
        let packetType = "unknown";
        const packetAny = normalizedPacket as any; // Type assertion to handle kind structure
        if (packetAny.kind) {
          if (packetAny.kind.Header) packetType = "header";
          else if (packetAny.kind.Payload) packetType = "payload";
          else if (packetAny.kind.Command) packetType = "command";
          else if (packetAny.kind.State) packetType = "state";
        } else {
          // Fallback: check top-level fields for protobuf-style packets
          if (packetAny.header) packetType = "header";
          else if (packetAny.payload) packetType = "payload";
          else if (packetAny.command) packetType = "command";
          else if (packetAny.state) packetType = "state";
        }

        console.log(`Detected packet type: ${packetType} for ${id}`);

        // Process immediately for real-time display
        const now = Date.now();

        // Create a unique fingerprint for this packet to prevent duplicates
        const packetFingerprint = `${id}_${JSON.stringify(
          normalizedPacket
        )}_${now}`;

        // Check if we've already processed this exact packet
        if (processedPackets.has(packetFingerprint)) {
          console.log(`Skipping already processed packet for ${id}`);
          return;
        }

        // Add to processed set
        processedPackets.add(packetFingerprint);

        // Update global packet type counter
        setGlobalPacketTypeCounts((prev) => ({
          ...prev,
          [packetType]: (prev[packetType] || 0) + 1,
        }));

        setData((prev) => {
          const currentPackets = prev[id] || [];

          // Create a unique identifier for this packet to prevent duplicates
          const packetId = `${id}_${now}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;
          const newPacket = {
            packet: normalizedPacket,
            timestamp: now,
            id: packetId,
            packetType: packetType, // Store the detected packet type
          };

          // Keep only the last 100 packets per connection to improve performance
          const updatedPackets = [...currentPackets, newPacket].slice(-100);

          const updated = {
            ...prev,
            [id]: updatedPackets,
          };
          // Set the first tab as active if none is selected
          if (!activeTab) setActiveTab(id);

          console.log(
            `Updated data for ${id}, total packets: ${updatedPackets.length}`
          );
          return updated;
        });

        // Update packet count with real-time tracking and type-specific counts
        setPacketCounts((prev) => {
          const current = prev[id] || {
            count: 0,
            lastReset: now,
            headerCount: 0,
            payloadCount: 0,
            totalCount: 0,
          };
          const timeSinceReset = now - current.lastReset;

          // Use the packetType we already determined above
          console.log(`Counting packet for ${id}, type: ${packetType}`);

          // Reset counter every 1000ms for accurate per-second display
          if (timeSinceReset >= 1000) {
            console.log(
              `Resetting packet count for ${id}, type: ${packetType}`
            );
            return {
              ...prev,
              [id]: {
                count: 1,
                lastReset: now,
                headerCount: packetType === "header" ? 1 : 0,
                payloadCount: packetType === "payload" ? 1 : 0,
                totalCount: current.totalCount + 1,
              },
            };
          } else {
            const newCount = current.count + 1;
            const newHeaderCount =
              current.headerCount + (packetType === "header" ? 1 : 0);
            const newPayloadCount =
              current.payloadCount + (packetType === "payload" ? 1 : 0);
            console.log(
              `Updated packet count for ${id}: ${newCount}/s (H:${newHeaderCount}, P:${newPayloadCount}, T:${
                current.totalCount + 1
              })`
            );
            return {
              ...prev,
              [id]: {
                count: newCount,
                lastReset: current.lastReset,
                headerCount: newHeaderCount,
                payloadCount: newPayloadCount,
                totalCount: current.totalCount + 1,
              },
            };
          }
        });

        // Update per-connection packet type counter
        setConnectionPacketTypeCounts((prev) => ({
          ...prev,
          [id]: {
            ...(prev[id] || {}),
            [packetType]: (prev[id]?.[packetType] || 0) + 1,
          },
        }));

        // Update logs with packet details
        setLogs((prev) => {
          const currentLogs = prev[id] || [];
          const logEntry = `[${new Date(
            now
          ).toLocaleTimeString()}] Received packet: ${JSON.stringify(
            normalizedPacket,
            null,
            2
          )}`;
          const updatedLogs = [...currentLogs, logEntry].slice(-50); // Keep last 50 log entries
          return {
            ...prev,
            [id]: updatedLogs,
          };
        });
      }
    );
    unlisten.then((un) => unlistenAll.push(un));
    return () => {
      unlistenAll.forEach((fn) => fn());
    };
  }, [activeTab]);

  useEffect(() => {
    if (connections.length > 0 && !shareFrom) {
      setShareFrom(connections.find((conn) => !!conn.id)?.id ?? "");
    }
    if (connections.length > 0 && !shareTo) {
      setShareTo(connections.find((conn) => !!conn.id)?.id ?? "");
    }
  }, [connections]);

  const connect = async () => {
    // Only send the prefix to the backend
    const prefix = form.id || idPrefixes[0];
    await startConnection(prefix, form.port, parseInt(form.baud), packetType);
    const updated = await listConnections();
    setConnections(updated);
  };
  function clearAllStates() {
    setConnections([]);
    setData({});
    setLogs({});
    setPacketCounts({});
    setConnectionPacketTypeCounts({});
  }
  const disconnect = async (id: string, port: string, packetType: string) => {
    await stopConnection(id);
    // Clear the received data for this connection
    setData((prev) => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
    // Clear logs for this connection
    setLogs((prev) => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
    // Clear packet counts for this connection
    setPacketCounts((prev) => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
    // Remove per-connection packet type counters
    setConnectionPacketTypeCounts((prev) => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
    const updated = await listConnections();
    setConnections(updated);
  };

  const clearData = (id: string) => {
    setData((prev) => {
      const updated = { ...prev };
      if (updated[id]) {
        updated[id] = [];
      }
      return updated;
    });
    setLogs((prev) => {
      const updated = { ...prev };
      if (updated[id]) {
        updated[id] = [];
      }
      return updated;
    });
    setPacketCounts((prev) => {
      const updated = { ...prev };
      if (updated[id]) {
        updated[id] = {
          count: 0,
          lastReset: Date.now(),
          headerCount: 0,
          payloadCount: 0,
          totalCount: 0,
        };
      }
      return updated;
    });
    // Reset per-connection packet type counters
    setConnectionPacketTypeCounts((prev) => {
      const updated = { ...prev };
      if (updated[id]) {
        updated[id] = {};
      }
      return updated;
    });
  };

  const loadLogFiles = async () => {
    try {
      const files = await listLogFiles();
      setLogFiles(files);
      console.log("Loaded log files:", files);
    } catch (error) {
      console.error("Failed to load log files:", error);
    }
  };

  const loadLogsDirectory = async () => {
    try {
      const dir = await getLogsDirectory();
      setLogsDirectory(dir as any);
    } catch (error) {
      console.error("Failed to load logs directory:", error);
    }
  };

  const [appRootDirectory, setAppRootDirectory] = useState<string>("");

  const loadAppRootDirectory = async () => {
    try {
      const dir = await getAppRootDirectory();
      setAppRootDirectory(dir);
    } catch (error) {
      console.error("Failed to load app root directory:", error);
    }
  };

  const loadLogData = async (connectionId: string) => {
    try {
      const data = await readLogFile(connectionId);
      setLogData((prev) => ({
        ...prev,
        [connectionId]: data,
      }));
      setShowLogData((prev) => ({
        ...prev,
        [connectionId]: true,
      }));
    } catch (error) {
      console.error("Failed to load log data:", error);
    }
  };

  const toggleLogData = (connectionId: string) => {
    setShowLogData((prev) => ({
      ...prev,
      [connectionId]: !prev[connectionId],
    }));
  };

  const send = async (id: string, port: string, packetType: string) => {
    // Use example data instead of form data
    const exampleDataForType = exampleData[packetType];

    if (!exampleDataForType) {
      setLogs((prev: Record<string, string[]>) => ({
        ...prev,
        [id]: [...(prev[id] || []), `No example data for ${packetType}`],
      }));
      return;
    }

    // Create the packet with proper structure for Rust backend
    let packet: any = {}; // Use any to bypass TypeScript interface mismatch
    if (packetType === "Header") {
      packet = { kind: { Header: exampleDataForType } };
    } else if (packetType === "Payload") {
      // Ensure data is properly formatted as Uint8Array
      const payloadData = exampleDataForType.data
        ? new Uint8Array(exampleDataForType.data)
        : new Uint8Array();
      packet = {
        kind: {
          Payload: {
            ...exampleDataForType,
            data: payloadData,
          },
        },
      };
    } else {
      packet = { kind: { [packetType]: exampleDataForType } };
    }

    try {
      console.log(`Sending ${packetType} packet:`, packet);
      await sendPacket(id, packet);
      setLogs((prev: Record<string, string[]>) => ({
        ...prev,
        [id]: [
          ...(prev[id] || []),
          `Sent ${packetType}: ${JSON.stringify(packet)}`,
        ],
      }));
    } catch (error) {
      console.error(`Error sending ${packetType}:`, error);
      setLogs((prev: Record<string, string[]>) => ({
        ...prev,
        [id]: [...(prev[id] || []), `Error sending ${packetType}: ${error}`],
      }));
    }
  };

  const sendExampleData = async (packetType: string) => {
    if (connections.length === 0) {
      alert("No connections available. Please connect first.");
      return;
    }

    // Use the first available connection
    const connection = connections[0];
    const exampleDataForType = exampleData[packetType];

    if (!exampleDataForType) {
      alert(`No example data for ${packetType}`);
      return;
    }

    let packet: Packet = {};
    if (packetType === "Header") {
      packet = { header: exampleDataForType };
    } else if (packetType === "Payload") {
      packet = { payload: exampleDataForType };
    } else {
      packet = { [packetType.toLowerCase()]: exampleDataForType };
    }

    try {
      console.log(`Sending example ${packetType} packet:`, packet);
      await sendPacket(connection.id, packet);
      setLogs((prev: Record<string, string[]>) => ({
        ...prev,
        [connection.id]: [
          ...(prev[connection.id] || []),
          `Sent example ${packetType}: ${JSON.stringify(packet)}`,
        ],
      }));
    } catch (error) {
      console.error(`Error sending example ${packetType}:`, error);
      setLogs((prev: Record<string, string[]>) => ({
        ...prev,
        [connection.id]: [
          ...(prev[connection.id] || []),
          `Error sending example ${packetType}: ${error}`,
        ],
      }));
    }
  };
  const isValidJson = () => {
    try {
      JSON.parse(form.json);
      return true;
    } catch {
      return false;
    }
  };

  const handleStartShare = async () => {
    if (!shareFrom || !shareTo) return;
    await startShare(shareFrom, shareTo);
    setSharing(true);
  };

  const handleStopShare = async () => {
    await stopShare();
    setSharing(false);
  };

  const handleInitComs = async () => {
    await startConnection("com3_id", "COM3", 115200, "Header");
    await startConnection("com6_id", "COM6", 115200, "Header");
    const updated = await listConnections();
    setConnections(updated);
  };

  async function disconnectAllConnections() {
    await invoke("disconnect_all_connections");
    clearAllStates();
  }

  // Example/template data for each packet type
  const exampleData: Record<string, any> = {
    Header: {
      id: 1,
      length: 42,
      checksum: 1234,
      version: 1,
      flags: 0,
    },
    Payload: {
      type_value: 2,
      data: [22], // "Hello" as bytes
      size: 5,
      encoding: "utf8",
    },
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Serial Communication Monitor
          </h1>
          <p className="text-muted-foreground">
            Real-time packet monitoring and analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleInitComs} className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Init COM3 & COM6
          </Button>
        </div>
      </div>

      {/* Global Packet Type Counters */}
      {Object.keys(globalPacketTypeCounts).length > 0 && (
        <div className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                All Packets Received by Type
              </CardTitle>
              <CardDescription>
                Total packets received, grouped by type (all connections)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {Object.entries(globalPacketTypeCounts).map(([type, count]) => (
                  <div
                    key={type}
                    className="flex flex-col items-center p-4 bg-blue-50 rounded shadow min-w-[100px]"
                  >
                    <span className="text-lg font-bold text-blue-700 capitalize">
                      {type}
                    </span>
                    <span className="text-2xl font-mono text-green-700">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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

      <div className="grid md:grid-cols-4 gap-4">
        {/* <div className="md:col-span-3">
          <Label>Packet Types</Label>
          <div className="flex flex-col gap-1">
            {["Header", "Payload"].map((type) => (
              <div key={type} className="flex items-center gap-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={packetTypes.includes(type)}
                    onChange={() => {
                      setPacketTypes((prev) =>
                        prev.includes(type)
                          ? prev.filter((t) => t !== type)
                          : [...prev, type]
                      );
                    }}
                  />
                  {type}
                  {packetTypes.includes(type) && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="ml-2"
                      onClick={() => setForm((f) => ({ ...f, json: JSON.stringify(exampleData[type], null, 2) }))}
                    >
                      Fill Example
                    </Button>
                  )}
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => sendExampleData(type)}
                  disabled={connections.length === 0}
                >
                  Send {type}
                </Button>
              </div>
            ))}
          </div>
        </div> */}
        <div>
          <Label>ID Prefix</Label>
          <Select
            value={form.id}
            onValueChange={(v) => setForm((f) => ({ ...f, id: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select ID Prefix" />
            </SelectTrigger>
            <SelectContent>
              {idPrefixes.map((prefix) => (
                <SelectItem key={prefix} value={prefix}>
                  {prefix}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* <Select value={packetType} onValueChange={setPacketType}>
          <SelectTrigger>
            <SelectValue placeholder="Packet type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Header">Header</SelectItem>
            <SelectItem value="Payload">Payload</SelectItem>
          </SelectContent>
        </Select> */}
        <div>
          <Label>Port</Label>
          <Select
            value={form.port}
            onValueChange={(v) => setForm((f) => ({ ...f, port: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Port" />
            </SelectTrigger>
            <SelectContent>
              {ports
                .filter((port) => port !== "")
                .map((port, index) => (
                  <SelectItem key={port + index} value={port}>
                    {port}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Baud</Label>
          <Input
            value={form.baud}
            onChange={(e) => setForm((f) => ({ ...f, baud: e.target.value }))}
          />
        </div>
        <Button onClick={connect} className="self-end">
          Connect
        </Button>

        <Button onClick={disconnectAllConnections} variant="destructive">
          Disconnect All Connections
        </Button>

        <Button onClick={loadLogFiles} variant="outline" className="self-end">
          Load Log Files
        </Button>

        <Button
          onClick={loadLogsDirectory}
          variant="outline"
          className="self-end"
        >
          Get Logs Path
        </Button>
        <Button
          onClick={loadAppRootDirectory}
          variant="outline"
          className="self-end"
        >
          Get App Root
        </Button>
      </div>

      {/* <div>
        <Label>JSON Packet</Label>
        <Input
          value={form.json}
          onChange={(e) => setForm((f) => ({ ...f, json: e.target.value }))}
        />
      </div> */}

      <Separator />
      <div className="flex items-center gap-4">
        {logFiles.length > 0 ? (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>Log Files</span>
                <span className="text-xs text-muted-foreground">
                  ({logFiles.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-gray-200">
                {logFiles.map((file) => (
                  <li key={file} className="py-2 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                    <span className="font-mono text-blue-700 text-sm">
                      {file}
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                variant="destructive"
                className="mt-4"
                onClick={async () => {
                  setLogFiles([]);
                  // Optionally, call a backend command to delete log files here
                  // await invoke("clear_log_files");
                }}
              >
                Clear Log Files
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Log Files</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-gray-500">No log files found.</div>
            </CardContent>
          </Card>
        )}
        <div>
          <Label>Share From</Label>
          <Select value={shareFrom} onValueChange={setShareFrom}>
            <SelectTrigger>
              <SelectValue placeholder="From Connection" />
            </SelectTrigger>
            <SelectContent>
              {connections
                .filter((conn) => !!conn.id)
                .map((conn) => (
                  <SelectItem key={conn.id} value={conn.id}>
                    {conn.id}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Share To</Label>
          <Select value={shareTo} onValueChange={setShareTo}>
            <SelectTrigger>
              <SelectValue placeholder="To Connection" />
            </SelectTrigger>
            <SelectContent>
              {connections
                .filter((conn) => !!conn.id)
                .map((conn) => (
                  <SelectItem key={conn.id} value={conn.id}>
                    {conn.id}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={sharing ? handleStopShare : handleStartShare}
          disabled={!shareFrom || !shareTo || shareFrom === shareTo}
          variant={sharing ? "destructive" : "default"}
        >
          {sharing ? "Stop Share" : "Start Share (10ms)"}
        </Button>
      </div>

      {/* Packet Counters */}
      {Object.keys(packetCounts).length > 0 && (
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Real-time Packet Counters
              </CardTitle>
              <CardDescription>
                Live packet statistics for each connection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(packetCounts).map(([connectionId, counts]) => (
                  <Card
                    key={connectionId}
                    className="border-l-4 border-l-green-500"
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center justify-between">
                        <span className="font-mono">{connectionId}</span>
                        <Badge variant="secondary" className="text-xs">
                          {counts.count}/s
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-2 gap-4">
                        {connectionPacketTypeCounts[connectionId] ? (
                          Object.entries(
                            connectionPacketTypeCounts[connectionId]
                          ).map(([type, count]) => (
                            <div key={type} className="text-center">
                              <div className="text-2xl font-bold text-blue-600">
                                {count}
                              </div>
                              <div className="text-xs text-gray-500 capitalize">
                                {type}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center col-span-2 text-gray-400">
                            No packets yet
                          </div>
                        )}
                        <div className="text-center col-span-2">
                          <div className="text-lg font-bold text-green-600">
                            {counts.totalCount}
                          </div>
                          <div className="text-xs text-gray-500">Total</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Storage Statistics */}
      {Object.keys(storageStats).length > 0 && (
        <div className="mt-4">
          <Card className="p-4">
            <CardHeader>
              <CardTitle className="text-sm font-mono">
                Storage Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(storageStats).map(
                  ([connectionId, packetCount]) => (
                    <div
                      key={connectionId}
                      className="text-center p-3 bg-blue-50 rounded"
                    >
                      <div className="text-lg font-bold text-blue-600">
                        {packetCount}
                      </div>
                      <div className="text-xs text-gray-600">Saved Packets</div>
                      <div className="text-xs text-blue-500">
                        {connectionId}
                      </div>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Debug Information */}
      {(logsDirectory || appRootDirectory) && (
        <div className="mt-4">
          <Card className="p-4">
            <CardHeader>
              <CardTitle className="text-sm font-mono">
                Debug Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {appRootDirectory && (
                  <div>
                    <div className="text-xs font-semibold text-gray-600 mb-1">
                      App Root Directory:
                    </div>
                    <div className="bg-blue-50 p-2 rounded font-mono text-sm">
                      {appRootDirectory}
                    </div>
                  </div>
                )}
                {logsDirectory && (
                  <div>
                    <div className="text-xs font-semibold text-gray-600 mb-1">
                      Logs Directory:
                    </div>
                    <div className="bg-gray-100 p-2 rounded font-mono text-sm">
                      {logsDirectory}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-1">
                    Connection Status:
                  </div>
                  <div className="bg-yellow-50 p-2 rounded font-mono text-sm">
                    Active Connections: {connections.length} | Total Packets:{" "}
                    {Object.values(data).reduce(
                      (sum, packets) => sum + packets.length,
                      0
                    )}{" "}
                    | Active Tabs: {Object.keys(data).length}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Received Data Display */}
      <div className="mt-8">
        <h3 className="text-lg font-bold mb-4">Real-time Packet Data</h3>

        {/* Real-time Packet Display */}
        <div className="mb-6">
          <Card className="p-4">
            <CardHeader>
              <CardTitle className="text-sm font-mono flex justify-between items-center">
                <span>Live Packet Stream</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setData({})}
                  >
                    Clear All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (activeTab) {
                        setData((prev) => ({ ...prev, [activeTab]: [] }));
                      }
                    }}
                  >
                    Clear Current
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  {Object.keys(data).map((id) => (
                    <TabsTrigger
                      key={id}
                      value={id}
                    >{`Connection: ${id}`}</TabsTrigger>
                  ))}
                </TabsList>
                {Object.keys(data).map((id) => (
                  <TabsContent key={id} value={id}>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <span>
                          Showing last {data[id].length} packets from {id}
                        </span>
                        <div className="flex gap-4">
                          <span className="text-blue-600 font-semibold">
                            Total: {data[id].length}
                          </span>
                          <span className="text-green-600 font-semibold">
                            {packetCounts[id]?.count || 0} packets/sec
                          </span>
                        </div>
                      </div>

                      <div className="max-h-96 overflow-y-auto space-y-3">
                        {data[id]
                          .slice(-20)
                          .reverse()
                          .map(({ packet, timestamp, id: packetId }, index) => (
                            <div
                              key={packetId || `packet-${index}`}
                              className="p-4 border rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                            >
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(timestamp).toLocaleTimeString()}
                                  </span>
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                    Packet #{data[id].length - index}
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {Object.keys(packet).length} fields
                                </div>
                              </div>

                              <div className="space-y-2">
                                {Object.entries(packet).map(([key, value]) => (
                                  <div
                                    key={key}
                                    className="bg-background p-3 rounded border"
                                  >
                                    <div className="flex justify-between items-center mb-1">
                                      <div className="text-sm font-semibold text-blue-600">
                                        {key}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {typeof value} •{" "}
                                        {Array.isArray(value)
                                          ? value.length
                                          : "N/A"}{" "}
                                        items
                                      </div>
                                    </div>
                                    <pre className="text-xs overflow-x-auto whitespace-pre-wrap bg-muted p-2 rounded">
                                      {JSON.stringify(value, null, 2)}
                                    </pre>
                                  </div>
                                ))}
                                {Object.keys(packet).length === 0 && (
                                  <div className="text-xs text-gray-500 italic">
                                    Empty packet
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}

                        {data[id].length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            <p className="text-lg">No packets received yet</p>
                            <p className="text-sm">
                              Packets will appear here in real-time as they are
                              received
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Data Statistics */}
        {/* <div className="mb-6">
          <Card className="p-4">
            <CardHeader>
              <CardTitle className="text-sm font-mono">Packet Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(data).map(([id, packets]) => {
                  const packetCount = packetCounts[id]?.count || 0;
                  const latestPacket = packets.length > 0 ? packets[packets.length - 1] : null;
                  const packetTypes = packets.reduce((acc, { packet }) => {
                    Object.keys(packet).forEach(key => {
                      acc[key] = (acc[key] || 0) + 1;
                    });
                    return acc;
                  }, {} as Record<string, number>);
                  
                  return (
                    <div key={id} className="p-4 border rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="text-lg font-bold text-blue-600">{id}</div>
                          <div className="text-xs text-gray-600">Connection ID</div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-600">{packetCount}</div>
                          <div className="text-xs text-gray-500">packets/sec</div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Total Packets:</span>
                          <span className="font-semibold text-blue-600">{packets.length}</span>
                        </div>
                        
                        {latestPacket && (
                          <div className="flex justify-between text-sm">
                            <span>Latest:</span>
                            <span className="text-green-600">
                              {new Date(latestPacket.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        )}
                        
                        {Object.keys(packetTypes).length > 0 && (
                          <div className="mt-3">
                            <div className="text-xs font-semibold text-gray-600 mb-1">Packet Types:</div>
                            <div className="space-y-1">
                              {Object.entries(packetTypes).map(([type, count]) => (
                                <div key={type} className="flex justify-between text-xs">
                                  <span className="text-blue-600">{type}:</span>
                                  <span className="font-semibold">{count}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div> */}

        {/* Packet Type Breakdown */}
      </div>

      {connections.map((conn, index) => (
        <Card key={index} className="space-y-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  {conn.id}
                </CardTitle>
                <CardDescription>Connected to {conn.name}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => send(conn.id, conn.name, "Header")}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Send Header
                </Button>
                <Button
                  onClick={() => send(conn.id, conn.name, "Payload")}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Send Payload
                </Button>
                <Button
                  onClick={() => clearData(conn.id)}
                  variant="outline"
                  size="sm"
                >
                  Clear Data
                </Button>
                <Button
                  onClick={() => disconnect(conn.id, conn.name, "Header")}
                  variant="destructive"
                  size="sm"
                >
                  Disconnect
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Per-connection packet type counters */}
            {connectionPacketTypeCounts[conn.id] && (
              <div className="flex flex-wrap gap-2 mb-2">
                {Object.entries(connectionPacketTypeCounts[conn.id]).map(
                  ([type, count]) => (
                    <div
                      key={type}
                      className="flex flex-col items-center p-2 bg-blue-100 rounded min-w-[70px]"
                    >
                      <span className="text-xs font-semibold text-blue-700 capitalize">
                        {type}
                      </span>
                      <span className="text-lg font-mono text-green-700">
                        {count}
                      </span>
                    </div>
                  )
                )}
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => loadLogData(conn.id)}
                variant="outline"
                size="sm"
              >
                Load Log
              </Button>
              <Button
                onClick={() => toggleLogData(conn.id)}
                variant="outline"
                size="sm"
              >
                {showLogData[conn.id] ? "Hide Log" : "Show Log"}
              </Button>
            </div>
            <div className="space-y-4">
              {/* <div>
                <Label className="mb-2 block font-medium">Live Logs</Label>
                <div className="bg-muted p-3 border rounded-lg h-32 overflow-auto text-sm" id={`logs-${conn.id}`}>
                  {(logs[conn.id] || []).map((line, i) => (
                    <div key={i} className="py-1 border-b border-gray-200 last:border-b-0">
                      {line}
                    </div>
                  ))}
                  {(!logs[conn.id] || logs[conn.id].length === 0) && (
                    <div className="text-gray-500 italic">No logs available</div>
                  )}
                </div>
              </div> */}

              {/* <div>
                <Label className="mb-2 block font-medium">Serial Data</Label>
                <div className="h-64 overflow-auto rounded-lg border bg-muted text-sm font-mono p-3" id={`data-${conn.id}`}>
                  {(data[conn.id] || []).map((item, index) => (
                    <div key={index} className="p-2 border-b border-gray-200 last:border-b-0 bg-white rounded mb-2">
                      <div className="text-xs text-gray-500 mb-1">Packet #{index + 1}</div>
                      <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(item, null, 2)}
                      </pre>
                    </div>
                  ))}
                  {(!data[conn.id] || data[conn.id].length === 0) && (
                    <div className="text-gray-500 italic">No data available</div>
                  )}
                </div>
              </div> */}
            </div>

            {/* Log Data Display */}
            {showLogData[conn.id] && (
              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block font-medium items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>F
                    Log Data
                  </Label>
                  <div className="h-64 overflow-auto rounded-lg border bg-purple-50 text-sm font-mono p-3">
                    {(logData[conn.id] || []).map((logLine, index) => (
                      <div
                        key={index}
                        className="p-2 border-b border-purple-200 last:border-b-0 bg-purple-100 rounded mb-1"
                      >
                        <div className="text-xs text-purple-700">{logLine}</div>
                      </div>
                    ))}
                    {(!logData[conn.id] || logData[conn.id].length === 0) && (
                      <div className="text-gray-500 italic text-center py-8">
                        No log data available
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Implement renderPacketProtobuf to pretty-print the protobuf structure
function renderPacketProtobuf(packet: import("@/gen/packet").Packet) {
  if (!packet) return "No data";
  // Helper to render a field group
  console.log("packet::", packet);

  const FieldGroup = ({
    title,
    fields,
  }: {
    title: string;
    fields: [string, any][];
  }) => {
    return (
      <div className="mb-2">
        <div className="font-bold text-blue-300 mb-1">{title}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {fields.map(([k, v]) => (
            <React.Fragment key={k}>
              <div className="text-gray-400">{k}</div>
              <div className="text-green-200">
                {typeof v === "object" &&
                v !== null &&
                !(v instanceof Uint8Array)
                  ? JSON.stringify(v)
                  : v instanceof Uint8Array
                  ? `[bytes] ${v.length}`
                  : String(v)}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  const sections = [];
  if (packet.header) {
    sections.push(
      <FieldGroup
        key="header"
        title="Header"
        fields={Object.entries(packet.header)}
      />
    );
  }
  if (packet.payload) {
    sections.push(
      <FieldGroup
        key="payload"
        title="Payload"
        fields={Object.entries({
          ...packet.payload,
          data: packet.payload.data
            ? `[bytes] ${packet.payload.data.length}`
            : undefined,
        })}
      />
    );
  }
  if (packet.checksum) {
    sections.push(
      <FieldGroup
        key="checksum"
        title="Checksum"
        fields={Object.entries({
          ...packet.checksum,
          value: packet.checksum.value
            ? `[bytes] ${packet.checksum.value.length}`
            : undefined,
        })}
      />
    );
  }
  if (packet.timestamp) {
    sections.push(
      <FieldGroup
        key="timestamp"
        title="Timestamp"
        fields={Object.entries(packet.timestamp)}
      />
    );
  }
  if (packet.source) {
    sections.push(
      <FieldGroup
        key="source"
        title="Source"
        fields={Object.entries(packet.source)}
      />
    );
  }
  if (packet.destination) {
    sections.push(
      <FieldGroup
        key="destination"
        title="Destination"
        fields={Object.entries(packet.destination)}
      />
    );
  }
  if (packet.protocol) {
    sections.push(
      <FieldGroup
        key="protocol"
        title="Protocol"
        fields={Object.entries(packet.protocol)}
      />
    );
  }
  if (packet.flags) {
    sections.push(
      <FieldGroup
        key="flags"
        title="Flags"
        fields={Object.entries(packet.flags)}
      />
    );
  }
  if (packet.version) {
    sections.push(
      <FieldGroup
        key="version"
        title="Version"
        fields={Object.entries(packet.version)}
      />
    );
  }
  if (sections.length === 0)
    return <div className="text-gray-400">No fields present</div>;
  console.log(sections);
  return <div>{sections}</div>;
}
