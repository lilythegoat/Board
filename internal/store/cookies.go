package store

import (
	"context"
	"errors"
	"time"

	"evilion.xyz/chat/internal/db"
	"evilion.xyz/chat/internal/ids"
)

// Cookies are Board's own currency: accounts earn them, spend them, and
// give them to each other. The balance lives on the account row, so every
// read and write below is one row — no extra table to keep in step.

// CookiesStartingBalance is what a new account (and every account from
// before real balances) holds: the same 100 the display-only Cookies
// Place showed.
const CookiesStartingBalance = 100

// CookiesDailyBonus is what the daily bonus pays, once a day.
const CookiesDailyBonus = 50

// MaxCookieGift is the most Cookies one gift can move.
const MaxCookieGift = 10000

// ErrNotEnoughCookies is returned when a gift is more than the giver holds.
var ErrNotEnoughCookies = errors.New("not enough cookies")

// CookiesState is an account's Cookies as its app needs them: the balance,
// when the daily bonus was last claimed, and whether it can be claimed now.
type CookiesState struct {
	Balance       int64 `json:"balance"`
	LastDaily     int64 `json:"last_daily"`
	CanClaimDaily bool  `json:"can_claim_daily"`
}

// cookiesDayStart is the start of today, UTC: the line a daily claim must
// be after to count for today.
func cookiesDayStart() int64 {
	return time.Now().UTC().Truncate(24 * time.Hour).UnixMilli()
}

// CookiesState reads an account's Cookies.
func (s *Store) CookiesState(ctx context.Context, uid ids.ID) (*CookiesState, error) {
	st := &CookiesState{}
	err := s.db.R.QueryRowContext(ctx, `SELECT cookies_balance, cookies_last_daily FROM users WHERE id = ?`, int64(uid)).Scan(&st.Balance, &st.LastDaily)
	if err != nil {
		return nil, err
	}
	st.CanClaimDaily = st.LastDaily < cookiesDayStart()
	return st, nil
}

// AddCookies moves an account's balance by delta, up or down, and returns
// the new balance. It is the owner's way of giving: the owner holds
// unlimited Cookies, so their gifts credit the receiver without debiting
// anyone.
func (s *Store) AddCookies(ctx context.Context, uid ids.ID, delta int64) (int64, error) {
	var balance int64
	err := s.Tx(ctx, func(tx *db.Tx) error {
		if _, err := tx.ExecContext(ctx, `UPDATE users SET cookies_balance = cookies_balance + ? WHERE id = ?`, delta, int64(uid)); err != nil {
			return err
		}
		return tx.QueryRowContext(ctx, `SELECT cookies_balance FROM users WHERE id = ?`, int64(uid)).Scan(&balance)
	})
	return balance, err
}

// ClaimDailyCookies pays the daily bonus, once a day: the claim is one
// guarded update, so two taps at once still pay only once. It returns the
// new balance and whether this call was the one that paid.
func (s *Store) ClaimDailyCookies(ctx context.Context, uid ids.ID) (balance int64, claimed bool, err error) {
	now := time.Now().UnixMilli()
	res, err := s.db.W.ExecContext(ctx, `UPDATE users SET cookies_balance = cookies_balance + ?, cookies_last_daily = ? WHERE id = ? AND cookies_last_daily < ?`, CookiesDailyBonus, now, int64(uid), cookiesDayStart())
	if err != nil {
		return 0, false, err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return 0, false, err
	}
	st, err := s.CookiesState(ctx, uid)
	if err != nil {
		return 0, false, err
	}
	return st.Balance, n == 1, nil
}

// GiveCookies moves amount Cookies from one account to another, in one
// transaction: the giver must hold at least that many, and a gift that
// fails moves nothing. It returns both new balances.
func (s *Store) GiveCookies(ctx context.Context, from, to ids.ID, amount int64) (fromBalance, toBalance int64, err error) {
	err = s.Tx(ctx, func(tx *db.Tx) error {
		var bal int64
		if err := tx.QueryRowContext(ctx, `SELECT cookies_balance FROM users WHERE id = ?`, int64(from)).Scan(&bal); err != nil {
			return err
		}
		if bal < amount {
			return ErrNotEnoughCookies
		}
		if _, err := tx.ExecContext(ctx, `UPDATE users SET cookies_balance = cookies_balance - ? WHERE id = ?`, amount, int64(from)); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `UPDATE users SET cookies_balance = cookies_balance + ? WHERE id = ?`, amount, int64(to)); err != nil {
			return err
		}
		fromBalance = bal - amount
		return nil
	})
	if err != nil {
		return 0, 0, err
	}
	st, err := s.CookiesState(ctx, to)
	if err != nil {
		return 0, 0, err
	}
	return fromBalance, st.Balance, nil
}

// WelcomePending reports whether Board's welcome is still waiting in an
// account's Board conversation: set when the account is made, cleared
// once they have read the conversation.
func (s *Store) WelcomePending(ctx context.Context, uid ids.ID) (bool, error) {
	var pending int
	err := s.db.R.QueryRowContext(ctx, `SELECT welcome_pending FROM users WHERE id = ?`, int64(uid)).Scan(&pending)
	if err != nil {
		return false, err
	}
	return pending != 0, nil
}

// SetWelcomePending marks Board's welcome as waiting, or as read.
func (s *Store) SetWelcomePending(ctx context.Context, uid ids.ID, pending bool) error {
	v := 0
	if pending {
		v = 1
	}
	_, err := s.db.W.ExecContext(ctx, `UPDATE users SET welcome_pending = ? WHERE id = ?`, v, int64(uid))
	return err
}
