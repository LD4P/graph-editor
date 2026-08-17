import { useState } from "react";
import { useGraphStore } from "../state/graphStore";
import { addProperty, addType, deleteNode, renameNode } from "../lib/pyBridge";

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

export default function Inspector() {
  const projection = useGraphStore((state) => state.projection);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const setProjection = useGraphStore((state) => state.setProjection);
  const selectNode = useGraphStore((state) => state.selectNode);

  const [newIri, setNewIri] = useState("");
  const [typeIri, setTypeIri] = useState("");
  const [propPredicate, setPropPredicate] = useState("");
  const [propValue, setPropValue] = useState("");

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

  async function handleAddProperty() {
    const predicate = propPredicate.trim();
    const value = propValue.trim();
    if (!predicate || !value) return;
    setProjection(await addProperty(node!.id, predicate, value, null, null));
    setPropPredicate("");
    setPropValue("");
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
        <input value={typeIri} onChange={(event) => setTypeIri(event.target.value)} />
      </label>
      <button onClick={handleAddType}>Add type</button>

      <hr style={{ width: "100%" }} />

      <label style={{ display: "flex", flexDirection: "column" }}>
        Predicate IRI
        <input value={propPredicate} onChange={(event) => setPropPredicate(event.target.value)} />
      </label>
      <label style={{ display: "flex", flexDirection: "column" }}>
        Value
        <input value={propValue} onChange={(event) => setPropValue(event.target.value)} />
      </label>
      <button onClick={handleAddProperty}>Add property</button>

      <hr style={{ width: "100%" }} />

      <button onClick={handleDeleteNode} style={{ color: "crimson" }}>
        Delete node
      </button>
    </aside>
  );
}
