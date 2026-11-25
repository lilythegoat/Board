package api

import "testing"

// Badges staff give are theirs alone to give (a mod cannot), and one its
// holder hid is not in anyone else's view of the profile; a staff rank can
// never be hidden, so nobody passes for a member while acting as staff.
func TestBadgesStaffGiveAndHiddenStayHidden(t *testing.T) {
	_, ts := newTestServer(t)
	ownTok, ownID := register(t, ts, "owner")
	modTok, modID := register(t, ts, "mod")
	bobTok, bobID := register(t, ts, "bob")
	if res, body := do(t, ts, "PATCH", "/api/v1/admin/users/"+modID, ownTok, map[string]any{"rank": "mod"}); res.StatusCode != 200 {
		t.Fatalf("make mod: %d %v", res.StatusCode, body)
	}
	give := map[string]any{"badges": []string{"contributor"}}
	for _, tok := range []string{bobTok, modTok} {
		if res, _ := do(t, ts, "PUT", "/api/v1/moderation/users/"+bobID+"/badges", tok, give); res.StatusCode != 403 {
			t.Errorf("gave a badge without being an admin: %d", res.StatusCode)
		}
	}
	if res, body := do(t, ts, "PUT", "/api/v1/moderation/users/"+bobID+"/badges", ownTok, map[string]any{"badges": []string{"og"}}); res.StatusCode != 400 {
		t.Errorf("gave an earned badge by hand: %d %v", res.StatusCode, body)
	}
	if res, body := do(t, ts, "PUT", "/api/v1/moderation/users/"+bobID+"/badges", ownTok, give); res.StatusCode != 200 {
		t.Fatalf("give contributor: %d %v", res.StatusCode, body)
	}
	shown := func(tok, id string) map[string]bool {
		_, body := do(t, ts, "GET", "/api/v1/users/"+id+"/profile", tok, nil)
		out := map[string]bool{}
		for _, b := range body["badges"].([]any) {
			out[b.(map[string]any)["id"].(string)] = true
		}
		return out
	}
	if !shown(modTok, bobID)["contributor"] {
		t.Fatal("contributor not on the profile")
	}
	if res, body := do(t, ts, "PUT", "/api/v1/users/@me/badges", bobTok, map[string]any{"order": []string{"contributor"}, "hidden": []string{"contributor"}}); res.StatusCode != 200 {
		t.Fatalf("hide: %d %v", res.StatusCode, body)
	}
	if shown(modTok, bobID)["contributor"] || shown(bobTok, bobID)["contributor"] {
		t.Error("a hidden badge still shows on the profile")
	}
	_, mine := do(t, ts, "GET", "/api/v1/users/@me/badges", bobTok, nil)
	if l := mine["badges"].([]any); len(l) == 0 || l[0].(map[string]any)["hidden"] != true {
		t.Errorf("own list lost the hidden badge: %v", mine)
	}
	// the owner tries to hide their rank
	do(t, ts, "PUT", "/api/v1/users/@me/badges", ownTok, map[string]any{"hidden": []string{"staff"}})
	if !shown(bobTok, ownID)["staff"] {
		t.Error("a staff rank was hidden")
	}
}

// Making a custom badge is the owner's alone (a mod cannot), and a badge
// keeps the description it was made with, which the list shows to staff.
func TestBadgesOwnerOnlyCreateAndDescription(t *testing.T) {
	_, ts := newTestServer(t)
	ownTok, _ := register(t, ts, "owner")
	modTok, modID := register(t, ts, "mod")
	if res, body := do(t, ts, "PATCH", "/api/v1/admin/users/"+modID, ownTok, map[string]any{"rank": "mod"}); res.StatusCode != 200 {
		t.Fatalf("make mod: %d %v", res.StatusCode, body)
	}
	def := map[string]any{"name": "Halloween", "icon": "ghost", "color": 0xff7a45, "description": "For the Halloween event."}
	if res, _ := do(t, ts, "POST", "/api/v1/moderation/badges", modTok, def); res.StatusCode != 403 {
		t.Errorf("a mod made a badge: %d", res.StatusCode)
	}
	res, body := do(t, ts, "POST", "/api/v1/moderation/badges", ownTok, def)
	if res.StatusCode != 200 {
		t.Fatalf("owner create: %d %v", res.StatusCode, body)
	}
	if body["description"] != "For the Halloween event." {
		t.Errorf("create lost the description: %v", body)
	}
	if res, _ := do(t, ts, "PATCH", "/api/v1/moderation/badges/"+body["id"].(string), modTok, def); res.StatusCode != 403 {
		t.Errorf("a mod edited a badge: %d", res.StatusCode)
	}
	_, list := do(t, ts, "GET", "/api/v1/moderation/badges", modTok, nil)
	badges := list["badges"].([]any)
	if len(badges) != 1 || badges[0].(map[string]any)["description"] != "For the Halloween event." {
		t.Errorf("list lost the description: %v", list)
	}
}
