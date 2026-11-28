import { useEffect, useState } from "react";
import { t } from "@/i18n";
import { boardPlus, type LeaderboardEntry, type ShopItem } from "@/api/boardplus";
import { useCookies } from "@/stores/cookies";
import { useLevels } from "@/stores/levels";
import { useUI } from "@/stores/ui";
import s from "./CookiesPage.module.css";

export default function CookiesPage() {
  const cookies = useCookies((c) => c.cookies);
  const claimDaily = useCookies((c) => c.claimDaily);
  const levels = useLevels((l) => l.levels);
  const toast = useUI((u) => u.toast);
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [shop, setShop] = useState<ShopItem[]>([]);

  useEffect(() => {
    void useCookies.getState().load().catch(() => undefined);
    void useLevels.getState().load().catch(() => undefined);
    let alive = true;
    boardPlus
      .leaderboard()
      .then((r) => {
        if (alive) setLeaders(r.leaderboard);
      })
      .catch(() => undefined);
    boardPlus
      .shop()
      .then((r) => {
        if (alive) setShop(r.items);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const claim = async () => {
    try {
      const claimed = await claimDaily();
      toast(claimed ? t("cookies.dailyClaimedToast") : t("cookies.dailyClaimed"), "success");
    } catch {
      toast(t("cookies.dailyClaimFailed"), "error");
    }
  };

  const buy = async (item: ShopItem) => {
    try {
      const r = await boardPlus.buy(item.id);
      await useCookies.getState().load();
      toast(t("cookies.shopBought", { name: item.name }), "success");
      void r;
    } catch {
      toast(t("cookies.shopFailed"), "error");
    }
  };

  return (
    <div className={s.page}>
      <h1 className={s.title}>{t("cookies.title")}</h1>

      <div className={s.balanceCard}>
        <div className={s.balanceEmoji}>🍪</div>
        <div className={s.balanceNumber}>{cookies === null ? "…" : cookies.balance}</div>
        <div className={s.balanceLabel}>{t("cookies.balanceLabel")}</div>
      </div>

      {levels ? (
        <div className={s.levelCard}>
          <div className={s.levelTop}>
            <span className={s.levelBadge}>Lv {levels.level}</span>
            <span className={s.levelXp}>
              {levels.xp_into_level} / {levels.xp_for_next} XP
            </span>
          </div>
          <div className={s.levelBar}>
            <div className={s.levelFill} style={{ width: `${Math.min(100, (levels.xp_into_level / Math.max(1, levels.xp_for_next)) * 100)}%` }} />
          </div>
          <div className={s.levelSub}>
            {t("cookies.streak", { count: levels.streak })}
            {levels.streak > 0 ? ` · ${t("cookies.streakBonus", { count: levels.streak_bonus })}` : ""}
          </div>
        </div>
      ) : null}

      <div className={s.section}>
        <h2 className={s.sectionTitle}>{t("cookies.earnTitle")}</h2>
        <div className={s.dailyCard}>
          <span className={s.dailyEmoji}>🎁</span>
          <span className={s.dailyText}>{t("cookies.earnDaily")}</span>
          {cookies?.can_claim_daily ? (
            <button type="button" className={s.claim} onClick={() => void claim()}>
              {t("cookies.dailyClaim")} · +50 🍪
            </button>
          ) : (
            <span className={s.claimed}>{t("cookies.dailyClaimed")}</span>
          )}
        </div>
        <div className={s.item}>
          <span className={s.itemEmoji}>💬</span>
          <span>{t("cookies.earnChat")}</span>
        </div>
        <div className={s.item}>
          <span className={s.itemEmoji}>🎉</span>
          <span>{t("cookies.earnEvent")}</span>
        </div>
      </div>

      <div className={s.section}>
        <h2 className={s.sectionTitle}>{t("cookies.spendTitle")}</h2>
        {shop.length === 0 ? (
          <>
            <div className={s.item}>
              <span className={s.itemEmoji}>🏅</span>
              <span>{t("cookies.spendBadge")}</span>
              <span className={s.price}>🍪 50</span>
            </div>
            <div className={s.item}>
              <span className={s.itemEmoji}>🎨</span>
              <span>{t("cookies.spendTheme")}</span>
              <span className={s.price}>🍪 200</span>
            </div>
            <div className={s.item}>
              <span className={s.itemEmoji}>🚀</span>
              <span>{t("cookies.spendBoost")}</span>
              <span className={s.price}>🍪 500</span>
            </div>
          </>
        ) : (
          shop.map((item) => (
            <div key={item.id} className={s.item}>
              <span className={s.itemEmoji}>{item.kind === "badge" ? "🏅" : item.kind === "theme" ? "🎨" : "✨"}</span>
              <span>
                <span className={s.shopName}>{item.name}</span>
                <span className={s.shopDesc}>{item.description}</span>
              </span>
              <button type="button" className={s.buy} disabled={cookies !== null && cookies.balance < item.price} onClick={() => void buy(item)}>
                🍪 {item.price}
              </button>
            </div>
          ))
        )}
      </div>

      <div className={s.section}>
        <h2 className={s.sectionTitle}>{t("cookies.leaderboardTitle")}</h2>
        {leaders.length === 0 ? (
          <div className={s.empty}>{t("cookies.leaderboardEmpty")}</div>
        ) : (
          leaders.map((row, i) => (
            <div key={row.user_id} className={s.leaderRow}>
              <span className={s.leaderRank}>{i + 1}</span>
              <span className={s.leaderName}>{row.display_name}</span>
              <span className={s.price}>🍪 {row.balance}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
