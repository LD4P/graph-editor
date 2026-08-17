import { create } from "zustand";
import type { RdfProjection } from "../model/rdfGraphModel";
import { historyStatus, serializeRdf } from "../lib/pyBridge";
import { AUTOSAVE_KEY } from "../lib/autosave";

export interface Position {
  x: number;
  y: number;
}

interface GraphState {
  projection: RdfProjection;
  positions: Record<string, Position>;
  selectedNodeId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  setProjection: (projection: RdfProjection) => void;
  resetPositions: () => void;
  setPosition: (nodeId: string, position: Position) => void;
  selectNode: (nodeId: string | null) => void;
  refreshHistoryStatus: () => Promise<void>;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  projection: { nodes: [], edges: [] },
  positions: {},
  selectedNodeId: null,
  canUndo: false,
  canRedo: false,
  setProjection: (projection) => {
    set({ projection });
    get().refreshHistoryStatus();
    serializeRdf("turtle")
      .then((text) => {
        try {
          localStorage.setItem(AUTOSAVE_KEY, text);
        } catch {
          // localStorage unavailable (private browsing, quota, etc.); skip autosave
        }
      })
      .catch(() => {});
  },
  resetPositions: () => set({ positions: {} }),
  setPosition: (nodeId, position) =>
    set((state) => ({ positions: { ...state.positions, [nodeId]: position } })),
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  refreshHistoryStatus: async () => {
    const status = await historyStatus();
    set({ canUndo: status.canUndo, canRedo: status.canRedo });
  },
}));
