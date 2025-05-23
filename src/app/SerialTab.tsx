"use client";
import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Separator } from "../components/ui/separator";

export default function SerialTab() {
  const [ports, setPorts] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [baudRate, setBaudRate] = useState("115200");
  const [data, setData] = useState<string[]>([]);
  const parentRef = useRef<HTMLDivElement>(null);
  const [selectedPort, setSelectedPort] = useState("");
  const [json, setJson] = useState(
    '{ "id": 1, "length": 2, "checksum": 3, "version": 4, "flags": 5 }'
  );
  const [log, setLog] = useState<string[]>([]);
  const send = async () => {
    if (!isValidJson()) {
      setLog((prev) => [...prev, `Invalid JSON: ${json}`]);
      return;
    }
    await invoke("send_data", { json });
    setLog((prev) => [...prev, `Sent: ${json}`]);
  };
  const isValidJson = () => {
    try {
      JSON.parse(json);
      return true;
    } catch {
      return false;
    }
  };
  useEffect(() => {
    invoke("disconnect");
    const loadPorts = async () => {
      const ports = await invoke<string[]>("list_ports");
      setPorts(ports);
    };
    loadPorts();
  }, []);

  useEffect(() => {
    const unlisten = listen("serial_packet", (event) => {
      // console.log('Received data:', event);
      setData((prev) => [...prev, JSON.stringify(event.payload).toString()]);
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const handleConnect = async () => {
    if (isConnected) {
      await invoke("disconnect");
    } else {
      await invoke("start_serial", {
        portName: selectedPort,
        baudRate: parseInt(baudRate),
      });
    }
    setIsConnected(!isConnected);
  };

  return (
    <Card className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row gap-4 mb-6 items-end">
        <div className="flex-1">
          <Label className="mb-1 block">Port</Label>
          <Select
            value={selectedPort}
            onValueChange={(e) => setSelectedPort(e)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select port" />
            </SelectTrigger>
            <SelectContent>
              {ports.map((port) => (
                <SelectItem key={port} value={port}>
                  {port}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-32">
          <Label className="mb-1 block">Baud Rate</Label>
          <Input
            type="number"
            value={baudRate}
            onChange={(e) => setBaudRate(e.target.value)}
          />
        </div>
        <Button onClick={handleConnect} className="w-full md:w-auto">
          {isConnected ? "Disconnect" : "Connect"}
        </Button>
      </div>
      <div className="flex gap-4 mb-4">
        <Input
          value={json}
          onChange={(e) => setJson(e.target.value)}
          className="flex-1"
          placeholder="JSON data to send"
        />
        <Button
          onClick={send}
          disabled={!isConnected}
          className="bg-green-500 text-white"
        >
          Send
        </Button>
      </div>
      <Separator />
      <div className="mb-4">
        <Label className="mb-1 block">Log</Label>
        <div className="bg-muted p-2 border h-32 overflow-auto text-sm rounded">
          {log.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>
      <div>
        <Label className="mb-1 block">Serial Data</Label>
        <div
          ref={parentRef}
          className="h-64 overflow-auto rounded border bg-muted text-sm font-mono p-2"
        >
          {data.map((item, index) => (
            <div key={index} className="p-1 border-b last:border-b-0">
              {item}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
