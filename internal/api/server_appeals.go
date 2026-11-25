package api

import (
	"errors"
	"net/http"

	"evilion.xyz/chat/internal/auth"
	"evilion.xyz/chat/internal/ids"
	"evilion.xyz/chat/internal/perms"
	"evilion.xyz/chat/internal/store"
)

// Appeals against a server's own bans. Instance bans have their cases; a
// server ban used to leave a member with no way back to ask. A banned
// member files one appeal per ban, and the server's moderators settle it
// where they manage the bans: accepting lifts the ban, denying leaves it.
//
// The member's two routes cannot use serverCtx: a banned member is not a
// member, so serverCtx would turn them away — which is the whole problem.
// They check the ban itself instead. The moderators' routes use serverCtx
// with BanMembers, the same permission as the ban list.

const maxAppealMessage = 1000

func (s *Server) serverAppealRoutes(mux *http.ServeMux) {
	mux.Handle("POST /api/v1/servers/{id}/ban-appeal", s.authed(s.handleBanAppealCreate))
	mux.Handle("GET /api/v1/servers/{id}/ban-appeal", s.authed(s.handleBanAppealState))
	mux.Handle("GET /api/v1/servers/{id}/ban-appeals", s.authed(s.handleBanAppeals))
	mux.Handle("POST /api/v1/servers/{id}/ban-appeals/{aid}/resolve", s.authed(s.handleBanAppealResolve))
}

// banAppealServer loads the server of {id} for a caller who may well not be
// a member of it, or answers 404.
func (s *Server) banAppealServer(w http.ResponseWriter, r *http.Request) *store.Server {
	id, err := ids.Parse(r.PathValue("id"))
	if err != nil {
		WriteError(w, ErrNotFound)
		return nil
	}
	srv, err := s.Store.ServerByID(r.Context(), id)
	if err != nil {
		WriteError(w, ErrNotFound)
		return nil
	}
	return srv
}

// handleBanAppealState says whether the caller is banned from the server,
// what for, and where their appeal stands: how the app knows to show the
// appeal box, and what it says once an appeal is in.
func (s *Server) handleBanAppealState(w http.ResponseWriter, r *http.Request) {
	srv := s.banAppealServer(w, r)
	if srv == nil {
		return
	}
	me := auth.UserFrom(r.Context())
	out := map[string]any{"banned": false, "ban": nil, "appeal": nil}
	ban, err := s.Store.BanFor(r.Context(), srv.ID, me.ID)
	if err != nil && !errors.Is(err, store.ErrNotFound) {
		WriteError(w, err)
		return
	}
	if ban != nil {
		out["banned"] = true
		out["ban"] = ban
	}
	if appeal, err := s.Store.LatestServerBanAppeal(r.Context(), srv.ID, me.ID); err == nil {
		out["appeal"] = appeal
	} else if !errors.Is(err, store.ErrNotFound) {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, out)
}

// handleBanAppealCreate files the caller's appeal against their ban.
func (s *Server) handleBanAppealCreate(w http.ResponseWriter, r *http.Request) {
	srv := s.banAppealServer(w, r)
	if srv == nil {
		return
	}
	me := auth.UserFrom(r.Context())
	banned, err := s.Store.IsBanned(r.Context(), srv.ID, me.ID)
	if err != nil {
		WriteError(w, err)
		return
	}
	if !banned {
		WriteError(w, E(http.StatusForbidden, "not_banned", "You are not banned from this server."))
		return
	}
	var req struct {
		Message string `json:"message"`
	}
	if err := ReadJSON(w, r, &req, 16<<10); err != nil {
		WriteError(w, err)
		return
	}
	message, ok := CleanText(req.Message, maxAppealMessage)
	if !ok {
		WriteError(w, E(http.StatusBadRequest, "invalid_message", "Appeals are at most 1000 characters."))
		return
	}
	if _, err := s.Store.PendingServerBanAppeal(r.Context(), srv.ID, me.ID); err == nil {
		WriteError(w, E(http.StatusConflict, "appeal_pending", "You already have an appeal waiting for this server's moderators."))
		return
	} else if !errors.Is(err, store.ErrNotFound) {
		WriteError(w, err)
		return
	}
	appeal, err := s.Store.CreateServerBanAppeal(r.Context(), srv.ID, me.ID, message)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusCreated, appeal)
}

// handleBanAppeals lists a server's ban appeals for its moderators, with
// the accounts they are about, the way the ban list does.
func (s *Server) handleBanAppeals(w http.ResponseWriter, r *http.Request) {
	srv, _, _ := s.serverCtx(w, r, perms.BanMembers)
	if srv == nil {
		return
	}
	appeals, err := s.Store.ServerBanAppeals(r.Context(), srv.ID)
	if err != nil {
		WriteError(w, err)
		return
	}
	list := make([]ids.ID, 0, len(appeals))
	seen := map[ids.ID]bool{}
	for _, a := range appeals {
		if !seen[a.UserID] {
			seen[a.UserID] = true
			list = append(list, a.UserID)
		}
		if a.ResolvedBy != nil && !seen[*a.ResolvedBy] {
			seen[*a.ResolvedBy] = true
			list = append(list, *a.ResolvedBy)
		}
	}
	byID, err := s.Store.UsersByIDs(r.Context(), list)
	if err != nil {
		WriteError(w, err)
		return
	}
	users := []store.PublicUser{}
	for _, id := range list {
		if u := byID[id]; u != nil {
			users = append(users, u.Public())
		}
	}
	WriteJSON(w, http.StatusOK, map[string]any{"appeals": appeals, "users": users})
}

// handleBanAppealResolve settles one pending appeal: "accept" lifts the
// ban, "deny" leaves it standing.
func (s *Server) handleBanAppealResolve(w http.ResponseWriter, r *http.Request) {
	srv, me, _ := s.serverCtx(w, r, perms.BanMembers)
	if srv == nil {
		return
	}
	appealID, err := ids.Parse(r.PathValue("aid"))
	if err != nil {
		WriteError(w, ErrNotFound)
		return
	}
	var req struct {
		Action string `json:"action"`
	}
	if err := ReadJSON(w, r, &req, 16<<10); err != nil {
		WriteError(w, err)
		return
	}
	if req.Action != "accept" && req.Action != "deny" {
		WriteError(w, E(http.StatusBadRequest, "invalid_action", "Action must be \"accept\" or \"deny\"."))
		return
	}
	appeal, err := s.Store.ServerBanAppealByID(r.Context(), srv.ID, appealID)
	if err != nil {
		WriteError(w, err)
		return
	}
	status := "denied"
	if req.Action == "accept" {
		status = "accepted"
	}
	if err := s.Store.ResolveServerBanAppeal(r.Context(), srv.ID, appealID, me.ID, status); err != nil {
		WriteError(w, err)
		return
	}
	if req.Action == "accept" {
		// lift the ban itself; already lifted by hand is just as settled
		if err := s.Store.Unban(r.Context(), srv.ID, appeal.UserID); err != nil && !errors.Is(err, store.ErrNotFound) {
			WriteError(w, err)
			return
		}
		s.emitServerWithPerm(r.Context(), srv.ID, perms.BanMembers, "ban_remove", map[string]any{"server_id": srv.ID, "user_id": appeal.UserID})
	}
	s.auditAs(r.Context(), srv.ID, me.ID, "ban_appeal_"+status, "user", &appeal.UserID, map[string]any{"appeal_id": appealID}, "")
	updated, err := s.Store.ServerBanAppealByID(r.Context(), srv.ID, appealID)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, updated)
}
