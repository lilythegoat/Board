import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark, Trash2 } from "lucide-react";
import { boardPlus, type Bookmark as SavedBookmark } from "@/api/boardplus";
import { useChannels } from "@/stores/channels";
import { formatTimestamp } from "@/lib/time";
import s from "./BookmarksPage.module.css";

import { t } from "@/i18n";
/** Messages saved to read again later. */
export function BookmarksPage() {
  const nav = useNavigate();
  const channels = useChannels((c) => c.byId);
  const [list, setList] = useState<SavedBookmark[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    boardPlus
      .bookmarks()
      .then((r) => {
        if (alive) setList(r.bookmarks);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const remove = async (messageId: string) => {
    await boardPlus.removeBookmark(messageId).catch(() => undefined);
    setList((cur) => cur.filter((b) => b.message_id !== messageId));
  };

  return (
    <div className={s.page}>
      <h1 className={s.title}><Bookmark size={28} /> {t("bookmarks.title")}</h1>
      <p className={s.lede}>{t("bookmarks.lede")}</p>
      {!loaded ? null : list.length === 0 ? (
        <div className={s.empty}>{t("bookmarks.empty")}</div>
      ) : (
        <div className={s.list}>
          {list.map((b) => {
            const ch = channels[b.channel_id];
            return (
              <div key={b.message_id} className={s.item}>
                <button
                  className={s.open}
                  onClick={() => {
                    if (ch?.server_id) nav(`/channels/${ch.server_id}/${ch.id}`);
                    else if (ch) nav(`/channels/@me/${ch.id}`);
                  }}
                >
                  <span className={s.where}>{ch ? `#${ch.name ?? t("bookmarks.unknownChannel")}` : t("bookmarks.unknownChannel")}</span>
                  <span className={s.when}>{formatTimestamp(b.saved_at)}</span>
                </button>
                <button className={s.remove} aria-label={t("bookmarks.remove")} onClick={() => void remove(b.message_id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
