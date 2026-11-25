package store

import (
	"context"

	"evilion.xyz/chat/internal/ids"
)

// RulesAcceptance says which version of Board's rules an account has agreed
// to, and when: version 0 while it has not agreed yet. Accounts from before
// the rules step carry version 1 with an acceptedAt of 0 (migration 0055
// stamped them; they agreed to the Terms when they signed up).
func (s *Store) RulesAcceptance(ctx context.Context, uid ids.ID) (acceptedAt int64, version int, err error) {
	err = s.db.R.QueryRowContext(ctx, `SELECT rules_accepted_at, rules_version FROM users WHERE id = ?`, int64(uid)).Scan(&acceptedAt, &version)
	if err != nil {
		return 0, 0, err
	}
	return acceptedAt, version, nil
}

// AcceptRules records that an account has read and agreed to the given
// version of Board's rules, from the rules step it meets before the app.
func (s *Store) AcceptRules(ctx context.Context, uid ids.ID, version int) error {
	_, err := s.db.W.ExecContext(ctx, `UPDATE users SET rules_accepted_at = ?, rules_version = ? WHERE id = ?`, nowMs(), version, int64(uid))
	return err
}
