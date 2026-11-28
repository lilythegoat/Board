import { useEffect, useState } from "react";
import { boardPlus, type MessageEdit } from "@/api/boardplus";
import { Modal } from "@/components/common/Modal";
import { displayName, useUsers } from "@/stores/users";
import { formatTimestamp } from "@/lib/time";
import s from "./EditHistoryModal.module.css";

import { t } from "@/i18n";
/** When a message changed, and who changed it — the edit history view. */
export function EditHistoryModal({ onClose, channelId, messageId }: { onClose: () => void; channelId: string; messageId: string }) {
  const [edits, setEdits] = useState<MessageEdit[] | null>(null);
  const [failed, setFailed] = useState(false);
  const users = useUsers((u) => u.byId);

  useEffect(() => {
    let alive = true;
    boardPlus
      .messageEdits(channelId, messageId)
      .then((r) => {
        if (alive) setEdits(r.edits);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [channelId, messageId]);

  return (
    <Modal open onClose={onClose} title={t("chat.messageMenu.editHistory")} width={440}>
      <div className={s.list}>
        {failed ? (
          <div className={s.empty}>{t("chat.messageMenu.editHistoryFailed")}</div>
        ) : edits === null ? (
          <div className={s.empty}>{t("chat.pins.loading")}</div>
        ) : edits.length === 0 ? (
          <div className={s.empty}>{t("chat.messageMenu.noEdits")}</div>
        ) : (
          edits.map((e) => (
            <div key={e.id} className={s.row}>
              <span className={s.who}>{displayName(users[e.editor_id])}</span>
              <span className={s.when}>{formatTimestamp(e.edited_at)}</span>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
