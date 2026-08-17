import { create } from "zustand";

interface PanelState {
  validationPanelOpen: boolean;
  toggleValidationPanel: () => void;
}

export const usePanelStore = create<PanelState>((set) => ({
  validationPanelOpen: false,
  toggleValidationPanel: () =>
    set((state) => ({ validationPanelOpen: !state.validationPanelOpen })),
}));
