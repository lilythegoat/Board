import { create } from "zustand";
import { boardPlus, type QuietHours } from "@/api/boardplus";

interface QuietHoursStoreState {
  quiet: QuietHours | null;
  load: () => Promise<void>;
  /** Saves do-not-disturb hours and keeps them in step. */
  save: (q: QuietHours) => Promise<void>;
  /** Whether right now falls inside the quiet hours. */
  activeNow: () => boolean;
  clear: () => void;
}

export const useQuietHours = create<QuietHoursStoreState>()((set, get) => ({
  quiet: null,
  load: async () => {
    try {
      set({ quiet: await boardPlus.quietHours() });
    } catch {
      // without them, nothing is quiet
    }
  },
  save: async (q) => {
    const saved = await boardPlus.setQuietHours(q);
    set({ quiet: saved });
  },
  activeNow: () => {
    const q = get().quiet;
    if (!q || !q.enabled) return false;
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    if (q.start === q.end) return false;
    if (q.start < q.end) return mins >= q.start && mins < q.end;
    return mins >= q.start || mins < q.end;
  },
  clear: () => set({ quiet: null }),
}));
