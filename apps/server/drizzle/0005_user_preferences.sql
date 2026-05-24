CREATE TABLE IF NOT EXISTS "user_preferences" (
	"user_sub" text PRIMARY KEY NOT NULL,
	"preferred_model" text DEFAULT 'openai/gpt-4o' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
