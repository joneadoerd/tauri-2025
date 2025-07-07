import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface UdpSensorClient {
  sensor_id: number;
  lat: number;
  lon: number;
  alt: number;
  temp: number;
}

interface SensorStreamingControlProps {
  udpClients: UdpSensorClient[];
  availableTargets: number[];
}

export function SensorStreamingControl({ udpClients, availableTargets }: SensorStreamingControlProps) {
  const [selectedSensor, setSelectedSensor] = useState<number | null>(null);
  const [command, setCommand] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [mappings, setMappings] = useState<{ target_id: number; sensor_id: number }[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [forwardingAddrs, setForwardingAddrs] = useState<Record<number, string>>({});
  const [settingAddr, setSettingAddr] = useState<Record<number, boolean>>({});
  const [streaming, setStreaming] = useState<Record<number, boolean>>({});
  const [streamingLoading, setStreamingLoading] = useState<Record<number, boolean>>({});

  // When targetId changes, set a default forwarding address if not already set
  React.useEffect(() => {
    if (targetId && !forwardingAddrs[targetId]) {
      setForwardingAddrs(prev => ({ ...prev, [targetId]: `127.0.0.1:${6000 + targetId}` }));
    }
  }, [targetId]);

  const sendCommand = async () => {
    if (!selectedSensor || !command) return;
    setIsSending(true);
    try {
      const resp = await invoke<string>("send_sensor_command", {
        sensorId: selectedSensor,
        command,
      });
      setResponse(resp);
    } catch (e) {
      setResponse("Error sending command");
    } finally {
      setIsSending(false);
    }
  };

  const handleMap = async () => {
    if (selectedSensor && targetId && !mappings.some(m => m.target_id === targetId)) {
      const addr = forwardingAddrs[targetId];
      if (!addr) {
        alert("Please set the UDP forwarding address before mapping.");
        return;
      }
      try {
        await invoke("set_target_udp_addr", { targetId, addr });
        await invoke("map_udp_sensor_target", { sensorId: selectedSensor, targetId });
        setMappings([...mappings, { target_id: targetId, sensor_id: selectedSensor }]);
      } catch (e) {
        alert("Failed to map target: " + e);
      }
    }
  };

  const handleRemoveMapping = async (target_id: number) => {
    const mapping = mappings.find(m => m.target_id === target_id);
    if (mapping) {
      try {
        await invoke("unmap_udp_sensor_target", { sensorId: mapping.sensor_id });
        setMappings(mappings.filter(m => m.target_id !== target_id));
      } catch (e) {
        alert("Failed to remove mapping: " + e);
      }
    }
  };

  const handleSetAddr = async (target_id: number) => {
    const addr = forwardingAddrs[target_id];
    if (!addr) return;
    setSettingAddr(prev => ({ ...prev, [target_id]: true }));
    try {
      await invoke("set_target_udp_addr", { targetId: target_id, addr });
      alert(`Forwarding address for Target ${target_id} set to ${addr}`);
    } catch (e) {
      alert("Failed to set forwarding address: " + e);
    } finally {
      setSettingAddr(prev => ({ ...prev, [target_id]: false }));
    }
  };

  // Remove handleStartStreaming and handleStopStreaming
  // Remove Start/Stop Streaming buttons from the Target Mappings list
  // Streaming is now managed by mapping/unmapping only

  const selectedClient = udpClients.find(c => c.sensor_id === selectedSensor);

  return (
    <Card className="max-w-xl mx-auto">
      <CardHeader>
        <CardTitle className="text-blue-800 flex items-center gap-2 text-2xl">
          <span role="img" aria-label="sensor">🛰️</span> Sensor Streaming Control
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block font-semibold mb-1">UDP Client</label>
              <Select value={selectedSensor?.toString() ?? ""} onValueChange={v => setSelectedSensor(Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Sensor" />
                </SelectTrigger>
                <SelectContent>
                  {udpClients.map((c: UdpSensorClient) => (
                    <SelectItem key={c.sensor_id} value={c.sensor_id.toString()}>
                      Sensor {c.sensor_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Map Target</label>
              <div className="flex gap-2">
                <Select value={targetId?.toString() ?? ""} onValueChange={v => setTargetId(Number(v))} disabled={!selectedSensor}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select Target" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTargets.map(tid => (
                      <SelectItem key={tid} value={tid.toString()}>Target {tid}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleMap}
                  disabled={!selectedSensor || !targetId || mappings.some(m => m.target_id === targetId)}
                  variant="default"
                >
                  Map
                </Button>
              </div>
            </div>
            <div>
              <label className="block font-semibold mb-1">Send Command</label>
              <div className="flex gap-2">
                <input
                  className="border rounded px-2 py-1 flex-1"
                  value={command}
                  onChange={e => setCommand(e.target.value)}
                  placeholder="Command (e.g., check_health)"
                />
                <Button
                  onClick={sendCommand}
                  disabled={!selectedSensor || !command || isSending}
                  variant="default"
                >
                  {isSending ? "Sending..." : "Send"}
                </Button>
              </div>
              {response && (
                <div className="mt-2 p-2 rounded bg-green-50 border border-green-200 text-green-800 text-sm">
                  <span className="font-semibold">Response:</span> {response}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-4">
            <Card className="bg-gray-50">
              <CardHeader>
                <CardTitle className="text-gray-700 text-base font-semibold">Live Sensor Data</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedClient ? (
                  <ul className="text-sm space-y-1">
                    <li><span className="font-semibold">Sensor ID:</span> {selectedClient.sensor_id}</li>
                    <li><span className="font-semibold">Lat:</span> {selectedClient.lat.toFixed(6)}</li>
                    <li><span className="font-semibold">Lon:</span> {selectedClient.lon.toFixed(6)}</li>
                    <li><span className="font-semibold">Alt:</span> {selectedClient.alt.toFixed(2)}</li>
                    <li><span className="font-semibold">Temp:</span> {selectedClient.temp.toFixed(2)}°C</li>
                  </ul>
                ) : (
                  <div className="text-gray-400">No sensor selected.</div>
                )}
              </CardContent>
            </Card>
            <Card className="bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-700 text-base font-semibold">Target Mappings</CardTitle>
              </CardHeader>
              <CardContent>
                {mappings.length === 0 ? (
                  <div className="text-blue-400">No targets mapped.</div>
                ) : (
                  <ul className="text-sm space-y-1">
                    {mappings.map((m, i) => (
                      <li key={i} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">Target {m.target_id}</span> → Sensor {m.sensor_id}
                          <Button size="sm" variant="destructive" onClick={() => handleRemoveMapping(m.target_id)}>
                            Remove
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            className="border rounded px-2 py-1 text-xs"
                            style={{ width: 180 }}
                            placeholder="UDP Forward Addr (ip:port)"
                            value={forwardingAddrs[m.target_id] || ""}
                            onChange={e => setForwardingAddrs(prev => ({ ...prev, [m.target_id]: e.target.value }))}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!forwardingAddrs[m.target_id] || settingAddr[m.target_id]}
                            onClick={() => handleSetAddr(m.target_id)}
                          >
                            {settingAddr[m.target_id] ? "Setting..." : "Set Addr"}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 