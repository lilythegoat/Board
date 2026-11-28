import { create } from "zustand";
import { boardPlus, type LevelState } from "@/api/boardplus";

interface LevelsStoreState {
  /** XP, level and streak, once read; null before. */
  levels: LevelState | null;
  loading: boolean;
  load: () => Promise<void>;
  /** Pays XP for a sent message; the server allows it once a minute. */
  award: () => Promise<void>;
  /** Records today's login; pays the streak bonus when it grows. */
  checkin: () => Promise<void>;
  clear: () => void;
}

export const useLevels = create<LevelsStoreState>()((set, get) => ({
  levels: null,
  loading: false,
  load: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      set({ levels: await boardPlus.levelsMe() });
    } finally {
      set({ loading: false });
    }
  },
  award: async () => {
    try {
      set({ levels: await boardPlus.awardXp() });
    } catch {
      // a failed award is nothing to show: chatting still worked
    }
  },
  checkin: async () => {
    try {
      set({ levels: await boardPlus.checkin() });
    } catch {
      // a missed check-in never blocks opening the app
    }
  },
  clear: () => set({ levels: null, loading: false }),
}));
