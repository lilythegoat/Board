-- Board 20: levels & XP, login streaks, avatar items, the Cookie Shop,
-- server boosts, message edit history, voice raise-hand, friend nicknames,
-- bookmarks and quiet hours.
ALTER TABLE users ADD COLUMN xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN last_xp_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN last_seen_day TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN login_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN quiet_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN quiet_start INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN quiet_end INTEGER NOT NULL DEFAULT 0;

-- Wearable avatar items: made by accounts, worn one at a time.
CREATE TABLE avatar_items (
  id         INTEGER PRIMARY KEY,
  owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  emoji      TEXT NOT NULL DEFAULT '',
  color      INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX avatar_items_owner ON avatar_items(owner_id);
CREATE TABLE user_avatar_items (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id  INTEGER NOT NULL REFERENCES avatar_items(id) ON DELETE CASCADE,
  equipped INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, item_id)
);

-- The Cookie Shop: frames become avatar items, badges are event badges.
CREATE TABLE shop_items (
  id          INTEGER PRIMARY KEY,
  kind        TEXT NOT NULL,
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL DEFAULT '',
  price       INTEGER NOT NULL,
  badge_id    INTEGER NOT NULL DEFAULT 0,
  frame_color INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1
);
INSERT INTO shop_items (id, kind, name, emoji, price, badge_id, frame_color, active) VALUES
  (1, 'frame', 'Purple Glow Frame', '💜', 200, 0, 8388736, 1),
  (2, 'frame', 'Golden Frame', '💛', 500, 0, 16766720, 1),
  (3, 'frame', 'Ocean Frame', '💙', 300, 0, 255, 1),
  (4, 'badge', 'Cookie Monster', '🍪', 150, 1001, 0, 1),
  (5, 'badge', 'Early Bird', '🌅', 250, 1002, 0, 1),
  (6, 'badge', 'Night Owl', '🦉', 250, 1003, 0, 1);
INSERT INTO badge_defs (id, name, icon, color, description, created_by, created_at) VALUES
  (1001, 'Cookie Monster', '🍪', 8388736, 'Bought in the Cookie Shop.', 0, 1763942400000),
  (1002, 'Early Bird', '🌅', 16766720, 'Bought in the Cookie Shop.', 0, 1763942400000),
  (1003, 'Night Owl', '🦉', 255, 'Bought in the Cookie Shop.', 0, 1763942400000);

-- Server boosts bought with Cookies: 500 Cookies a boost.
CREATE TABLE server_boosts (
  id         INTEGER PRIMARY KEY,
  server_id  INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cookies    INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX server_boosts_server ON server_boosts(server_id);

-- One line per content edit, so a message can show its edit history.
CREATE TABLE message_edits (
  id         INTEGER PRIMARY KEY,
  message_id INTEGER NOT NULL,
  editor_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  edited_at  INTEGER NOT NULL
);
CREATE INDEX message_edits_message ON message_edits(message_id);

-- Hands raised in a voice channel: transient, but kept in the database so
-- a rejoin still sees them.
CREATE TABLE voice_hands (
  channel_id INTEGER NOT NULL,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raised_at  INTEGER NOT NULL,
  PRIMARY KEY (channel_id, user_id)
);

-- Nicknames an account gives its friends, shown in the friends list and DMs.
CREATE TABLE friend_nicknames (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (user_id, friend_id)
);

-- Saved messages: ids only, the client resolves the words from its own store.
CREATE TABLE bookmarks (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id INTEGER NOT NULL,
  channel_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX bookmarks_user ON bookmarks(user_id);
CREATE UNIQUE INDEX bookmarks_unique ON bookmarks(user_id, message_id);
