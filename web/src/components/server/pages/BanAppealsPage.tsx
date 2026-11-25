import { useEffect, useState } from "react";
import { servers as serversApi, type ServerBanAppeal } from "@/api/servers";
import { Avatar } from "@/components/common/Avatar";
import { Button } from "@/components/common/Button";
import { LoadError } from "@/components/common/LoadError";
import { PersonName } from "@/components/common/PersonName";
import { Spinner } from "@/components/common/Spinner";
import { dispatchHooks } from "@/gateway/dispatch";
import type { GatewayEvent } from "@/gateway/events";
import { t, Tr } from "@/i18n";
import { describeError } from "@/lib/errors";
import { formatFull } from "@/lib/time";
import { displayName, useUsers } from "@/stores/users";
import { useUI } from "@/stores/ui";
import st from "@/components/settings/Settings.module.css";
import s from "../ServerSettings.module.css";

/**
 * Ban appeals: what banned members asked this server's moderators, next to
 * the ban list it belongs with. Accepting lifts the ban; denying leaves it
 * standing. Settled appeals stay listed, with who settled them, as the
 * record of the decision.
 */
export default function BanAppealsPage({ serverId }: { serverId: string }) {
  const users = useUsers((u) => u.byId);
  const upsertUsers = useUsers((u) => u.upsert);
  const toast = useUI((u) => u.toast);
  const [appeals, setAppeals] = useState<ServerBanAppeal[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      serversApi
        .banAppeals(serverId)
        .then((res) => {
          if (!alive) return;
          upsertUsers(res.users);
          setAppeals(res.appeals);
          setFailed(false);
        })
        .catch(() => {
          if (!alive) return;
          setAppeals(null);
          setFailed(true);
        });
    void load();
    // Accepting an appeal lifts the ban, and a lifted ban re-reads the list.
    const hook = (e: GatewayEvent) => {
      if (e.t === "ban_remove" && (e.d as { server_id?: string }).server_id === serverId) void load();
    };
    dispatchHooks.onUnhandled.push(hook);
    return () => {
      alive = false;
      dispatchHooks.onUnhandled.splice(dispatchHooks.onUnhandled.indexOf(hook), 1);
    };
  }, [serverId, upsertUsers, attempt]);

  const resolve = async (appeal: ServerBanAppeal, action: "accept" | "deny") => {
    setBusy(appeal.id);
    try {
      const updated = await serversApi.resolveBanAppeal(serverId, appeal.id, action);
      setAppeals((cur) => cur?.map((a) => (a.id === updated.id ? updated : a)) ?? null);
      toast(t(action === "accept" ? "serverAppeals.acceptedToast" : "serverAppeals.deniedToast"), "success");
    } catch (err) {
      toast(describeError(err, t("serverAppeals.couldNotResolve")), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <h2 className={st.title}>{t("serverAppeals.title")}</h2>
      {appeals === null && !failed ? <Spinner label={t("serverAppeals.loading")} /> : null}
      {failed ? <LoadError message={t("serverAppeals.loadFailed")} onRetry={() => setAttempt((n) => n + 1)} /> : null}
      {appeals && appeals.length === 0 ? <p className={st.hint}>{t("serverAppeals.none")}</p> : null}
      {(appeals ?? []).map((a) => (
        <div key={a.id} className={s.memberRow}>
          <Avatar id={a.user_id} avatarId={users[a.user_id]?.avatar_id ?? null} name={displayName(users[a.user_id])} size={40} />
          <div className={s.memberText}>
            <PersonName userId={a.user_id} className={s.memberName}>{displayName(users[a.user_id])}</PersonName>
            <span className={s.memberSub}>
              <bdi>@{users[a.user_id]?.username ?? a.user_id}</bdi> · {formatFull(a.created_at)}
              {a.status !== "pending" && a.resolved_by ? (
                <>
                  {" · "}
                  <Tr id={a.status === "accepted" ? "serverAppeals.acceptedBy" : "serverAppeals.deniedBy"} values={{ who: <PersonName userId={a.resolved_by} serverId={serverId}>{displayName(users[a.resolved_by])}</PersonName> }} />
                </>
              ) : null}
            </span>
            {a.message ? <span className={s.memberSub}>{a.message}</span> : null}
          </div>
          {a.status === "pending" ? (
            <>
              <Button size="sm" loading={busy === a.id} onClick={() => void resolve(a, "accept")}>{t("serverAppeals.accept")}</Button>
              <Button size="sm" variant="secondary" disabled={busy === a.id} onClick={() => void resolve(a, "deny")}>{t("serverAppeals.deny")}</Button>
            </>
          ) : (
            <span className={s.memberSub}>{t(a.status === "accepted" ? "serverAppeals.accepted" : "serverAppeals.denied")}</span>
          )}
        </div>
      ))}
    </>
  );
}
