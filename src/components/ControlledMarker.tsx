"use client";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { ReactNode } from "react";

interface Props {
  position: [number, number];
  icon: L.DivIcon;
  children?: ReactNode;
}

export default function ControlledMarker({ position, icon, children }: Props) {
  return (
    <Marker position={position} icon={icon}>
      {children}
    </Marker>
  );
}
