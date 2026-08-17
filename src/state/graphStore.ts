import { create } from "zustand";
import type { RdfProjection } from "../model/rdfGraphModel";

export interface Position {
  x: number;
  y: number;
}

interface GraphState {
  projection: RdfProjection;
  positions: Record<string, Position>;
  selectedNodeId: string | null;
  setProjection: (projection: RdfProjection) => void;
  resetPositions: () => void;
  setPosition: (nodeId: string, position: Position) => void;
  selectNode: (nodeId: string | null) => void;
}

export const useGraphStore = create<GraphState>((set) => ({
  projection: { nodes: [], edges: [] },
  positions: {},
  selectedNodeId: null,
  setProjection: (projection) => set({ projection }),
  resetPositions: () => set({ positions: {} }),
  setPosition: (nodeId, position) =>
    set((state) => ({ positions: { ...state.positions, [nodeId]: position } })),
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
}));
