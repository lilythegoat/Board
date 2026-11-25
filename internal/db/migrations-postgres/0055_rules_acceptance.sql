-- The signup rules step: which version of Board's rules an account has
-- agreed to (users.rules_version, 0 for none yet) and when it agreed
-- (users.rules_accepted_at, ms; 0 while it has not, and left 0 for the
-- accounts below).
--
-- Every account that already exists agreed to the Terms when it signed up,
-- which is the consent this step grows out of, so it is not asked again:
-- existing accounts are stamped with version 1 here. Accounts made after
-- this migration start at 0 and meet the rules step before the app.
ALTER TABLE users ADD COLUMN rules_accepted_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN rules_version BIGINT NOT NULL DEFAULT 0;
UPDATE users SET rules_version = 1;
