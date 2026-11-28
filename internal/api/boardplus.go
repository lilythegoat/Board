package api

import (
	"errors"
	"net/http"
	"strings"
	"unicode/utf8"

	"evilion.xyz/chat/internal/auth"
	"evilion.xyz/chat/internal/ids"
	"evilion.xyz/chat/internal/store"
)

// Board 20: the leaderboard, the Cookie Shop, levels & XP, login streaks,
// server boosts, avatar items, message edit history, voice raise-hand,
// friend nicknames, bookmarks, quiet hours and DM read receipts.
func (s *Server) boardPlusRoutes(mux *http.ServeMux) {
	mux.Handle("GET /api/v1/cookies/leaderboard", s.authed(s.handleLeaderboard))
	mux.Handle("GET /api/v1/shop", s.authed(s.handleShopList))
	mux.Handle("POST /api/v1/shop/buy", s.authed(s.handleShopBuy))
	mux.Handle("GET /api/v1/levels/me", s.authed(s.handleLevelsMe))
	mux.Handle("POST /api/v1/levels/award", s.authed(s.handleLevelsAward))
	mux.Handle("POST /api/v1/streak/checkin", s.authed(s.handleStreakCheckin))
	mux.Handle("POST /api/v1/servers/{id}/boost", s.authed(s.handleServerBoost))
	mux.Handle("GET /api/v1/servers/{id}/boosts", s.authed(s.handleServerBoosts))
	mux.Handle("GET /api/v1/avatar-items", s.authed(s.handleAvatarItems))
	mux.Handle("POST /api/v1/avatar-items", s.authed(s.handleAvatarItemCreate))
	mux.Handle("POST /api/v1/avatar-items/{id}/equip", s.authed(s.handleAvatarItemEquip))
	mux.Handle("GET /api/v1/avatar-items/equipped", s.authed(s.handleAvatarItemsEquipped))
	mux.Handle("GET /api/v1/channels/{id}/messages/{mid}/edits", s.authed(s.handleMessageEdits))
	mux.Handle("POST /api/v1/voice/{id}/hand", s.authed(s.handleVoiceHand))
	mux.Handle("GET /api/v1/voice/{id}/hands", s.authed(s.handleVoiceHands))
	mux.Handle("GET /api/v1/nicknames", s.authed(s.handleNicknames))
	mux.Handle("POST /api/v1/nicknames", s.authed(s.handleNicknameSet))
	mux.Handle("GET /api/v1/bookmarks", s.authed(s.handleBookmarks))
	mux.Handle("POST /api/v1/bookmarks", s.authed(s.handleBookmarkAdd))
	mux.Handle("DELETE /api/v1/bookmarks/{mid}", s.authed(s.handleBookmarkRemove))
	mux.Handle("GET /api/v1/quiet-hours", s.authed(s.handleQuietHours))
	mux.Handle("POST /api/v1/quiet-hours", s.authed(s.handleQuietHoursSet))
	mux.Handle("GET /api/v1/channels/{id}/readers", s.authed(s.handleChannelReaders))
}

// handleLeaderboard is the richest accounts, by Cookies.
func (s *Server) handleLeaderboard(w http.ResponseWriter, r *http.Request) {
	top, err := s.Store.LeaderboardTop(r.Context(), 20)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"leaderboard": top})
}

// handleShopList is everything the Cookie Shop sells.
func (s *Server) handleShopList(w http.ResponseWriter, r *http.Request) {
	items, err := s.Store.ShopList(r.Context())
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

// handleShopBuy buys one shop item with Cookies.
func (s *Server) handleShopBuy(w http.ResponseWriter, r *http.Request) {
	me := auth.UserFrom(r.Context())
	var req struct {
		ItemID int64 `json:"item_id"`
	}
	if err := ReadJSON(w, r, &req, 1<<10); err != nil {
		WriteError(w, err)
		return
	}
	balance, granted, err := s.Store.BuyShopItem(r.Context(), me.ID, req.ItemID)
	if err != nil {
		if errors.Is(err, store.ErrNotEnoughCookies) {
			WriteError(w, E(http.StatusBadRequest, "not_enough_cookies", "You do not have that many Cookies."))
			return
		}
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"balance": balance, "granted": granted})
}

// handleLevelsMe is the caller's XP, level and streak.
func (s *Server) handleLevelsMe(w http.ResponseWriter, r *http.Request) {
	me := auth.UserFrom(r.Context())
	st, err := s.Store.LevelsMe(r.Context(), me.ID)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, st)
}

// handleLevelsAward pays XP for a chat message, at most once a minute.
func (s *Server) handleLevelsAward(w http.ResponseWriter, r *http.Request) {
	me := auth.UserFrom(r.Context())
	st, err := s.Store.AwardXP(r.Context(), me.ID)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, st)
}

// handleStreakCheckin records today's login for the streak.
func (s *Server) handleStreakCheckin(w http.ResponseWriter, r *http.Request) {
	me := auth.UserFrom(r.Context())
	st, err := s.Store.CheckinStreak(r.Context(), me.ID)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, st)
}

// handleServerBoost buys one boost for a server with 500 Cookies.
func (s *Server) handleServerBoost(w http.ResponseWriter, r *http.Request) {
	me := auth.UserFrom(r.Context())
	id, err := ids.Parse(r.PathValue("id"))
	if err != nil {
		WriteError(w, ErrNotFound)
		return
	}
	if _, err := s.Store.ServerByID(r.Context(), id); err != nil {
		WriteError(w, ErrNotFound)
		return
	}
	count, level, balance, err := s.Store.BoostServer(r.Context(), id, me.ID)
	if err != nil {
		if errors.Is(err, store.ErrNotMember) {
			WriteError(w, E(http.StatusForbidden, "not_a_member", "You are not a member of this server."))
			return
		}
		if errors.Is(err, store.ErrNotEnoughCookies) {
			WriteError(w, E(http.StatusBadRequest, "not_enough_cookies", "A boost costs 500 Cookies."))
			return
		}
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"boosts": count, "level": level, "balance": balance})
}

// handleServerBoosts is a server's boosts and level.
func (s *Server) handleServerBoosts(w http.ResponseWriter, r *http.Request) {
	id, err := ids.Parse(r.PathValue("id"))
	if err != nil {
		WriteError(w, ErrNotFound)
		return
	}
	count, level, err := s.Store.BoostInfo(r.Context(), id)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"boosts": count, "level": level})
}

// handleAvatarItems is every wearable item the caller made or bought, and
// which one is worn.
func (s *Server) handleAvatarItems(w http.ResponseWriter, r *http.Request) {
	me := auth.UserFrom(r.Context())
	items, equipped, err := s.Store.MyAvatarItems(r.Context(), me.ID)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"items": items, "equipped": equipped})
}

// handleAvatarItemCreate makes a wearable item.
func (s *Server) handleAvatarItemCreate(w http.ResponseWriter, r *http.Request) {
	me := auth.UserFrom(r.Context())
	var req struct {
		Name  string `json:"name"`
		Emoji string `json:"emoji"`
		Color int64  `json:"color"`
	}
	if err := ReadJSON(w, r, &req, 1<<10); err != nil {
		WriteError(w, err)
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" || utf8.RuneCountInString(name) > 32 {
		WriteError(w, E(http.StatusBadRequest, "invalid_name", "Give the item a name, up to 32 characters."))
		return
	}
	it, err := s.Store.CreateAvatarItem(r.Context(), me.ID, name, strings.TrimSpace(req.Emoji), req.Color)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, it)
}

// handleAvatarItemEquip wears one of the caller's items.
func (s *Server) handleAvatarItemEquip(w http.ResponseWriter, r *http.Request) {
	me := auth.UserFrom(r.Context())
	id, err := ids.Parse(r.PathValue("id"))
	if err != nil {
		WriteError(w, ErrNotFound)
		return
	}
	if err := s.Store.EquipAvatarItem(r.Context(), me.ID, id); err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"equipped": id})
}

// handleAvatarItemsEquipped is the worn item for each account in ?ids=.
func (s *Server) handleAvatarItemsEquipped(w http.ResponseWriter, r *http.Request) {
	var userIDs []ids.ID
	for _, part := range strings.Split(r.URL.Query().Get("ids"), ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		id, err := ids.Parse(part)
		if err != nil {
			continue
		}
		userIDs = append(userIDs, id)
	}
	out, err := s.Store.EquippedAvatarItems(r.Context(), userIDs)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"equipped": out})
}

// handleMessageEdits is a message's edit history.
func (s *Server) handleMessageEdits(w http.ResponseWriter, r *http.Request) {
	me := auth.UserFrom(r.Context())
	ch, _ := s.channel(w, r, NeedView)
	if ch == nil {
		return
	}
	mid, err := ids.Parse(r.PathValue("mid"))
	if err != nil {
		WriteError(w, ErrNotFound)
		return
	}
	if _, err := s.Store.MessageByID(r.Context(), mid, me.ID); err != nil {
		WriteError(w, ErrNotFound)
		return
	}
	history, err := s.Store.EditHistory(r.Context(), mid)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"edits": history})
}

// handleVoiceHand raises or lowers the caller's hand in a voice channel.
func (s *Server) handleVoiceHand(w http.ResponseWriter, r *http.Request) {
	me := auth.UserFrom(r.Context())
	ch, _ := s.channel(w, r, NeedView)
	if ch == nil {
		return
	}
	var req struct {
		Raised bool `json:"raised"`
	}
	if err := ReadJSON(w, r, &req, 1<<10); err != nil {
		WriteError(w, err)
		return
	}
	var err error
	if req.Raised {
		err = s.Store.RaiseHand(r.Context(), ch.ID, me.ID)
	} else {
		err = s.Store.LowerHand(r.Context(), ch.ID, me.ID)
	}
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"raised": req.Raised})
}

// handleVoiceHands is every raised hand in a voice channel.
func (s *Server) handleVoiceHands(w http.ResponseWriter, r *http.Request) {
	ch, _ := s.channel(w, r, NeedView)
	if ch == nil {
		return
	}
	hands, err := s.Store.HandsFor(r.Context(), ch.ID)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"hands": hands})
}

// handleNicknames is every nickname the caller gave its friends.
func (s *Server) handleNicknames(w http.ResponseWriter, r *http.Request) {
	me := auth.UserFrom(r.Context())
	nicks, err := s.Store.Nicknames(r.Context(), me.ID)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"nicknames": nicks})
}

// handleNicknameSet gives a friend a nickname, or clears it.
func (s *Server) handleNicknameSet(w http.ResponseWriter, r *http.Request) {
	me := auth.UserFrom(r.Context())
	var req struct {
		FriendID ids.ID `json:"friend_id"`
		Nickname string `json:"nickname"`
	}
	if err := ReadJSON(w, r, &req, 1<<10); err != nil {
		WriteError(w, err)
		return
	}
	if req.FriendID.IsZero() || req.FriendID == me.ID {
		WriteError(w, E(http.StatusBadRequest, "invalid_friend", "Pick someone else to nickname."))
		return
	}
	nick := strings.TrimSpace(req.Nickname)
	if utf8.RuneCountInString(nick) > store.MaxNicknameLen {
		WriteError(w, E(http.StatusBadRequest, "invalid_nickname", "A nickname is up to 32 characters."))
		return
	}
	to, err := s.Store.UserByID(r.Context(), req.FriendID)
	if err != nil {
		WriteError(w, err)
		return
	}
	if to.Flags&store.FlagDeleted != 0 || notAPerson(to) {
		WriteError(w, E(http.StatusBadRequest, "invalid_friend", "That account cannot be nicknamed."))
		return
	}
	if err := s.Store.SetNickname(r.Context(), me.ID, req.FriendID, nick); err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"friend_id": req.FriendID, "nickname": nick})
}

// handleBookmarks is the caller's saved messages.
func (s *Server) handleBookmarks(w http.ResponseWriter, r *http.Request) {
	me := auth.UserFrom(r.Context())
	list, err := s.Store.Bookmarks(r.Context(), me.ID)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"bookmarks": list})
}

// handleBookmarkAdd saves a message.
func (s *Server) handleBookmarkAdd(w http.ResponseWriter, r *http.Request) {
	me := auth.UserFrom(r.Context())
	var req struct {
		MessageID ids.ID `json:"message_id"`
	}
	if err := ReadJSON(w, r, &req, 1<<10); err != nil {
		WriteError(w, err)
		return
	}
	m, err := s.Store.MessageByID(r.Context(), req.MessageID, me.ID)
	if err != nil {
		WriteError(w, ErrNotFound)
		return
	}
	if err := s.Store.AddBookmark(r.Context(), me.ID, req.MessageID, m.ChannelID); err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"saved": true})
}

// handleBookmarkRemove unsaves a message.
func (s *Server) handleBookmarkRemove(w http.ResponseWriter, r *http.Request) {
	me := auth.UserFrom(r.Context())
	mid, err := ids.Parse(r.PathValue("mid"))
	if err != nil {
		WriteError(w, ErrNotFound)
		return
	}
	if err := s.Store.RemoveBookmark(r.Context(), me.ID, mid); err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"saved": false})
}

// handleQuietHours is the caller's do-not-disturb hours.
func (s *Server) handleQuietHours(w http.ResponseWriter, r *http.Request) {
	me := auth.UserFrom(r.Context())
	q, err := s.Store.QuietHoursOf(r.Context(), me.ID)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, q)
}

// handleQuietHoursSet saves the caller's do-not-disturb hours.
func (s *Server) handleQuietHoursSet(w http.ResponseWriter, r *http.Request) {
	me := auth.UserFrom(r.Context())
	var req store.QuietHours
	if err := ReadJSON(w, r, &req, 1<<10); err != nil {
		WriteError(w, err)
		return
	}
	if req.Start < 0 || req.Start >= 1440 || req.End < 0 || req.End >= 1440 {
		WriteError(w, E(http.StatusBadRequest, "invalid_hours", "Quiet hours are minutes after midnight, 0 to 1439."))
		return
	}
	if err := s.Store.SetQuietHours(r.Context(), me.ID, &req); err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, &req)
}

// handleChannelReaders is every account's read marker in a channel, for
// read receipts.
func (s *Server) handleChannelReaders(w http.ResponseWriter, r *http.Request) {
	ch, _ := s.channel(w, r, NeedView)
	if ch == nil {
		return
	}
	readers, err := s.Store.ChannelReaders(r.Context(), ch.ID)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"readers": readers})
}
