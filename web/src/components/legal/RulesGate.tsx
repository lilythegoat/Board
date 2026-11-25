import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isDemo } from "@/lib/demoMode";
import { onTermsAccepted, termsAccepted } from "@/lib/legal";
import { RULES_VERSION } from "@/lib/rules";
import { useAuth } from "@/stores/auth";

/**
 * The rules step's other half (pages/RulesGatePage is the step itself):
 * while a signed-in account has not agreed to the rules in force, send it
 * to the step. Mounted beside the TermsGate: the terms come first, so
 * this waits until they are accepted — onTermsAccepted re-checks then,
 * since accepting the terms does not change the account this reads.
 * Accounts from before the step were stamped by migration 0055, so only
 * new accounts ever see it. The step records the agreement on the server,
 * so unlike the terms it is never asked twice, on any device.
 */
export function RulesGate() {
  const status = useAuth((a) => a.status);
  const me = useAuth((a) => a.me);
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [, setTermsTick] = useState(0);

  useEffect(() => onTermsAccepted(() => setTermsTick((n) => n + 1)), []);

  useEffect(() => {
    if (isDemo || status !== "ready" || !me) return;
    if ((me.rules_version ?? 0) >= RULES_VERSION) return;
    if (!termsAccepted(me.id)) return;
    if (pathname !== "/rules") nav("/rules", { replace: true });
  }, [status, me, nav, pathname]);

  return null;
}
