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
  SerialConnectionInfo,
} from "@/lib/serial";
import { listen } from "@tauri-apps/api/event";
import { UnlistenFn, Event } from "@tauri-apps/api/event";

// Update these imports to the correct paths for your project structure
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import { Packet } from "@/gen/packet";
import { Check } from "lucide-react";
import { SerialPacketEvent } from "@/gen/packet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import React from "react"; // Added for React.Fragment

export default function SerialTabGeneral() {
  const [ports, setPorts] = useState<string[]>([]);
  const [connections, setConnections] = useState<SerialConnectionInfo[]>([]);
  const [data, setData] = useState<Record<string, { packet: Packet; timestamp: number }[]>>({});
  const [activeTab, setActiveTab] = useState<string>("");
  // Define allowed ID prefixes
  const idPrefixes = ['COM', 'USB', 'UART', 'DEV'];
  const [form, setForm] = useState({
    id: '', // This will be the prefix
    port: '',
    baud: '115200',
    json: '{ "id": 1, "length": 2, "checksum": 3, "version": 4, "flags": 5 }',
  });
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [packetType, setPacketType] = useState("Header");
  const [shareFrom, setShareFrom] = useState("");
  const [shareTo, setShareTo] = useState("");
  const [sharing, setSharing] = useState(false);
  const [packetTypes, setPacketTypes] = useState<string[]>(["Header", "Payload", "Command", "State"]);
  const [packetCounts, setPacketCounts] = useState<Record<string, { count: number; lastReset: number }>>({});

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
    let processingTimeout: NodeJS.Timeout | null = null;
    
    const unlisten = listen("serial_packet", (event: Event<SerialPacketEvent>) => {
      const { id, packet } = event.payload;
      if (!packet) return;

      // If packet.kind exists, flatten it to the correct field
      let normalizedPacket: Packet;
      if ((packet as any).kind) {
        const kindObj = (packet as any).kind;
        const kindKey = Object.keys(kindObj)[0];
        normalizedPacket = { [kindKey.toLowerCase()]: kindObj[kindKey] } as Packet;
      } else {
        normalizedPacket = packet;
      }

      // Process immediately for real-time display
      const now = Date.now();
      
      setData((prev) => {
        const currentPackets = prev[id] || [];
        const newPacket = { packet: normalizedPacket, timestamp: now };
        
        // Keep only the last 1000 packets per connection for better performance
        const updatedPackets = [...currentPackets, newPacket].slice(-1000);
        
        const updated = {
          ...prev,
          [id]: updatedPackets,
        };
        // Set the first tab as active if none is selected
        if (!activeTab) setActiveTab(id);
        return updated;
      });
      
      // Update packet count with higher frequency
      setPacketCounts((prev) => {
        const current = prev[id] || { count: 0, lastReset: now };
        const timeSinceReset = now - current.lastReset;
        
        // Reset counter every 500ms for more responsive display
        if (timeSinceReset >= 500) {
          return {
            ...prev,
            [id]: { count: 1, lastReset: now }
          };
        } else {
          return {
            ...prev,
            [id]: { count: current.count + 1, lastReset: current.lastReset }
          };
        }
      });
    });
    unlisten.then((un) => unlistenAll.push(un));
    return () => {
      unlistenAll.forEach((fn) => fn());
      if (processingTimeout) {
        clearTimeout(processingTimeout);
      }
    };
  }, [activeTab]);

  useEffect(() => {
    if (connections.length > 0 && !shareFrom) {
      setShareFrom(connections.find(conn => !!conn.id)?.id ?? "");
    }
    if (connections.length > 0 && !shareTo) {
      setShareTo(connections.find(conn => !!conn.id)?.id ?? "");
    }
  }, [connections]);

  const connect = async () => {
    // Only send the prefix to the backend
    const prefix = form.id || idPrefixes[0];
    await startConnection(prefix, form.port, parseInt(form.baud), packetType);
    const updated = await listConnections();
    setConnections(updated);
  };

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
        updated[id] = { count: 0, lastReset: Date.now() };
      }
      return updated;
    });
  };

  const clearAllData = () => {
    setData({});
    setLogs({});
    setPacketCounts({});
  };

  const send = async (id: string, port: string, packetType: string) => {
    if (!isValidJson()) {
      setLogs((prev: Record<string, string[]>) => ({
        ...prev,
        [id]: [...(prev[id] || []), `Invalid JSON: ${JSON.stringify(form.json)}`],
      }));
      return;
    }

    // Parse the JSON and construct the Packet object
    let packet: Packet = {};
    const parsed = JSON.parse(form.json);
    if (packetType === "Header") {
      packet.header = parsed;
    } else if (packetType === "Payload") {
      packet.payload = parsed;
    } // Add more types as needed

    try {
      await sendPacket(id, packet);
      setLogs((prev: Record<string, string[]>) => ({
        ...prev,
        [id]: [...(prev[id] || []), `Sent ${packetType}: ${JSON.stringify(packet)}`],
      }));
    } catch (error) {
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
      packet.header = exampleDataForType;
    } else if (packetType === "Payload") {
      packet.payload = exampleDataForType;
    } // Add more types as needed

    try {
      await sendPacket(connection.id, packet);
      setLogs((prev: Record<string, string[]>) => ({
        ...prev,
        [connection.id]: [...(prev[connection.id] || []), `Sent ${packetType}: ${JSON.stringify(packet)}`],
      }));
    } catch (error) {
      setLogs((prev: Record<string, string[]>) => ({
        ...prev,
        [connection.id]: [...(prev[connection.id] || []), `Error sending ${packetType}: ${error}`],
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

  // Example/template data for each packet type
  const exampleData: Record<string, any> = {
    Header: {
      id: 1,
      length: 42,
      checksum: 1234,
      version: 1,
      flags: 0
    },
    Payload: {
      type_value: 2,
      data: [22], // "Hello" as bytes
      size: 5,
      encoding: "utf8"
    }
  };

  return (
    <Card className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-end mb-4">
        <Button onClick={handleInitComs}>Init COM3 &amp; COM6 (Header)</Button>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="md:col-span-3">
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
        </div>
        <div>
          <Label>ID Prefix</Label>
          <Select value={form.id} onValueChange={(v) => setForm((f) => ({ ...f, id: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select ID Prefix" />
            </SelectTrigger>
            <SelectContent>
              {idPrefixes.map((prefix) => (
                <SelectItem key={prefix} value={prefix}>{prefix}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Select value={packetType} onValueChange={setPacketType}>
          <SelectTrigger>
            <SelectValue placeholder="Packet type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Header">Header</SelectItem>
            <SelectItem value="Payload">Payload</SelectItem>
          </SelectContent>
        </Select>
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
              {ports.filter((port) => port !== "").map((port, index) => (
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
        <Button onClick={clearAllData} variant="outline" className="self-end">
          Clear All Data
        </Button>
      </div>

      <div>
        <Label>JSON Packet</Label>
        <Input
          value={form.json}
          onChange={(e) => setForm((f) => ({ ...f, json: e.target.value }))}
        />
      </div>

      <Separator />
      <div className="flex items-center gap-4">
        <div>
          <Label>Share From</Label>
          <Select value={shareFrom} onValueChange={setShareFrom}>
            <SelectTrigger>
              <SelectValue placeholder="From Connection" />
            </SelectTrigger>
            <SelectContent>
              {connections.filter((conn) => !!conn.id).map((conn) => (
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
              {connections.filter((conn) => !!conn.id).map((conn) => (
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

      {/* Received Data Display */}
      <div className="mt-8">
        <h3 className="text-lg font-bold mb-4">Received Data</h3>
        
        {/* Real-time Data Stream */}
        <div className="mb-6">
          <Card className="p-4">
            <CardHeader>
              <CardTitle className="text-sm font-mono">Real-time Data Stream</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  {Object.keys(data).map((id) => (
                    <TabsTrigger key={id} value={id}>{`ID: ${id}`}</TabsTrigger>
                  ))}
                </TabsList>
                {Object.keys(data).map((id) => (
                  <TabsContent key={id} value={id}>
                    <div className="h-64 overflow-y-auto space-y-2 bg-black text-green-400 font-mono text-xs p-4 rounded">
                      {data[id].slice(-10).map(({ packet, timestamp }, index) => (
                        <div key={index} className="border-b border-gray-700 pb-1">
                          <span className="text-yellow-400">[{new Date(timestamp).toLocaleTimeString()}]</span>
                          <span className="text-blue-400"> {id}:</span>
                          <div className="ml-4 text-green-300">
                            <pre>{renderPacketProtobuf(packet)}</pre>
                          </div>
                        </div>
                      ))}
                      {data[id].length === 0 && <div className="text-gray-500">Waiting for data...</div>}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Data Statistics */}
        <div className="mb-6">
          <Card className="p-4">
            <CardHeader>
              <CardTitle className="text-sm font-mono">Data Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(data).map(([id, packets]) => {
                  const packetCount = packetCounts[id]?.count || 0;
                  return (
                    <div key={id} className="text-center p-3 bg-blue-50 rounded">
                      <div className="text-2xl font-bold text-blue-600">{packets.length}</div>
                      <div className="text-xs text-gray-600">Total Packets for {id}</div>
                      <div className="text-lg font-semibold text-green-600">{packetCount}/s</div>
                      <div className="text-xs text-gray-500">Packets per second</div>
                      {packets.length > 0 && (
                        <div className="text-xs text-green-600">
                          Latest: {new Date(packets[packets.length - 1].timestamp).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Packet Type Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(data).map(([id, packets]) => (
            <Card key={id} className="p-4">
              <CardHeader>
                <CardTitle className="text-sm font-mono flex justify-between">
                  <span>{id}</span>
                  <span className="text-blue-500">({packets.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {packets.slice(-5).map((packet, index) => (
                    <div key={index} className="text-xs bg-gray-100 p-2 rounded">
                      <div className="text-gray-500 text-xs flex justify-between">
                        <span>{new Date(packet.timestamp).toLocaleTimeString()}</span>
                        <span className="text-blue-500">#{packets.length - index}</span>
                      </div>
                      <pre className="text-xs mt-1 overflow-x-auto">
                        {JSON.stringify(packet, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
                {packets.length === 0 && (
                  <div className="text-gray-400 text-xs">No packets received for {id}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {connections.map((conn, index) => (
        <Card key={index} className="p-4 mb-4 space-y-2">
          <div className="flex justify-between">
            <div>
              <strong>{conn.id}</strong> on <em>{conn.port_name}</em>
            </div>
            <div className="space-x-2">
              <Button onClick={() => send(conn.id, conn.port_name, "Header")}>Send Header</Button>
              <Button onClick={() => send(conn.id, conn.port_name, "Payload")}>Send Payload</Button>
              <Button onClick={() => clearData(conn.id)} variant="outline">Clear Data</Button>
              <Button onClick={() => disconnect(conn.id, conn.port_name, "Header")} variant="destructive">
                Disconnect
              </Button>
            </div>
          </div>
          <div className="bg-muted p-2 border h-32 overflow-auto text-sm rounded">
            {(logs[conn.id] || []).map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
          <div>
            <Label className="mb-1 block">Serial Data</Label>
            <div className="h-64 overflow-auto rounded border bg-muted text-sm font-mono p-2">
              {(data[conn.id] || []).map((item, index) => (
                <div key={index} className="p-1 border-b last:border-b-0">
                  {JSON.stringify(item, null, 2)}
                </div>
              ))}
            </div>
          </div>
        </Card>
      ))}
    </Card>
  );
}

// Implement renderPacketProtobuf to pretty-print the protobuf structure
function renderPacketProtobuf(packet: import("@/gen/packet").Packet) {
  if (!packet) return "No data";
  // Helper to render a field group
  console.log("packet::",packet);
  function FieldGroup({ title, fields }: { title: string; fields: [string, any][] }) {
    return (
      <div className="mb-2">
        <div className="font-bold text-blue-300 mb-1">{title}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {fields.map(([k, v]) => (
            <React.Fragment key={k}>
              <div className="text-gray-400">{k}</div>
              <div className="text-green-200">{typeof v === "object" && v !== null && !(v instanceof Uint8Array) ? JSON.stringify(v) : v instanceof Uint8Array ? `[bytes] ${v.length}` : String(v)}</div>
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }
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
          data: packet.payload.data ? `[bytes] ${packet.payload.data.length}` : undefined,
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
          value: packet.checksum.value ? `[bytes] ${packet.checksum.value.length}` : undefined,
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
  if (sections.length === 0) return <div className="text-gray-400">No fields present</div>;
  console.log(sections);
  return <div>{sections}</div>;
}
