"use client";
import React, { useState } from "react";
import ZmqTab from "./ZmqTab";
import SerialTab from "./SerialTab";
import SerialTabGeneral  from "./SerialTabGeneral";
import SerialTabGenerals  from "./serial-tab-general";
import SimulationRunner from "./SimulationRunner";
import SimulationMapView from "./simulation-map";
import SimulationStreamingDemo from "./SimulationStreamingDemo";
import UDPTapGeneral from "./UDPTapGeneral";

export default function App() {
  const [activeTab, setActiveTab] = useState<
    "zmq" | "serial" | "serial-general" | "SimulationStreamingDemo" | "simulation-map" | "udp-general"
  >("serial");

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="flex gap-4 mb-4">
        <button
          className={`px-4 py-2 rounded ${
            activeTab === "zmq" ? "bg-blue-500 text-white" : "bg-white border"
          }`}
          onClick={() => setActiveTab("zmq")}
        >
          ZMQ
        </button>
        <button
          className={`px-4 py-2 rounded ${
            activeTab === "serial"
              ? "bg-blue-500 text-white"
              : "bg-white border"
          }`}
          onClick={() => setActiveTab("serial")}
        >
          Serial
        </button>
        <button
          className={`px-4 py-2 rounded ${
            activeTab === "serial-general"
              ? "bg-blue-500 text-white"
              : "bg-white border"
          }`}
          onClick={() => setActiveTab("serial-general")}
        >
          Serial General
        </button>
        {/* <button
          className={`px-4 py-2 rounded ${
            activeTab === "SimulationStreamingDemo"
              ? "bg-blue-500 text-white"
              : "bg-white border"
          }`}
          onClick={() => setActiveTab("SimulationStreamingDemo")}
        >
          SimulationStreamingDemo
        </button> */}
        <button
          className={`px-4 py-2 rounded ${
            activeTab === "simulation-map"
              ? "bg-blue-500 text-white"
              : "bg-white border"
          }`}
          onClick={() => setActiveTab("simulation-map")}
        >
          Simulation Map
        </button>
        <button
          className={`px-4 py-2 rounded ${
            activeTab === "udp-general" ? "bg-blue-500 text-white" : "bg-white border"
          }`}
          onClick={() => setActiveTab("udp-general")}
        >
          UDP General
        </button>
      </div>
      <div>
        <div hidden={activeTab !== "zmq"}>
          <ZmqTab />
        </div>
        <div hidden={activeTab !== "serial"}>
          <SerialTabGenerals />
        </div>
        <div hidden={activeTab !== "serial-general"}>
          <SerialTabGeneral />
        </div>
        {/* <div hidden={activeTab !== "SimulationStreamingDemo"}>
          <SimulationStreamingDemo />
        </div> */}
        <div hidden={activeTab !== "simulation-map"}>
          <SimulationMapView />
        </div>
        <div hidden={activeTab !== "udp-general"}>
          <UDPTapGeneral />
        </div>
      </div>
    </div>
  );
}
