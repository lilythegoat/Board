import { useState } from "react";
import { ApiError } from "@/api/client";
import { servers as serversApi } from "@/api/servers";
import { Field, TextArea } from "@/components/common/TextInput";
import { t } from "@/i18n";
import { P } from "@/lib/perms";
import { canI, useServers } from "@/stores/servers";
import { useUI } from "@/stores/ui";
import st from "@/components/settings/Settings.module.css";
import { SaveBar } from "../SettingsLayer";
import s from "./RulesPage.module.css";

/** The rules as a list: one rule to a line in the text the server keeps. */
function ruleLines(rules: string): string[] {
  return rules
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * A server's own rules. Whoever manages the server writes them here, one
 * to a line; everyone else in the server reads the same page as a list —
 * the nav entry is open to all members (ServerSettingsModal), and this
 * page follows the permission the server itself enforces on the write.
 */
export default function RulesPage({ serverId }: { serverId: string }) {
  const entry = useServers((x) => x.byId[serverId]);
  const server = entry?.server;
  const toast = useUI((u) => u.toast);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!server) return null;

  if (!canI(entry, P.MANAGE_SERVER)) {
    const lines = ruleLines(server.rules);
    return (
      <>
        <h2 className={st.title}>{t("serverRules.title")}</h2>
        {lines.length === 0 ? (
          <p className={st.hint}>{t("serverRules.noneYet")}</p>
        ) : (
          <ol className={s.ruleList}>
            {lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        )}
      </>
    );
  }

  const text = draft ?? server.rules;
  const dirty = text !== server.rules;
  const save = async () => {
    setBusy(true);
    try {
      const srv = await serversApi.patch(serverId, { rules: text });
      useServers.getState().updateServer(srv);
      setDraft(null);
      toast(t("serverRules.saved"), "success");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : t("serverRules.failed"), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <h2 className={st.title}>{t("serverRules.title")}</h2>
      <div className={st.form}>
        <p className={st.hint}>{t("serverRules.intro")}</p>
        <Field label={t("serverRules.label")} hint={t("serverRules.hint")}>
          <TextArea value={text} onChange={(e) => setDraft(e.target.value)} rows={10} maxLength={4000} placeholder={t("serverRules.placeholder")} data-testid="server-rules-editor" />
        </Field>
      </div>
      <SaveBar dirty={dirty} busy={busy} onReset={() => setDraft(null)} onSave={() => void save()} />
    </>
  );
}
