import type { RdfProjection } from "../model/rdfGraphModel";
import type { Position } from "../state/graphStore";

export interface NodeBoxSize {
  width: number;
  height: number;
  groupPadding: number;
}

export interface ForceLayoutResult {
  // Top-left position of every node's card, with overlaps removed.
  positions: Record<string, Position>;
  // Where the simulation came to rest, before overlaps were removed. Pass
  // this back as `previousPositions` on the next run: it's already in
  // equilibrium, so an unchanged graph doesn't move at all.
  settled: Record<string, Position>;
}

// Physics follows Springy's ForceDirected layout
// (https://github.com/dhotson/springy): Coulomb repulsion between every pair
// of nodes, Hooke springs along edges, a weak pull toward the origin, and
// damped Euler integration until the graph stops moving. The constants are
// Springy's defaults and run in its abstract units, where a spring's rest
// length is 1. One change: Springy stops when the *total* kinetic energy
// drops below the threshold, which a large graph may never reach, so here
// the threshold applies to the average energy per node.
const STIFFNESS = 400;
const REPULSION = 400;
const DAMPING = 0.5;
const TIMESTEP = 0.03;
const MIN_ENERGY_THRESHOLD = 0.01;
const MAX_SPEED = 20;
const SPRING_LENGTH = 1;

// Springy runs until it settles; we also stop after a fixed number of steps
// so a large graph can't hang the tab. The cap is a step count rather than a
// time budget so the same input always settles to the same layout.
const MAX_ITERATIONS = 2000;

// Extra springs pull every CBD member toward its group's root, and nodes in
// different groups repel harder, so each CBD settles as a compact cluster.
const GROUP_STIFFNESS = 200;
const CROSS_GROUP_REPULSION = 2;

// Pixels per Springy unit. Two linked nodes settle about 2 units apart, which
// leaves room for an edge label between two 220px-wide cards.
const SCALE = 180;

// Minimum pixel gap left between cards (and between group boxes) by the
// overlap pass that runs after the simulation.
const NODE_GAP = 24;
const MAX_SEPARATION_PASSES = 100;

const SEED = 0x5eed;

interface Particle {
  id: string;
  group: string | null;
  pinned: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
}

interface Spring {
  a: Particle;
  b: Particle;
  stiffness: number;
}

// Small seeded PRNG (mulberry32), so starting positions for new nodes are
// the same on every run instead of coming from Math.random.
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Lay out the projection with a Springy-style force simulation, in pixels.
 *
 * `pinnedPositions` (nodes the user has dragged) stay exactly where they are
 * but still push and pull on everything else. `previousPositions` (the last
 * run's `settled` positions) seeds the simulation, so an edit only moves the
 * nodes near it instead of reshuffling the whole graph.
 */
export function forceDirectedPositions(
  projection: RdfProjection,
  pinnedPositions: Record<string, Position>,
  previousPositions: Record<string, Position>,
  size: NodeBoxSize,
): ForceLayoutResult {
  const random = seededRandom(SEED);
  const toUnits = (position: Position) => ({
    x: (position.x + size.width / 2) / SCALE,
    y: (position.y + size.height / 2) / SCALE,
  });

  const groupByMember = new Map<string, string>();
  for (const group of projection.groups) {
    for (const memberId of group.members) groupByMember.set(memberId, group.root);
  }

  const particles: Particle[] = [];
  const particleById = new Map<string, Particle>();
  for (const node of projection.nodes) {
    const pinned = pinnedPositions[node.id];
    const start = pinned ?? previousPositions[node.id];
    const particle: Particle = {
      id: node.id,
      group: groupByMember.get(node.id) ?? null,
      pinned: pinned !== undefined,
      x: NaN,
      y: NaN,
      vx: 0,
      vy: 0,
      ax: 0,
      ay: 0,
    };
    if (start) Object.assign(particle, toUnits(start));
    particles.push(particle);
    particleById.set(node.id, particle);
  }

  const springs: Spring[] = [];
  const springKeys = new Set<string>();
  const neighbours = new Map<Particle, Particle[]>();
  function addSpring(sourceId: string, targetId: string, stiffness: number) {
    const a = particleById.get(sourceId);
    const b = particleById.get(targetId);
    if (!a || !b || a === b) return;
    const key = sourceId < targetId ? `${sourceId}\n${targetId}` : `${targetId}\n${sourceId}`;
    if (springKeys.has(key)) return;
    springKeys.add(key);
    springs.push({ a, b, stiffness });
    neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
    neighbours.set(b, [...(neighbours.get(b) ?? []), a]);
  }
  for (const edge of projection.edges) addSpring(edge.source, edge.target, STIFFNESS);
  for (const group of projection.groups) {
    for (const memberId of group.members) addSpring(group.root, memberId, GROUP_STIFFNESS);
  }

  // Nodes without a previous position start next to any neighbours that
  // already have one; otherwise somewhere random, as in Springy.
  for (const particle of particles) {
    if (!Number.isNaN(particle.x)) continue;
    const placed = (neighbours.get(particle) ?? []).filter((n) => !Number.isNaN(n.x));
    if (placed.length > 0) {
      particle.x = placed.reduce((sum, n) => sum + n.x, 0) / placed.length + random() - 0.5;
      particle.y = placed.reduce((sum, n) => sum + n.y, 0) / placed.length + random() - 0.5;
    } else {
      particle.x = (random() - 0.5) * 10;
      particle.y = (random() - 0.5) * 10;
    }
  }

  simulate(particles, springs, random);

  const settled: Record<string, Position> = {};
  for (const particle of particles) {
    settled[particle.id] = pinnedPositions[particle.id] ?? {
      x: particle.x * SCALE - size.width / 2,
      y: particle.y * SCALE - size.height / 2,
    };
  }
  const positions = { ...settled };
  removeOverlaps(projection, positions, pinnedPositions, size);
  return { positions, settled };
}

function simulate(particles: Particle[], springs: Spring[], random: () => number) {
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // Coulomb's law: every pair of nodes pushes apart.
    for (let i = 0; i < particles.length; i++) {
      const p1 = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        let dx = p1.x - p2.x;
        let dy = p1.y - p2.y;
        if (dx === 0 && dy === 0) {
          dx = random() - 0.5;
          dy = random() - 0.5;
        }
        const magnitude = Math.hypot(dx, dy);
        const distance = magnitude + 0.1;
        const repulsion =
          p1.group !== p2.group ? REPULSION * CROSS_GROUP_REPULSION : REPULSION;
        const force = repulsion / (distance * distance * 0.5);
        const fx = (dx / magnitude) * force;
        const fy = (dy / magnitude) * force;
        p1.ax += fx;
        p1.ay += fy;
        p2.ax -= fx;
        p2.ay -= fy;
      }
    }

    // Hooke's law: springs pull linked nodes toward their rest length.
    for (const { a, b, stiffness } of springs) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const magnitude = Math.hypot(dx, dy) || 1e-6;
      const displacement = SPRING_LENGTH - magnitude;
      const force = stiffness * displacement * 0.5;
      const fx = (dx / magnitude) * force;
      const fy = (dy / magnitude) * force;
      a.ax -= fx;
      a.ay -= fy;
      b.ax += fx;
      b.ay += fy;
    }

    // A weak pull toward the origin keeps disconnected pieces from drifting.
    for (const particle of particles) {
      particle.ax -= particle.x * (REPULSION / 50);
      particle.ay -= particle.y * (REPULSION / 50);
    }

    let energy = 0;
    for (const particle of particles) {
      if (!particle.pinned) {
        particle.vx = (particle.vx + particle.ax * TIMESTEP) * DAMPING;
        particle.vy = (particle.vy + particle.ay * TIMESTEP) * DAMPING;
        const speed = Math.hypot(particle.vx, particle.vy);
        if (speed > MAX_SPEED) {
          particle.vx = (particle.vx / speed) * MAX_SPEED;
          particle.vy = (particle.vy / speed) * MAX_SPEED;
        }
        particle.x += particle.vx * TIMESTEP;
        particle.y += particle.vy * TIMESTEP;
        energy += 0.5 * (particle.vx * particle.vx + particle.vy * particle.vy);
      }
      particle.ax = 0;
      particle.ay = 0;
    }

    if (energy / particles.length < MIN_ENERGY_THRESHOLD) return;
  }
}

interface Box {
  memberIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  fixed: boolean;
}

/**
 * The simulation treats nodes as points, but they render as cards. Push
 * overlapping cards apart inside each CBD group, then push whole groups (and
 * ungrouped cards) apart from each other, the way dagre's compound
 * clustering kept groups separate. Pinned cards never move, and a group
 * holding a pinned card is never moved as a whole, so the user's placement
 * is kept exactly. Updates `positions` in place.
 *
 * Exported for tests: the simulation's own repulsion usually leaves nothing
 * to fix, so tests hand this overlapping positions directly.
 */
export function removeOverlaps(
  projection: RdfProjection,
  positions: Record<string, Position>,
  pinnedPositions: Record<string, Position>,
  size: NodeBoxSize,
) {
  const nodeBox = (id: string): Box => ({
    memberIds: [id],
    x: positions[id].x,
    y: positions[id].y,
    width: size.width,
    height: size.height,
    fixed: id in pinnedPositions,
  });

  const grouped = new Set<string>();
  const topLevel: Box[] = [];
  for (const group of projection.groups) {
    const members = group.members.filter((id) => id in positions);
    if (members.length === 0) continue;
    members.forEach((id) => grouped.add(id));

    const memberBoxes = members.map(nodeBox);
    separate(memberBoxes, NODE_GAP);
    applyBoxes(memberBoxes, positions);

    const minX = Math.min(...memberBoxes.map((box) => box.x));
    const minY = Math.min(...memberBoxes.map((box) => box.y));
    const maxX = Math.max(...memberBoxes.map((box) => box.x + box.width));
    const maxY = Math.max(...memberBoxes.map((box) => box.y + box.height));
    topLevel.push({
      memberIds: members,
      x: minX - size.groupPadding,
      y: minY - size.groupPadding,
      width: maxX - minX + size.groupPadding * 2,
      height: maxY - minY + size.groupPadding * 2,
      fixed: memberBoxes.some((box) => box.fixed),
    });
  }
  for (const node of projection.nodes) {
    if (!grouped.has(node.id)) topLevel.push(nodeBox(node.id));
  }

  const start = topLevel.map((box) => ({ x: box.x, y: box.y }));
  separate(topLevel, NODE_GAP);
  topLevel.forEach((box, index) => {
    const dx = box.x - start[index].x;
    const dy = box.y - start[index].y;
    for (const id of box.memberIds) {
      positions[id] = { x: positions[id].x + dx, y: positions[id].y + dy };
    }
  });
}

function applyBoxes(boxes: Box[], positions: Record<string, Position>) {
  for (const box of boxes) positions[box.memberIds[0]] = { x: box.x, y: box.y };
}

function overlaps(a: Box, b: Box, gap: number) {
  return (
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) + gap > 0 &&
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) + gap > 0
  );
}

// Repeatedly push each overlapping pair apart along whichever axis needs the
// smaller move, splitting the move between the two boxes unless one is fixed.
// If that move would shove a box into a fixed one (a card caught between two
// pinned cards, say), push along the other axis instead, or the box would
// just bounce between the two.
function separate(boxes: Box[], gap: number) {
  const fixedBoxes = boxes.filter((box) => box.fixed);
  const hitsFixed = (box: Box, dx: number, dy: number, ignore: Box[]) =>
    (dx !== 0 || dy !== 0) &&
    fixedBoxes.some(
      (fixed) => !ignore.includes(fixed) && overlaps({ ...box, x: box.x + dx, y: box.y + dy }, fixed, gap),
    );

  for (let pass = 0; pass < MAX_SEPARATION_PASSES; pass++) {
    let moved = false;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (a.fixed && b.fixed) continue;
        const overlapX =
          Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) + gap;
        const overlapY =
          Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) + gap;
        if (overlapX <= 0 || overlapY <= 0) continue;

        const aShare = a.fixed ? 0 : b.fixed ? 1 : 0.5;
        const bShare = 1 - aShare;
        const signX = a.x + a.width / 2 <= b.x + b.width / 2 ? -1 : 1;
        const signY = a.y + a.height / 2 <= b.y + b.height / 2 ? -1 : 1;
        const alongX = { dx: signX * overlapX, dy: 0 };
        const alongY = { dx: 0, dy: signY * overlapY };
        const candidates = overlapX < overlapY ? [alongX, alongY] : [alongY, alongX];
        const { dx, dy } =
          candidates.find(
            ({ dx, dy }) =>
              !hitsFixed(a, dx * aShare, dy * aShare, [a, b]) &&
              !hitsFixed(b, -dx * bShare, -dy * bShare, [a, b]),
          ) ?? candidates[0];
        a.x += dx * aShare;
        a.y += dy * aShare;
        b.x -= dx * bShare;
        b.y -= dy * bShare;
        moved = true;
      }
    }
    if (!moved) return;
  }
}
