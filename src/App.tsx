import { useState } from "react";
import GraphCanvas from "./components/GraphCanvas";
import Toolbar from "./components/Toolbar";
import type { RdfProjection } from "./model/rdfGraphModel";

const EMPTY_PROJECTION: RdfProjection = { nodes: [], edges: [] };

export default function App() {
  const [projection, setProjection] = useState<RdfProjection>(EMPTY_PROJECTION);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Toolbar onLoaded={setProjection} />
      <div style={{ flex: 1 }}>
        <GraphCanvas projection={projection} />
      </div>
    </div>
  );
}
