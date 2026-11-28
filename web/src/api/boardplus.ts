import { api } from "./client";
import type { Snowflake } from "./types";

/** One row of the richest-members leaderboard. */
export interface LeaderboardEntry {
  user_id: Snowflake;
  display_name: string;
  balance: number;
}

/** Something the Cookie Shop sells. */
export interface ShopItem {
  id: number;
  kind: string;
  name: string;
  description: string;
  price: number;
  badge_id: number | null;
  theme_id: string | null;
}

/** XP, level and streak, as the level card shows them. */
export interface LevelState {
  xp: number;
  level: number;
  xp_into_level: number;
  xp_for_next: number;
  streak: number;
  streak_bonus: number;
  cookies_balance: number;
}

/** A wearable item on an avatar. */
export interface AvatarItem {
  id: string;
  name: string;
  emoji: string;
  color: number;
  created_by: Snowflake;
}

/** One line of a message's edit history. */
export interface MessageEdit {
  id: number;
  message_id: Snowflake;
  editor_id: Snowflake;
  edited_at: number;
}

/** A raised hand in a voice channel. */
export interface VoiceHand {
  channel_id: Snowflake;
  user_id: Snowflake;
  raised_at: number;
}

/** A saved message. */
export interface Bookmark {
  user_id: Snowflake;
  message_id: Snowflake;
  channel_id: Snowflake;
  saved_at: number;
}

/** Do-not-disturb hours, in minutes after midnight. */
export interface QuietHours {
  enabled: boolean;
  start: number;
  end: number;
}

/** A read marker in a channel, for read receipts. */
export interface ChannelReader {
  user_id: Snowflake;
  last_read_message_id: Snowflake;
  last_ack_at: number;
}

/** The Board 20 backend (api/boardplus.go). */
export const boardPlus = {
  leaderboard(): Promise<{ leaderboard: LeaderboardEntry[] }> {
    return api.request("GET", "/cookies/leaderboard");
  },
  shop(): Promise<{ items: ShopItem[] }> {
    return api.request("GET", "/shop");
  },
  buy(itemId: number): Promise<{ balance: number; granted: string }> {
    return api.request("POST", "/shop/buy", { item_id: itemId });
  },
  levelsMe(): Promise<LevelState> {
    return api.request("GET", "/levels/me");
  },
  awardXp(): Promise<LevelState> {
    return api.request("POST", "/levels/award");
  },
  checkin(): Promise<LevelState> {
    return api.request("POST", "/streak/checkin");
  },
  boost(serverId: Snowflake): Promise<{ boosts: number; level: number; balance: number }> {
    return api.request("POST", `/servers/${serverId}/boost`);
  },
  boosts(serverId: Snowflake): Promise<{ boosts: number; level: number }> {
    return api.request("GET", `/servers/${serverId}/boosts`);
  },
  avatarItems(): Promise<{ items: AvatarItem[]; equipped: string | null }> {
    return api.request("GET", "/avatar-items");
  },
  createAvatarItem(name: string, emoji: string, color: number): Promise<AvatarItem> {
    return api.request("POST", "/avatar-items", { name, emoji, color });
  },
  equipAvatarItem(id: string): Promise<{ equipped: string }> {
    return api.request("POST", `/avatar-items/${id}/equip`);
  },
  equippedAvatarItems(ids: Snowflake[]): Promise<{ equipped: Record<string, AvatarItem> }> {
    return api.request("GET", `/avatar-items/equipped?ids=${ids.join(",")}`);
  },
  messageEdits(channelId: Snowflake, messageId: Snowflake): Promise<{ edits: MessageEdit[] }> {
    return api.request("GET", `/channels/${channelId}/messages/${messageId}/edits`);
  },
  setHand(channelId: Snowflake, raised: boolean): Promise<{ raised: boolean }> {
    return api.request("POST", `/voice/${channelId}/hand`, { raised });
  },
  hands(channelId: Snowflake): Promise<{ hands: VoiceHand[] }> {
    return api.request("GET", `/voice/${channelId}/hands`);
  },
  nicknames(): Promise<{ nicknames: Record<string, string> }> {
    return api.request("GET", "/nicknames");
  },
  setNickname(friendId: Snowflake, nickname: string): Promise<{ friend_id: Snowflake; nickname: string }> {
    return api.request("POST", "/nicknames", { friend_id: friendId, nickname });
  },
  bookmarks(): Promise<{ bookmarks: Bookmark[] }> {
    return api.request("GET", "/bookmarks");
  },
  addBookmark(messageId: Snowflake): Promise<{ saved: boolean }> {
    return api.request("POST", "/bookmarks", { message_id: messageId });
  },
  removeBookmark(messageId: Snowflake): Promise<{ saved: boolean }> {
    return api.request("DELETE", `/bookmarks/${messageId}`);
  },
  quietHours(): Promise<QuietHours> {
    return api.request("GET", "/quiet-hours");
  },
  setQuietHours(q: QuietHours): Promise<QuietHours> {
    return api.request("POST", "/quiet-hours", q);
  },
  channelReaders(channelId: Snowflake): Promise<{ readers: ChannelReader[] }> {
    return api.request("GET", `/channels/${channelId}/readers`);
  },
};
