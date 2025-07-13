import React, { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { sendPacket } from "@/lib/serial";

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

export default function UDPTapGeneral() {
  const [address, setAddress] = useState("127.0.0.1:9000");
  const [connections, setConnections] = useState<
    { id: string; name: string }[]
  >([]);
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState("");

  const [shareFrom, setShareFrom] = useState("");
  const [shareTo, setShareTo] = useState("");
  const [shareInterval, setShareInterval] = useState(100);
  const [remoteInputs, setRemoteInputs] = useState<Record<string, string>>({});
  const [received, setReceived] = useState<Record<string, any[]>>({});
  const [initA, setInitA] = useState("127.0.0.1:9000");
  const [initB, setInitB] = useState("127.0.0.1:9001");
  const [refreshing, setRefreshing] = useState(false);

  const send = async (id: string, port: string, packetType: string) => {
    // Use example data instead of form data
    const exampleDataForType = exampleData[packetType];

    if (!exampleDataForType) {
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
    } catch (error) {
      console.error(`Error sending ${packetType}:`, error);
    }
  };
  // Fetch UDP connections
  const fetchConnections = useCallback(async () => {
    setRefreshing(true);
    try {
      const all = await invoke<{ id: string; name: string }[]>(
        "list_connections"
      );
      setConnections(all.filter((c) => c.name.startsWith("Udp(")));
    } catch (e) {
      setStatus("Error fetching connections: " + e);
    }
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchConnections();
    // Listen for UDP packets (serial_packet event)
    const unlistenPromise = listen("serial_packet", (event) => {
      const { id, packet } = event.payload as { id: string; packet: any };
      setReceived((prev) => ({
        ...prev,
        [id]: [...(prev[id] || []), packet],
      }));
    });
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [fetchConnections]);

  const startUdp = async () => {
    try {
      await invoke("start_udp_connection", {
        prefix: "udp",
        localAddr: address,
      });
      setStatus("UDP connection started");
      setAddress("");
      fetchConnections();
    } catch (e) {
      setStatus("Error: " + e);
    }
  };

  const stopUdp = async (id: string) => {
    try {
      await invoke("stop_connection", { id });
      setStatus("Stopped connection " + id);
      fetchConnections();
    } catch (e) {
      setStatus("Error stopping connection: " + e);
    }
  };

  const disconnectAll = async () => {
    try {
      await invoke("disconnect_all_connections");
      setStatus("All UDP connections stopped");
      fetchConnections();
    } catch (e) {
      setStatus("Error disconnecting all: " + e);
    }
  };

  const startShare = async () => {
    if (!shareFrom || !shareTo || shareFrom === shareTo) {
      setStatus("Select two different UDP connections to share between.");
      return;
    }
    try {
      await invoke("start_serial_share", {
        fromId: shareFrom,
        toId: shareTo,
        intervalMs: shareInterval,
      });
      setStatus(
        `Started sharing from ${shareFrom} to ${shareTo} every ${shareInterval}ms`
      );
      fetchConnections();
    } catch (e) {
      setStatus("Error starting share: " + e);
    }
  };

  const stopShare = async () => {
    if (!shareFrom || !shareTo) {
      setStatus("Select two UDP connections to stop sharing.");
      return;
    }
    try {
      await invoke("stop_share", { fromId: shareFrom, toId: shareTo });
      setStatus(`Stopped sharing from ${shareFrom} to ${shareTo}`);
      fetchConnections();
    } catch (e) {
      setStatus("Error stopping share: " + e);
    }
  };

  const setRemoteAddr = async (id: string) => {
    const remoteAddr = remoteInputs[id];
    if (!remoteAddr) {
      setStatus("Enter a remote address.");
      return;
    }
    try {
      await invoke("set_udp_remote_addr", { id, remoteAddr });
      setStatus(`Set remote address for ${id}`);
      fetchConnections();
    } catch (e) {
      setStatus("Error setting remote address: " + e);
    }
  };

  // Init two servers and connect them
  const initTwoServers = async () => {
    try {
      // Start A
      await invoke("start_udp_connection", {
        prefix: "udpA",
        localAddr: initA,
      });
      // Start B
      await invoke("start_udp_connection", {
        prefix: "udpB",
        localAddr: initB,
      });
      // Refresh and get IDs
      await fetchConnections();
      const all = await invoke<{ id: string; name: string }[]>(
        "list_connections"
      );
      const udpA = all.find((c) => c.name.includes(initA));
      const udpB = all.find((c) => c.name.includes(initB));
      if (udpA && udpB) {
        await invoke("set_udp_remote_addr", { id: udpA.id, remoteAddr: initB });
        await invoke("set_udp_remote_addr", { id: udpB.id, remoteAddr: initA });
        setStatus(`Started and connected ${initA} <-> ${initB}`);
      } else {
        setStatus("Could not find both UDP servers after starting.");
      }
      fetchConnections();
    } catch (e) {
      setStatus("Error initializing two servers: " + e);
    }
  };

  return (
    <Card className="p-6 max-w-2xl mx-auto space-y-6">
      <CardHeader>
        <CardTitle>UDP General</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <Label className="mb-1 block">Address (host:port)</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="127.0.0.1:9000"
            />
          </div>
          <Button
            onClick={startUdp}
            disabled={!address}
            className="w-full md:w-auto"
          >
            Start UDP Connection
          </Button>
          <Button
            onClick={disconnectAll}
            variant="destructive"
            className="w-full md:w-auto"
          >
            Disconnect All
          </Button>
          <Button
            onClick={fetchConnections}
            variant="outline"
            className="w-full md:w-auto"
            disabled={refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <Label className="mb-1 block">Init 2 Servers</Label>
            <Input
              value={initA}
              onChange={(e) => setInitA(e.target.value)}
              placeholder="127.0.0.1:9000"
              className="mb-2"
            />
            <Input
              value={initB}
              onChange={(e) => setInitB(e.target.value)}
              placeholder="127.0.0.1:9001"
            />
          </div>
          <Button onClick={initTwoServers} className="w-full md:w-auto">
            Init 2 Servers & Connect
          </Button>
        </div>
        <Separator />
        <div>
          <h4 className="font-semibold mb-2">Active UDP Connections</h4>
          {connections.length === 0 ? (
            <div className="text-muted-foreground">No UDP connections.</div>
          ) : (
            <ul className="space-y-4">
              {connections.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-col gap-2 border rounded p-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{c.name}</Badge>
                    <span className="font-mono text-xs">{c.id}</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => stopUdp(c.id)}
                    >
                      Stop
                    </Button>
                    {/* Send Header and Payload buttons */}
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={() => send(c.id, c.name, "Header")}
                    >
                      Send Header
                    </Button>
                    <Button
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700"
                      onClick={() => send(c.id, c.name, "Payload")}
                    >
                      Send Payload
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      className="w-48"
                      value={remoteInputs[c.id] || ""}
                      onChange={(e) =>
                        setRemoteInputs((prev) => ({
                          ...prev,
                          [c.id]: e.target.value,
                        }))
                      }
                      placeholder="Remote address (host:port)"
                    />
                    <Button size="sm" onClick={() => setRemoteAddr(c.id)}>
                      Set Remote
                    </Button>
                  </div>
                  <div>
                    <Label className="mb-1 block">Received Packets</Label>
                    <div className="bg-muted p-2 rounded text-xs max-h-32 overflow-y-auto">
                      {received[c.id]?.length ? (
                        received[c.id].slice(-10).map((pkt, i) => (
                          <div key={i} className="break-all">
                            {JSON.stringify(pkt)}
                          </div>
                        ))
                      ) : (
                        <span className="text-muted-foreground">
                          No packets received.
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Separator />
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <Label className="mb-1 block">Share Data From</Label>
            <select
              className="border rounded px-2 py-1 w-full"
              value={shareFrom}
              onChange={(e) => setShareFrom(e.target.value)}
            >
              <option value="">From UDP Connection</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.id})
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <Label className="mb-1 block">To</Label>
            <select
              className="border rounded px-2 py-1 w-full"
              value={shareTo}
              onChange={(e) => setShareTo(e.target.value)}
            >
              <option value="">To UDP Connection</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.id})
                </option>
              ))}
            </select>
          </div>
          <div className="w-32">
            <Label className="mb-1 block">Interval (ms)</Label>
            <Input
              type="number"
              value={shareInterval}
              onChange={(e) => setShareInterval(Number(e.target.value))}
              min={1}
            />
          </div>
          <Button
            onClick={startShare}
            disabled={!shareFrom || !shareTo || shareFrom === shareTo}
            className="w-full md:w-auto"
          >
            Start Share
          </Button>
          <Button
            onClick={stopShare}
            variant="destructive"
            disabled={!shareFrom || !shareTo}
            className="w-full md:w-auto"
          >
            Stop Share
          </Button>
        </div>
        <Separator />
        <div className="text-sm text-muted-foreground">{status}</div>
      </CardContent>
    </Card>
  );
}
