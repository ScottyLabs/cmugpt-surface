CREATE TABLE IF NOT EXISTS "user_custom_llm" (
	"user_sub" text PRIMARY KEY NOT NULL,
	"use_custom_chat" boolean DEFAULT false NOT NULL,
	"base_url" text DEFAULT '' NOT NULL,
	"api_key" text DEFAULT '' NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
