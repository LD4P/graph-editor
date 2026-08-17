import { create } from "zustand";

interface PanelState {
  validationPanelOpen: boolean;
  namespacePanelOpen: boolean;
  toggleValidationPanel: () => void;
  toggleNamespacePanel: () => void;
}

export const usePanelStore = create<PanelState>((set) => ({
  validationPanelOpen: false,
  namespacePanelOpen: false,
  toggleValidationPanel: () =>
    set((state) => ({ validationPanelOpen: !state.validationPanelOpen })),
  toggleNamespacePanel: () =>
    set((state) => ({ namespacePanelOpen: !state.namespacePanelOpen })),
}));
