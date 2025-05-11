"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export function UDPForm() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    invoke("start_udp");
    
    const unlisten = listen<string>("udp_message", (event) => {
      setMessages(prev => [...prev, `Received: ${event.payload}`]);
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const sendMessage = async () => {
    if (message.trim()) {
      await invoke("send_udp_message", { message });
      setMessages(prev => [...prev, `Sent: ${message}`]);
      setMessage("");
    }
  };

  return (
    <Card className="w-[600px]">
      <CardHeader>
        <CardTitle>Real-Time UDP Communication</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid w-full gap-4">
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="message">Message</Label>
            <Input
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyUp={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Type a message..."
            />
          </div>
          <Button onClick={sendMessage}>Send Message</Button>
        </div>
      </CardContent>
      <CardFooter>
        <div className="w-full space-y-2">
          <h3 className="font-semibold">Messages:</h3>
          <div className="h-64 overflow-y-auto border rounded-lg p-2">
            {messages.map((msg, idx) => (
              <div key={idx} className="text-sm py-1">
                {msg}
              </div>
            ))}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}