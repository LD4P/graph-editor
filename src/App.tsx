import GraphCanvas from "./components/GraphCanvas";
import Toolbar from "./components/Toolbar";
import Inspector from "./components/Inspector";
import ValidationPanel from "./components/ValidationPanel";
import NamespacePanel from "./components/NamespacePanel";
import AutosaveBanner from "./components/AutosaveBanner";
import Dialog from "./components/Dialog";
import StatusBar from "./components/StatusBar";

export default function App() {
  return (
    <div style={{ display: "flex", flexDirection: "column", position: "fixed", inset: 0 }}>
      <Toolbar />
      <AutosaveBanner />
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ flex: 1 }}>
          <GraphCanvas />
        </div>
        <Inspector />
        <ValidationPanel />
        <NamespacePanel />
      </div>
      <StatusBar />
      <Dialog />
    </div>
  );
}
