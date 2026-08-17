import { useRef, useState } from "react";
import { validateShacl } from "../lib/pyBridge";
import { FORMATS } from "../lib/rdfFormats";
import { useGraphStore } from "../state/graphStore";
import { usePanelStore } from "../state/panelStore";
import type { ShaclValidationResult } from "../model/rdfGraphModel";

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

export default function ValidationPanel() {
  const selectNode = useGraphStore((state) => state.selectNode);
  const validationPanelOpen = usePanelStore((state) => state.validationPanelOpen);
  const toggleValidationPanel = usePanelStore((state) => state.toggleValidationPanel);

  const [shapesText, setShapesText] = useState("");
  const [format, setFormat] = useState("turtle");
  const [result, setResult] = useState<ShaclValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!validationPanelOpen) return null;

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setShapesText(await file.text());
  }

  async function handleValidate() {
    setLoading(true);
    setError(null);
    try {
      setResult(await validateShacl(shapesText, format));
    } catch (err) {
      setError(String(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: 13 }}>SHACL Validation</h3>
        <button onClick={toggleValidationPanel}>Close</button>
      </div>

      <label style={{ display: "flex", flexDirection: "column" }}>
        Shapes format
        <select value={format} onChange={(event) => setFormat(event.target.value)}>
          {FORMATS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button onClick={() => fileInputRef.current?.click()}>Load shapes file...</button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".ttl,.turtle,.rdf,.xml,.jsonld,.json,.nt"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <textarea
        value={shapesText}
        onChange={(event) => setShapesText(event.target.value)}
        rows={8}
        placeholder="Paste SHACL shapes here..."
        style={{ fontFamily: "monospace", fontSize: 11 }}
      />

      <button onClick={handleValidate} disabled={loading || !shapesText.trim()}>
        {loading ? "Validating..." : "Validate"}
      </button>

      {error && <span style={{ color: "crimson" }}>{error}</span>}

      {result && (
        <>
          <hr style={{ width: "100%" }} />
          {result.conforms ? (
            <p style={{ color: "seagreen" }}>✓ Conforms — no violations.</p>
          ) : (
            <p style={{ color: "crimson" }}>
              ✗ {result.violations.length} violation(s) found.
            </p>
          )}
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {result.violations.map((violation, index) => (
              <li key={index} style={{ marginBottom: 8 }}>
                <button
                  onClick={() => violation.focusNode && selectNode(violation.focusNode)}
                  disabled={!violation.focusNode}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "4px 6px",
                    border: "1px solid #ddd",
                  }}
                >
                  <strong>{violation.severity ?? "Violation"}</strong>
                  {violation.path && <> on {violation.path}</>}
                  <br />
                  {violation.message ?? "No message provided."}
                  {violation.focusNode && (
                    <>
                      <br />
                      <span style={{ wordBreak: "break-all", color: "#555" }}>
                        {violation.focusNode}
                      </span>
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
