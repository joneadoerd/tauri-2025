"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Play, Save, Settings, Target as TargetIcon } from "lucide-react"
import type { Simulation, Target, F16State, Position } from "@/gen/simulation"
import { invoke } from "@tauri-apps/api/core"

function defaultF16State(): F16State {
  return {
    vt: 500.0,
    alpha: 0.037027160081059704,
    beta: 0.0,
    phi: 0.0,
    theta: 0,
    psi: 0.39269908169872414,
    p: 0.0,
    q: 0.0,
    r: 0.0,
    lat: 32.9965,
    lon: -80.7238,
    alt: 50.0,
    pow: 9.0,
  }
}

function defaultTarget(id: number): Target {
  return {
    id,
    init_state: defaultF16State(),
    waypoints: [
      { lat: 32.9775, lon: -80.6138, alt: 100.0 },
      { lat: 32.8912, lon: -80.5734, alt: 300.0 },
      { lat: 32.7421, lon: -80.4231, alt: 400.0 },
      { lat: 32.7362, lon: -80.3231, alt: 500.0 },
    ],
  }
}

export default function SimulationConfigPage() {
  const [targets, setTargets] = useState<Target[]>([defaultTarget(1)])
  const [timeStep, setTimeStep] = useState(0.1)
  const [maxTime, setMaxTime] = useState(400)
  const [simStatus, setSimStatus] = useState<string>("")
  const [isRunning, setIsRunning] = useState(false)
  const [savedInitState, setSavedInitState] = useState<Simulation | null>(null)

  const handleTargetChange = (idx: number, field: keyof Target, value: any) => {
    setTargets((ts) =>
      ts.map((t, i) => (i === idx ? { ...t, [field]: value } : t))
    )
  }

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
    )
  }

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
    )
  }

  const addTarget = () =>
    setTargets((ts) => [...ts, defaultTarget(ts.length + 1)])

  const removeTarget = (tidx: number) => {
    setTargets((ts) => ts.filter((_, i) => i !== tidx))
  }

  const addWaypoint = (tidx: number) => {
    setTargets((ts) =>
      ts.map((t, i) =>
        i === tidx
          ? { ...t, waypoints: [...t.waypoints, { alt: 0, lat: 0, lon: 0 }] }
          : t
      )
    )
  }

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
    )
  }

  const saveInitState = () => {
    const simulation: Simulation = {
      targets,
      time_step: timeStep,
      max_time: maxTime,
    }
    setSavedInitState(simulation)
    setSimStatus("Initial state saved successfully!")
  }

  const runSimulation = async () => {
    if (!savedInitState) {
      setSimStatus("Please save initial state first!")
      return
    }

    setIsRunning(true)
    setSimStatus("Running simulation...")

    try {
      await invoke("simulation", { sim: savedInitState })
      setSimStatus("Simulation completed successfully!")
    } catch (error) {
      setSimStatus(`Simulation failed: ${error instanceof Error ? error.message : String(error)}`)
      console.error("Simulation error:", error)
    } finally {
      setIsRunning(false)
    }
  }

  const clearSimulation = async () => {
    try {
      await invoke("clear_simulation_data")
      setSimStatus("Simulation data cleared!")
      setSavedInitState(null)
    } catch (error) {
      setSimStatus(`Failed to clear simulation data: ${error}`)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-4">
        <Settings className="h-6 w-6" /> Simulation Configuration
      </h1>
      <div className="space-y-6">
          {/* Simulation Parameters */}
          <Card>
            <CardHeader>
              <CardTitle>Simulation Parameters</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-4 gap-6">
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
              <div className="space-y-2">
                <Label>Total Targets</Label>
                <div className="text-2xl font-bold text-primary">{targets.length}</div>
              </div>
              <div className="space-y-2">
                <Label>Total Waypoints</Label>
                <div className="text-2xl font-bold text-primary">
                  {targets.reduce((sum, target) => sum + target.waypoints.length, 0)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Targets Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TargetIcon className="h-5 w-5" />
                Targets Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {targets.map((target, tidx) => (
                <div key={tidx} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-lg">Target {target.id}</h4>
                      <Badge variant="outline">
                        {target.waypoints.length} waypoint{target.waypoints.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      {targets.length > 1 && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removeTarget(tidx)}
                        >
                          Remove Target
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Initial State */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Initial Position</Label>
                        <div className="grid grid-cols-3 gap-2">
                          <Input
                            placeholder="Lat"
                            type="number"
                            step="any"
                            value={target.init_state?.lat || 0}
                            onChange={(e) =>
                              handleInitStateChange(tidx, "lat", Number(e.target.value))
                            }
                          />
                          <Input
                            placeholder="Lon"
                            type="number"
                            step="any"
                            value={target.init_state?.lon || 0}
                            onChange={(e) =>
                              handleInitStateChange(tidx, "lon", Number(e.target.value))
                            }
                          />
                          <Input
                            placeholder="Alt"
                            type="number"
                            step="any"
                            value={target.init_state?.alt || 0}
                            onChange={(e) =>
                              handleInitStateChange(tidx, "alt", Number(e.target.value))
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Initial Velocity</Label>
                        <Input
                          placeholder="Velocity"
                          type="number"
                          step="any"
                          value={target.init_state?.vt || 0}
                          onChange={(e) =>
                            handleInitStateChange(tidx, "vt", Number(e.target.value))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Initial Power</Label>
                        <Input
                          placeholder="Power"
                          type="number"
                          step="any"
                          value={target.init_state?.pow || 0}
                          onChange={(e) =>
                            handleInitStateChange(tidx, "pow", Number(e.target.value))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Initial Angles</Label>
                        <div className="grid grid-cols-3 gap-2">
                          <Input
                            placeholder="Alpha"
                            type="number"
                            step="any"
                            value={target.init_state?.alpha || 0}
                            onChange={(e) =>
                              handleInitStateChange(tidx, "alpha", Number(e.target.value))
                            }
                          />
                          <Input
                            placeholder="Beta"
                            type="number"
                            step="any"
                            value={target.init_state?.beta || 0}
                            onChange={(e) =>
                              handleInitStateChange(tidx, "beta", Number(e.target.value))
                            }
                          />
                          <Input
                            placeholder="Psi"
                            type="number"
                            step="any"
                            value={target.init_state?.psi || 0}
                            onChange={(e) =>
                              handleInitStateChange(tidx, "psi", Number(e.target.value))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Waypoints */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">Waypoints ({target.waypoints.length})</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addWaypoint(tidx)}
                      >
                        Add Waypoint
                      </Button>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Latitude</TableHead>
                            <TableHead>Longitude</TableHead>
                            <TableHead>Altitude</TableHead>
                            <TableHead className="w-24">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {target.waypoints.map((waypoint, widx) => (
                            <TableRow key={widx}>
                              <TableCell className="font-medium">{widx + 1}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="any"
                                  value={waypoint.lat}
                                  onChange={(e) =>
                                    handleWaypointChange(tidx, widx, "lat", Number(e.target.value))
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="any"
                                  value={waypoint.lon}
                                  onChange={(e) =>
                                    handleWaypointChange(tidx, widx, "lon", Number(e.target.value))
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="any"
                                  value={waypoint.alt}
                                  onChange={(e) =>
                                    handleWaypointChange(tidx, widx, "alt", Number(e.target.value))
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => removeWaypoint(tidx, widx)}
                                  disabled={target.waypoints.length <= 1}
                                >
                                  Remove
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-center pt-4">
                <Button type="button" variant="outline" onClick={addTarget} className="flex items-center gap-2">
                  <TargetIcon className="h-4 w-4" />
                  Add Target
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card>
            <CardHeader>
              <CardTitle>Simulation Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-center justify-center">
                <Button
                  type="button"
                  onClick={saveInitState}
                  variant="outline"
                  className="flex items-center gap-2 min-w-[140px]"
                >
                  <Save className="h-4 w-4" />
                  Save Init State
                </Button>
                <Button
                  type="button"
                  onClick={runSimulation}
                  disabled={!savedInitState || isRunning}
                  className="flex items-center gap-2 min-w-[140px]"
                >
                  <Play className="h-4 w-4" />
                  {isRunning ? "Running..." : "Run Simulation"}
                </Button>
                <Button
                  type="button"
                  onClick={clearSimulation}
                  variant="destructive"
                  size="sm"
                  className="min-w-[100px]"
                >
                  Clear Data
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Status Display */}
          {(simStatus || savedInitState) && (
            <Card>
              <CardContent className="pt-6">
                {simStatus && (
                  <div className="p-3 bg-blue-50 rounded border mb-3">
                    <div className="text-sm font-medium text-blue-700">{simStatus}</div>
                  </div>
                )}

                {/* Saved State Indicator */}
                {savedInitState && (
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Save className="h-3 w-3" />
                      Initial State Saved
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {savedInitState.targets.length} target{savedInitState.targets.length !== 1 ? "s" : ""} configured
                    </span>
                    <span className="text-sm text-muted-foreground">
                      • {savedInitState.targets.reduce((sum, target) => sum + target.waypoints.length, 0)} total waypoints
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
    </div>
  )
} 