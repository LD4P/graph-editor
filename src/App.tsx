import { useCallback, useState } from "react";
import { Background, Controls, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ping } from "./lib/pyBridge";

export default function App() {
  const [pingResult, setPingResult] = useState("not called yet");
  const [loading, setLoading] = useState(false);

  const handlePing = useCallback(async () => {
    setLoading(true);
    try {
      setPingResult(await ping());
    } catch (err) {
      setPingResult(`error: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header style={{ padding: "0.5rem 1rem", borderBottom: "1px solid #ddd" }}>
        <button onClick={handlePing} disabled={loading}>
          {loading ? "pinging..." : "Ping Python worker"}
        </button>
        <span style={{ marginLeft: "1rem" }}>{pingResult}</span>
      </header>
      <div style={{ flex: 1 }}>
        <ReactFlow nodes={[]} edges={[]} fitView>
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
