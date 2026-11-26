package api

import (
	"context"

	"evilion.xyz/chat/internal/store"
)

// headquartersName is the official community server: every new account
// joins it, and nobody leaves it (server_handlers.go).
const headquartersName = "Board Headquarters"

// welcomeMessageBody is what Board says to a new account, as the first
// thing in their Board conversation (nexa.go).
const welcomeMessageBody = "Welcome to Board! 🎉 This is the official Board account — announcements and updates from the Board team arrive here. Have fun, be kind, and enjoy your Cookies. 🍪"

// onboardNewAccount brings a new account home: into Board Headquarters,
// and with Board's welcome waiting in their Board conversation. It is
// best-effort — a missing Headquarters or a failed welcome never blocks
// signing up — and only new accounts get it: accounts from before this
// landed are never forced in.
func (s *Server) onboardNewAccount(ctx context.Context, u *store.User) {
	hq, err := s.Store.ServerByName(ctx, headquartersName)
	if err != nil {
		// no Headquarters yet (a fresh install, or before it was made)
		return
	}
	if _, err := s.Store.Join(ctx, hq.ID, u.ID, store.JoinInfo{}); err != nil {
		s.Log.Warn("onboarding: join headquarters", "user", u.ID.String(), "err", err)
	}
	if err := s.Store.SetWelcomePending(ctx, u.ID, true); err != nil {
		s.Log.Warn("onboarding: welcome", "user", u.ID.String(), "err", err)
	}
}
