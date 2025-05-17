"use client";

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface Sub {
  id: string;
  topic: string;
}

export default function Setup() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [newId, setNewId] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const [messages, setMessages] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchSubs();
  }, []);

  const fetchSubs = async () => {
    const list: string[] = await invoke("list_subs");
    const restored = list.map((id) => ({ id, topic: '' })); // you can expand this later
    setSubs(restored);
  };

  const addSub = async () => {
    if (!newId || !newTopic) return;
    await invoke("add_sub", { id: newId, topic: newTopic });

    listen(`zmq-message-${newId}`, (event) => {
      setMessages((prev) => ({
        ...prev,
        [newId]: [...(prev[newId] || []), event.payload as string],
      }));
    });

    setSubs([...subs, { id: newId, topic: newTopic }]);
    setNewId('');
    setNewTopic('');
  };

  const removeSub = async (id: string) => {
    await invoke("remove_sub", { id });
    setSubs(subs.filter((s) => s.id !== id));
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Manage Subscriptions</h1>

      <div style={{ marginBottom: 20 }}>
        <input placeholder="ID" value={newId} onChange={(e) => setNewId(e.target.value)} />
        <input placeholder="Topic" value={newTopic} onChange={(e) => setNewTopic(e.target.value)} />
        <button onClick={addSub}>Add Subscription</button>
      </div>

      <div>
        {subs.map((sub) => (
          <div key={sub.id} style={{ marginBottom: 10, border: '1px solid #ccc', padding: 10 }}>
            <h3>ID: {sub.id}</h3>
            <p>Topic: {sub.topic}</p>
            <button onClick={() => removeSub(sub.id)}>Remove</button>
            <ul>
              {(messages[sub.id] || []).map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
