CREATE TABLE "game_notes" (
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_notes_user_id_game_id_pk" PRIMARY KEY("user_id","game_id"),
	CONSTRAINT "game_notes_body_length" CHECK (char_length("game_notes"."body") <= 4000)
);
--> statement-breakpoint
ALTER TABLE "game_notes" ADD CONSTRAINT "game_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_notes" ADD CONSTRAINT "game_notes_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;