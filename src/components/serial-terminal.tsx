'use client';
import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Input } from './ui/input';
import { Toggle } from './ui/toggle';
import { Button } from './ui/button';

export default function SerialTerminal() {
  const [isConnected, setIsConnected] = useState(false);
  const [baudRate, setBaudRate] = useState('115200');
  const [receivedData, setReceivedData] = useState<string[]>([]);
  const [sendMessage, setSendMessage] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen<number[]>('serial-data', (event) => {
      const text = new TextDecoder().decode(new Uint8Array(event.payload));
      setReceivedData(prev => [...prev, text]);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  useEffect(() => {
    if (autoScroll && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [receivedData, autoScroll]);

  const handleConnect = async () => {
    if (isConnected) {
        console.log('Disconnecting...');
      await invoke('disconnect_serial');
    } else {
      console.log('Connecting...');
      await invoke('connect_com4', { baudRate: parseInt(baudRate) });
    }
    setIsConnected(!isConnected);
  };

  const handleSend = async () => {
    if (!sendMessage.trim()) return;
    await invoke('send_to_com4', { data: sendMessage });
    setSendMessage('');
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex gap-4 items-center">
        <Input
          type="number"
          value={baudRate}
          onChange={(e) => setBaudRate(e.target.value)}
          className="w-32"
          disabled={isConnected}
        />
        <Button onClick={handleConnect}>
          {isConnected ? 'Disconnect' : 'Connect COM4'}
        </Button>
        <Toggle
          pressed={autoScroll}
          onPressedChange={setAutoScroll}
          aria-label="Auto scroll"
        >
          Auto Scroll
        </Toggle>
      </div>

      <div className="flex-1 overflow-auto bg-gray-900 text-green-400 p-4 rounded font-mono">
        {receivedData.map((data, i) => (
          <div key={i}>{data}</div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2">
        <Input
          value={sendMessage}
          onChange={(e) => setSendMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type message to send..."
        />
        <Button onClick={handleSend}>Send</Button>
      </div>
    </div>
  );
}