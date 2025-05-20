"use client";

import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";

export default function Setup() {
  const [messages, setMessages] = useState<Record<string, string[]>>({});
  const listenerMap = useRef<Record<string, UnlistenFn>>({}); // 🔁 prevent duplicate listen
  const [subs, setSubs] = useState<
    { id: string; topic: string; connected: boolean }[]
  >([]);

  const loadSubs = async () => {
    const list = (await invoke("list_subs_with_status")) as [
      string,
      string,
      boolean
    ][];
    console.log("list_subs_with_status", list);
    setSubs(list.map(([id, topic, connected]) => ({ id, topic, connected })));

    // Attach listeners only if not already attached
    await Promise.all(
      list.map(async ([id]) => {
        if (!listenerMap.current[id]) {
          const unlisten = await listen(`zmq-message-${id}`, (event) => {
            setMessages((prev) => ({
              ...prev,
              [id]: [
                ...(prev[id] || []),
                JSON.stringify(event.payload).toString(),
              ],
            }));
          });

          listenerMap.current[id] = unlisten;
        }
      })
    );
  };

  useEffect(() => {
    invoke("init_zmq");
    loadSubs();

    return () => {
      // Clean up listeners if needed on unmount
      Object.values(listenerMap.current).forEach((unlisten) => unlisten());
      listenerMap.current = {};
    };
  }, []);

  const handleAdd = async () => {
    const ok = await invoke("add_sub", { id: newId, topic: newTopic });
    if (ok) {
      await loadSubs();
      setNewId("");
      setNewTopic("");
    }
  };

  const handleRemove = async (id: string) => {
    await invoke("remove_sub", { id });

    if (listenerMap.current[id]) {
      await listenerMap.current[id](); // unlisten
      delete listenerMap.current[id];
    }

    await loadSubs();
  };

  const [newId, setNewId] = useState("");
  const [newTopic, setNewTopic] = useState("");

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold mb-4">Setup Subscriptions</h1>
      <Card className="p-4 flex flex-col md:flex-row gap-4 items-center mb-6">
        <Input
          placeholder="ID"
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
          className="max-w-xs"
        />
        <Input
          placeholder="Topic"
          value={newTopic}
          onChange={(e) => setNewTopic(e.target.value)}
          className="max-w-xs"
        />
        <Button onClick={handleAdd} className="w-full md:w-auto">
          Add Subscription
        </Button>
      </Card>

      <h2 className="text-xl font-semibold mb-2">Current Subs</h2>
      <div className="space-y-4">
        {subs.map((sub) => (
          <Card key={sub.id} className="p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Badge variant={sub.connected ? "default" : "destructive"}>
                  {sub.connected ? "Connected" : "Disconnected"}
                </Badge>
                <span className="font-semibold">ID:</span> {sub.id}
                <Separator orientation="vertical" className="mx-2 h-6" />
                <span className="font-semibold">Topic:</span> {sub.topic}
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleRemove(sub.id)}
              >
                Remove
              </Button>
            </div>
            <Separator className="my-2" />
            <div className="max-h-40 overflow-y-auto text-sm font-mono bg-muted rounded p-2">
              <ul className="space-y-1">
                {(messages[sub.id] || []).map((msg, idx) => (
                  <li key={idx}>{msg}</li>
                ))}
              </ul>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
