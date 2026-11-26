import { create } from "zustand";
import { cookies as cookiesApi, type CookiesState, type GiveResult } from "@/api/cookies";

interface CookiesStoreState {
  /** The account's Cookies, once read; null before. */
  cookies: CookiesState | null;
  loading: boolean;
  /** Reads them again; what Cookies Place shows. */
  load: () => Promise<void>;
  /** Claims the daily bonus and keeps the balance in step. */
  claimDaily: () => Promise<boolean>;
  /** Gives Cookies to someone and keeps the balance in step. */
  give: (to: string, amount: number) => Promise<GiveResult>;
  clear: () => void;
}

export const useCookies = create<CookiesStoreState>()((set, get) => ({
  cookies: null,
  loading: false,
  load: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      set({ cookies: await cookiesApi.get() });
    } finally {
      set({ loading: false });
    }
  },
  claimDaily: async () => {
    const r = await cookiesApi.claimDaily();
    const now = Date.now();
    set((st) => ({
      cookies: st.cookies
        ? { ...st.cookies, balance: r.balance, can_claim_daily: false, last_daily: now }
        : { balance: r.balance, last_daily: now, can_claim_daily: false },
    }));
    return r.claimed;
  },
  give: async (to, amount) => {
    const r = await cookiesApi.give(to, amount);
    set((st) => (st.cookies ? { cookies: { ...st.cookies, balance: r.balance } } : st));
    return r;
  },
  clear: () => set({ cookies: null, loading: false }),
}));
