import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type OnConnect,
  type OnNodesChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { buildFlowElements, computeLayoutPositions } from "../lib/layout";
import ResourceNode, { type ResourceNodeData } from "./ResourceNode";
import CbdGroupNode, { type CbdGroupNodeData } from "./CbdGroupNode";
import ResourcePredicateEdge from "./ResourcePredicateEdge";
import { useGraphStore, type Position } from "../state/graphStore";
import { useDialogStore } from "../state/dialogStore";
import { addEdge, listPredicates } from "../lib/pyBridge";

const nodeTypes = { resource: ResourceNode, cbdGroup: CbdGroupNode };
const edgeTypes = { resourcePredicate: ResourcePredicateEdge };

export default function GraphCanvas() {
  const projection = useGraphStore((state) => state.projection);
  const positions = useGraphStore((state) => state.positions);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const layoutMode = useGraphStore((state) => state.layoutMode);
  const setPosition = useGraphStore((state) => state.setPosition);
  const setProjection = useGraphStore((state) => state.setProjection);
  const selectNode = useGraphStore((state) => state.selectNode);
  const openDialog = useDialogStore((state) => state.openDialog);

  // The last force layout, used to warm-start the next one so an edit only
  // nudges nearby nodes instead of reshuffling the graph.
  const previousForcePositions = useRef<Record<string, Position>>({});
  const layout = useMemo(
    () =>
      computeLayoutPositions(projection, layoutMode, positions, previousForcePositions.current),
    [projection, layoutMode, positions],
  );
  useEffect(() => {
    if (layout.settled) previousForcePositions.current = layout.settled;
  }, [layout]);

  // Positions of nodes mid-drag. They're only committed to the store (and so
  // re-run the layout) when the drag ends, not on every mouse move.
  const [dragPositions, setDragPositions] = useState<Record<string, Position>>({});

  // Sizes React Flow has measured for each node. Nodes are rebuilt from the
  // projection on every render, so these have to be passed back in or React
  // Flow treats every node as unmeasured (and warns when one is dragged).
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>(
    {},
  );

  const { nodes, edges } = useMemo(() => {
    const elements = buildFlowElements(
      projection,
      { ...layout.positions, ...dragPositions },
      selectedNodeId,
    );
    return {
      ...elements,
      nodes: elements.nodes.map((node) =>
        measured[node.id] ? { ...node, measured: measured[node.id] } : node,
      ),
    };
  }, [projection, layout, dragPositions, selectedNodeId, measured]);

  const instanceRef = useRef<ReactFlowInstance<
    Node<ResourceNodeData | CbdGroupNodeData>,
    Edge
  > | null>(null);

  useEffect(() => {
    if (selectedNodeId && instanceRef.current) {
      instanceRef.current.fitView({ nodes: [{ id: selectedNodeId }], duration: 300 });
    }
  }, [selectedNodeId, nodes]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      for (const change of changes) {
        if (change.type === "dimensions" && change.dimensions) {
          const { id, dimensions } = change;
          setMeasured((current) =>
            current[id]?.width === dimensions.width && current[id]?.height === dimensions.height
              ? current
              : { ...current, [id]: dimensions },
          );
          continue;
        }
        if (change.type !== "position" || !change.position) continue;
        const { id, position } = change;
        if (change.dragging) {
          setDragPositions((current) => ({ ...current, [id]: position }));
        } else {
          setPosition(id, position);
          setDragPositions((current) => {
            const next = { ...current };
            delete next[id];
            return next;
          });
        }
      }
    },
    [setPosition],
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type === "cbdGroup") return;
      selectNode(node.id);
    },
    [selectNode],
  );

  const onPaneClick = useCallback(() => selectNode(null), [selectNode]);

  const onConnect: OnConnect = useCallback(
    async (connection) => {
      const { source, target } = connection;
      if (!source || !target) return;
      const predicates = await listPredicates();
      openDialog({
        title: "Add relationship",
        fields: [
          {
            name: "predicate",
            label: "Predicate IRI",
            placeholder: "e.g. rdfs:seeAlso or http://example.org/knows",
            options: predicates,
          },
        ],
        onSubmit: async (values) => {
          if (!values.predicate) return;
          setProjection(await addEdge(source, values.predicate, target));
        },
      });
    },
    [openDialog, setProjection],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      onConnect={onConnect}
      onInit={(instance) => (instanceRef.current = instance)}
      fitView
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
