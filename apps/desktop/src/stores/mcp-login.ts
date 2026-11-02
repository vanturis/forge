import { create } from "zustand";

interface McpLoginState {
  /** servers waiting for the sign-in in the browser, with the page */
  waiting: Record<string, string>;
  setWaiting: (name: string, url: string | null) => void;
}

export const useMcpLogin = create<McpLoginState>((set) => ({
  waiting: {},
  setWaiting: (name, url) =>
    set((s) => {
      const { [name]: _gone, ...rest } = s.waiting;
      return { waiting: url ? { ...rest, [name]: url } : rest };
    }),
}));
