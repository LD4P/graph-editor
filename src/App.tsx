import GraphCanvas from "./components/GraphCanvas";
import Toolbar from "./components/Toolbar";
import Inspector from "./components/Inspector";
import ValidationPanel from "./components/ValidationPanel";
import Dialog from "./components/Dialog";

export default function App() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Toolbar />
      <div style={{ flex: 1, display: "flex" }}>
        <div style={{ flex: 1 }}>
          <GraphCanvas />
        </div>
        <Inspector />
        <ValidationPanel />
      </div>
      <Dialog />
    </div>
  );
}
