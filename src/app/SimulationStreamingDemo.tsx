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

export default function SimulationStreamingDemo() {
  const [simulationData, setSimulationData] = useState<SimulationResultList | undefined>();
  const [isStreaming, setIsStreaming] = useState(false);
  const [demoStatus, setDemoStatus] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(false);

  const { targets, log } = useSimulationStream();

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
              <li>Real-time position data streaming</li>
              <li>Individual stream control (start/stop specific streams)</li>
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
      />

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
  stream_interval_ms: 100
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
              {/* Placeholder for map - replace with real map if needed */}
              <div className="relative h-64 bg-gray-100 rounded flex items-center justify-center">
                {Object.values(targets).length === 0 ? (
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
              {Object.values(targets).length === 0 ? (
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
    </div>
  );
} 