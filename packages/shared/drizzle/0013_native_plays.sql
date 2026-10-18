CREATE TABLE "native_plays" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"puzzle_number" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "show_on_rankings" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "native_plays" ADD CONSTRAINT "native_plays_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "native_plays" ADD CONSTRAINT "native_plays_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "native_plays_once_key" ON "native_plays" USING btree ("user_id","game_id","puzzle_number");--> statement-breakpoint
CREATE INDEX "native_plays_game_idx" ON "native_plays" USING btree ("game_id","puzzle_number");