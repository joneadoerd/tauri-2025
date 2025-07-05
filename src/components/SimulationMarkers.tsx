import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Scan } from "lucide-react";
import { SimPosition } from "@/hooks/useSimulationTargets";
import { renderToStaticMarkup } from "react-dom/server";

const makeIcon = (color: string) =>
  new L.DivIcon({
    html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;">
      ${renderToStaticMarkup(<Scan size={28} color={color} />)}
    </div>`,
    className: "custom-scan-marker",
    iconSize: [32, 32],
  });

interface SimulationMarkersProps {
  simPositions: SimPosition[];
  simResultAvailable: boolean;
  currentStep: number;
  totalSteps: number;
}

export function SimulationMarkers({
  simPositions,
  simResultAvailable,
  currentStep,
  totalSteps,
}: SimulationMarkersProps) {
  const [openPopups, setOpenPopups] = useState<Set<number>>(new Set());
  const markerRefs = useRef<Record<number, L.Marker>>({});

  // Re-open popups only if user had them open previously
  useEffect(() => {
    simPositions.forEach((pos) => {
      const marker = markerRefs.current[pos.id];
      if (marker && openPopups.has(pos.id)) {
        marker.openPopup();
      }
    });
  }, [simPositions, openPopups]);

  return (
    <>
      {simResultAvailable &&
        simPositions.map((pos, idx) => {
          const key = `${pos.id}`; // Keep key stable

          return (
            <Marker
              key={key}
              position={[pos.lat, pos.lon]}
              icon={makeIcon(idx === 0 ? "#007bff" : "#ff0000")}
              eventHandlers={{
                popupopen: () => {
                  setOpenPopups((prev) => new Set(prev).add(pos.id));
                },
                popupclose: () => {
                  setOpenPopups((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(pos.id);
                    return newSet;
                  });
                },
              }}
              ref={(ref) => {
                if (ref) markerRefs.current[pos.id] = ref;
              }}
            >
              <Popup
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
            </Marker>
          );
        })}
    </>
  );
}
