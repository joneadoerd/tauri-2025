import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  Play, 
  Square, 
  AlertCircle, 
  CheckCircle,
  Info,
  Code,
  Database,
  RefreshCw
} from "lucide-react";

import { SimulationStreamingControl } from "@/components/SimulationStreamingControl";
import { invoke } from "@tauri-apps/api/core";
import { checkSimulationDataAvailable } from "@/lib/simulation-streaming";
import type { SimulationResultList } from "@/gen/simulation";
import { listen } from "@tauri-apps/api/event";
import { SensorStreamingControl } from "@/components/SensorStreamingControl";

interface SimulationStreamUpdate {
  target_id: number;
  connection_id: string;
  position: {
    lat: number;
    lon: number;
    alt: number;
  };
  step: number;
  total_steps: number;
  raw_data: string;
}

function useSimulationStream() {
  const [targets, setTargets] = useState<Record<string, SimulationStreamUpdate>>({});
  const [log, setLog] = useState<SimulationStreamUpdate[]>([]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<SimulationStreamUpdate>("simulation_stream_update", (event) => {
      const data = event.payload;
      setTargets((prev) => ({
        ...prev,
        [data.target_id]: data,
      }));
      setLog((prev) => [data, ...prev.slice(0, 99)]); // keep last 100
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  return { targets, log };
}

interface UdpSensorClient {
  sensor_id: number;
  lat: number;
  lon: number;
  alt: number;
  temp: number;
}

function useUdpSensorClients() {
  const [clients, setClients] = useState<UdpSensorClient[]>([]);
  const [loading, setLoading] = useState(false);
  const refresh = async () => {
    setLoading(true);
    try {
      const result = await invoke<UdpSensorClient[]>("get_udp_sensor_clients");
      setClients(result);
    } catch (e) {
      setClients([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 1000); // refresh every second
    return () => clearInterval(interval);
  }, []);
  return { clients, loading, refresh };
}

const DATA_SOURCES = [
  { label: "Simulation", value: "Simulation" },
  { label: "Sensor", value: "Sensor" },
];

export default function SimulationStreamingDemo() {
  const [simulationData, setSimulationData] = useState<SimulationResultList | undefined>();
  const [isStreaming, setIsStreaming] = useState(false);
  const [demoStatus, setDemoStatus] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [dataSource, setDataSource] = useState("Sensor");
  const [targetLiveData, setTargetLiveData] = useState<Record<number, any>>({});

  const { targets, log } = useSimulationStream();
  const { clients: udpClients, loading: udpLoading, refresh: refreshUdp } = useUdpSensorClients();

  useEffect(() => {
    const unlisten = listen("target_sensor_data", (event) => {
      const data = event.payload as any;
      setTargetLiveData(prev => ({ ...prev, [data.target_id]: data }));
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // Load simulation data
  const loadSimulationData = async () => {
    try {
      setIsLoading(true);
      const data = await invoke<SimulationResultList>("get_simulation_data");
      if (data && data.results && data.results.length > 0) {
        setSimulationData(data);
        setDemoStatus(`Simulation data loaded successfully (${data.results.length} targets)`);
        setLastRefresh(new Date());
      } else {
        setSimulationData(undefined);
        setDemoStatus("No simulation data available. Run a simulation first.");
      }
    } catch (error) {
      console.error("Failed to load simulation data:", error);
      setDemoStatus("Failed to load simulation data");
    } finally {
      setIsLoading(false);
    }
  };

  // Check for simulation data availability
  const checkDataAvailability = async () => {
    try {
      const isAvailable = await checkSimulationDataAvailable();
      if (isAvailable && !simulationData) {
        // Data became available, refresh
        await loadSimulationData();
      }
    } catch (error) {
      console.error("Failed to check data availability:", error);
    }
  };

  // Load data on component mount
  useEffect(() => {
    loadSimulationData();
  }, []);

  // Auto-refresh when enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(checkDataAvailability, 2000); // Check every 2 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, simulationData]);

  const handleStreamingStateChange = (streaming: boolean) => {
    setIsStreaming(streaming);
    setDemoStatus(streaming ? "Simulation streaming active" : "Simulation streaming stopped");
  };

  const handleRefresh = async () => {
    await loadSimulationData();
  };

  // Use UDP sensor IDs as available targets if dataSource is 'Sensor', else use simulationData
  const availableTargets = dataSource === "Sensor"
    ? udpClients.map((c) => c.sensor_id)
    : simulationData
      ? simulationData.results.map((result) => result.target_id)
      : [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Simulation Streaming Demo</h1>
        <p className="text-muted-foreground">
          Stream simulation target positions to multiple serial connections
        </p>
      </div>

      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Demo Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Badge variant={simulationData ? "default" : "secondary"}>
              <Database className="h-3 w-3 mr-1" />
              {simulationData ? "Data Available" : "No Data"}
            </Badge>
            <Badge variant={isStreaming ? "default" : "secondary"}>
              {isStreaming ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Streaming Active
                </>
              ) : (
                <>
                  <Square className="h-3 w-3 mr-1" />
                  Not Streaming
                </>
              )}
            </Badge>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              {isLoading ? "Refreshing..." : "Refresh Data"}
            </Button>
            <Button 
              variant={autoRefresh ? "default" : "outline"} 
              size="sm" 
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
            </Button>
            <div>
              <label className="block text-xs font-semibold mb-1">Data Source</label>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={dataSource}
                onChange={e => setDataSource(e.target.value)}
              >
                {DATA_SOURCES.map(ds => (
                  <option key={ds.value} value={ds.value}>{ds.label}</option>
                ))}
              </select>
            </div>
          </div>

          {lastRefresh && (
            <div className="text-sm text-muted-foreground">
              Last refreshed: {lastRefresh.toLocaleTimeString()}
            </div>
          )}

          {demoStatus && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{demoStatus}</AlertDescription>
            </Alert>
          )}

          {simulationData && (
            <div className="space-y-2">
              <h3 className="font-semibold">Available Targets:</h3>
              <div className="flex flex-wrap gap-2">
                {simulationData.results.map((result) => (
                  <Badge key={result.target_id} variant="outline">
                    Target {result.target_id} ({result.final_state.length} steps)
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="prose prose-sm max-w-none">
            <h4>Simulation Streaming Process:</h4>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                <strong>Select Target Data:</strong> Choose which simulation targets to stream
              </li>
              <li>
                <strong>Choose Serial Connections:</strong> Select which serial ports to send data to
              </li>
              <li>
                <strong>Configure Intervals:</strong> Set how frequently to send position updates (10ms - 10s)
              </li>
              <li>
                <strong>Start Streaming:</strong> Each target-connection pair runs in its own spawned task
              </li>
              <li>
                <strong>Monitor Progress:</strong> Track active streams and stop individual or all streams
              </li>
            </ol>

            <h4>UDP Sensor Client Mapping & Health-Check:</h4>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                <strong>Send Health-Check Command:</strong> The server sends a <code>check-health</code> command to a UDP client. The client responds with its health and test temperature data.
              </li>
              <li>
                <strong>Map UDP Clients:</strong> You can map a UDP sensor client (target) to a new UDP client for receiving real-time data. This mapping is managed in the UI.
              </li>
              <li>
                <strong>Display Real-Time Data:</strong> Once mapped, the server receives and displays real-time data (position, temperature, etc.) from the mapped UDP client in the UI.
              </li>
            </ol>

            <h4>Data Format:</h4>
            <p>
              Position data is encoded as Protocol Buffer messages containing:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li><code>lat</code> - Latitude in radians</li>
              <li><code>lon</code> - Longitude in radians</li>
              <li><code>alt</code> - Altitude in meters</li>
            </ul>

            <h4>Features:</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Multiple concurrent streams (one per target-connection pair)</li>
              <li>Configurable update intervals per stream</li>
              <li>Real-time position and sensor data streaming</li>
              <li>Individual stream control (start/stop specific streams)</li>
              <li>UDP client health-check and mapping</li>
              <li>Error handling and validation</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Simulation Streaming Control */}
      <SimulationStreamingControl
        simulationData={simulationData}
        onStreamingStateChange={handleStreamingStateChange}
        dataSource={dataSource}
        availableTargets={availableTargets}
        disableInterval={dataSource === "Sensor"}
      />

      {dataSource === "Sensor" && (
        <div className="my-4">
          <SensorStreamingControl udpClients={udpClients} availableTargets={availableTargets} />
        </div>
      )}

      {/* Usage Example */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Example</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg">
            <pre className="text-sm overflow-x-auto">
{`// Example: Stream target 1 to COM3 every 100ms
const request = {
  simulation_data: simulationResultList,
  stream_configs: [
    {
      target_id: 1,
      serial_connection_id: "COM3",
      stream_interval_ms: 100
    }
  ],
  stream_interval_ms: 100,
  data_source: "${dataSource}" // Include data source
};

await startSimulationStreaming(request);`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Streaming Live View */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Map View */}
        <div className="flex-1 min-w-[300px]">
          <Card>
            <CardHeader>
              <CardTitle>Map View (Live Targets)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative h-64 bg-gray-100 rounded flex items-center justify-center">
                {dataSource === "Sensor" ? (
                  udpClients.filter(t => availableTargets.includes(t.sensor_id)).length === 0 ? (
                    <span className="text-muted-foreground">No active sensor targets</span>
                  ) : (
                    <ul className="space-y-2">
                      {udpClients.filter(t => availableTargets.includes(t.sensor_id)).map((t) => (
                        <li key={t.sensor_id} className="flex items-center gap-2">
                          <span className="font-bold">Sensor {t.sensor_id}</span>
                          <span>Status: <span className="text-green-600">Online</span></span>
                          <span>Lat: {t.lat.toFixed(6)}</span>
                          <span>Lon: {t.lon.toFixed(6)}</span>
                          <span>Alt: {t.alt.toFixed(1)}</span>
                          <span>Temp: {t.temp.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  )
                ) : (
                  Object.values(targets).length === 0 ? (
                    <span className="text-muted-foreground">No active targets</span>
                  ) : (
                    <ul className="space-y-2">
                      {Object.values(targets).map((t: SimulationStreamUpdate) => (
                        <li key={t.target_id} className="flex items-center gap-2">
                          <span className="font-bold">Target {t.target_id}</span>
                          <span>Lat: {t.position.lat.toFixed(6)}</span>
                          <span>Lon: {t.position.lon.toFixed(6)}</span>
                          <span>Alt: {t.position.alt.toFixed(1)}</span>
                          <span>Step: {t.step}/{t.total_steps}</span>
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Sidebar - Target Info */}
        <div className="w-full md:w-80">
          <Card>
            <CardHeader>
              <CardTitle>Target Info (Sidebar)</CardTitle>
            </CardHeader>
            <CardContent>
              {dataSource === "Sensor" ? (
                udpClients.filter(t => availableTargets.includes(t.sensor_id)).length === 0 ? (
                  <span className="text-muted-foreground">No active sensor targets</span>
                ) : (
                  <ul className="space-y-3">
                    {udpClients.filter(t => availableTargets.includes(t.sensor_id)).map((t) => (
                      <li key={t.sensor_id} className="border rounded p-2">
                        <div className="font-semibold">Sensor {t.sensor_id}</div>
                        <div>Status: <span className="text-green-600">Online</span></div>
                        <div>Lat: {t.lat.toFixed(6)}</div>
                        <div>Lon: {t.lon.toFixed(6)}</div>
                        <div>Alt: {t.alt.toFixed(1)}</div>
                        <div>Temp: {t.temp.toFixed(2)}</div>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                Object.values(targets).length === 0 ? (
                  <span className="text-muted-foreground">No active targets</span>
                ) : (
                  <ul className="space-y-3">
                    {Object.values(targets).map((t: SimulationStreamUpdate) => (
                      <li key={t.target_id} className="border rounded p-2">
                        <div className="font-semibold">Target {t.target_id}</div>
                        <div>Connection: <span className="font-mono">{t.connection_id}</span></div>
                        <div>Lat: {t.position.lat.toFixed(6)}</div>
                        <div>Lon: {t.position.lon.toFixed(6)}</div>
                        <div>Alt: {t.position.alt.toFixed(1)}</div>
                        <div>Step: {t.step} / {t.total_steps}</div>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Debug Log */}
      <Card>
        <CardHeader>
          <CardTitle>Serial Data Debug Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-48 overflow-y-auto text-xs font-mono bg-gray-50 rounded p-2">
            {log.length === 0 ? (
              <span className="text-muted-foreground">No data sent yet</span>
            ) : (
              <ul>
                {log.map((entry, i) => (
                  <li key={i} className="mb-1">
                    [Target {entry.target_id}] [Conn: {entry.connection_id}] Step {entry.step}/{entry.total_steps} - Lat: {entry.position.lat.toFixed(6)}, Lon: {entry.position.lon.toFixed(6)}, Alt: {entry.position.alt.toFixed(1)} | Raw: <span className="break-all">{entry.raw_data}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* UDP Config Tab */}
      <Card>
        <CardHeader>
          <CardTitle>UDP Sensor Server</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-2">
            <Button variant="outline" size="sm" onClick={refreshUdp} disabled={udpLoading}>
              {udpLoading ? "Refreshing..." : "Refresh Clients"}
            </Button>
            <span className="text-muted-foreground text-sm">Listening on UDP :5001</span>
          </div>
          {udpClients.length === 0 ? (
            <div className="text-muted-foreground">No sensor clients connected.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border">
                <thead>
                  <tr>
                    <th className="px-2 py-1 border">Sensor ID</th>
                    <th className="px-2 py-1 border">Lat</th>
                    <th className="px-2 py-1 border">Lon</th>
                    <th className="px-2 py-1 border">Alt</th>
                    <th className="px-2 py-1 border">Temp</th>
                  </tr>
                </thead>
                <tbody>
                  {udpClients.map((c) => (
                    <tr key={c.sensor_id}>
                      <td className="px-2 py-1 border font-mono">{c.sensor_id}</td>
                      <td className="px-2 py-1 border">{c.lat.toFixed(4)}</td>
                      <td className="px-2 py-1 border">{c.lon.toFixed(4)}</td>
                      <td className="px-2 py-1 border">{c.alt.toFixed(1)}</td>
                      <td className="px-2 py-1 border">{c.temp.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 