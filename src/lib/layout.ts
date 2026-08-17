import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import type { RdfProjection } from "../model/rdfGraphModel";
import type { ResourceNodeData } from "../components/ResourceNode";

const NODE_WIDTH = 220;
const NODE_HEIGHT = 120;

export function layoutProjection(projection: RdfProjection): {
  nodes: Node<ResourceNodeData>[];
  edges: Edge[];
} {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 80 });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of projection.nodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of projection.edges) {
    graph.setEdge(edge.source, edge.target);
  }

  dagre.layout(graph);

  const nodes: Node<ResourceNodeData>[] = projection.nodes.map((node) => {
    const { x, y } = graph.node(node.id);
    return {
      id: node.id,
      type: "resource",
      position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 },
      data: {
        iri: node.id,
        label: node.label,
        types: node.types,
        properties: node.properties,
      },
    };
  });

  const edges: Edge[] = projection.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.predicate,
  }));

  return { nodes, edges };
}
