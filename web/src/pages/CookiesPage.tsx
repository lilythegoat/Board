import { useEffect } from "react";
import { t } from "@/i18n";
import { useCookies } from "@/stores/cookies";
import { useUI } from "@/stores/ui";
import s from "./CookiesPage.module.css";

export default function CookiesPage() {
  const cookies = useCookies((c) => c.cookies);
  const claimDaily = useCookies((c) => c.claimDaily);
  const toast = useUI((u) => u.toast);

  useEffect(() => {
    void useCookies.getState().load().catch(() => undefined);
  }, []);

  const claim = async () => {
    try {
      const claimed = await claimDaily();
      toast(claimed ? t("cookies.dailyClaimedToast") : t("cookies.dailyClaimed"), "success");
    } catch {
      toast(t("cookies.dailyClaimFailed"), "error");
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
      </div>
    </div>
  );
}
