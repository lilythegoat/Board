import { useEffect, useState } from "react";
import type { Channel } from "@/api/types";
import { boardPlus, type ChannelReader } from "@/api/boardplus";
import { useAuth } from "@/stores/auth";
import { displayName, useUsers } from "@/stores/users";
import s from "./Chat.module.css";

import { t } from "@/i18n";
/** What a message row carries, enough to find the last one of mine. */
export interface ReceiptRow {
  kind: string;
  msg?: { id: string; author_id: string };
}

/** "Seen" under the last message of mine in a DM, with who saw it. */
export function ReadReceipts({ channel, rows }: { channel: Channel; rows: ReceiptRow[] }) {
  const me = useAuth((a) => a.me);
  const users = useUsers((u) => u.byId);
  const [readers, setReaders] = useState<ChannelReader[]>([]);
  const isDm = channel.type === "dm" || channel.type === "group_dm";
  const lastMine = [...rows].reverse().find((r) => r.kind === "msg" && r.msg?.author_id === me?.id)?.msg;

  useEffect(() => {
    if (!isDm || !lastMine) return;
    let alive = true;
    boardPlus
      .channelReaders(channel.id)
      .then((r) => {
        if (alive) setReaders(r.readers);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [isDm, channel.id, lastMine?.id]);

  if (!isDm || !lastMine || !me) return null;
  const seenBy = readers.filter((r) => {
    if (r.user_id === me.id || r.last_read_message_id === null || r.last_read_message_id === undefined) return false;
    try {
      return BigInt(r.last_read_message_id) >= BigInt(lastMine.id);
    } catch {
      return false;
    }
  });
  if (seenBy.length === 0) return null;
  const names = seenBy.map((r) => displayName(users[r.user_id])).filter(Boolean);
  return (
    <div className={s.receipt}>
      ✓ {names.length > 0 ? t("board20.receipts.seenBy", { names: names.join(", ") }) : t("board20.receipts.seen")}
    </div>
  );
}
