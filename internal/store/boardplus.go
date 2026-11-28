package store

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"time"

	"evilion.xyz/chat/internal/db"
	"evilion.xyz/chat/internal/ids"
)

// Board 20: levels & XP, login streaks, avatar items, the Cookie Shop,
// server boosts, message edit history, voice raise-hand, friend nicknames,
// bookmarks and quiet hours. Everything here is one small table or a few
// columns on users, following the cookies.go pattern: one row, one
// transaction, no extra tables to keep in step.

// XPPerMessage is the XP one chat message earns, at most once a minute.
const XPPerMessage = 10

// XPPerLevel is the XP each level costs: level is xp / XPPerLevel.
const XPPerLevel = 100

// LevelUpBonus is the Cookies a level-up pays.
const LevelUpBonus = 50

// StreakWeekBonus is the Cookies a 7-day login streak pays, then every
// 7 days after that.
const StreakWeekBonus = 100

// ServerBoostCost is the Cookies one server boost costs.
const ServerBoostCost = 500

// MaxAvatarItems is how many wearable items one account may make.
const MaxAvatarItems = 10

// ErrNotMember is returned when an action needs server membership.
var ErrNotMember = errors.New("not a member of this server")

// LevelForXP is the level an XP total sits at: 100 XP a level.
func LevelForXP(xp int64) int {
	if xp < 0 {
		return 0
	}
	return int(xp / XPPerLevel)
}

// LevelState is an account's XP as the app needs it.
type LevelState struct {
	XP         int64 `json:"xp"`
	Level      int    `json:"level"`
	XPInto     int64  `json:"xp_into_level"`
	XPForNext  int64  `json:"xp_for_next_level"`
	LeveledUp  bool   `json:"leveled_up"`
	Bonus      int64  `json:"bonus"`
	Streak     int64  `json:"streak"`
	Balance    int64  `json:"balance"`
}

// LevelsMe reads an account's XP, level and streak.
func (s *Store) LevelsMe(ctx context.Context, uid ids.ID) (*LevelState, error) {
	st := &LevelState{}
	var xp, streak, balance int64
	err := s.db.R.QueryRowContext(ctx, `SELECT xp, login_streak, cookies_balance FROM users WHERE id = ?`, int64(uid)).Scan(&xp, &streak, &balance)
	if err != nil {
		return nil, err
	}
	st.XP = xp
	st.Level = LevelForXP(xp)
	st.XPInto = xp % XPPerLevel
	st.XPForNext = XPPerLevel
	st.Streak = streak
	st.Balance = balance
	return st, nil
}

// AwardXP pays 10 XP for a chat message, at most once a minute. A level-up
// pays 50 Cookies with it.
func (s *Store) AwardXP(ctx context.Context, uid ids.ID) (*LevelState, error) {
	now := nowMs()
	st := &LevelState{}
	err := s.Tx(ctx, func(tx *db.Tx) error {
		var xp, last, streak, balance int64
		if err := tx.QueryRowContext(ctx, `SELECT xp, last_xp_at, login_streak, cookies_balance FROM users WHERE id = ?`, int64(uid)).Scan(&xp, &last, &streak, &balance); err != nil {
			return err
		}
		st.XP = xp
		st.Level = LevelForXP(xp)
		st.XPInto = xp % XPPerLevel
		st.XPForNext = XPPerLevel
		st.Streak = streak
		st.Balance = balance
		if now-last < 60000 {
			return nil
		}
		oldLevel := LevelForXP(xp)
		xp += XPPerMessage
		if _, err := tx.ExecContext(ctx, `UPDATE users SET xp = ?, last_xp_at = ? WHERE id = ?`, xp, now, int64(uid)); err != nil {
			return err
		}
		st.XP = xp
		st.Level = LevelForXP(xp)
		st.XPInto = xp % XPPerLevel
		if st.Level > oldLevel {
			st.LeveledUp = true
			st.Bonus = LevelUpBonus
			if _, err := tx.ExecContext(ctx, `UPDATE users SET cookies_balance = cookies_balance + ? WHERE id = ?`, LevelUpBonus, int64(uid)); err != nil {
				return err
			}
			st.Balance = balance + LevelUpBonus
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return st, nil
}

// StreakState is an account's login streak after a check-in.
type StreakState struct {
	Streak int64 `json:"streak"`
	Bonus  int64 `json:"bonus"`
}

// CheckinStreak records today's login: a day after yesterday grows the
// streak by one, any other gap restarts it at one. Every 7th day pays
// 100 Cookies.
func (s *Store) CheckinStreak(ctx context.Context, uid ids.ID) (*StreakState, error) {
	today := time.Now().UTC().Format("2006-01-02")
	yesterday := time.Now().UTC().AddDate(0, 0, -1).Format("2006-01-02")
	st := &StreakState{}
	err := s.Tx(ctx, func(tx *db.Tx) error {
		var last string
		var streak int64
		if err := tx.QueryRowContext(ctx, `SELECT last_seen_day, login_streak FROM users WHERE id = ?`, int64(uid)).Scan(&last, &streak); err != nil {
			return err
		}
		st.Streak = streak
		if last == today {
			return nil
		}
		if last == yesterday {
			streak++
		} else {
			streak = 1
		}
		bonus := int64(0)
		if streak%7 == 0 {
			bonus = StreakWeekBonus
		}
		if _, err := tx.ExecContext(ctx, `UPDATE users SET last_seen_day = ?, login_streak = ? WHERE id = ?`, today, streak, int64(uid)); err != nil {
			return err
		}
		if bonus > 0 {
			if _, err := tx.ExecContext(ctx, `UPDATE users SET cookies_balance = cookies_balance + ? WHERE id = ?`, bonus, int64(uid)); err != nil {
				return err
			}
		}
		st.Streak = streak
		st.Bonus = bonus
		return nil
	})
	if err != nil {
		return nil, err
	}
	return st, nil
}

// LeaderboardRow is one account on the Cookies leaderboard.
type LeaderboardRow struct {
	ID          ids.ID `json:"id"`
	DisplayName string  `json:"display_name"`
	Username    string  `json:"username"`
	Cookies     int64   `json:"cookies"`
	XP          int64   `json:"xp"`
	Level       int     `json:"level"`
}

// LeaderboardTop is the richest accounts, by Cookies. Deleted accounts and
// the system account never appear.
func (s *Store) LeaderboardTop(ctx context.Context, limit int) ([]*LeaderboardRow, error) {
	if limit < 1 || limit > 50 {
		limit = 20
	}
	rows, err := s.db.R.QueryContext(ctx, `SELECT id, display_name, username, cookies_balance, xp FROM users WHERE (flags & 4) = 0 AND (flags & 16) = 0 ORDER BY cookies_balance DESC, xp DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*LeaderboardRow{}
	for rows.Next() {
		r := &LeaderboardRow{}
		if err := rows.Scan(&r.ID, &r.DisplayName, &r.Username, &r.Cookies, &r.XP); err != nil {
			return nil, err
		}
		r.Level = LevelForXP(r.XP)
		out = append(out, r)
	}
	return out, rows.Err()
}

// ShopItem is one thing the Cookie Shop sells: a frame becomes a wearable
// avatar item, a badge is an event badge.
type ShopItem struct {
	ID         int64  `json:"id"`
	Kind       string `json:"kind"`
	Name       string `json:"name"`
	Emoji      string `json:"emoji"`
	Price      int64  `json:"price"`
	BadgeID    int64  `json:"badge_id"`
	FrameColor int64  `json:"frame_color"`
}

// ShopList is everything the Cookie Shop sells right now.
func (s *Store) ShopList(ctx context.Context) ([]*ShopItem, error) {
	rows, err := s.db.R.QueryContext(ctx, `SELECT id, kind, name, emoji, price, badge_id, frame_color FROM shop_items WHERE active = 1 ORDER BY price ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*ShopItem{}
	for rows.Next() {
		it := &ShopItem{}
		if err := rows.Scan(&it.ID, &it.Kind, &it.Name, &it.Emoji, &it.Price, &it.BadgeID, &it.FrameColor); err != nil {
			return nil, err
		}
		out = append(out, it)
	}
	return out, rows.Err()
}

// BuyShopItem buys one shop item: the price leaves the balance in the same
// transaction that grants it, so a failed buy moves nothing.
func (s *Store) BuyShopItem(ctx context.Context, uid ids.ID, itemID int64) (balance int64, granted string, err error) {
	err = s.Tx(ctx, func(tx *db.Tx) error {
		var kind, name, emoji string
		var price, badgeID, frameColor int64
		if err := tx.QueryRowContext(ctx, `SELECT kind, name, emoji, price, badge_id, frame_color FROM shop_items WHERE id = ? AND active = 1`, itemID).Scan(&kind, &name, &emoji, &price, &badgeID, &frameColor); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return ErrNotFound
			}
			return err
		}
		var bal int64
		if err := tx.QueryRowContext(ctx, `SELECT cookies_balance FROM users WHERE id = ?`, int64(uid)).Scan(&bal); err != nil {
			return err
		}
		if bal < price {
			return ErrNotEnoughCookies
		}
		if _, err := tx.ExecContext(ctx, `UPDATE users SET cookies_balance = cookies_balance - ? WHERE id = ?`, price, int64(uid)); err != nil {
			return err
		}
		balance = bal - price
		now := nowMs()
		if kind == "badge" {
			granted = "event:" + strconv.FormatInt(badgeID, 10)
			if _, err := tx.ExecContext(ctx, `INSERT INTO user_badges (user_id, badge, granted_by, granted_at) VALUES (?,?,?,?) ON CONFLICT(user_id, badge) DO NOTHING`, int64(uid), granted, int64(uid), now); err != nil {
				return err
			}
			granted = name
			return nil
		}
		id := ids.New()
		if _, err := tx.ExecContext(ctx, `INSERT INTO avatar_items (id, owner_id, name, emoji, color, created_at) VALUES (?,?,?,?,?,?)`, int64(id), int64(uid), name, emoji, frameColor, now); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `UPDATE user_avatar_items SET equipped = 0 WHERE user_id = ?`, int64(uid)); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO user_avatar_items (user_id, item_id, equipped) VALUES (?,?,1)`, int64(uid), int64(id)); err != nil {
			return err
		}
		granted = name
		return nil
	})
	return balance, granted, err
}

// AvatarItem is a wearable item: an emoji and a ring colour for an avatar.
type AvatarItem struct {
	ID      ids.ID `json:"id"`
	OwnerID ids.ID `json:"owner_id"`
	Name    string `json:"name"`
	Emoji   string `json:"emoji"`
	Color   int64  `json:"color"`
}

// CreateAvatarItem makes a wearable item. An account may make ten.
func (s *Store) CreateAvatarItem(ctx context.Context, uid ids.ID, name, emoji string, color int64) (*AvatarItem, error) {
	var count int64
	if err := s.db.R.QueryRowContext(ctx, `SELECT COUNT(*) FROM avatar_items WHERE owner_id = ?`, int64(uid)).Scan(&count); err != nil {
		return nil, err
	}
	if count >= MaxAvatarItems {
		return nil, errors.New("too many avatar items")
	}
	it := &AvatarItem{ID: ids.New(), OwnerID: uid, Name: name, Emoji: emoji, Color: color}
	if _, err := s.db.W.ExecContext(ctx, `INSERT INTO avatar_items (id, owner_id, name, emoji, color, created_at) VALUES (?,?,?,?,?,?)`, int64(it.ID), int64(uid), name, emoji, color, nowMs()); err != nil {
		return nil, err
	}
	return it, nil
}

// MyAvatarItems is every wearable item an account made or bought.
func (s *Store) MyAvatarItems(ctx context.Context, uid ids.ID) ([]*AvatarItem, []ids.ID, error) {
	rows, err := s.db.R.QueryContext(ctx, `SELECT a.id, a.owner_id, a.name, a.emoji, a.color, COALESCE(u.equipped, 0) FROM avatar_items a LEFT JOIN user_avatar_items u ON u.item_id = a.id AND u.user_id = ? WHERE a.owner_id = ? OR u.user_id = ? ORDER BY a.created_at ASC`, int64(uid), int64(uid), int64(uid))
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	items := []*AvatarItem{}
	equipped := []ids.ID{}
	for rows.Next() {
		it := &AvatarItem{}
		var eq int
		if err := rows.Scan(&it.ID, &it.OwnerID, &it.Name, &it.Emoji, &it.Color, &eq); err != nil {
			return nil, nil, err
		}
		items = append(items, it)
		if eq != 0 {
			equipped = append(equipped, it.ID)
		}
	}
	return items, equipped, rows.Err()
}

// EquipAvatarItem wears one of the account's items and takes the rest off.
func (s *Store) EquipAvatarItem(ctx context.Context, uid ids.ID, itemID ids.ID) error {
	return s.Tx(ctx, func(tx *db.Tx) error {
		var one int
		if err := tx.QueryRowContext(ctx, `SELECT 1 FROM user_avatar_items WHERE user_id = ? AND item_id = ?`, int64(uid), int64(itemID)).Scan(&one); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return ErrNotFound
			}
			return err
		}
		if _, err := tx.ExecContext(ctx, `UPDATE user_avatar_items SET equipped = 0 WHERE user_id = ?`, int64(uid)); err != nil {
			return err
		}
		_, err := tx.ExecContext(ctx, `UPDATE user_avatar_items SET equipped = 1 WHERE user_id = ? AND item_id = ?`, int64(uid), int64(itemID))
		return err
	})
}

// EquippedAvatarItems is the worn item for each account asked about.
func (s *Store) EquippedAvatarItems(ctx context.Context, userIDs []ids.ID) (map[ids.ID]*AvatarItem, error) {
	out := map[ids.ID]*AvatarItem{}
	if len(userIDs) == 0 {
		return out, nil
	}
	args := make([]any, 0, len(userIDs))
	ph := ""
	for i, id := range userIDs {
		if i > 0 {
			ph += ","
		}
		ph += "?"
		args = append(args, int64(id))
	}
	rows, err := s.db.R.QueryContext(ctx, `SELECT u.user_id, a.id, a.owner_id, a.name, a.emoji, a.color FROM user_avatar_items u JOIN avatar_items a ON a.id = u.item_id WHERE u.equipped = 1 AND u.user_id IN (`+ph+`)`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var uid ids.ID
		it := &AvatarItem{}
		if err := rows.Scan(&uid, &it.ID, &it.OwnerID, &it.Name, &it.Emoji, &it.Color); err != nil {
			return nil, err
		}
		out[uid] = it
	}
	return out, rows.Err()
}

// BoostLevel is the level a server's boost count sits at: 1 at one boost,
// 2 at five, 3 at ten.
func BoostLevel(count int64) int {
	switch {
	case count >= 10:
		return 3
	case count >= 5:
		return 2
	case count >= 1:
		return 1
	default:
		return 0
	}
}

// BoostInfo is a server's boosts: how many, and what level that is.
func (s *Store) BoostInfo(ctx context.Context, serverID ids.ID) (count int64, level int, err error) {
	err = s.db.R.QueryRowContext(ctx, `SELECT COUNT(*) FROM server_boosts WHERE server_id = ?`, int64(serverID)).Scan(&count)
	if err != nil {
		return 0, 0, err
	}
	return count, BoostLevel(count), nil
}

// BoostServer buys one boost for a server with 500 Cookies. Members only.
func (s *Store) BoostServer(ctx context.Context, serverID, uid ids.ID) (count int64, level int, balance int64, err error) {
	member, err := s.IsMember(ctx, serverID, uid)
	if err != nil {
		return 0, 0, 0, err
	}
	if !member {
		return 0, 0, 0, ErrNotMember
	}
	err = s.Tx(ctx, func(tx *db.Tx) error {
		var bal int64
		if err := tx.QueryRowContext(ctx, `SELECT cookies_balance FROM users WHERE id = ?`, int64(uid)).Scan(&bal); err != nil {
			return err
		}
		if bal < ServerBoostCost {
			return ErrNotEnoughCookies
		}
		if _, err := tx.ExecContext(ctx, `UPDATE users SET cookies_balance = cookies_balance - ? WHERE id = ?`, ServerBoostCost, int64(uid)); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO server_boosts (id, server_id, user_id, cookies, created_at) VALUES (?,?,?,?,?)`, int64(ids.New()), int64(serverID), int64(uid), ServerBoostCost, nowMs()); err != nil {
			return err
		}
		balance = bal - ServerBoostCost
		return nil
	})
	if err != nil {
		return 0, 0, 0, err
	}
	count, level, err = s.BoostInfo(ctx, serverID)
	return count, level, balance, err
}

// EditRecord is one line of a message's edit history.
type EditRecord struct {
	EditorID    ids.ID `json:"editor_id"`
	DisplayName string  `json:"display_name"`
	EditedAt    int64   `json:"edited_at"`
}

// SetProfileBanner saves the account's profile banner colour (0 = none).
func (s *Store) SetProfileBanner(ctx context.Context, uid ids.ID, color int64) error {
	if color < 0 || color > 0xFFFFFF {
		return E(http.StatusBadRequest, "invalid_banner", "A banner is a colour, 0 to 16777215.")
	}
	_, err := s.db.W.ExecContext(ctx, `UPDATE users SET profile_banner = ? WHERE id = ?`, color, int64(uid))
	return err
}

// ProfileBannerOf is the account's profile banner colour (0 = none).
func (s *Store) ProfileBannerOf(ctx context.Context, uid ids.ID) (int64, error) {
	var color int64
	err := s.db.R.QueryRowContext(ctx, `SELECT profile_banner FROM users WHERE id = ?`, int64(uid)).Scan(&color)
	if err != nil {
		return 0, err
	}
	return color, nil
}

// RecordMessageEdit leaves one history line for a content edit.
func (s *Store) RecordMessageEdit(ctx context.Context, messageID, editorID ids.ID) error {
	_, err := s.db.W.ExecContext(ctx, `INSERT INTO message_edits (id, message_id, editor_id, edited_at) VALUES (?,?,?,?)`, int64(ids.New()), int64(messageID), int64(editorID), nowMs())
	return err
}

// EditHistory is a message's edits, oldest first, with who made each one.
func (s *Store) EditHistory(ctx context.Context, messageID ids.ID) ([]*EditRecord, error) {
	rows, err := s.db.R.QueryContext(ctx, `SELECT e.editor_id, COALESCE(u.display_name, ''), e.edited_at FROM message_edits e LEFT JOIN users u ON u.id = e.editor_id WHERE e.message_id = ? ORDER BY e.edited_at ASC`, int64(messageID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*EditRecord{}
	for rows.Next() {
		r := &EditRecord{}
		if err := rows.Scan(&r.EditorID, &r.DisplayName, &r.EditedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// RaisedHand is one raised hand in a voice channel.
type RaisedHand struct {
	UserID   ids.ID `json:"user_id"`
	RaisedAt int64   `json:"raised_at"`
}

// RaiseHand puts a hand up in a voice channel.
func (s *Store) RaiseHand(ctx context.Context, channelID, uid ids.ID) error {
	_, err := s.db.W.ExecContext(ctx, `INSERT INTO voice_hands (channel_id, user_id, raised_at) VALUES (?,?,?) ON CONFLICT(channel_id, user_id) DO UPDATE SET raised_at = excluded.raised_at`, int64(channelID), int64(uid), nowMs())
	return err
}

// LowerHand takes a hand down again.
func (s *Store) LowerHand(ctx context.Context, channelID, uid ids.ID) error {
	_, err := s.db.W.ExecContext(ctx, `DELETE FROM voice_hands WHERE channel_id = ? AND user_id = ?`, int64(channelID), int64(uid))
	return err
}

// HandsFor is every raised hand in a voice channel, oldest first.
func (s *Store) HandsFor(ctx context.Context, channelID ids.ID) ([]*RaisedHand, error) {
	rows, err := s.db.R.QueryContext(ctx, `SELECT user_id, raised_at FROM voice_hands WHERE channel_id = ? ORDER BY raised_at ASC`, int64(channelID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*RaisedHand{}
	for rows.Next() {
		h := &RaisedHand{}
		if err := rows.Scan(&h.UserID, &h.RaisedAt); err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	return out, rows.Err()
}



// Bookmark is one saved message.
type Bookmark struct {
	MessageID ids.ID `json:"message_id"`
	ChannelID ids.ID `json:"channel_id"`
	CreatedAt int64   `json:"created_at"`
}

// AddBookmark saves a message. Saving it twice keeps the first save.
func (s *Store) AddBookmark(ctx context.Context, uid, messageID, channelID ids.ID) error {
	_, err := s.db.W.ExecContext(ctx, `INSERT INTO bookmarks (id, user_id, message_id, channel_id, created_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id, message_id) DO NOTHING`, int64(ids.New()), int64(uid), int64(messageID), int64(channelID), nowMs())
	return err
}

// RemoveBookmark unsaves a message.
func (s *Store) RemoveBookmark(ctx context.Context, uid, messageID ids.ID) error {
	_, err := s.db.W.ExecContext(ctx, `DELETE FROM bookmarks WHERE user_id = ? AND message_id = ?`, int64(uid), int64(messageID))
	return err
}

// Bookmarks is an account's saved messages, newest first.
func (s *Store) Bookmarks(ctx context.Context, uid ids.ID) ([]*Bookmark, error) {
	rows, err := s.db.R.QueryContext(ctx, `SELECT message_id, channel_id, created_at FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`, int64(uid))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*Bookmark{}
	for rows.Next() {
		b := &Bookmark{}
		if err := rows.Scan(&b.MessageID, &b.ChannelID, &b.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// QuietHours is an account's do-not-disturb hours, in minutes after
// midnight. Start and end are only read while quiet is enabled.
type QuietHours struct {
	Enabled bool  `json:"enabled"`
	Start   int64 `json:"start"`
	End     int64 `json:"end"`
}

// QuietHoursOf reads an account's quiet hours.
func (s *Store) QuietHoursOf(ctx context.Context, uid ids.ID) (*QuietHours, error) {
	q := &QuietHours{}
	var enabled int
	if err := s.db.R.QueryRowContext(ctx, `SELECT quiet_enabled, quiet_start, quiet_end FROM users WHERE id = ?`, int64(uid)).Scan(&enabled, &q.Start, &q.End); err != nil {
		return nil, err
	}
	q.Enabled = enabled != 0
	return q, nil
}

// SetQuietHours saves an account's quiet hours.
func (s *Store) SetQuietHours(ctx context.Context, uid ids.ID, q *QuietHours) error {
	enabled := 0
	if q.Enabled {
		enabled = 1
	}
	_, err := s.db.W.ExecContext(ctx, `UPDATE users SET quiet_enabled = ?, quiet_start = ?, quiet_end = ? WHERE id = ?`, enabled, q.Start, q.End, int64(uid))
	return err
}

// ChannelReader is one account's read marker in a channel.
type ChannelReader struct {
	UserID      ids.ID  `json:"user_id"`
	LastReadID  *ids.ID `json:"last_read_id"`
}

// ChannelReaders is every account's read marker in a channel, for read
// receipts: whoever read up to a message has seen it.
func (s *Store) ChannelReaders(ctx context.Context, channelID ids.ID) ([]*ChannelReader, error) {
	rows, err := s.db.R.QueryContext(ctx, `SELECT user_id, last_read_message_id FROM read_states WHERE channel_id = ?`, int64(channelID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*ChannelReader{}
	for rows.Next() {
		r := &ChannelReader{}
		var last sql.NullInt64
		if err := rows.Scan(&r.UserID, &last); err != nil {
			return nil, err
		}
		if last.Valid {
			id := ids.ID(last.Int64)
			r.LastReadID = &id
		}
		out = append(out, r)
	}
	return out, rows.Err()
}
