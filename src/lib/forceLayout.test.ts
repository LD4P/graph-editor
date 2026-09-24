import { describe, expect, it, vi } from "vitest";
import type { RdfProjection } from "../model/rdfGraphModel";
import type { Position } from "../state/graphStore";
import { forceDirectedPositions, removeOverlaps } from "./forceLayout";

const SIZE = { width: 220, height: 120, groupPadding: 16 };

function node(id: string) {
  return { id, label: id, types: [], properties: [] };
}

function edge(source: string, target: string) {
  return { id: `${source}->${target}`, source, target, predicate: "p", predicateIri: "ex:p" };
}

// `groupCount` CBDs, each a root with a chain of members hanging off it, with
// consecutive roots linked, plus one ungrouped node linked to the first root.
function clusteredProjection(groupCount: number, membersPerGroup: number): RdfProjection {
  const projection: RdfProjection = { nodes: [], edges: [], groups: [] };
  for (let g = 0; g < groupCount; g++) {
    const root = `g${g}`;
    const members = [root];
    projection.nodes.push(node(root));
    for (let m = 1; m < membersPerGroup; m++) {
      const id = `${root}_${m}`;
      projection.nodes.push(node(id));
      projection.edges.push(edge(m === 1 ? root : `${root}_${m - 1}`, id));
      members.push(id);
    }
    projection.groups.push({ root, label: root, members });
    if (g > 0) projection.edges.push(edge(`g${g - 1}`, root));
  }
  projection.nodes.push(node("loose"));
  projection.edges.push(edge("g0", "loose"));
  return projection;
}

function cardsOverlap(a: Position, b: Position) {
  return Math.abs(a.x - b.x) < SIZE.width && Math.abs(a.y - b.y) < SIZE.height;
}

function groupBox(positions: Record<string, Position>, members: string[]) {
  const xs = members.map((id) => positions[id].x);
  const ys = members.map((id) => positions[id].y);
  return {
    left: Math.min(...xs) - SIZE.groupPadding,
    top: Math.min(...ys) - SIZE.groupPadding,
    right: Math.max(...xs) + SIZE.width + SIZE.groupPadding,
    bottom: Math.max(...ys) + SIZE.height + SIZE.groupPadding,
  };
}

function maxMove(a: Record<string, Position>, b: Record<string, Position>) {
  return Math.max(...Object.keys(a).map((id) => Math.hypot(a[id].x - b[id].x, a[id].y - b[id].y)));
}

const distance = (a: Position, b: Position) => Math.hypot(a.x - b.x, a.y - b.y);

describe("forceDirectedPositions", () => {
  it("returns nothing for an empty graph", () => {
    const result = forceDirectedPositions({ nodes: [], edges: [], groups: [] }, {}, {}, SIZE);
    expect(result).toEqual({ positions: {}, settled: {} });
  });

  it("gives every node a finite position", () => {
    const projection = clusteredProjection(3, 4);
    const { positions } = forceDirectedPositions(projection, {}, {}, SIZE);
    expect(Object.keys(positions).sort()).toEqual(projection.nodes.map((n) => n.id).sort());
    for (const { x, y } of Object.values(positions)) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }
  });

  it("lays out the same graph the same way every time, even after a reload", async () => {
    const projection = clusteredProjection(4, 3);
    const first = forceDirectedPositions(projection, {}, {}, SIZE);
    expect(forceDirectedPositions(projection, {}, {}, SIZE)).toEqual(first);

    // A fresh copy of the module, as after a page reload.
    vi.resetModules();
    const reloaded = await import("./forceLayout");
    expect(reloaded.forceDirectedPositions(projection, {}, {}, SIZE)).toEqual(first);
  });

  it("keeps cards and CBD group boxes from overlapping", () => {
    const projection = clusteredProjection(10, 5);
    const { positions } = forceDirectedPositions(projection, {}, {}, SIZE);

    const ids = Object.keys(positions);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        expect(cardsOverlap(positions[ids[i]], positions[ids[j]]), `${ids[i]} / ${ids[j]}`).toBe(
          false,
        );
      }
    }

    const boxes = projection.groups.map((group) => groupBox(positions, group.members));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const [a, b] = [boxes[i], boxes[j]];
        const overlap =
          a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        expect(overlap, `group ${i} / group ${j}`).toBe(false);
      }
    }
  });

  it("keeps the ungrouped node outside every CBD group box", () => {
    const projection = clusteredProjection(3, 4);
    const { positions } = forceDirectedPositions(projection, {}, {}, SIZE);
    const loose = positions.loose;
    for (const group of projection.groups) {
      const box = groupBox(positions, group.members);
      const inside =
        loose.x < box.right &&
        loose.x + SIZE.width > box.left &&
        loose.y < box.bottom &&
        loose.y + SIZE.height > box.top;
      expect(inside, group.root).toBe(false);
    }
  });

  it("settles each CBD member closer to its own root than to any other root", () => {
    const projection = clusteredProjection(4, 4);
    const { positions } = forceDirectedPositions(projection, {}, {}, SIZE);
    for (const group of projection.groups) {
      for (const member of group.members) {
        const own = distance(positions[member], positions[group.root]);
        for (const other of projection.groups) {
          if (other === group) continue;
          expect(own, `${member} vs ${other.root}`).toBeLessThan(
            distance(positions[member], positions[other.root]),
          );
        }
      }
    }
  });

  it("leaves an unchanged graph in place when warm-started from the settled positions", () => {
    const projection = clusteredProjection(10, 5);
    const first = forceDirectedPositions(projection, {}, {}, SIZE);
    const second = forceDirectedPositions(projection, {}, first.settled, SIZE);
    expect(maxMove(first.positions, second.positions)).toBeLessThan(5);
  });

  it("keeps the arrangement it was warm-started from rather than laying out afresh", () => {
    // A mirror image of a settled layout is also at rest, so warm-starting
    // from it should keep it mirrored instead of flipping back.
    const projection = clusteredProjection(3, 4);
    const first = forceDirectedPositions(projection, {}, {}, SIZE);
    const mirror = (positions: Record<string, Position>) =>
      Object.fromEntries(
        Object.entries(positions).map(([id, { x, y }]) => [id, { x: -x - SIZE.width, y }]),
      );
    const second = forceDirectedPositions(projection, {}, mirror(first.settled), SIZE);
    expect(maxMove(second.positions, mirror(first.positions))).toBeLessThan(5);
  });

  it("places a newly added node near the node it links to", () => {
    const projection = clusteredProjection(3, 4);
    const first = forceDirectedPositions(projection, {}, {}, SIZE);

    projection.nodes.push(node("new"));
    projection.edges.push(edge("g2", "new"));
    const second = forceDirectedPositions(projection, {}, first.settled, SIZE);

    const newToLinked = distance(second.positions.new, second.positions.g2);
    for (const id of Object.keys(first.positions)) {
      if (id === "g2") continue;
      expect(newToLinked, id).toBeLessThanOrEqual(
        distance(second.positions.new, second.positions[id]) + SIZE.width,
      );
    }
  });

  it("keeps pinned nodes exactly where they were dropped", () => {
    const projection = clusteredProjection(3, 4);
    const first = forceDirectedPositions(projection, {}, {}, SIZE);
    const pins = {
      g0: { x: first.positions.g0.x + 500, y: first.positions.g0.y + 300 },
      g1_2: { x: -1234.5, y: 678.25 },
    };
    const { positions, settled } = forceDirectedPositions(projection, pins, first.settled, SIZE);
    expect(positions.g0).toEqual(pins.g0);
    expect(positions.g1_2).toEqual(pins.g1_2);
    expect(settled.g0).toEqual(pins.g0);
  });

  it("moves unpinned nodes out from under a pinned one instead of moving the pin", () => {
    const projection: RdfProjection = {
      nodes: [node("a"), node("b")],
      edges: [edge("a", "b")],
      groups: [],
    };
    const first = forceDirectedPositions(projection, {}, {}, SIZE);
    // Drop "a" right on top of where "b" settled.
    const pins = { a: first.positions.b };
    const { positions } = forceDirectedPositions(projection, pins, first.settled, SIZE);
    expect(positions.a).toEqual(pins.a);
    expect(cardsOverlap(positions.a, positions.b)).toBe(false);
  });

  it("copes with self-loops, duplicate edges, and edges to unknown nodes", () => {
    const projection: RdfProjection = {
      nodes: [node("a"), node("b")],
      edges: [edge("a", "a"), edge("a", "b"), edge("b", "a"), edge("a", "missing")],
      groups: [{ root: "a", label: "a", members: ["a", "b", "missing"] }],
    };
    const { positions } = forceDirectedPositions(projection, {}, {}, SIZE);
    expect(Object.keys(positions).sort()).toEqual(["a", "b"]);
    expect(cardsOverlap(positions.a, positions.b)).toBe(false);
  });

  it("runs the overlap pass on the simulated positions", () => {
    // Two pinned cards that already touch can't be separated, so the only
    // way their neighbour ends up clear of both is the overlap pass.
    const projection: RdfProjection = {
      nodes: [node("a"), node("b"), node("c")],
      edges: [edge("a", "c"), edge("b", "c")],
      groups: [],
    };
    const pins = { a: { x: 0, y: 0 }, b: { x: 0, y: 200 } };
    const { positions } = forceDirectedPositions(projection, pins, { c: { x: 0, y: 100 } }, SIZE);
    expect(cardsOverlap(positions.c, positions.a)).toBe(false);
    expect(cardsOverlap(positions.c, positions.b)).toBe(false);
  });

  it("separates nodes that start at exactly the same position", () => {
    const projection: RdfProjection = { nodes: [node("a"), node("b")], edges: [], groups: [] };
    const same = { x: 100, y: 100 };
    const { positions } = forceDirectedPositions(projection, {}, { a: same, b: same }, SIZE);
    for (const { x, y } of Object.values(positions)) {
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
    }
    expect(cardsOverlap(positions.a, positions.b)).toBe(false);
  });
});

describe("removeOverlaps", () => {
  const GAP = 24;

  function overlapsWithGap(a: Position, b: Position) {
    return Math.abs(a.x - b.x) < SIZE.width + GAP && Math.abs(a.y - b.y) < SIZE.height + GAP;
  }

  it("pushes overlapping ungrouped cards apart, leaving the gap between them", () => {
    const projection: RdfProjection = { nodes: [node("a"), node("b")], edges: [], groups: [] };
    const positions = { a: { x: 0, y: 0 }, b: { x: 50, y: 10 } };
    removeOverlaps(projection, positions, {}, SIZE);
    expect(overlapsWithGap(positions.a, positions.b)).toBe(false);
    // The move is split between the two cards.
    expect(positions.a.x + positions.a.y).toBeLessThan(0);
    expect(positions.b.x + positions.b.y).toBeGreaterThan(60);
  });

  it("only moves the unpinned card when one of them is pinned", () => {
    const projection: RdfProjection = { nodes: [node("a"), node("b")], edges: [], groups: [] };
    const pinned = { a: { x: 0, y: 0 } };
    const positions = { a: { ...pinned.a }, b: { x: 50, y: 10 } };
    removeOverlaps(projection, positions, pinned, SIZE);
    expect(positions.a).toEqual(pinned.a);
    expect(overlapsWithGap(positions.a, positions.b)).toBe(false);
  });

  it("leaves two pinned cards alone even when they overlap", () => {
    const projection: RdfProjection = { nodes: [node("a"), node("b")], edges: [], groups: [] };
    const pinned = { a: { x: 0, y: 0 }, b: { x: 10, y: 10 } };
    const positions = { a: { ...pinned.a }, b: { ...pinned.b } };
    removeOverlaps(projection, positions, pinned, SIZE);
    expect(positions).toEqual(pinned);
  });

  it("separates cards within a group, then moves whole groups apart", () => {
    const projection: RdfProjection = {
      nodes: [node("a1"), node("a2"), node("b1"), node("b2")],
      edges: [],
      groups: [
        { root: "a1", label: "A", members: ["a1", "a2"] },
        { root: "b1", label: "B", members: ["b1", "b2"] },
      ],
    };
    const positions = {
      a1: { x: 0, y: 0 },
      a2: { x: 20, y: 0 },
      b1: { x: 100, y: 30 },
      b2: { x: 400, y: 30 },
    };
    removeOverlaps(projection, positions, {}, SIZE);

    expect(overlapsWithGap(positions.a1, positions.a2)).toBe(false);
    const a = groupBox(positions, ["a1", "a2"]);
    const b = groupBox(positions, ["b1", "b2"]);
    const boxesOverlap = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    expect(boxesOverlap).toBe(false);
    // Group B moved as one piece: its members kept their spacing.
    expect(positions.b2.x - positions.b1.x).toBe(300);
    expect(positions.b2.y - positions.b1.y).toBe(0);
  });

  it("never moves a group that holds a pinned card", () => {
    const projection: RdfProjection = {
      nodes: [node("a1"), node("a2"), node("loose")],
      edges: [],
      groups: [{ root: "a1", label: "A", members: ["a1", "a2"] }],
    };
    const pinned = { a2: { x: 400, y: 0 } };
    const positions = { a1: { x: 0, y: 0 }, a2: { ...pinned.a2 }, loose: { x: 200, y: 20 } };
    removeOverlaps(projection, positions, pinned, SIZE);
    expect(positions.a1).toEqual({ x: 0, y: 0 });
    expect(positions.a2).toEqual(pinned.a2);
    const box = groupBox(positions, ["a1", "a2"]);
    const looseInside =
      positions.loose.x < box.right &&
      positions.loose.x + SIZE.width > box.left &&
      positions.loose.y < box.bottom &&
      positions.loose.y + SIZE.height > box.top;
    expect(looseInside).toBe(false);
  });
});
