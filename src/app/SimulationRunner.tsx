import { useState } from "react";
import { simulation } from "@/lib/serial";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function SimulationRunner() {
  const [input, setInput] = useState(`{
  "targets": [
    {
      "id": 1,
      "init_state": {
        "vt": 500.0,
        "alpha": 0.05,
        "beta": 0.01,
        "phi": 0.0,
        "theta": 0.0,
        "psi": 0.0,
        "p": 0.0,
        "q": 0.0,
        "r": 0.0,
        "pn": 1000.0,
        "pe": 2000.0,
        "h": 10000.0,
        "pow": 5.0
      },
      "waypoints": [
        { "alt": 10000.0, "lat": 1000.0, "lon": 2000.0 },
        { "alt": 14000.0, "lat": 5000.0, "lon": 5000.0 },
        { "alt": 10200.0, "lat": 4000.0, "lon": 2400.0 },
        { "alt": 12000.0, "lat": 2000.0, "lon": 3000.0 }
      ]
    },
    {
      "id": 2,
      "init_state": {
        "vt": 520.0,
        "alpha": 0.04,
        "beta": 0.02,
        "phi": 0.1,
        "theta": 0.0,
        "psi": 0.2,
        "p": 0.0,
        "q": 0.0,
        "r": 0.0,
        "pn": 1500.0,
        "pe": 2500.0,
        "h": 11000.0,
        "pow": 6.0
      },
      "waypoints": [
        { "alt": 11000.0, "lat": 1500.0, "lon": 2500.0 },
        { "alt": 13000.0, "lat": 2500.0, "lon": 3500.0 }
      ]
    }
  ],
  "time_step": 0.01,
  "max_time": 20.0
}`);
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const runSimulation = async () => {
    setLoading(true);
    try {
      const result = await simulation(input);
      setOutput(result);
    } catch (e) {
      setOutput("Error: " + String(e));
    }
    setLoading(false);
  };

  return (
    <Card className="p-6 max-w-3xl mx-auto space-y-4">
      <Label>Simulation Input (JSON)</Label>
      <Textarea
        rows={16}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="font-mono"
      />
      <Button onClick={runSimulation} disabled={loading}>
        {loading ? "Running..." : "Run Simulation"}
      </Button>
      <Label>Simulation Output (JSON)</Label>
      <Textarea
        rows={16}
        value={output}
        readOnly
        className="font-mono bg-muted"
      />
    </Card>
  );
}
