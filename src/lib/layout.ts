import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import type { RdfProjection } from "../model/rdfGraphModel";
import type { Position } from "../state/graphStore";
import type { ResourceNodeData } from "../components/ResourceNode";
import type { CbdGroupNodeData } from "../components/CbdGroupNode";

const NODE_WIDTH = 220;
const NODE_HEIGHT = 120;
const GROUP_PADDING = 24;

export function layoutProjection(
  projection: RdfProjection,
  overridePositions: Record<string, Position> = {},
  selectedNodeId: string | null = null,
): {
  nodes: Node<ResourceNodeData | CbdGroupNodeData>[];
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
    const override = overridePositions[node.id];
    const { x, y } = graph.node(node.id);
    const position = override ?? { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 };
    return {
      id: node.id,
      type: "resource",
      position,
      selected: node.id === selectedNodeId,
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
    type: "resourcePredicate",
    source: edge.source,
    target: edge.target,
    data: { predicate: edge.predicate, predicateIri: edge.predicateIri },
  }));

  const positionById = new Map(nodes.map((node) => [node.id, node.position]));
  const labelById = new Map(projection.nodes.map((node) => [node.id, node.label]));

  const groupNodes: Node<CbdGroupNodeData>[] = [];
  for (const group of projection.groups) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const memberId of group.members) {
      const position = positionById.get(memberId);
      if (!position) continue;
      minX = Math.min(minX, position.x);
      minY = Math.min(minY, position.y);
      maxX = Math.max(maxX, position.x + NODE_WIDTH);
      maxY = Math.max(maxY, position.y + NODE_HEIGHT);
    }
    if (!Number.isFinite(minX)) continue;
    groupNodes.push({
      id: `cbd-group:${group.root}`,
      type: "cbdGroup",
      position: { x: minX - GROUP_PADDING, y: minY - GROUP_PADDING },
      style: {
        width: maxX - minX + GROUP_PADDING * 2,
        height: maxY - minY + GROUP_PADDING * 2,
      },
      draggable: false,
      selectable: false,
      zIndex: -1,
      data: { label: labelById.get(group.root) ?? group.root },
    });
  }

  return { nodes: [...groupNodes, ...nodes], edges };
}
