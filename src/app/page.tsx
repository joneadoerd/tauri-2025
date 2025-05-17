"use client";

import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export default function Setup() {
  const [subs, setSubs] = useState<{ id: string; topic: string }[]>([]);
  const [messages, setMessages] = useState<Record<string, string[]>>({});
  const listenerMap = useRef<Record<string, UnlistenFn>>({}); // 🔁 prevent duplicate listen

  const loadSubs = async () => {
    const list = (await invoke('list_subs')) as [string, string][];
    setSubs(list.map(([id, topic]) => ({ id, topic })));

    // Attach listeners only if not already attached
    await Promise.all(
      list.map(async ([id]) => {
        if (!listenerMap.current[id]) {
          const unlisten = await listen(`zmq-message-${id}`, (event) => {
            setMessages((prev) => ({
              ...prev,
              [id]: [...(prev[id] || []), event.payload as string],
            }));
          });

          listenerMap.current[id] = unlisten;
        }
      })
    );
  };

  useEffect(() => {
    invoke('init_zmq');
    loadSubs();

    return () => {
      // Clean up listeners if needed on unmount
      Object.values(listenerMap.current).forEach((unlisten) => unlisten());
      listenerMap.current = {};
    };
  }, []);

  const handleAdd = async () => {
    const ok = await invoke('add_sub', { id: newId, topic: newTopic });
    if (ok) {
      await loadSubs();
      setNewId('');
      setNewTopic('');
    }
  };

  const handleRemove = async (id: string) => {
    await invoke('remove_sub', { id });

    if (listenerMap.current[id]) {
      await listenerMap.current[id](); // unlisten
      delete listenerMap.current[id];
    }

    await loadSubs();
  };

  const [newId, setNewId] = useState('');
  const [newTopic, setNewTopic] = useState('');

  return (
    <div style={{ padding: 20 }}>
      <h1>Setup Subscriptions</h1>
      <div>
        <input
          placeholder="ID"
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
        />
        <input
          placeholder="Topic"
          value={newTopic}
          onChange={(e) => setNewTopic(e.target.value)}
        />
        <button onClick={handleAdd}>Add Subscription</button>
      </div>

      <h2>Current Subs</h2>
      {subs.map((sub) => (
        <div key={sub.id} style={{ marginBottom: 20, padding: 10, border: '1px solid gray' }}>
          <strong>ID:</strong> {sub.id} <br />
          <strong>Topic:</strong> {sub.topic}
          <button style={{ marginLeft: 10 }} onClick={() => handleRemove(sub.id)}>Remove</button>

          <ul>
            {(messages[sub.id] || []).map((msg, idx) => (
              <li key={idx}>{msg}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}