CREATE TABLE "capture_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "capture_tokens" ADD CONSTRAINT "capture_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "capture_tokens_token_hash_key" ON "capture_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "capture_tokens_user_idx" ON "capture_tokens" USING btree ("user_id");