import { create } from "zustand";
import { sendMessage } from "@/components/composer/send";

/** A message waiting for its time to go out. */
export interface ScheduledMessage {
  id: string;
  channelId: string;
  text: string;
  sendAt: number;
}

const KEY = "board.scheduledMessages";

function readStored(): ScheduledMessage[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as ScheduledMessage[];
    return Array.isArray(list) ? list.filter((m) => m && typeof m.text === "string" && typeof m.sendAt === "number") : [];
  } catch {
    return [];
  }
}

function writeStored(list: ScheduledMessage[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // a full store loses the schedule, but never the message being typed
  }
}

interface ScheduledMessagesState {
  scheduled: ScheduledMessage[];
  /** Queues a message to go out at a time. */
  add: (channelId: string, text: string, sendAt: number) => void;
  /** Drops a queued message before it goes out. */
  remove: (id: string) => void;
  /** Sends everything whose time has come; run on a timer while the app is open. */
  sendDue: () => void;
  clear: () => void;
}

export const useScheduledMessages = create<ScheduledMessagesState>()((set, get) => ({
  scheduled: readStored(),
  add: (channelId, text, sendAt) => {
    const item: ScheduledMessage = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, channelId, text, sendAt };
    const next = [...get().scheduled, item];
    writeStored(next);
    set({ scheduled: next });
  },
  remove: (id) => {
    const next = get().scheduled.filter((m) => m.id !== id);
    writeStored(next);
    set({ scheduled: next });
  },
  sendDue: () => {
    const now = Date.now();
    const due = get().scheduled.filter((m) => m.sendAt <= now);
    if (due.length === 0) return;
    const rest = get().scheduled.filter((m) => m.sendAt > now);
    writeStored(rest);
    set({ scheduled: rest });
    for (const m of due) {
      void sendMessage(m.channelId, m.text).catch(() => undefined);
    }
  },
  clear: () => {
    writeStored([]);
    set({ scheduled: [] });
  },
}));
