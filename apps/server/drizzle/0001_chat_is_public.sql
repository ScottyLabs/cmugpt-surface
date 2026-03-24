ALTER TABLE "chats" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false NOT NULL;
