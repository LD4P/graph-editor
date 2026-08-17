import { useMemo } from "react";
import { Background, Controls, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { RdfProjection } from "../model/rdfGraphModel";
import { layoutProjection } from "../lib/layout";
import ResourceNode from "./ResourceNode";

const nodeTypes = { resource: ResourceNode };

export default function GraphCanvas({
  projection,
}: {
  projection: RdfProjection;
}) {
  const { nodes, edges } = useMemo(
    () => layoutProjection(projection),
    [projection],
  );

  return (
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView>
      <Background />
      <Controls />
    </ReactFlow>
  );
}
