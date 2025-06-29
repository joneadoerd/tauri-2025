"use client";

import {
  MapContainer,
  TileLayer,
  Circle,
  Polyline,
  Popup,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Scan } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "@/components/ui/button";
import ControlledMarker from "./ControlledMarker";
import { useSimulationTargets } from "@/hooks/useSimulationTargets";
import { invoke } from "@tauri-apps/api/core";
import type {
  SimulationResultList,
  SimulationResult,
  Position,
} from "@/gen/simulation";
import React, { useRef, useEffect, useState } from "react";

const makeIcon = (color: string) =>
  new L.DivIcon({
    html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;">
      ${renderToStaticMarkup(<Scan size={28} color={color} />)}
    </div>`,
    className: "custom-scan-marker",
    iconSize: [32, 32],
  });

interface MapPageProps {
  showPath?: boolean;
  clearFlag?: boolean;
  simRunning?: boolean;
  simResultAvailable?: boolean;
  resetFlag?: boolean;
  onSimulationComplete?: () => void;
}

export default function MapPage({
  showPath = false,
  clearFlag,
  simRunning,
  simResultAvailable,
  resetFlag,
  onSimulationComplete,
}: MapPageProps) {
  const [showPathMode, setShowPathMode] = useState(true);
  const {
    positions: simPositions,
    start,
    stop,
    reset,
    load,
    running: animationRunning,
    waypoints,
    targets,
    currentStep,
    totalSteps,
    flightPaths,
  } = useSimulationTargets(
    async () =>
      simResultAvailable
        ? await invoke<SimulationResultList>("get_simulation_data")
        : { results: [] },
    10, // 1s per frame
    showPathMode
  );

  const mapRef = useRef<any>(null);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(13);
  const [fitBoundsDone, setFitBoundsDone] = useState(false);

  // Load simulation data when results become available
  useEffect(() => {
    if (simResultAvailable) {
      load();
    }
  }, [simResultAvailable]);

  // Clear map state if clearFlag is set
  useEffect(() => {
    if (clearFlag) {
      setSimulationProgress(0);
      setFitBoundsDone(false);
    }
  }, [clearFlag]);

  // Calculate simulation progress
  useEffect(() => {
    if (totalSteps > 0) {
      setSimulationProgress(Math.round((currentStep / totalSteps) * 100));
    }
  }, [currentStep, totalSteps]);

  // Fit map to show both waypoints and flight path only when showPath or simRunning first becomes true
  useEffect(() => {
    if (
      (showPath || simRunning) &&
      !fitBoundsDone &&
      mapRef.current &&
      waypoints.length > 0 &&
      flightPaths.length > 0
    ) {
      const allPoints = [
        ...waypoints.flat().map((wp) => [wp.lat, wp.lon]),
        ...flightPaths.flat().map((fp) => [fp.lat, fp.lon]),
      ];
      if (allPoints.length > 0) {
        mapRef.current.fitBounds(allPoints, {
          padding: [50, 50],
          maxZoom: 17,
        });
        setFitBoundsDone(true);
      }
    }
    if (!showPath && !simRunning) {
      setFitBoundsDone(false);
    }
  }, [showPath, simRunning, waypoints, flightPaths, fitBoundsDone]);

  // Handle animation completion
  useEffect(() => {
    if (!animationRunning && currentStep > 0 && onSimulationComplete) {
      onSimulationComplete();
    }
  }, [animationRunning, currentStep, onSimulationComplete]);

  // Handle showPath, simRunning, reset
  // useEffect(() => {
  //   if (showPath && simResultAvailable) {
  //     setShowPathMode(true);
  //     load();
  //     stop();
  //     reset();
  //   } else {
  //     setShowPathMode(false);
  //   }
  // }, [showPath, simResultAvailable]);

  useEffect(() => {
    if (simRunning && simResultAvailable) {
      setShowPathMode(false);
      load();
      start();
    } else if (!simRunning) {
      stop();
    }
  }, [simRunning, simResultAvailable]);

  // Reset to first step when resetFlag changes
  useEffect(() => {
    if (resetFlag && simResultAvailable) {
      setShowPathMode(true);
      load();
      stop();
      reset();
    }
  }, [resetFlag, simResultAvailable]);

  if (!simResultAvailable) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400">
        No simulation results. Run simulation to view map.
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen">
      {simRunning && (
        <div className="absolute top-4 left-4 z-[1000] bg-white p-2 rounded shadow-lg">
          Simulation Progress: {simulationProgress}%
        </div>
      )}

      <MapContainer
        center={[45, -70]}
        zoom={zoomLevel}
        style={{ height: "100%", width: "100%" }}
        ref={mapRef}
        zoomControl={true}
        doubleClickZoom={true}
        scrollWheelZoom={true}
        touchZoom={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {/* Flight paths (shown during both path display and animation) */}
        {showPath &&
          flightPaths.map((path, idx) => (
            <Polyline
              key={`path-${idx}`}
              positions={path.map((p) => [p.lat, p.lon])}
              pathOptions={{
                color: idx === 0 ? "#007bff" : "#ff0000",
                weight: 2,
                opacity: 0.7,
                dashArray: showPath ? undefined : "5, 5", // Dashed during animation
              }}
            />
          ))}
        {/* Waypoint markers (always shown with path) */}
        {showPath &&
          waypoints.map((wps, idx) =>
            wps.map((wp, widx) => (
              <Circle
                key={`wp-${idx}-${widx}`}
                center={[wp.lat, wp.lon]}
                radius={zoomLevel > 12 ? 30 : 50} // Adjust size based on zoom
                pathOptions={{
                  color: idx === 0 ? "#007bff" : "#ff0000",
                  fillOpacity: 0.5,
                }}
              >
                <Popup>
                  <div className="space-y-1">
                    <div className="font-bold">Waypoint {widx + 1}</div>
                    <div>Target: {targets[idx]?.target_id}</div>
                    <div>Lat: {wp.lat.toFixed(6)}</div>
                    <div>Lon: {wp.lon.toFixed(6)}</div>
                    <div>Alt: {wp.alt.toFixed(1)}m</div>
                  </div>
                </Popup>
              </Circle>
            ))
          )}
        {/* Animated aircraft markers */}
        // Modify the markers rendering section:
        {simResultAvailable &&
          simPositions.map((pos, idx) => {
            const key = `${pos.id}-${pos.time}`;
            return (
              <ControlledMarker
                key={key}
                position={[pos.lat, pos.lon]}
                icon={makeIcon(idx === 0 ? "#007bff" : "#ff0000")}
              >
                <Popup
                  autoClose={false}
                  closeOnClick={false}
                  closeOnEscapeKey={false}
                  className="permanent-popup"
                >
                  <div className="space-y-1">
                    <div className="font-bold">Target {pos.id}</div>
                    <div>Time: {pos.time.toFixed(1)}s</div>
                    <div>Lat: {pos.lat.toFixed(6)}</div>
                    <div>Lon: {pos.lon.toFixed(6)}</div>
                    <div>Alt: {pos.alt.toFixed(1)}m</div>
                    <div>
                      Progress: {Math.round((currentStep / totalSteps) * 100)}%
                    </div>
                  </div>
                </Popup>
              </ControlledMarker>
            );
          })}
      </MapContainer>
    </div>
  );
}
