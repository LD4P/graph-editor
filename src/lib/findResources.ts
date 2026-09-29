import type { RdfNode } from "../model/rdfGraphModel";

/**
 * Find nodes whose label or IRI contains `query` (case-insensitive).
 * Label-prefix matches rank first, then other label matches, then IRI-only
 * matches; ties keep the projection's order.
 */
export function findResources(nodes: RdfNode[], query: string, limit = 10): RdfNode[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const ranked: { node: RdfNode; rank: number; index: number }[] = [];
  nodes.forEach((node, index) => {
    const label = node.label.toLowerCase();
    let rank: number;
    if (label.startsWith(needle)) rank = 0;
    else if (label.includes(needle)) rank = 1;
    else if (node.id.toLowerCase().includes(needle)) rank = 2;
    else return;
    ranked.push({ node, rank, index });
  });
  ranked.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return ranked.slice(0, limit).map((entry) => entry.node);
}
