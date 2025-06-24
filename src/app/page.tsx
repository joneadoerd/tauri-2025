"use client";
import React, { useState } from "react";
import ZmqTab from "./ZmqTab";
import SerialTab from "./SerialTab";
import SerialTabGeneral from "./SerialTabGeneral";
import SimulationRunner from "./SimulationRunner";

export default function App() {
  const [activeTab, setActiveTab] = useState<
    "zmq" | "serial" | "serial-general" | "simulation"
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
        <button
          className={`px-4 py-2 rounded ${
            activeTab === "simulation"
              ? "bg-blue-500 text-white"
              : "bg-white border"
          }`}
          onClick={() => setActiveTab("simulation")}
        >
          Simulation
        </button>
      </div>
      <div>
        <div hidden={activeTab !== "zmq"}>
          <ZmqTab />
        </div>
        <div hidden={activeTab !== "serial"}>
          <SerialTab />
        </div>
        <div hidden={activeTab !== "serial-general"}>
          <SerialTabGeneral />
        </div>
        <div hidden={activeTab !== "simulation"}>
          <SimulationRunner />
        </div>
      </div>
    </div>
  );
}
