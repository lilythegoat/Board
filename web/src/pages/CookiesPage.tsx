import { t } from "@/i18n";
import s from "./CookiesPage.module.css";

// Version 1: display-only balance. Real earning and spending comes in phase 2.
const BALANCE = 100;

export default function CookiesPage() {
  return (
    <div className={s.page}>
      <h1 className={s.title}>{t("cookies.title")}</h1>

      <div className={s.balanceCard}>
        <div className={s.balanceEmoji}>🍪</div>
        <div className={s.balanceNumber}>{BALANCE}</div>
        <div className={s.balanceLabel}>{t("cookies.balanceLabel")}</div>
      </div>

      <div className={s.section}>
        <h2 className={s.sectionTitle}>{t("cookies.earnTitle")}</h2>
        <div className={s.item}>{t("cookies.earnDaily")}</div>
        <div className={s.item}>{t("cookies.earnChat")}</div>
        <div className={s.item}>{t("cookies.earnEvent")}</div>
      </div>

      <div className={s.section}>
        <h2 className={s.sectionTitle}>{t("cookies.spendTitle")}</h2>
        <div className={s.item}>
          <span>{t("cookies.spendBadge")}</span>
          <span className={s.price}>🍪 50</span>
        </div>
        <div className={s.item}>
          <span>{t("cookies.spendTheme")}</span>
          <span className={s.price}>🍪 200</span>
        </div>
        <div className={s.item}>
          <span>{t("cookies.spendBoost")}</span>
          <span className={s.price}>🍪 500</span>
        </div>
      </div>
    </div>
  );
}
