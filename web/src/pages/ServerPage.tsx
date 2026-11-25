import { ChannelGlyph } from "@/components/common/ChannelGlyph";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "@/api/client";
import { servers as serversApi, type MyBanState } from "@/api/servers";
import { channels as channelsApi } from "@/api/channels";
import { lazyPage } from "@/lib/lazyChunk";
import { isThread } from "@/stores/threads";
import { Button } from "@/components/common/Button";
import { TextArea } from "@/components/common/TextInput";
import { ChatView } from "@/components/chat/ChatView";
import { VoiceRoom } from "@/components/voice/VoiceRoom";
import { PaneSpinner } from "@/components/common/Spinner";
import { PageHeaderButtons } from "@/components/shell/PageHeader";
import { channelTree, useChannels } from "@/stores/channels";
import { useServers } from "@/stores/servers";
import { rememberChannel } from "@/stores/serverNav";
import { useUI } from "@/stores/ui";
import { useUsers } from "@/stores/users";
import { isForum } from "@/lib/threads";
import s from "./ServerPage.module.css";

import { t as tr_ } from "@/i18n";

const ForumView = lazyPage(() => import("@/components/forum/ForumView"));

/** Channels people write in, where the conversation is the page. */
function talkable(type: string | undefined): boolean {
  return type === "text" || type === "announcement" || type === "thread" || type === "private_thread";
}

export default function ServerPage() {
  const { serverId = "", channelId, messageId } = useParams();
  const nav = useNavigate();
  // Handed on through the redirects below: opening a server from the phone's
  // drawer asks it to stay open on the channel list (AppShell's keepDrawer),
  // and the hop to the first channel dropped that and shut the drawer.
  const { state: navState } = useLocation();
  const st = useServers((x) => x.byId[serverId]);
  const setFromView = useServers((x) => x.setFromView);
  const channels = useChannels((c) => c.byId);
  const upsert = useChannels((c) => c.upsert);
  const upsertUsers = useUsers((u) => u.upsert);
  const setActiveChannel = useUI((u) => u.setActiveChannel);
  const setJumpTo = useUI((u) => u.setJumpTo);
  // "Gone" and "the request failed" are different things: being kicked belongs
  // at home, a 500 belongs on a page with a Try again on it. Sending the reader
  // home either way made a network blip indistinguishable from being removed.
  const [missing, setMissing] = useState(false);
  // Banned from this server is its own answer, not "gone": the ban, and the
  // appeal against it, are shown where the server would have opened.
  const [banState, setBanState] = useState<MyBanState | null>(null);
  const [appealText, setAppealText] = useState("");
  const [appealBusy, setAppealBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const seen = useRef<string | null>(null);
  const channel = channelId ? channels[channelId] : undefined;
  // A thread this app does not hold yet (a closed one, or one opened from a
  // link before the server's threads arrived) is fetched once by its link, and
  // waited for: falling back to the first channel while the answer was still
  // on its way sent a thread's link to #general.
  const [asked, setAsked] = useState<{ id: string; done: boolean } | null>(null);
  useEffect(() => {
    if (!st || !channelId || channel || asked?.id === channelId || !/^\d+$/.test(channelId)) return;
    const id = channelId;
    setAsked({ id, done: false });
    channelsApi
      .get(id)
      .then((ch) => {
        if (ch.server_id === serverId && isThread(ch)) upsert(ch);
      })
      .catch(() => undefined)
      .finally(() => setAsked((a) => (a?.id === id ? { id, done: true } : a)));
  }, [st, channelId, channel, asked, serverId, upsert]);

  // an unknown server (deep link before ready, or one we were just added to) is fetched once;
  // one that vanishes after being seen was left, deleted or kicked from: go home without asking
  useEffect(() => {
    if (st) {
      seen.current = serverId;
      setMissing(false);
      setBanState(null);
      return;
    }
    if (!serverId) return;
    // Which server was seen, not merely that one was: all three server routes
    // render this same element, so following a link from one server to another
    // never remounts, and a plain flag would take the second for one that went
    // away and send the reader home without ever asking for it.
    if (seen.current === serverId) {
      setMissing(true);
      return;
    }
    setMissing(false);
    setFailed(false);
    let alive = true;
    serversApi
      .get(serverId)
      .then((res) => {
        if (!alive) return;
        upsertUsers(res.users);
        upsert(res.server.channels);
        setFromView(res.server);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 403) {
          // A ban and a removal answer the same way here; ask which it is
          // before sending the reader home — the appeal state answers for
          // a banned member, where the server itself will not.
          void serversApi
            .myBan(serverId)
            .then((state) => {
              if (!alive) return;
              if (state.banned) {
                setBanState(state);
                return;
              }
              useUI.getState().toast(tr_("server.youAreNoLongerInThatServer"), "error");
              setMissing(true);
            })
            .catch(() => {
              if (!alive) return;
              useUI.getState().toast(tr_("server.youAreNoLongerInThatServer"), "error");
              setMissing(true);
            });
          return;
        }
        if (err instanceof ApiError && err.status === 404) {
          useUI.getState().toast(tr_("server.thatServerIsGone"), "error");
          setMissing(true);
          return;
        }
        setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [st, serverId, setFromView, upsert, upsertUsers, attempt]);

  const firstText = useMemo(() => {
    const tree = channelTree(channels, serverId);
    const loose = tree.loose.find((c) => c.type === "text" || c.type === "announcement");
    if (loose) return loose.id;
    for (const cat of tree.categories) {
      const t = cat.children.find((c) => c.type === "text" || c.type === "announcement");
      if (t) return t.id;
    }
    return null;
  }, [channels, serverId]);

  // Keyed on the id and type, not the channel object: every new message
  // replaces that object, and re-running this would cancel a reply or edit.
  const chId = channel?.id;
  const chType = channel?.type;
  useEffect(() => {
    // a voice channel's chat says for itself while it is open (VoiceRoom)
    if (chType === "voice") return;
    if (!chId || !talkable(chType)) {
      setActiveChannel(null);
      return;
    }
    setActiveChannel(chId);
    rememberChannel(serverId, chId);
    return () => setActiveChannel(null);
  }, [chId, chType, serverId, setActiveChannel]);

  useEffect(() => {
    if (channelId && messageId && /^\d+$/.test(messageId)) setJumpTo({ channelId, messageId });
  }, [channelId, messageId, setJumpTo]);

  useEffect(() => {
    if (missing) nav("/channels/@me", { replace: true });
  }, [missing, nav]);

  const sendAppeal = async () => {
    setAppealBusy(true);
    try {
      const appeal = await serversApi.appealBan(serverId, appealText.trim());
      setBanState((cur) => (cur ? { ...cur, appeal } : cur));
      setAppealText("");
      useUI.getState().toast(tr_("serverAppeals.sentToast"), "success");
    } catch (err) {
      useUI.getState().toast(err instanceof ApiError ? err.message : tr_("serverAppeals.sendFailed"), "error");
    } finally {
      setAppealBusy(false);
    }
  };

  if (!st && banState?.banned) {
    const appeal = banState.appeal;
    return (
      <div className={s.empty}>
        <header className={s.header}><PageHeaderButtons /></header>
        <div className={s.emptyBody}>
          <h2>{tr_("serverAppeals.bannedTitle")}</h2>
          <p>{tr_("serverAppeals.bannedLead")}</p>
          {banState.ban?.reason ? <p>{tr_("serverAppeals.banReason", { reason: banState.ban.reason })}</p> : null}
          {appeal?.status === "pending" ? (
            <p data-testid="server-appeal-pending">{tr_("serverAppeals.pending")}</p>
          ) : appeal?.status === "accepted" ? (
            <p>{tr_("serverAppeals.acceptedNote")}</p>
          ) : (
            <>
              {appeal?.status === "denied" ? <p>{tr_("serverAppeals.deniedNote")}</p> : null}
              <TextArea value={appealText} onChange={(e) => setAppealText(e.target.value)} rows={4} maxLength={1000} placeholder={tr_("serverAppeals.messagePlaceholder")} data-testid="server-appeal-message" style={{ width: "100%", maxWidth: 420, textAlign: "left" }} />
              <Button loading={appealBusy} onClick={() => void sendAppeal()} data-testid="server-appeal-send">
                {tr_("serverAppeals.appealButton")}
              </Button>
            </>
          )}
          <Button variant="secondary" onClick={() => nav("/channels/@me", { replace: true })}>{tr_("serverAppeals.backHome")}</Button>
        </div>
      </div>
    );
  }

  if (!st && failed) {
    return (
      <div className={s.empty}>
        <header className={s.header}><PageHeaderButtons /></header>
        <div className={s.emptyBody}>
          <h2>{tr_("server.thatServerCouldNotBeOpened")}</h2>
          <p>{tr_("server.theRequestDidNotGetThrough")}</p>
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>{tr_("chat.messageList.tryAgain")}</Button>
        </div>
      </div>
    );
  }
  if (!st) return <PaneSpinner text={tr_("server.openingServer")} />;
  // a thread asked for by its link is waited for before falling back to the first channel
  if (channelId && !channel && !(asked?.id === channelId && asked.done) && /^\d+$/.test(channelId)) return <PaneSpinner text={tr_("server.openingServer")} />;
  if (!channelId || (channelId && !channel && firstText)) {
    if (firstText) return <Navigate to={`/channels/${serverId}/${firstText}`} replace state={navState} />;
    if (!channelId) return <NoChannels />;
  }
  if (!channel || channel.server_id !== serverId) return <NoChannels />;
  if (channel.type === "voice") return <VoiceRoom channel={channel} />;
  // a link channel only opens its address (lib/linkChannel), so a path to one leads to the server
  if (channel.type === "category" || channel.type === "link") return <Navigate to={`/channels/${serverId}`} replace state={navState} />;
  if (isForum(channel)) {
    return (
      <Suspense fallback={<PaneSpinner text={tr_("forum.loading")} />}>
        <ForumView channel={channel} />
      </Suspense>
    );
  }
  return <ChatView channel={channel} />;
}

function NoChannels() {
  return (
    <div className={s.empty}>
      <header className={s.header}><PageHeaderButtons /></header>
      <div className={s.emptyBody}>
        <h2>{tr_("server.noTextChannels")}</h2>
        <p>{tr_("server.youFindYourselfInAStrange")}</p>
      </div>
    </div>
  );
}
