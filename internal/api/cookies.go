package api

import (
	"errors"
	"net/http"

	"evilion.xyz/chat/internal/auth"
	"evilion.xyz/chat/internal/ids"
	"evilion.xyz/chat/internal/store"
)

func (s *Server) cookiesRoutes(mux *http.ServeMux) {
	mux.Handle("GET /api/v1/cookies", s.authed(s.handleCookies))
	mux.Handle("POST /api/v1/cookies/daily", s.authed(s.handleCookiesDaily))
	mux.Handle("POST /api/v1/cookies/give", s.authed(s.handleCookiesGive))
}

// handleCookies is an account's Cookies as its app needs them.
func (s *Server) handleCookies(w http.ResponseWriter, r *http.Request) {
	me := auth.UserFrom(r.Context())
	st, err := s.Store.CookiesState(r.Context(), me.ID)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, st)
}

// handleCookiesDaily pays the daily bonus, once a day.
func (s *Server) handleCookiesDaily(w http.ResponseWriter, r *http.Request) {
	me := auth.UserFrom(r.Context())
	balance, claimed, err := s.Store.ClaimDailyCookies(r.Context(), me.ID)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"balance": balance, "claimed": claimed})
}

// handleCookiesGive sends Cookies to another account. The owner holds
// unlimited Cookies and gives from nowhere; everyone else gives from
// their own balance.
func (s *Server) handleCookiesGive(w http.ResponseWriter, r *http.Request) {
	me := auth.UserFrom(r.Context())
	var req struct {
		UserID ids.ID `json:"user_id"`
		Amount int64  `json:"amount"`
	}
	if err := ReadJSON(w, r, &req, 1<<10); err != nil {
		WriteError(w, err)
		return
	}
	if req.Amount < 1 || req.Amount > store.MaxCookieGift {
		WriteError(w, E(http.StatusBadRequest, "invalid_amount", "A gift is 1 to 10,000 Cookies."))
		return
	}
	if req.UserID.IsZero() || req.UserID == me.ID {
		WriteError(w, E(http.StatusBadRequest, "invalid_recipient", "Pick someone else to give Cookies to."))
		return
	}
	to, err := s.Store.UserByID(r.Context(), req.UserID)
	if err != nil {
		WriteError(w, err)
		return
	}
	if to.Flags&store.FlagDeleted != 0 || notAPerson(to) {
		WriteError(w, E(http.StatusBadRequest, "invalid_recipient", "That account cannot hold Cookies."))
		return
	}
	ownerID, _ := s.Store.InstanceOwnerID(r.Context())
	if ownerID != 0 && ownerID == me.ID {
		toBalance, err := s.Store.AddCookies(r.Context(), req.UserID, req.Amount)
		if err != nil {
			WriteError(w, err)
			return
		}
		mine, err := s.Store.CookiesState(r.Context(), me.ID)
		if err != nil {
			WriteError(w, err)
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"balance": mine.Balance, "recipient_balance": toBalance})
		return
	}
	fromBalance, toBalance, err := s.Store.GiveCookies(r.Context(), me.ID, req.UserID, req.Amount)
	if err != nil {
		if errors.Is(err, store.ErrNotEnoughCookies) {
			WriteError(w, E(http.StatusBadRequest, "not_enough_cookies", "You do not have that many Cookies."))
			return
		}
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"balance": fromBalance, "recipient_balance": toBalance})
}
