package api

import (
	"net/http"

	"evilion.xyz/chat/internal/auth"
)

// currentRulesVersion is the version of Board's rules in force: the rules
// step a new account completes before the app. Bump it when the rules
// (web/src/i18n/locales/en.json, appRules.*) change in a way everyone
// should agree to again, and bump RULES_VERSION in web/src/lib/rules.ts
// to match.
const currentRulesVersion = 1

func (s *Server) rulesRoutes(mux *http.ServeMux) {
	mux.Handle("POST /api/v1/me/accept-rules", s.authed(s.handleAcceptRules))
}

// handleAcceptRules stamps the caller's agreement to the rules in force.
// The app sends it from the rules step, after the account has read the
// rules to the bottom and ticked the box; the record is what the gate
// checks from then on, on any device.
func (s *Server) handleAcceptRules(w http.ResponseWriter, r *http.Request) {
	me := auth.UserFrom(r.Context())
	if err := s.Store.AcceptRules(r.Context(), me.ID, currentRulesVersion); err != nil {
		WriteError(w, err)
		return
	}
	updated, err := s.Store.UserByID(r.Context(), me.ID)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, s.meView(r.Context(), updated))
}
