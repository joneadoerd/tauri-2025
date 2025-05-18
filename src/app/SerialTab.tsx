'use client';
import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function SerialTab() {
  const [ports, setPorts] = useState<string[]>([]);
  const [selectedPort, setSelectedPort] = useState('');
  const [baudRate, setBaudRate] = useState('115200');
  const [connected, setConnected] = useState(false);
  const [json, setJson] = useState('');
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    invoke<string[]>('list_ports').then(setPorts).catch(console.error);
  }, []);

  const connect = async () => {
    await invoke('start_serial', {
      portName: selectedPort,
      baudRate: parseInt(baudRate),
    });
    setConnected(true);
  };

  const disconnect = async () => {
    await invoke('disconnect');
    setConnected(false);
  };

  const send = async () => {
    if (!isValidJson()) {
      setLog((prev) => [...prev, `Invalid JSON: ${json}`]);
      return;
    }
    await invoke('send_data', { json });
    setLog((prev) => [...prev, `Sent: ${json}`]);
  };
const isValidJson = () => {
  try {
    JSON.parse(json);
    return true;
  } catch {
    return false;
  }
};
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <select value={selectedPort} onChange={(e) => setSelectedPort(e.target.value)} className="border p-2">
          <option value="">Select Port</option>
          {ports.map((port, i) => (
            <option key={i} value={port}>{port}</option>
          ))}
        </select>
        <input type="number" value={baudRate} onChange={(e) => setBaudRate(e.target.value)} className="border p-2 w-32" />
        {connected ? (
          <button onClick={disconnect} className="bg-red-500 text-white px-4 py-2 rounded">Disconnect</button>
        ) : (
          <button onClick={connect} className="bg-blue-500 text-white px-4 py-2 rounded">Connect</button>
        )}
      </div>

      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        placeholder='{ "id": 1, "length": 2, "checksum": 3, "version": 4, "flags": 5 }'
        className="border p-2 w-full h-24"
      />
      <button onClick={send} disabled={!connected} className="bg-green-500 text-white px-4 py-2 rounded">Send</button>

      <div className="bg-white p-2 border h-40 overflow-auto text-sm">
        {log.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}
