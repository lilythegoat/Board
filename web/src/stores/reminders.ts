import { create } from "zustand";
import { showNotification } from "@/lib/notify";

/** A reminder about a message, fired by the app while it is open. */
export interface MessageReminder {
  id: string;
  channelId: string;
  messageId: string;
  preview: string;
  remindAt: number;
}

const KEY = "board.messageReminders";

function readStored(): MessageReminder[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as MessageReminder[];
    return Array.isArray(list) ? list.filter((m) => m && typeof m.remindAt === "number") : [];
  } catch {
    return [];
  }
}

function writeStored(list: MessageReminder[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // a full store loses the reminder, but never the message itself
  }
}

interface RemindersState {
  reminders: MessageReminder[];
  /** Reminds about a message at a time. */
  add: (channelId: string, messageId: string, preview: string, remindAt: number) => void;
  remove: (id: string) => void;
  /** Fires everything whose time has come; run on a timer while the app is open. */
  fireDue: () => void;
  clear: () => void;
}

export const useReminders = create<RemindersState>()((set, get) => ({
  reminders: readStored(),
  add: (channelId, messageId, preview, remindAt) => {
    const item: MessageReminder = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, channelId, messageId, preview, remindAt };
    const next = [...get().reminders, item];
    writeStored(next);
    set({ reminders: next });
  },
  remove: (id) => {
    const next = get().reminders.filter((m) => m.id !== id);
    writeStored(next);
    set({ reminders: next });
  },
  fireDue: () => {
    const now = Date.now();
    const due = get().reminders.filter((m) => m.remindAt <= now);
    if (due.length === 0) return;
    const rest = get().reminders.filter((m) => m.remindAt > now);
    writeStored(rest);
    set({ reminders: rest });
    for (const m of due) {
      void showNotification("Board", { body: m.preview || "A message you asked to be reminded about." });
    }
  },
  clear: () => {
    writeStored([]);
    set({ reminders: [] });
  },
}));
