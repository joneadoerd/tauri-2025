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

// Update these imports to the correct paths for your project structure
import { Card } from "@/components/ui/card";
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
import { PacketHeader } from "@/gen/packet";

export default function SerialTabGeneral() {
  const [ports, setPorts] = useState<string[]>([]);
  const [connections, setConnections] = useState<SerialConnectionInfo[]>([]);
  const [data, setData] = useState<Record<string, string[]>>({});
  const [form, setForm] = useState({
    id: "",
    port: "",
    baud: "115200",
    json: '{ "id": 1, "length": 2, "checksum": 3, "version": 4, "flags": 5 }',
  });
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [packetType, setPacketType] = useState("Header");
  const [shareFrom, setShareFrom] = useState("");
  const [shareTo, setShareTo] = useState("");
  const [sharing, setSharing] = useState(false);

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
    const unlistenAll: (() => void)[] = [];
    listConnections().then((conns) => {
      conns.forEach(({ id }) => {
        const unlisten = listen(
          `serial_packet_${id}`,
          (event) => {
            // If event.payload is base64, decode and parse as PacketHeader
            try {
              let parsed = event.payload;

              setData((prev) => ({
                ...prev,
                [id]: [...(prev[id] || []), JSON.stringify(parsed)],
              }));
            } catch (e) {
              setData((prev) => ({
                ...prev,
                [id]: [...(prev[id] || []), "Failed to decode: " + String(e)],
              }));
            }
          }
        );
        unlisten.then((un) => unlistenAll.push(un));
      });
    });
    return () => unlistenAll.forEach((fn) => fn());
  }, [connections]);

  const connect = async () => {
    await startConnection(form.id, form.port, parseInt(form.baud), packetType);
    const updated = await listConnections();
    setConnections(updated);
  };

  const disconnect = async (id: string) => {
    await stopConnection(id);
    const updated = await listConnections();
    setConnections(updated);
  };

  const send = async (id: string) => {
    if (!isValidJson()) {
      setLogs((prev) => ({
        ...prev,
        [id]: [...(prev[id] || []), `Invalid JSON: ${JSON.stringify(wrapper)}`],
      }));
      return;
    }
    const wrapper = {
      type: packetType,
      payload: JSON.parse(form.json),
    };
    await sendPacket(id, JSON.stringify(wrapper));
    setLogs((prev) => ({
      ...prev,
      [id]: [...(prev[id] || []), `Sent: ${JSON.stringify(wrapper)}`],
    }));
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

  return (
    <Card className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <div>
          <Label>ID</Label>
          <Input
            value={form.id}
            onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
          />
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
              {ports.map((port, index) => (
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
              {connections.map((conn) => (
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
              {connections.map((conn) => (
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

      {connections.map((conn, index) => (
        <Card key={index} className="p-4 mb-4 space-y-2">
          <div className="flex justify-between">
            <div>
              <strong>{conn.id}</strong> on <em>{conn.port_name}</em>
            </div>
            <div className="space-x-2">
              <Button onClick={() => send(conn.id)}>Send</Button>
              <Button onClick={() => disconnect(conn.id)} variant="destructive">
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
                  {item}
                </div>
              ))}
            </div>
          </div>
        </Card>
      ))}
    </Card>
  );
}
