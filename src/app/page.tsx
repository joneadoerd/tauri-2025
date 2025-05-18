'use client';
import React, { useState, useEffect } from 'react';
import ZmqTab from './ZmqTab';
import { SerialTab } from './SerialTab';


export default function App() {
  const [activeTab, setActiveTab] = useState<'zmq' | 'serial'>('serial');

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="flex gap-4 mb-4">
        <button
          className={`px-4 py-2 rounded ${activeTab === 'zmq' ? 'bg-blue-500 text-white' : 'bg-white border'}`}
          onClick={() => setActiveTab('zmq')}
        >
          ZMQ
        </button>
        <button
          className={`px-4 py-2 rounded ${activeTab === 'serial' ? 'bg-blue-500 text-white' : 'bg-white border'}`}
          onClick={() => setActiveTab('serial')}
        >
          Serial
        </button>
      </div>
      <div>
        {activeTab === 'zmq' ? <ZmqTab /> : <SerialTab />}
      </div>
    </div>
  );
}
