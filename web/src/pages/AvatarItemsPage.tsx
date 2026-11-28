import { useEffect, useState } from "react";
import { Shirt } from "lucide-react";
import { useAvatarItems } from "@/stores/avatarItems";
import { useAuth } from "@/stores/auth";
import { boardPlus } from "@/api/boardplus";
import s from "./AvatarItemsPage.module.css";

import { t } from "@/i18n";
const COLORS = [0x8000ff, 0xff5fa2, 0x22c55e, 0x3b82f6, 0xf59e0b, 0xef4444, 0x14b8a6, 0xfacc15];

/** Avatar items: make a wearable item, wear one of yours. */
export function AvatarItemsPage() {
  const items = useAvatarItems((x) => x.items);
  const equipped = useAvatarItems((x) => x.equipped);
  const loadMine = useAvatarItems((x) => x.loadMine);
  const create = useAvatarItems((x) => x.create);
  const equip = useAvatarItems((x) => x.equip);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("⭐");
  const [color, setColor] = useState(COLORS[0]!);
  const [error, setError] = useState("");
  // a banner colour for the profile card, when there is no banner picture
  const meId = useAuth((a) => a.me?.id);
  const [banner, setBanner] = useState(0);
  useEffect(() => {
    if (!meId) return;
    boardPlus
      .bannerOf(meId)
      .then((r) => setBanner(r.banner))
      .catch(() => undefined);
  }, [meId]);

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  const make = async () => {
    setError("");
    try {
      await create(name.trim(), emoji.trim() || "⭐", color);
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("avatarItems.failed"));
    }
  };

  return (
    <div className={s.page}>
      <h1 className={s.title}><Shirt size={28} /> {t("avatarItems.title")}</h1>
      <p className={s.lede}>{t("avatarItems.lede")}</p>
      <div className={s.form}>
        <input className={s.input} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("avatarItems.namePlaceholder")} maxLength={32} aria-label={t("avatarItems.namePlaceholder")} />
        <input className={s.emojiInput} value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="⭐" maxLength={4} aria-label={t("avatarItems.emojiPlaceholder")} />
        <div className={s.colors}>
          {COLORS.map((c) => (
            <button key={c} type="button" className={s.color} data-on={color === c || undefined} style={{ background: `#${c.toString(16).padStart(6, "0")}` }} onClick={() => setColor(c)} aria-label={`#${c.toString(16).padStart(6, "0")}`} />
          ))}
        </div>
        <button className={s.make} onClick={() => void make()} disabled={!name.trim()}>{t("avatarItems.create")}</button>
      </div>
      {error ? <div className={s.error}>{error}</div> : null}
      <h2 className={s.sub}>{t("avatarItems.yours")}</h2>
      {items.length === 0 ? (
        <div className={s.empty}>{t("avatarItems.empty")}</div>
      ) : (
        <div className={s.list}>
          {items.map((item) => (
            <div key={item.id} className={s.item} data-worn={equipped === item.id || undefined}>
              <span className={s.itemEmoji} style={{ background: `#${item.color.toString(16).padStart(6, "0")}` }}>{item.emoji}</span>
              <span className={s.itemName}>{item.name}</span>
              {equipped === item.id ? (
                <span className={s.worn}>{t("avatarItems.worn")}</span>
              ) : (
                <button className={s.wear} onClick={() => void equip(item.id)}>{t("avatarItems.wear")}</button>
              )}
            </div>
          ))}
        </div>
      )}
      <h2 className={s.sub}>{t("avatarItems.bannerTitle")}</h2>
      <p className={s.lede}>{t("avatarItems.bannerLede")}</p>
      <div className={s.form}>
        <div className={s.colors}>
          {COLORS.map((c) => (
            <button key={c} type="button" className={s.color} data-on={banner === c || undefined} style={{ background: `#${c.toString(16).padStart(6, "0")}` }} onClick={() => {
              setBanner(c);
              void boardPlus.setBanner(c).catch(() => undefined);
            }} aria-label={`#${c.toString(16).padStart(6, "0")}`} />
          ))}
          <button type="button" className={s.color} data-on={banner === 0 || undefined} style={{ background: "transparent", border: "1px dashed currentColor" }} onClick={() => {
            setBanner(0);
            void boardPlus.setBanner(0).catch(() => undefined);
          }} aria-label={t("avatarItems.noBanner")}>✕</button>
        </div>
      </div>
    </div>
  );
}
