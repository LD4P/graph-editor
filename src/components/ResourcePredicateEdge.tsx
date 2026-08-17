import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";
import { addEdge, deleteEdge } from "../lib/pyBridge";
import { useGraphStore } from "../state/graphStore";
import { useDialogStore } from "../state/dialogStore";

export type ResourcePredicateEdgeData = {
  predicate: string;
  predicateIri: string;
};

export type ResourcePredicateEdge = Edge<ResourcePredicateEdgeData, "resourcePredicate">;

export default function ResourcePredicateEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  source,
  target,
  data,
}: EdgeProps<ResourcePredicateEdge>) {
  const setProjection = useGraphStore((state) => state.setProjection);
  const openDialog = useDialogStore((state) => state.openDialog);
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY });

  async function handleDelete(event: React.MouseEvent) {
    event.stopPropagation();
    if (!data) return;
    setProjection(await deleteEdge(source, data.predicateIri, target));
  }

  function handleEdit(event: React.MouseEvent) {
    event.stopPropagation();
    if (!data) return;
    openDialog({
      title: "Edit relationship",
      fields: [{ name: "predicate", label: "Predicate IRI", defaultValue: data.predicateIri }],
      onSubmit: async (values) => {
        if (!values.predicate || values.predicate === data.predicateIri) return;
        await deleteEdge(source, data.predicateIri, target);
        setProjection(await addEdge(source, values.predicate, target));
      },
    });
  }

  return (
    <>
      <BaseEdge path={edgePath} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 4,
            padding: "1px 4px",
            fontSize: 11,
            display: "flex",
            gap: 4,
            alignItems: "center",
            pointerEvents: "all",
          }}
        >
          <span onClick={handleEdit} style={{ cursor: "pointer" }} title="Click to edit predicate">
            {data?.predicate}
          </span>
          <button
            title="Remove relationship"
            onClick={handleDelete}
            style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }}
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
