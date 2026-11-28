import { create } from "zustand";
import { boardPlus, type AvatarItem } from "@/api/boardplus";

interface AvatarItemsStoreState {
  /** The items the account made or bought, once read. */
  items: AvatarItem[];
  /** The item worn right now, if any. */
  equipped: string | null;
  /** The worn item of other accounts, by account id, once read. */
  equippedByUser: Record<string, AvatarItem>;
  loading: boolean;
  loadMine: () => Promise<void>;
  /** Reads the worn items of the accounts shown, for the member and friends lists. */
  loadEquipped: (ids: string[]) => Promise<void>;
  /** Makes a wearable item. */
  create: (name: string, emoji: string, color: number) => Promise<void>;
  /** Wears one of the account's items. */
  equip: (id: string) => Promise<void>;
  clear: () => void;
}

export const useAvatarItems = create<AvatarItemsStoreState>()((set, get) => ({
  items: [],
  equipped: null,
  equippedByUser: {},
  loading: false,
  loadMine: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const r = await boardPlus.avatarItems();
      set({ items: r.items, equipped: r.equipped });
    } finally {
      set({ loading: false });
    }
  },
  loadEquipped: async (ids) => {
    const missing = ids.filter((id) => !(id in get().equippedByUser));
    if (missing.length === 0) return;
    try {
      const r = await boardPlus.equippedAvatarItems(missing);
      set((st) => ({ equippedByUser: { ...st.equippedByUser, ...r.equipped } }));
    } catch {
      // a list without item badges is still a list
    }
  },
  create: async (name, emoji, color) => {
    const item = await boardPlus.createAvatarItem(name, emoji, color);
    set((st) => ({ items: [...st.items, item] }));
  },
  equip: async (id) => {
    await boardPlus.equipAvatarItem(id);
    set({ equipped: id });
  },
  clear: () => set({ items: [], equipped: null, equippedByUser: {}, loading: false }),
}));
