import dagre from "@dagrejs/dagre";
import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { RdfProjection } from "../model/rdfGraphModel";
import type { LayoutMode, Position } from "../state/graphStore";
import type { ResourceNodeData } from "../components/ResourceNode";
import type { CbdGroupNodeData } from "../components/CbdGroupNode";
import { forceDirectedPositions, type ForceLayoutResult } from "./forceLayout";

const NODE_WIDTH = 220;
const NODE_HEIGHT = 120;
// Kept below half of `nodesep` so two adjacent groups' padded boxes can
// never touch, since dagre's compound clustering already keeps sibling
// clusters at least `nodesep` apart.
const GROUP_PADDING = 16;
const PREDICATE_ARROW = { type: MarkerType.ArrowClosed, width: 18, height: 18, color: "#b1b1b7" };

/**
 * Compute every node's top-left position. Nodes in `overridePositions` (the
 * ones the user has dragged) keep that position; the force layout also
 * arranges the rest around them, and warm-starts from `previousPositions`
 * (the `settled` positions it returned last time).
 */
export function computeLayoutPositions(
  projection: RdfProjection,
  mode: LayoutMode,
  overridePositions: Record<string, Position> = {},
  previousPositions: Record<string, Position> = {},
): Partial<ForceLayoutResult> & Pick<ForceLayoutResult, "positions"> {
  if (mode === "force") {
    return forceDirectedPositions(projection, overridePositions, previousPositions, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      groupPadding: GROUP_PADDING,
    });
  }
  return { positions: dagrePositions(projection, overridePositions) };
}

function dagrePositions(
  projection: RdfProjection,
  overridePositions: Record<string, Position>,
): Record<string, Position> {
  // Groups are disjoint (the backend merges any that share a member), so
  // every node has at most one group and can be given a single dagre
  // cluster parent. Compound clustering makes dagre keep sibling clusters
  // apart during layout, rather than us discovering overlap afterwards.
  const graph = new dagre.graphlib.Graph({ compound: true });
  graph.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 80 });
  graph.setDefaultEdgeLabel(() => ({}));

  const clusterIdByMember = new Map<string, string>();
  for (const group of projection.groups) {
    const clusterId = `cbd-group:${group.root}`;
    graph.setNode(clusterId, {});
    for (const memberId of group.members) {
      clusterIdByMember.set(memberId, clusterId);
    }
  }

  for (const node of projection.nodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    const clusterId = clusterIdByMember.get(node.id);
    if (clusterId) graph.setParent(node.id, clusterId);
  }
  for (const edge of projection.edges) {
    graph.setEdge(edge.source, edge.target);
  }

  dagre.layout(graph);

  const positions: Record<string, Position> = {};
  for (const node of projection.nodes) {
    const { x, y } = graph.node(node.id);
    positions[node.id] = overridePositions[node.id] ?? {
      x: x - NODE_WIDTH / 2,
      y: y - NODE_HEIGHT / 2,
    };
  }
  return positions;
}

export function buildFlowElements(
  projection: RdfProjection,
  positions: Record<string, Position>,
  selectedNodeId: string | null = null,
): {
  nodes: Node<ResourceNodeData | CbdGroupNodeData>[];
  edges: Edge[];
} {
  const nodes: Node<ResourceNodeData>[] = projection.nodes.map((node) => ({
    id: node.id,
    type: "resource",
    position: positions[node.id],
    selected: node.id === selectedNodeId,
    data: {
      iri: node.id,
      label: node.label,
      types: node.types,
      properties: node.properties,
    },
  }));

  const edges: Edge[] = projection.edges.map((edge) => ({
    id: edge.id,
    type: "resourcePredicate",
    source: edge.source,
    target: edge.target,
    // Arrowhead at the object end, so each edge reads subject -> predicate -> object.
    markerEnd: PREDICATE_ARROW,
    data: { predicate: edge.predicate, predicateIri: edge.predicateIri },
  }));

  const positionById = new Map(nodes.map((node) => [node.id, node.position]));

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
      data: { label: group.label },
    });
  }

  return { nodes: [...groupNodes, ...nodes], edges };
}
