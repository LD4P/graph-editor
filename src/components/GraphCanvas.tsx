import { useCallback, useEffect, useMemo, useRef } from "react";
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
import { layoutProjection } from "../lib/layout";
import ResourceNode, { type ResourceNodeData } from "./ResourceNode";
import ResourcePredicateEdge from "./ResourcePredicateEdge";
import { useGraphStore } from "../state/graphStore";
import { useDialogStore } from "../state/dialogStore";
import { addEdge, listPredicates } from "../lib/pyBridge";

const nodeTypes = { resource: ResourceNode };
const edgeTypes = { resourcePredicate: ResourcePredicateEdge };

export default function GraphCanvas() {
  const projection = useGraphStore((state) => state.projection);
  const positions = useGraphStore((state) => state.positions);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const setPosition = useGraphStore((state) => state.setPosition);
  const setProjection = useGraphStore((state) => state.setProjection);
  const selectNode = useGraphStore((state) => state.selectNode);
  const openDialog = useDialogStore((state) => state.openDialog);

  const { nodes, edges } = useMemo(
    () => layoutProjection(projection, positions, selectedNodeId),
    [projection, positions, selectedNodeId],
  );

  const instanceRef = useRef<ReactFlowInstance<Node<ResourceNodeData>, Edge> | null>(null);

  useEffect(() => {
    if (selectedNodeId && instanceRef.current) {
      instanceRef.current.fitView({ nodes: [{ id: selectedNodeId }], duration: 300 });
    }
  }, [selectedNodeId, nodes]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          setPosition(change.id, change.position);
        }
      }
    },
    [setPosition],
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => selectNode(node.id),
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
            placeholder: "http://example.org/knows",
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
