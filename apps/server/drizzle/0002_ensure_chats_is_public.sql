-- Heals DBs where 0001 was marked applied but the column is missing (e.g. restored DB, failed apply).
ALTER TABLE "chats" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false NOT NULL;
