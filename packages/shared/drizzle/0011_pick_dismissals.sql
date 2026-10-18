CREATE TABLE "pick_dismissals" (
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pick_dismissals_user_id_game_id_pk" PRIMARY KEY("user_id","game_id")
);
--> statement-breakpoint
ALTER TABLE "pick_dismissals" ADD CONSTRAINT "pick_dismissals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pick_dismissals" ADD CONSTRAINT "pick_dismissals_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;