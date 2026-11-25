-- Appeals against a server's own bans (server_ban_appeals): a banned member
-- asks the server's moderators to lift the ban, and a moderator accepts
-- (which lifts it) or denies. Instance bans keep their cases; this is only
-- for the bans in the bans table. One appeal may be pending per member and
-- server; settled ones stay as the record.
CREATE TABLE server_ban_appeals (
  id          INTEGER PRIMARY KEY,
  server_id   INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  INTEGER NOT NULL,
  resolved_by INTEGER,
  resolved_at INTEGER
);
CREATE INDEX server_ban_appeals_server ON server_ban_appeals(server_id, status, created_at);
CREATE UNIQUE INDEX server_ban_appeals_pending ON server_ban_appeals(server_id, user_id) WHERE status = 'pending';
