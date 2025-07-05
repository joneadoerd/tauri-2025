"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Simulation } from "@/gen/simulation";
import { SimulationInitForm } from "@/components/SimulationInitForm";
import dynamic from "next/dynamic";
import { invoke } from "@tauri-apps/api/core";
import { simulation } from "@/lib/serial";

const MapPage = dynamic(() => import("@/components/MapPage"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      Loading map...
    </div>
  ),
});

export default function SimulationMapView() {
  const [simStatus, setSimStatus] = useState<string>("");
  const [initState, setInitState] = useState<Simulation | null>(null);
  const [showPath, setShowPath] = useState(false);
  const [simRunning, setSimRunning] = useState(false);
  const [simResultAvailable, setSimResultAvailable] = useState(false);
  const [clearFlag, setClearFlag] = useState(false);
  const [resetFlag, setResetFlag] = useState(false);

  const runSimulation = async () => {
    if (!initState) return;

    setSimStatus("Running simulation...");
    setShowPath(false);
    setSimRunning(false);
    setSimResultAvailable(false);
    setClearFlag(false);

    try {
      await simulation(initState);
      setSimStatus("Simulation completed successfully!");
      setSimResultAvailable(true);
    } catch (e) {
      setSimStatus(
        `Simulation failed: ${e instanceof Error ? e.message : String(e)}`
      );
      console.error("Simulation error:", e);
    }
  };

  const handleShowPath = () => {
    setShowPath(true);
    // setSimRunning(false);
  };

  const handleStartAnimation = () => {
    // setShowPath(false);
    setSimRunning(true);
  };

  const handleClear = async () => {
    setInitState(null);
    // setShowPath(false);
    setSimRunning(false);
    setSimResultAvailable(false);
    setClearFlag(true);
    setSimStatus("");
    await invoke("clear_simulation_data");
  };
  const handleStop = () => setSimRunning(false);

  const handleReset = () => {
    setSimRunning(false);
    setResetFlag((flag) => !flag); // Only reset when explicitly requested
  };

  return (
    <div className="flex flex-col h-screen w-screen">
      <div className="p-4 flex flex-col gap-2 items-start bg-gray-100">
        <SimulationInitForm onSubmit={setInitState} />

        <div className="flex gap-2 items-center flex-wrap">
          <Button
            onClick={runSimulation}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={!initState || simRunning}
          >
            Run Simulation
          </Button>
          <Button
            onClick={handleShowPath}
            className="bg-gray-600 hover:bg-gray-700 text-white"
            disabled={showPath}
          >
            Show Path
          </Button>
          <Button
            onClick={handleStartAnimation}
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={!simResultAvailable || simRunning}
          >
            Start Animation
          </Button>
          <Button
            onClick={handleStop}
            className="bg-yellow-600 hover:bg-yellow-700 text-white"
            disabled={!simRunning}
          >
            Stop Animation
          </Button>
          <Button
            onClick={handleReset}
            className="bg-purple-600 hover:bg-purple-700 text-white"
            disabled={!simResultAvailable || simRunning}
          >
            Reset
          </Button>
          <Button
            onClick={handleClear}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Clear All
          </Button>

          <div className="ml-4 text-sm font-medium">{simStatus}</div>
        </div>
      </div>

      <div className="flex-1">
        <MapPage
          showPath={showPath}
          clearFlag={clearFlag}
          simRunning={simRunning} // This controls pause/resume
          simResultAvailable={simResultAvailable}
          resetFlag={resetFlag} // Only used for explicit reset
          onSimulationComplete={() => setSimStatus("Animation completed")}
        />
      </div>
    </div>
  );
}
