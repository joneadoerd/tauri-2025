import { useEffect, useRef, useState } from "react";
import type { SimulationResultList, SimulationResult, Position } from "@/gen/simulation";

interface SimPosition extends Position {
  id: number;
  time: number;
}

type FetchSimulationData = () => Promise<SimulationResultList>;

export function useSimulationTargets(fetchSimulationData: FetchSimulationData, intervalMs = 100, showPathMode = false) {
  const [targets, setTargets] = useState<SimulationResult[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [running, setRunning] = useState(false);
  const stepsRef = useRef<SimPosition[][]>([]);
  const flightPathsRef = useRef<SimPosition[][]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load data but do not start animation
 const load = async () => {
  try {
    const data = await fetchSimulationData();
    if (!data?.results) return;
    setTargets(data.results);
    const steps = data.results.map((target) => {
      return (target.final_state || []).map((state) => ({
        id: target.target_id,
        lat: state.lat,
        lon: state.lon,
        alt: state.alt,
        time: state.time || 0,
      }));
    });
    stepsRef.current = steps;
    flightPathsRef.current = steps;
    // Don't reset currentStep here!
    setTotalSteps(Math.max(...steps.map(s => s.length)));
  } catch (error) {
    console.error("Error loading simulation data:", error);
  }
};

// Keep the existing start/stop functions as they are:
const start = () => {
  setRunning(true);
};

const stop = () => {
  setRunning(false);
};

  // Start animation


  // Stop animation (pause at current step)

  // Reset to first step
  const reset = () => {
    setCurrentStep(0);
    setRunning(false);
  };

  useEffect(() => {
    if (!running) return;
    timerRef.current = setInterval(() => {
      setCurrentStep(prev => {
        if (prev + 1 >= totalSteps) {
          setRunning(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running, totalSteps, intervalMs]);

  // Get current positions for all targets
  let positions: SimPosition[] = [];
  if (showPathMode) {
    // Show first position for each target
    positions = stepsRef.current.map(arr => arr[0] || null).filter(Boolean) as SimPosition[];
  } else {
    positions = stepsRef.current.map(arr => arr[Math.min(currentStep, arr.length - 1)] || null).filter(Boolean) as SimPosition[];
  }

  // Get waypoints for each target
  const waypoints = targets.map(target => target.waypoints || []);

  // Get flight paths for each target
  const flightPaths = flightPathsRef.current.map(path => 
    path.map(p => ({ lat: p.lat, lon: p.lon }))
  );

  return { 
    positions, 
    start, 
    stop,
    reset,
    load,
    running, 
    targets, 
    waypoints, 
    flightPaths,
    currentStep, 
    totalSteps 
  };
}