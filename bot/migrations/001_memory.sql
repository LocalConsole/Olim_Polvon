-- run once on a database created before 22.11.2026:
-- npx wrangler d1 execute olim-bot --remote --file=migrations/001_memory.sql
ALTER TABLE users ADD COLUMN cid TEXT;
CREATE TABLE IF NOT EXISTS mem (key TEXT PRIMARY KEY, facts TEXT DEFAULT '[]', recent TEXT DEFAULT '[]', updated INTEGER);
