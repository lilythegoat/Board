-- Cookies: a real balance per account (store/cookies.go), the last daily
-- bonus claim, and whether Board's welcome is still waiting in their Board
-- conversation (api/nexa.go). New accounts start at 100 Cookies, the same
-- 100 the display-only Cookies Place showed.
ALTER TABLE users ADD COLUMN cookies_balance INTEGER NOT NULL DEFAULT 100;
ALTER TABLE users ADD COLUMN cookies_last_daily INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN welcome_pending INTEGER NOT NULL DEFAULT 0;
