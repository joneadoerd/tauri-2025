'use client';
import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Label } from 'recharts';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';


export default function SerialMonitor() {
  const [ports, setPorts] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [baudRate, setBaudRate] = useState('115200');
  const [data, setData] = useState<string[]>([]);
  const parentRef = useRef<HTMLDivElement>(null);



  useEffect(() => {
    const loadPorts = async () => {
      const ports = await invoke<string[]>('get_available_ports');
      setPorts(ports);
    };
    loadPorts();
  }, []);

  useEffect(() => {
    const unlisten = listen<number[]>('serial-data', (event) => {
      const text = new TextDecoder().decode(new Uint8Array(event.payload));
      setData(prev => [...prev, text]);
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const handleConnect = async () => {
    if (isConnected) {
      await invoke('disconnect_serial');
    } else {
      const port = "com4"// Get selected port from UI
      await invoke('connect_serial', { portName: port, baudRate: parseInt(baudRate) });
    }
    setIsConnected(!isConnected);
  };

  return (
    <Card className="p-6">
      <div className="flex gap-4 mb-6 items-end">
        <div className="flex-1">
          <Label>Port</Label>
          <Select >
            <SelectTrigger>
              <SelectValue placeholder="Select port" />
            </SelectTrigger>
            <SelectContent>
              {ports.map(port => (
                <SelectItem  key={port} value={port}>{port}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="w-32">
          <Label>Baud Rate</Label>
          <Input
            type="number"
            value={baudRate}
            onChange={(e) => setBaudRate(e.target.value)}
          />
        </div>

        <Button onClick={handleConnect}>
          {isConnected ? 'Disconnect' : 'Connect'}
        </Button>
      </div>

      <div ref={parentRef} className="h-96 overflow-auto rounded border">

        
      </div>
    </Card>
  );
}