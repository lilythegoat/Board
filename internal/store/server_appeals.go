package store

import (
	"context"
	"database/sql"

	"evilion.xyz/chat/internal/ids"
)

// ServerBanAppeal is a banned member's ask for a server's moderators to lift
// their ban (server_ban_appeals). Status is "pending" until a moderator
// resolves it "accepted" (which also lifts the ban) or "denied".
type ServerBanAppeal struct {
	ID         ids.ID  `json:"id"`
	ServerID   ids.ID  `json:"server_id"`
	UserID     ids.ID  `json:"user_id"`
	Message    string  `json:"message"`
	Status     string  `json:"status"`
	CreatedAt  int64   `json:"created_at"`
	ResolvedBy *ids.ID `json:"resolved_by"`
	ResolvedAt *int64  `json:"resolved_at"`
}

const serverBanAppealCols = `id, server_id, user_id, message, status, created_at, resolved_by, resolved_at`

func scanServerBanAppeal(r rowScanner) (*ServerBanAppeal, error) {
	var a ServerBanAppeal
	var resolvedBy, resolvedAt sql.NullInt64
	if err := r.Scan(&a.ID, &a.ServerID, &a.UserID, &a.Message, &a.Status, &a.CreatedAt, &resolvedBy, &resolvedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	a.ResolvedBy, a.ResolvedAt = idPtr(resolvedBy), int64Ptr(resolvedAt)
	return &a, nil
}

// CreateServerBanAppeal files an appeal. A member may have only one pending
// appeal per server (a partial unique index says so); a second while one is
// pending fails, and the caller turns that into a conflict answer.
func (s *Store) CreateServerBanAppeal(ctx context.Context, serverID, uid ids.ID, message string) (*ServerBanAppeal, error) {
	a := &ServerBanAppeal{ID: ids.New(), ServerID: serverID, UserID: uid, Message: message, Status: "pending", CreatedAt: nowMs()}
	_, err := s.db.W.ExecContext(ctx, `INSERT INTO server_ban_appeals (id, server_id, user_id, message, status, created_at) VALUES (?,?,?,?,?,?)`,
		int64(a.ID), int64(serverID), int64(uid), a.Message, a.Status, a.CreatedAt)
	if err != nil {
		return nil, err
	}
	return a, nil
}

// PendingServerBanAppeal is the appeal a member is still waiting on in a
// server, or ErrNotFound when there is none.
func (s *Store) PendingServerBanAppeal(ctx context.Context, serverID, uid ids.ID) (*ServerBanAppeal, error) {
	return scanServerBanAppeal(s.db.R.QueryRowContext(ctx, `SELECT `+serverBanAppealCols+` FROM server_ban_appeals WHERE server_id = ? AND user_id = ? AND status = 'pending'`, int64(serverID), int64(uid)))
}

// LatestServerBanAppeal is a member's most recent appeal in a server,
// pending or settled, or ErrNotFound when they have never appealed.
func (s *Store) LatestServerBanAppeal(ctx context.Context, serverID, uid ids.ID) (*ServerBanAppeal, error) {
	return scanServerBanAppeal(s.db.R.QueryRowContext(ctx, `SELECT `+serverBanAppealCols+` FROM server_ban_appeals WHERE server_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1`, int64(serverID), int64(uid)))
}

// ServerBanAppealByID reads one appeal of a server, for resolving it.
func (s *Store) ServerBanAppealByID(ctx context.Context, serverID, appealID ids.ID) (*ServerBanAppeal, error) {
	return scanServerBanAppeal(s.db.R.QueryRowContext(ctx, `SELECT `+serverBanAppealCols+` FROM server_ban_appeals WHERE server_id = ? AND id = ?`, int64(serverID), int64(appealID)))
}

// ServerBanAppeals lists a server's appeals, pending first, then newest.
func (s *Store) ServerBanAppeals(ctx context.Context, serverID ids.ID) ([]*ServerBanAppeal, error) {
	rows, err := s.db.R.QueryContext(ctx, `SELECT `+serverBanAppealCols+` FROM server_ban_appeals WHERE server_id = ? ORDER BY (status = 'pending') DESC, created_at DESC`, int64(serverID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*ServerBanAppeal{}
	for rows.Next() {
		a, err := scanServerBanAppeal(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// ResolveServerBanAppeal settles a pending appeal. ErrNotFound when it is
// not pending any more, so two moderators cannot settle the same one twice.
func (s *Store) ResolveServerBanAppeal(ctx context.Context, serverID, appealID, resolvedBy ids.ID, status string) error {
	res, err := s.db.W.ExecContext(ctx, `UPDATE server_ban_appeals SET status = ?, resolved_by = ?, resolved_at = ? WHERE server_id = ? AND id = ? AND status = 'pending'`,
		status, int64(resolvedBy), nowMs(), int64(serverID), int64(appealID))
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// BanFor is a server's ban of one member, or ErrNotFound when they are not
// banned: what the ban-appeal screens show about the ban being appealed.
func (s *Store) BanFor(ctx context.Context, serverID, uid ids.ID) (*Ban, error) {
	var b Ban
	err := s.db.R.QueryRowContext(ctx, `SELECT server_id, user_id, reason, banned_by, created_at FROM bans WHERE server_id = ? AND user_id = ?`, int64(serverID), int64(uid)).Scan(&b.ServerID, &b.UserID, &b.Reason, &b.BannedBy, &b.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &b, nil
}
