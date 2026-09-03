import { useState } from "react";
import type { RdfProperty } from "../model/rdfGraphModel";
import { useGraphStore } from "../state/graphStore";
import { addProperty, addType, deleteNode, deleteProperty, renameNode, updateProperty } from "../lib/pyBridge";
import { BLANK_NODE_PREFIX, generateBlankNodeId } from "../lib/blankNodes";

const panelStyle: React.CSSProperties = {
  width: 280,
  borderLeft: "1px solid #ddd",
  padding: "0.75rem",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  fontSize: 12,
  overflowY: "auto",
};

// The Value input and its ghost-text overlay have to share a font and line box
// for the suggestion to sit exactly where the typed text ends.
const valueInputStyle: React.CSSProperties = {
  font: "inherit",
  boxSizing: "border-box",
  width: "100%",
  border: "1px solid #ccc",
  padding: "2px 4px",
};

const valueGhostStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  padding: "0 5px",
  font: "inherit",
  whiteSpace: "pre",
  overflow: "hidden",
  pointerEvents: "none",
};

export default function Inspector() {
  const projection = useGraphStore((state) => state.projection);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const setProjection = useGraphStore((state) => state.setProjection);
  const selectNode = useGraphStore((state) => state.selectNode);

  const [newIri, setNewIri] = useState("");
  const [typeIri, setTypeIri] = useState("");
  const [propPredicate, setPropPredicate] = useState("");
  const [propValue, setPropValue] = useState("");
  const [propValueSuggestion, setPropValueSuggestion] = useState<string | null>(null);
  const [propDatatype, setPropDatatype] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editDatatype, setEditDatatype] = useState("");
  const [editLanguage, setEditLanguage] = useState("");

  const node = projection.nodes.find((candidate) => candidate.id === selectedNodeId);

  if (!node) {
    return (
      <aside style={panelStyle}>
        <p>Select a node to edit it.</p>
      </aside>
    );
  }

  async function handleRename() {
    const trimmed = newIri.trim();
    if (!trimmed) return;
    setProjection(await renameNode(node!.id, trimmed));
    selectNode(trimmed);
    setNewIri("");
  }

  async function handleDeleteNode() {
    setProjection(await deleteNode(node!.id));
    selectNode(null);
  }

  async function handleAddType() {
    const trimmed = typeIri.trim();
    if (!trimmed) return;
    setProjection(await addType(node!.id, trimmed));
    setTypeIri("");
  }

  /** Offer a generated id as soon as the value is just the blank node notation. */
  function handlePropValueChange(next: string) {
    setPropValue(next);
    if (next !== BLANK_NODE_PREFIX) {
      setPropValueSuggestion(null);
    } else if (!propValueSuggestion) {
      setPropValueSuggestion(generateBlankNodeId(projection.nodes.map((candidate) => candidate.id)));
    }
  }

  function handlePropValueKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!propValueSuggestion) return;
    if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      setPropValue(propValueSuggestion);
      setPropValueSuggestion(null);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setPropValueSuggestion(null);
    }
  }

  async function handleAddProperty() {
    const predicate = propPredicate.trim();
    const value = propValue.trim();
    if (!predicate || !value) return;
    setProjection(await addProperty(node!.id, predicate, value, propDatatype.trim() || null, null));
    setPropPredicate("");
    setPropValue("");
    setPropValueSuggestion(null);
    setPropDatatype("");
  }

  function startEditingProperty(index: number, property: RdfProperty) {
    setEditingIndex(index);
    setEditValue(property.value);
    setEditDatatype(property.datatype ?? "");
    setEditLanguage(property.language ?? "");
  }

  function cancelEditingProperty() {
    setEditingIndex(null);
  }

  async function handleSaveProperty(property: RdfProperty) {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    setProjection(
      await updateProperty(
        node!.id,
        property.predicateIri,
        property.value,
        property.datatype,
        property.language,
        trimmed,
        editDatatype.trim() || null,
        editLanguage.trim() || null,
      ),
    );
    setEditingIndex(null);
  }

  async function handleDeleteProperty(property: RdfProperty) {
    setProjection(
      await deleteProperty(node!.id, property.predicateIri, property.value, property.datatype, property.language),
    );
  }

  return (
    <aside style={panelStyle}>
      <h3 style={{ margin: 0, wordBreak: "break-all", fontSize: 13 }}>{node.id}</h3>

      <label style={{ display: "flex", flexDirection: "column" }}>
        Rename to
        <input value={newIri} onChange={(event) => setNewIri(event.target.value)} placeholder={node.id} />
      </label>
      <button onClick={handleRename}>Rename</button>

      <hr style={{ width: "100%" }} />

      <label style={{ display: "flex", flexDirection: "column" }}>
        Add type (IRI)
        <input
          value={typeIri}
          onChange={(event) => setTypeIri(event.target.value)}
          placeholder="e.g. rdfs:Resource or full URI"
        />
      </label>
      <button onClick={handleAddType}>Add type</button>

      <hr style={{ width: "100%" }} />

      {node.properties.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {node.properties.map((property, index) =>
            editingIndex === index ? (
              <div
                key={`${property.predicateIri}-${index}`}
                style={{ display: "flex", flexDirection: "column", gap: 4, border: "1px solid #ddd", padding: 6 }}
              >
                <span style={{ color: "#555" }}>{property.predicate}</span>
                <input value={editValue} onChange={(event) => setEditValue(event.target.value)} placeholder="Value" autoFocus />
                <input
                  value={editDatatype}
                  onChange={(event) => setEditDatatype(event.target.value)}
                  placeholder="Datatype IRI (optional), e.g. xsd:date"
                />
                <input
                  value={editLanguage}
                  onChange={(event) => setEditLanguage(event.target.value)}
                  placeholder="Language tag (optional)"
                />
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => handleSaveProperty(property)}>Save</button>
                  <button onClick={cancelEditingProperty}>Cancel</button>
                </div>
              </div>
            ) : (
              <div
                key={`${property.predicateIri}-${index}`}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 4 }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  <span style={{ color: "#555" }}>{property.predicate}: </span>
                  {property.value}
                </span>
                <span style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button onClick={() => startEditingProperty(index, property)}>Edit</button>
                  <button onClick={() => handleDeleteProperty(property)}>×</button>
                </span>
              </div>
            ),
          )}
        </div>
      )}

      <label style={{ display: "flex", flexDirection: "column" }}>
        Predicate IRI
        <input
          value={propPredicate}
          onChange={(event) => setPropPredicate(event.target.value)}
          placeholder="e.g. rdfs:label or full URI"
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column" }}>
        Value
        <span style={{ position: "relative", display: "block" }}>
          <input
            value={propValue}
            onChange={(event) => handlePropValueChange(event.target.value)}
            onKeyDown={handlePropValueKeyDown}
            placeholder="text, or a URI/_:blank node to link a resource"
            style={valueInputStyle}
          />
          {propValueSuggestion && (
            <span style={valueGhostStyle} aria-hidden="true">
              <span style={{ color: "transparent" }}>{propValue}</span>
              <span style={{ color: "#999" }}>{propValueSuggestion.slice(propValue.length)}</span>
            </span>
          )}
        </span>
        {propValueSuggestion && (
          <span style={{ color: "#777", fontSize: 11 }}>Tab to accept, or keep typing your own id</span>
        )}
      </label>
      <label style={{ display: "flex", flexDirection: "column" }}>
        Datatype IRI (optional)
        <input
          value={propDatatype}
          onChange={(event) => setPropDatatype(event.target.value)}
          placeholder="e.g. xsd:date or full URI"
        />
      </label>
      <button onClick={handleAddProperty}>Add property</button>

      <hr style={{ width: "100%" }} />

      <button onClick={handleDeleteNode} style={{ color: "crimson" }}>
        Delete node
      </button>
    </aside>
  );
}
