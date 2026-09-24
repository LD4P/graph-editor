import { describe, expect, it } from "vitest";
import type { RdfProjection } from "../model/rdfGraphModel";
import { buildFlowElements, computeLayoutPositions } from "./layout";

function node(id: string) {
  return { id, label: id, types: [], properties: [] };
}

const projection: RdfProjection = {
  nodes: [node("a"), node("b"), node("c")],
  edges: [{ id: "a->b", source: "a", target: "b", predicate: "p", predicateIri: "ex:p" }],
  groups: [{ root: "a", label: "A", members: ["a", "b"] }],
};

describe("computeLayoutPositions", () => {
  it("returns settled positions to warm-start from in force mode", () => {
    const layout = computeLayoutPositions(projection, "force");
    expect(Object.keys(layout.positions).sort()).toEqual(["a", "b", "c"]);
    expect(layout.settled).toBeDefined();
  });

  it("uses dagre in dagre mode, with no settled positions", () => {
    const layout = computeLayoutPositions(projection, "dagre");
    expect(Object.keys(layout.positions).sort()).toEqual(["a", "b", "c"]);
    expect(layout.settled).toBeUndefined();
    // Left-to-right ranks: the edge's target sits to the right of its source.
    expect(layout.positions.b.x).toBeGreaterThan(layout.positions.a.x);
  });

  it.each(["force", "dagre"] as const)("honors dragged positions in %s mode", (mode) => {
    const dragged = { x: 999, y: -42 };
    const layout = computeLayoutPositions(projection, mode, { c: dragged });
    expect(layout.positions.c).toEqual(dragged);
  });
});

describe("buildFlowElements", () => {
  const positions = { a: { x: 0, y: 0 }, b: { x: 300, y: 50 }, c: { x: 800, y: 0 } };

  it("puts group boxes first, behind the resource nodes", () => {
    const { nodes } = buildFlowElements(projection, positions);
    expect(nodes.map((n) => n.id)).toEqual(["cbd-group:a", "a", "b", "c"]);
    expect(nodes[0]).toMatchObject({ type: "cbdGroup", zIndex: -1, draggable: false });
  });

  it("sizes each group box to enclose its members plus padding", () => {
    const { nodes } = buildFlowElements(projection, positions);
    const group = nodes[0];
    expect(group.position).toEqual({ x: -16, y: -16 });
    expect(group.style).toEqual({ width: 300 + 220 + 32, height: 50 + 120 + 32 });
  });

  it("marks only the selected node as selected", () => {
    const { nodes } = buildFlowElements(projection, positions, "b");
    const selected = nodes.filter((n) => n.selected).map((n) => n.id);
    expect(selected).toEqual(["b"]);
  });

  it("maps projection edges to predicate edges", () => {
    const { edges } = buildFlowElements(projection, positions);
    expect(edges).toEqual([
      {
        id: "a->b",
        type: "resourcePredicate",
        source: "a",
        target: "b",
        data: { predicate: "p", predicateIri: "ex:p" },
      },
    ]);
  });
});
