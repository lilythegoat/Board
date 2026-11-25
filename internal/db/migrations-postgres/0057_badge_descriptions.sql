-- Badge descriptions: what a custom badge is for, shown in its tooltip
-- (badge_defs.description).
ALTER TABLE badge_defs ADD COLUMN description TEXT NOT NULL DEFAULT '';
