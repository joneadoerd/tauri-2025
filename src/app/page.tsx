'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface SensorData {
  sensor_id: string;
  value: number;
  timestamp: number;
}

function App() {
  const [sensors, setSensors] = useState<string[]>([]);
  const [sensorData, setSensorData] = useState<Record<string, SensorData>>({});
  const [command, setCommand] = useState('');

  useEffect(() => {
    // Load initial sensors
    invoke<string[]>('get_active_sensors').then(setSensors);

    // Listen for new sensor connections
    const unlistenConnect = listen<string>('sensor-connected', (event) => {
      setSensors(prev => [...prev, event.payload]);
    });

    // Listen for sensor disconnections
    const unlistenDisconnect = listen<string>('sensor-disconnected', (event) => {
      setSensors(prev => prev.filter(id => id !== event.payload));
      setSensorData(prev => {
        const newData = {...prev};
        delete newData[event.payload];
        return newData;
      });
    });

    // Listen for sensor data
    const unlistenData = listen<SensorData>('sensor-data', (event) => {
      setSensorData(prev => ({
        ...prev,
        [event.payload.sensor_id]: event.payload
      }));
    });

    return () => {
      unlistenConnect.then(f => f());
      unlistenDisconnect.then(f => f());
      unlistenData.then(f => f());
    };
  }, []);

  const sendCommand = (sensorId: string) => {
    invoke('send_command_to_sensor', { sensorId, command })
      .catch(console.error);
  };

  return (
    <div className="container">
      <h1>Sensor Dashboard</h1>
      
      <div className="sensors-list">
        <h2>Connected Sensors ({sensors.length})</h2>
        <ul>
          {sensors.map(sensor => (
            <li key={sensor}>
              {sensor} 
              {sensorData[sensor] && (
                <span> - Value: {sensorData[sensor].value.toFixed(2)}</span>
              )}
              <div>
                <input 
                  type="text" 
                  placeholder="Command" 
                  onChange={(e) => setCommand(e.target.value)}
                />
                <button onClick={() => sendCommand(sensor)}>Send</button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="data-visualization">
        <h2>Sensor Data</h2>
        {Object.entries(sensorData).map(([id, data]) => (
          <div key={id} className="sensor-data">
            <h3>{id}</h3>
            <p>Value: {data.value}</p>
            <p>Timestamp: {new Date(data.timestamp).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;