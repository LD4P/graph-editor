import { useEffect, useState } from "react";
import { listNamespaces, setNamespace } from "../lib/pyBridge";
import { useGraphStore } from "../state/graphStore";
import { usePanelStore } from "../state/panelStore";
import type { RdfNamespace } from "../model/rdfGraphModel";

const panelStyle: React.CSSProperties = {
  width: 320,
  borderLeft: "1px solid #ddd",
  padding: "0.75rem",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  fontSize: 12,
  overflowY: "auto",
};

export default function NamespacePanel() {
  const setProjection = useGraphStore((state) => state.setProjection);
  const namespacePanelOpen = usePanelStore((state) => state.namespacePanelOpen);
  const toggleNamespacePanel = usePanelStore((state) => state.toggleNamespacePanel);

  const [namespaces, setNamespaces] = useState<RdfNamespace[]>([]);
  const [prefix, setPrefix] = useState("");
  const [uri, setUri] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (namespacePanelOpen) {
      listNamespaces().then(setNamespaces).catch((err) => setError(String(err)));
    }
  }, [namespacePanelOpen]);

  if (!namespacePanelOpen) return null;

  async function handleSave() {
    const trimmedPrefix = prefix.trim();
    const trimmedUri = uri.trim();
    if (!trimmedPrefix || !trimmedUri) return;
    setError(null);
    try {
      const result = await setNamespace(trimmedPrefix, trimmedUri);
      setProjection(result.projection);
      setNamespaces(result.namespaces);
      setPrefix("");
      setUri("");
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <aside style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: 13 }}>Namespaces</h3>
        <button onClick={toggleNamespacePanel}>Close</button>
      </div>

      <label style={{ display: "flex", flexDirection: "column" }}>
        Prefix
        <input value={prefix} onChange={(event) => setPrefix(event.target.value)} placeholder="ex" />
      </label>
      <label style={{ display: "flex", flexDirection: "column" }}>
        Namespace URI
        <input
          value={uri}
          onChange={(event) => setUri(event.target.value)}
          placeholder="http://example.org/"
        />
      </label>
      <button onClick={handleSave}>Add / update prefix</button>

      {error && <span style={{ color: "crimson" }}>{error}</span>}

      <hr style={{ width: "100%" }} />

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {namespaces.map((entry) => (
          <li key={entry.prefix} style={{ marginBottom: 4 }}>
            <button
              onClick={() => {
                setPrefix(entry.prefix);
                setUri(entry.uri);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "4px 6px",
                border: "1px solid #ddd",
              }}
            >
              <strong>{entry.prefix}</strong>: <span style={{ wordBreak: "break-all" }}>{entry.uri}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
