import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Command, Hash, Server, Sparkles } from "lucide-react";
import { useChannels } from "@/stores/channels";
import { useServers } from "@/stores/servers";
import { channelDisplayName } from "@/lib/names";
import s from "./QuickSwitcher.module.css";

import { t } from "@/i18n";
interface SwitchItem {
  id: string;
  label: string;
  hint: string;
  kind: "page" | "server" | "channel";
  go: string;
}

/** Ctrl+K (or ⌘K): jump to a page, a server or a channel, and run a command. */
export function QuickSwitcher() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const servers = useServers((x) => x.byId);
  const channels = useChannels((c) => c.byId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((was) => !was);
        setQuery("");
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items = useMemo<SwitchItem[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (label: string) => q === "" || label.toLowerCase().includes(q);
    const out: SwitchItem[] = [];
    const pages: SwitchItem[] = [
      { id: "p-friends", label: t("sidebar.dMSidebar.friends"), hint: t("board20.switcher.page"), kind: "page", go: "/channels/@me" },
      { id: "p-cookies", label: t("cookies.nav"), hint: t("board20.switcher.page"), kind: "page", go: "/channels/@me/cookies" },
      { id: "p-boardai", label: t("boardai.title"), hint: t("board20.switcher.command"), kind: "page", go: "/channels/@me/board-ai" },
      { id: "p-avatar", label: t("avatarItems.title"), hint: t("board20.switcher.page"), kind: "page", go: "/channels/@me/avatar-items" },
      { id: "p-bookmarks", label: t("bookmarks.title"), hint: t("board20.switcher.page"), kind: "page", go: "/channels/@me/bookmarks" },
      { id: "p-support", label: t("support.nav"), hint: t("board20.switcher.page"), kind: "page", go: "/channels/@me/support" },
      { id: "p-notes", label: t("notes.title"), hint: t("board20.switcher.page"), kind: "page", go: "/channels/@me/notes" },
    ];
    for (const p of pages) if (match(p.label)) out.push(p);
    for (const st of Object.values(servers)) {
      const name = st.server.name;
      if (!match(name)) continue;
      out.push({ id: `s-${st.server.id}`, label: name, hint: t("board20.switcher.server"), kind: "server", go: `/channels/${st.server.id}` });
    }
    for (const ch of Object.values(channels)) {
      const name = ch.server_id ? `#${ch.name ?? ""}` : channelDisplayName(ch);
      if (!name || !match(name)) continue;
      out.push({ id: `c-${ch.id}`, label: name, hint: t("board20.switcher.channel"), kind: "channel", go: ch.server_id ? `/channels/${ch.server_id}/${ch.id}` : `/channels/@me/${ch.id}` });
    }
    return out.slice(0, 30);
  }, [query, servers, channels]);

  if (!open) return null;

  const jump = (item: SwitchItem) => {
    setOpen(false);
    nav(item.go);
  };

  return (
    <div className={s.backdrop} onClick={() => setOpen(false)}>
      <div className={s.panel} role="dialog" aria-label={t("board20.switcher.title")} onClick={(e) => e.stopPropagation()}>
        <div className={s.row}>
          <Command size={18} />
          <input
            className={s.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && items[0]) jump(items[0]!);
            }}
            placeholder={t("board20.switcher.placeholder")}
            autoFocus
            aria-label={t("board20.switcher.placeholder")}
          />
          <kbd className={s.kbd}>ESC</kbd>
        </div>
        <div className={s.list}>
          {items.length === 0 ? (
            <div className={s.empty}>{t("board20.switcher.empty")}</div>
          ) : (
            items.map((item) => (
              <button key={item.id} className={s.item} onClick={() => jump(item)}>
                {item.kind === "server" ? <Server size={16} /> : item.kind === "channel" ? <Hash size={16} /> : <Sparkles size={16} />}
                <span className={s.label}>{item.label}</span>
                <span className={s.hint}>{item.hint}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
