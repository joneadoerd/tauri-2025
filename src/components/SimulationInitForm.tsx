import { useState } from "react";
import { Popup } from "react-leaflet";
import type { Simulation, Target, F16State, Position } from "@/gen/simulation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMapEvents } from "react-leaflet";

// Add this interface at the top of your file
interface MapClickHandlerProps {
  onMapClick: (lat: number, lon: number) => void;
  activeTargetIndex: number | null;
}

function MapClickHandler({ onMapClick, activeTargetIndex }: MapClickHandlerProps) {
  useMapEvents({
    click: (e) => {
      if (activeTargetIndex !== null) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}
function defaultF16State(): F16State {
  return {
    vt: 164.592,
    alpha: 0.037025,
    beta: 0,
    phi: 0,
    theta: 0,
    psi: 0.392699,
    p: 0,
    q: 0,
    r: 0,
    lat: 37.7749,
    lon: -122.4194,
    alt: 1158.24,
    pow: 9,
  };
}

function defaultTarget(id: number): Target {
  return {
    id,
    init_state: defaultF16State(),
    waypoints: [
      { lat: 37.775, lon: -122.4194, alt: 1219.2 },
      { lat: 37.7755, lon: -122.419, alt: 1188.72 },
      { lat: 37.7745, lon: -122.4185, alt: 1143.0 },
      { lat: 37.7742, lon: -122.418, alt: 91.44 },
    ],
  };
}

export function SimulationInitForm({
  onSubmit,
}: {
  onSubmit: (sim: Simulation) => void;
}) {
  const [targets, setTargets] = useState<Target[]>([defaultTarget(1)]);
  const [timeStep, setTimeStep] = useState(0.01);
  const [maxTime, setMaxTime] = useState(75);
  const [selectedWaypoint, setSelectedWaypoint] = useState<{
    tidx: number;
    widx: number;
  } | null>(null);
  const [openWaypointDialog, setOpenWaypointDialog] = useState(false);

  const handleTargetChange = (idx: number, field: keyof Target, value: any) => {
    setTargets((ts) =>
      ts.map((t, i) => (i === idx ? { ...t, [field]: value } : t))
    );
  };

  const handleInitStateChange = (
    idx: number,
    field: keyof F16State,
    value: any
  ) => {
    setTargets((ts) =>
      ts.map((t, i) =>
        i === idx && t.init_state
          ? { ...t, init_state: { ...t.init_state, [field]: value } }
          : t
      )
    );
  };

  const handleWaypointChange = (
    tidx: number,
    widx: number,
    field: keyof Position,
    value: any
  ) => {
    setTargets((ts) =>
      ts.map((t, i) =>
        i === tidx
          ? {
              ...t,
              waypoints: t.waypoints.map((w, j) =>
                j === widx ? { ...w, [field]: value } : w
              ),
            }
          : t
      )
    );
  };

  const addTarget = () => setTargets((ts) => [...ts, defaultTarget(ts.length + 1)]);
  
  const removeTarget = (tidx: number) => {
    setTargets((ts) => ts.filter((_, i) => i !== tidx));
  };

  const addWaypoint = (tidx: number) => {
    setTargets((ts) =>
      ts.map((t, i) =>
        i === tidx
          ? { ...t, waypoints: [...t.waypoints, { alt: 0, lat: 0, lon: 0 }] }
          : t
      )
    );
  };

  const removeWaypoint = (tidx: number, widx: number) => {
    setTargets((ts) =>
      ts.map((t, i) =>
        i === tidx
          ? {
              ...t,
              waypoints: t.waypoints.filter((_, j) => j !== widx),
            }
          : t
      )
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ targets, time_step: timeStep, max_time: maxTime });
  };

  const openWaypointInfo = (tidx: number, widx: number) => {
    setSelectedWaypoint({ tidx, widx });
    setOpenWaypointDialog(true);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Simulation Parameters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="timeStep">Time Step</Label>
            <Input
              id="timeStep"
              type="number"
              step="any"
              value={timeStep}
              onChange={(e) => setTimeStep(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxTime">Max Time</Label>
            <Input
              id="maxTime"
              type="number"
              step="any"
              value={maxTime}
              onChange={(e) => setMaxTime(Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      {targets.map((target, tidx) => (
        <Card key={tidx}>
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle>Target #{target.id}</CardTitle>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => removeTarget(tidx)}
            >
              Remove Target
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`target-id-${tidx}`}>Target ID</Label>
              <Input
                id={`target-id-${tidx}`}
                type="number"
                value={target.id}
                onChange={(e) =>
                  handleTargetChange(tidx, "id", Number(e.target.value))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Initial State</Label>
              <div className="grid grid-cols-3 gap-2">
                {target.init_state &&
                  Object.entries(target.init_state).map(
                    ([k, v]) =>
                      k !== "time" && (
                        <div key={k} className="space-y-1">
                          <Label htmlFor={`${tidx}-${k}`}>{k}</Label>
                          <Input
                            id={`${tidx}-${k}`}
                            type="number"
                            step="any"
                            value={v as number}
                            onChange={(e) =>
                              handleInitStateChange(
                                tidx,
                                k as keyof F16State,
                                Number(e.target.value)
                              )
                            }
                          />
                        </div>
                      )
                  )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Waypoints</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addWaypoint(tidx)}
                >
                  Add Waypoint
                </Button>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lat</TableHead>
                    <TableHead>Lon</TableHead>
                    <TableHead>Alt</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {target.waypoints.map((wp, widx) => (
                    <TableRow key={widx}>
                      <TableCell>
                        <Input
                          type="number"
                          value={wp.lat}
                          onChange={(e) =>
                            handleWaypointChange(
                              tidx,
                              widx,
                              "lat",
                              Number(e.target.value)
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={wp.lon}
                          onChange={(e) =>
                            handleWaypointChange(
                              tidx,
                              widx,
                              "lon",
                              Number(e.target.value)
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={wp.alt}
                          onChange={(e) =>
                            handleWaypointChange(
                              tidx,
                              widx,
                              "alt",
                              Number(e.target.value)
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openWaypointInfo(tidx, widx)}
                        >
                          Info
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removeWaypoint(tidx, widx)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex gap-4">
        <Button type="button" variant="outline" onClick={addTarget}>
          Add Target
        </Button>
        <Button type="submit">Save Init State</Button>
      </div>

      <Dialog open={openWaypointDialog} onOpenChange={setOpenWaypointDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Waypoint Information</DialogTitle>
          </DialogHeader>
          {selectedWaypoint && (
            <div className="space-y-2">
              <div>
                <span className="font-medium">Latitude: </span>
                {targets[selectedWaypoint.tidx].waypoints[selectedWaypoint.widx].lat}
              </div>
              <div>
                <span className="font-medium">Longitude: </span>
                {targets[selectedWaypoint.tidx].waypoints[selectedWaypoint.widx].lon}
              </div>
              <div>
                <span className="font-medium">Altitude: </span>
                {targets[selectedWaypoint.tidx].waypoints[selectedWaypoint.widx].alt}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </form>
  );
}