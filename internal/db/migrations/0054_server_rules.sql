-- A server's own rules, written by whoever manages it and read by its
-- members (servers.rules): one block of text, a rule to a line, or '' while
-- the server has written none.
ALTER TABLE servers ADD COLUMN rules TEXT NOT NULL DEFAULT '';
