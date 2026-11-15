import { create } from "zustand";

interface SessionArchiveDialog {
  shown: boolean;
  /** whose archive is shown; null: the archive of all projects. Stays after closing, so the dialog keeps its content while it fades out. */
  projectId: string | null;
  open: (projectId: string | null) => void;
  close: () => void;
}

/** The dialog of components/workspace/SessionArchive.tsx; opened from the session picker, the palette and menus. */
export const useSessionArchiveDialog = create<SessionArchiveDialog>((set) => ({
  shown: false,
  projectId: null,
  open: (projectId) => set({ shown: true, projectId }),
  close: () => set({ shown: false }),
}));
