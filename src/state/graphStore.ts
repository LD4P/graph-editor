import { create } from "zustand";
import type { RdfProjection } from "../model/rdfGraphModel";
import { historyStatus, serializeRdf } from "../lib/pyBridge";
import { AUTOSAVE_KEY } from "../lib/autosave";

export interface Position {
  x: number;
  y: number;
}

export type LayoutMode = "force" | "dagre";

interface GraphState {
  projection: RdfProjection;
  positions: Record<string, Position>;
  selectedNodeId: string | null;
  /** Bumped by focusNode so the canvas re-zooms even if the node was already selected. */
  focusRequest: number;
  layoutMode: LayoutMode;
  canUndo: boolean;
  canRedo: boolean;
  setProjection: (projection: RdfProjection) => void;
  resetPositions: () => void;
  setPosition: (nodeId: string, position: Position) => void;
  selectNode: (nodeId: string | null) => void;
  focusNode: (nodeId: string) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  refreshHistoryStatus: () => Promise<void>;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  projection: { nodes: [], edges: [], groups: [] },
  positions: {},
  selectedNodeId: null,
  focusRequest: 0,
  layoutMode: "force",
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
  focusNode: (nodeId) =>
    set((state) => ({ selectedNodeId: nodeId, focusRequest: state.focusRequest + 1 })),
  setLayoutMode: (mode) => set({ layoutMode: mode }),
  refreshHistoryStatus: async () => {
    const status = await historyStatus();
    set({ canUndo: status.canUndo, canRedo: status.canRedo });
  },
}));
