import { useGraphStore } from "../state/graphStore";

export default function StatusBar() {
  const nodeCount = useGraphStore((state) => state.projection.nodes.length);
  const edgeCount = useGraphStore((state) => state.projection.edges.length);

  return (
    <footer
      style={{
        flexShrink: 0,
        borderTop: "1px solid #ddd",
        padding: "6px 12px",
        background: "#f8f9fa",
        color: "#444",
        fontSize: 12,
      }}
    >
      <span role="status" aria-live="polite" aria-atomic="true">
        {nodeCount} {nodeCount === 1 ? "node" : "nodes"}
        {" | "}
        {edgeCount} {edgeCount === 1 ? "edge" : "edges"}
      </span>
    </footer>
  );
}
