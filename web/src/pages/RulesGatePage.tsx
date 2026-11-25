import { LogOut, ScrollText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { users } from "@/api/users";
import { NexaWordmark } from "@/components/common/Brand";
import { Button } from "@/components/common/Button";
import { t } from "@/i18n";
import { APP_RULE_KEYS, RULES_VERSION } from "@/lib/rules";
import { usePageTitle } from "@/pages/AuthLayout";
import { useAuth } from "@/stores/auth";
import s from "./RulesGatePage.module.css";

/**
 * The rules step: the full-screen page a new account lands on after the
 * terms, before the app (components/legal/RulesGate sends it here). The
 * Continue button stays off until the rules have been scrolled to the
 * bottom and the agreement box is ticked — read, then agree. Agreeing is
 * recorded on the server, so the step happens once per account.
 */
export default function RulesGatePage() {
  usePageTitle(t("appRules.title"));
  const me = useAuth((a) => a.me);
  const setMe = useAuth((a) => a.setMe);
  const logout = useAuth((a) => a.logout);
  const nav = useNavigate();
  const [read, setRead] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  // An account that has already agreed has no step to do.
  useEffect(() => {
    if (me && (me.rules_version ?? 0) >= RULES_VERSION) nav("/channels/@me", { replace: true });
  }, [me, nav]);

  // Rules short enough to fit without scrolling count as read.
  useEffect(() => {
    const el = boxRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 8) setRead(true);
  }, []);

  const onScroll = () => {
    const el = boxRef.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setRead(true);
  };

  const accept = async () => {
    setBusy(true);
    setError("");
    try {
      setMe(await users.acceptRules());
      nav("/channels/@me", { replace: true });
    } catch {
      setError(t("appRules.error"));
      setBusy(false);
    }
  };

  return (
    <main className={s.page}>
      <span className={s.brand} aria-hidden="true">
        <NexaWordmark height={34} />
      </span>
      <section className={s.card} data-testid="rules-gate">
        <span className={s.iconBox} aria-hidden="true">
          <ScrollText size={34} />
        </span>
        <h1 className={s.title}>{t("appRules.title")}</h1>
        <p className={s.sub}>{t("appRules.intro")}</p>
        <div className={s.rulesBox} ref={boxRef} onScroll={onScroll} tabIndex={0} data-testid="rules-box">
          <ol className={s.rules}>
            {APP_RULE_KEYS.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ol>
        </div>
        {!read && <p className={s.hint}>{t("appRules.scrollHint")}</p>}
        <label className={s.agree}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} data-testid="rules-agree" />
          <span>{t("appRules.agree")}</span>
        </label>
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
        <Button block loading={busy} disabled={!read || !agreed} onClick={() => void accept()} data-testid="rules-continue">
          {t("appRules.continue")}
        </Button>
        <Button variant="danger" onClick={() => void logout()}>
          <LogOut size={16} /> {t("appRules.logOut")}
        </Button>
      </section>
    </main>
  );
}
