-- Board 20: a profile banner colour per account (0 = none). Shown as a
-- coloured strip with a glow on the profile card; picked on the Avatar
-- Items page. The friend-nicknames table from 0059 stays unused: nicknames
-- already live in the relationships table (SetRelationshipNickname).
ALTER TABLE users ADD COLUMN profile_banner INTEGER NOT NULL DEFAULT 0;
