CREATE TABLE "solutions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"game_id" uuid NOT NULL,
	"puzzle_number" integer NOT NULL,
	"puzzle_date" date NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"source_url" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "solutions_status_check" CHECK (status IN ('pending', 'approved', 'rejected')),
	CONSTRAINT "solutions_body_length" CHECK (char_length("solutions"."body") BETWEEN 1 AND 1000),
	CONSTRAINT "solutions_source_https" CHECK ("solutions"."source_url" ~ '^https://' AND char_length("solutions"."source_url") <= 500)
);
--> statement-breakpoint
ALTER TABLE "solutions" ADD CONSTRAINT "solutions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solutions" ADD CONSTRAINT "solutions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solutions" ADD CONSTRAINT "solutions_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "solutions_author_puzzle_key" ON "solutions" USING btree ("author_id","game_id","puzzle_number");--> statement-breakpoint
CREATE INDEX "solutions_game_puzzle_idx" ON "solutions" USING btree ("game_id","puzzle_number","status");--> statement-breakpoint
CREATE INDEX "solutions_status_idx" ON "solutions" USING btree ("status","created_at");