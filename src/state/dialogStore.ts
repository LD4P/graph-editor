import { create } from "zustand";

export interface DialogField {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  options?: string[];
}

export interface DialogRequest {
  title: string;
  fields: DialogField[];
  onSubmit: (values: Record<string, string>) => void;
}

interface DialogState {
  request: DialogRequest | null;
  openDialog: (request: DialogRequest) => void;
  closeDialog: () => void;
}

export const useDialogStore = create<DialogState>((set) => ({
  request: null,
  openDialog: (request) => set({ request }),
  closeDialog: () => set({ request: null }),
}));
