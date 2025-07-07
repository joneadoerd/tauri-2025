import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Play,
  Square,
  Settings,
  AlertCircle,
  CheckCircle,
  Clock,
  Target,
  Wifi,
  RefreshCw,
} from "lucide-react";

import {
  startSimulationStreaming,
  stopSimulationStreaming,
  stopTargetStream,
  getActiveSimulationStreams,
  getAvailableSimulationConnections,
  getAvailableSimulationTargets,
  createSimulationStreamRequest,
  getAvailableTargets,
  validateSimulationStreamRequest,
  type SimulationStreamConfig,
} from "@/lib/simulation-streaming";
import type { SimulationResultList } from "@/gen/simulation";
import { invoke } from "@tauri-apps/api/core";

interface SimulationStreamingControlProps {
  simulationData?: SimulationResultList;
  onStreamingStateChange?: (isStreaming: boolean) => void;
  dataSource?: string; // Add this prop
  availableTargets: number[];
  disableInterval?: boolean;
}

interface StreamMapping {
  target_id: number;
  serial_connection_id: string;
  stream_interval_ms: number;
}

export function SimulationStreamingControl({
  simulationData,
  onStreamingStateChange,
  dataSource = "Simulation",
  availableTargets,
  disableInterval = false,
}: SimulationStreamingControlProps) {
  const [streamMappings, setStreamMappings] = useState<StreamMapping[]>([]);
  const [availableConnections, setAvailableConnections] = useState<string[]>(
    []
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeStreams, setActiveStreams] = useState<string[]>([]);
  const [streamInterval, setStreamInterval] = useState(100);
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load available serial connections
  const loadConnections = async () => {
    try {
      setIsRefreshing(true);
      const connections = await getAvailableSimulationConnections();
      setAvailableConnections(connections);
      console.log("Loaded connections:", connections);
    } catch (error) {
      console.error("Failed to load connections:", error);
      setErrors([`Failed to load connections: ${error}`]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Load available targets from simulation data
  const loadTargets = async () => {
    try {
      const targets = await getAvailableSimulationTargets();
      console.log("Loaded targets:", targets);
    } catch (error) {
      console.error("Failed to load targets:", error);
    }
  };

  // Helper to load active streams for the current data source
  const loadActiveStreams = async () => {
    try {
      let streams: string[] = [];
      if (dataSource === "Sensor") {
        streams = await invoke<string[]>("get_active_sensor_streams");
      } else {
        streams = await getActiveSimulationStreams();
      }
      setActiveStreams(streams);
      setIsStreaming(streams.length > 0);
      onStreamingStateChange?.(streams.length > 0);
    } catch (error) {
      console.error("Failed to load active streams:", error);
    }
  };

  // Initial load
  useEffect(() => {
    loadConnections();
    loadTargets();
    loadActiveStreams();
  }, []);

  // Refresh connections when simulation data changes
  useEffect(() => {
    if (simulationData) {
      loadConnections();
      loadTargets();
    }
  }, [simulationData]);

  // On mount and when dataSource changes, load active streams
  useEffect(() => {
    loadActiveStreams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSource]);

  const addStreamMapping = () => {
    if (availableTargets.length > 0 && availableConnections.length > 0) {
      setStreamMappings([
        ...streamMappings,
        {
          target_id: availableTargets[0],
          serial_connection_id: availableConnections[0],
          stream_interval_ms: streamInterval,
        },
      ]);
    } else {
      setErrors([
        `Cannot add mapping. Available targets: ${availableTargets.length}, Available connections: ${availableConnections.length}`,
      ]);
    }
  };

  const removeStreamMapping = (index: number) => {
    setStreamMappings(streamMappings.filter((_, i) => i !== index));
  };

  const updateStreamMapping = (
    index: number,
    field: keyof StreamMapping,
    value: any
  ) => {
    setStreamMappings(
      streamMappings.map((mapping, i) =>
        i === index ? { ...mapping, [field]: value } : mapping
      )
    );
  };

  const startStreaming = async () => {
    if (!simulationData) {
      setErrors(["No simulation data available"]);
      return;
    }

    setIsLoading(true);
    setErrors([]);

    try {
      const request = {
        ...createSimulationStreamRequest(
          simulationData,
          streamMappings,
          streamInterval
        ),
        data_source: dataSource,
      };
      const validation = validateSimulationStreamRequest(request);

      if (!validation.valid) {
        setErrors(validation.errors);
        return;
      }

      await startSimulationStreaming(request);
      setIsStreaming(true);
      onStreamingStateChange?.(true);
      await loadActiveStreams();
    } catch (error) {
      setErrors([`Failed to start streaming: ${error}`]);
    } finally {
      setIsLoading(false);
    }
  };

  const stopStreaming = async () => {
    setIsLoading(true);
    try {
      if (dataSource === "Sensor") {
        await invoke("stop_sensor_streaming");
      } else {
        await stopSimulationStreaming();
      }
      setIsStreaming(false);
      onStreamingStateChange?.(false);
      setActiveStreams([]);
    } catch (error) {
      setErrors([`Failed to stop streaming: ${error}`]);
    } finally {
      setIsLoading(false);
    }
  };

  const stopSpecificStream = async (streamKey: string) => {
    // Split only on the first underscore
    const underscoreIdx = streamKey.indexOf("_");
    if (underscoreIdx === -1) return;
    const targetId = parseInt(streamKey.substring(0, underscoreIdx));
    const connectionId = streamKey.substring(underscoreIdx + 1);
    try {
      if (dataSource === "Sensor") {
        await invoke("stop_sensor_target_stream", { sensorId: targetId, connectionId });
      } else {
        await stopTargetStream(targetId, connectionId);
      }
      // Reload active streams after stopping
      await loadActiveStreams();
    } catch (error) {
      setErrors([`Failed to stop stream ${streamKey}: ${error}`]);
    }
  };

  const refreshData = async () => {
    await Promise.all([loadConnections(), loadTargets(), loadActiveStreams()]);
  };

  // Add a function to start sensor streaming
  const startSensorStreaming = async () => {
    if (streamMappings.length === 0) return;
    setIsLoading(true);
    setErrors([]);
    try {
      const request = {
        stream_configs: streamMappings.map(
          ({ target_id, serial_connection_id }) => ({
            sensor_id: target_id,
            serial_connection_id,
          })
        ),
      };
      await invoke("start_sensor_streaming", { request });
      setIsStreaming(true);
      onStreamingStateChange?.(true);
      await loadActiveStreams();
    } catch (error) {
      setErrors([`Failed to start sensor streaming: ${error}`]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-5 w-5" />
          Simulation Streaming Control
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-2">
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
          {activeStreams.length > 0 && (
            <Badge variant="outline">
              {activeStreams.length} active stream
              {activeStreams.length !== 1 ? "s" : ""}
            </Badge>
          )}
          <Badge variant="outline">
            {availableConnections.length} connection
            {availableConnections.length !== 1 ? "s" : ""} available
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Global Settings */}
        <div className="space-y-2">
          <Label htmlFor="stream-interval">Default Stream Interval (ms)</Label>
          <Input
            id="stream-interval"
            type="number"
            min="10"
            max="10000"
            value={streamInterval}
            onChange={(e) => setStreamInterval(parseInt(e.target.value) || 100)}
            disabled={disableInterval}
          />
        </div>

        <Separator />

        {/* Stream Mappings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Target-Connection Mappings</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={addStreamMapping}
              disabled={
                availableTargets.length === 0 ||
                availableConnections.length === 0
              }
            >
              <Settings className="h-4 w-4 mr-1" />
              Add Mapping
            </Button>
          </div>

          {streamMappings.length === 0 && (
            <div className="text-center text-muted-foreground py-4">
              No stream mappings configured. Add at least one mapping to start
              streaming.
            </div>
          )}

          {streamMappings.map((mapping, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label>Mapping {index + 1}</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeStreamMapping(index)}
                >
                  Remove
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Target ID</Label>
                  <Select
                    value={mapping.target_id.toString()}
                    onValueChange={(value) =>
                      updateStreamMapping(index, "target_id", parseInt(value))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTargets.map((targetId) => (
                        <SelectItem key={targetId} value={targetId.toString()}>
                          <Target className="h-4 w-4 mr-2" />
                          Target {targetId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Serial Connection</Label>
                  <Select
                    value={mapping.serial_connection_id}
                    onValueChange={(value) =>
                      updateStreamMapping(index, "serial_connection_id", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableConnections.map((connection) => (
                        <SelectItem key={connection} value={connection}>
                          <Wifi className="h-4 w-4 mr-2" />
                          {connection}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Interval (ms)</Label>
                  <Input
                    type="number"
                    min="10"
                    max="10000"
                    value={mapping.stream_interval_ms}
                    onChange={(e) =>
                      updateStreamMapping(
                        index,
                        "stream_interval_ms",
                        parseInt(e.target.value) || 100
                      )
                    }
                    disabled={disableInterval}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <Separator />

        {/* Active Streams */}
        {activeStreams.length > 0 && (
          <div className="space-y-2">
            <Label>Active Streams</Label>
            <div className="space-y-2">
              {activeStreams.map((streamKey) => (
                <div
                  key={streamKey}
                  className="flex items-center justify-between p-2 border rounded"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span className="font-mono text-sm">{streamKey}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => stopSpecificStream(streamKey)}
                  >
                    Stop
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Control Buttons */}
        <div className="flex gap-2">
          {dataSource !== "Sensor" && (
            <Button
              onClick={startStreaming}
              disabled={
                isLoading ||
                streamMappings.length === 0 ||
                (dataSource !== "Sensor" && !simulationData)
              }
              className="flex-1"
            >
              <Play className="h-4 w-4 mr-2" />
              {isLoading ? "Starting..." : "Start Streaming (Simulation)"}
            </Button>
          )}
          {dataSource === "Sensor" && (
            <Button
              onClick={startSensorStreaming}
              disabled={isLoading || streamMappings.length === 0}
              className="flex-1"
              variant="default"
            >
              <Play className="h-4 w-4 mr-2" />
              {isLoading ? "Starting..." : "Start Streaming (Sensor)"}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={stopStreaming}
            disabled={isLoading || !isStreaming}
            className="flex-1"
          >
            <Square className="h-4 w-4 mr-2" />
            {isLoading ? "Stopping..." : "Stop All"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
