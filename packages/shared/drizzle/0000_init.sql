CREATE EXTENSION IF NOT EXISTS citext;
--> statement-breakpoint
CREATE TABLE "device_pairings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code_hash" text NOT NULL,
	"poll_secret_hash" text NOT NULL,
	"number_match" smallint NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"initiator_user_agent" text,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_pairings_status_check" CHECK (status IN ('pending', 'approved', 'denied', 'consumed', 'expired')),
	CONSTRAINT "device_pairings_number_check" CHECK ("device_pairings"."number_match" BETWEEN 10 AND 99)
);
--> statement-breakpoint
CREATE TABLE "email_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"email" "citext" NOT NULL,
	"purpose" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_tokens_purpose_check" CHECK (purpose IN ('verify', 'login'))
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_user_id_game_id_pk" PRIMARY KEY("user_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "game_health_checks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"game_id" uuid NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ok" boolean NOT NULL,
	"http_status" smallint,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"x_frame_options" text,
	"csp_frame_ancestors" text,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "game_reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"game_id" uuid NOT NULL,
	"user_id" uuid,
	"kind" text NOT NULL,
	"details" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_reports_kind_check" CHECK (kind IN ('wrong_reset', 'moved', 'dead', 'wrong_info', 'other', 'auto')),
	CONSTRAINT "game_reports_status_check" CHECK (status IN ('open', 'resolved', 'dismissed')),
	CONSTRAINT "game_reports_details_length" CHECK (char_length("game_reports"."details") <= 1000)
);
--> statement-breakpoint
CREATE TABLE "game_submissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"submitted_by" uuid NOT NULL,
	"url" text NOT NULL,
	"normalized_key" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"reset_hint" text,
	"sample_share_text" text,
	"fetched_title" text,
	"fetched_description" text,
	"probe_result" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_submissions_status_check" CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate'))
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"publisher" text NOT NULL,
	"description" text NOT NULL,
	"url" text NOT NULL,
	"category" text NOT NULL,
	"difficulty" text NOT NULL,
	"tier" smallint NOT NULL,
	"embed_mode" text DEFAULT 'popout' NOT NULL,
	"reset_mode" text NOT NULL,
	"reset_tz" text,
	"reset_hour" smallint DEFAULT 0 NOT NULL,
	"puzzle_epoch" date NOT NULL,
	"epoch_number" integer NOT NULL,
	"parser_id" text,
	"scoring_type" text NOT NULL,
	"max_attempts" smallint,
	"status" text DEFAULT 'active' NOT NULL,
	"accent_color" text NOT NULL,
	"icon" text NOT NULL,
	"attribution_note" text NOT NULL,
	"verified_embeddable_at" timestamp with time zone,
	"verified_live_at" timestamp with time zone,
	"source_yaml_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_category_check" CHECK (category IN ('word', 'geography', 'logic', 'trivia', 'crossword', 'math', 'music', 'visual')),
	CONSTRAINT "games_difficulty_check" CHECK (difficulty IN ('easy', 'medium', 'hard')),
	CONSTRAINT "games_tier_check" CHECK ("games"."tier" IN (1, 2, 3)),
	CONSTRAINT "games_embed_mode_check" CHECK (embed_mode IN ('iframe', 'popout', 'native')),
	CONSTRAINT "games_reset_mode_check" CHECK (reset_mode IN ('user_local', 'fixed')),
	CONSTRAINT "games_reset_hour_check" CHECK ("games"."reset_hour" BETWEEN 0 AND 23),
	CONSTRAINT "games_scoring_type_check" CHECK (scoring_type IN ('attempts', 'time', 'points', 'distance', 'completion')),
	CONSTRAINT "games_status_check" CHECK (status IN ('active', 'possibly_down', 'archived')),
	CONSTRAINT "games_fixed_reset_has_tz" CHECK ("games"."reset_mode" <> 'fixed' OR "games"."reset_tz" IS NOT NULL),
	CONSTRAINT "games_iframe_requires_probe" CHECK ("games"."embed_mode" <> 'iframe' OR "games"."verified_embeddable_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "mod_actions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"reason" text,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkey_credentials" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" "bytea" NOT NULL,
	"counter" bigint DEFAULT 0 NOT NULL,
	"transports" text[] DEFAULT '{}'::text[] NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean DEFAULT false NOT NULL,
	"nickname" text NOT NULL,
	"aaguid" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "recovery_phrase_hashes" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "results" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"puzzle_number" integer NOT NULL,
	"puzzle_date" date NOT NULL,
	"solved" boolean NOT NULL,
	"attempts" smallint,
	"max_attempts" smallint,
	"time_seconds" integer,
	"score" integer,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"raw_share_text" text,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "results_source_check" CHECK (source IN ('paste', 'manual', 'checkbox', 'native', 'extension')),
	CONSTRAINT "results_share_text_length" CHECK (char_length("results"."raw_share_text") <= 4096),
	CONSTRAINT "results_attempts_range" CHECK ("results"."attempts" IS NULL OR ("results"."attempts" >= 0 AND "results"."attempts" <= 100)),
	CONSTRAINT "results_time_range" CHECK ("results"."time_seconds" IS NULL OR ("results"."time_seconds" >= 0 AND "results"."time_seconds" < 86400))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"ip_hash" text,
	"method" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streaks" (
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"current" integer DEFAULT 0 NOT NULL,
	"best" integer DEFAULT 0 NOT NULL,
	"last_puzzle_number" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "streaks_user_id_game_id_pk" PRIMARY KEY("user_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"username" "citext" NOT NULL,
	"display_name" text,
	"email" "citext",
	"email_verified_at" timestamp with time zone,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"quiet_hours_start" time,
	"quiet_hours_end" time,
	"spoiler_safe" boolean DEFAULT true NOT NULL,
	"prefs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"recovery_confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_role_check" CHECK (role IN ('user', 'mod', 'admin')),
	CONSTRAINT "users_username_format" CHECK ("users"."username"::text ~ '^[a-z0-9_]{3,20}$')
);
--> statement-breakpoint
ALTER TABLE "device_pairings" ADD CONSTRAINT "device_pairings_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_tokens" ADD CONSTRAINT "email_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_health_checks" ADD CONSTRAINT "game_health_checks_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_reports" ADD CONSTRAINT "game_reports_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_reports" ADD CONSTRAINT "game_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_reports" ADD CONSTRAINT "game_reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_submissions" ADD CONSTRAINT "game_submissions_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_submissions" ADD CONSTRAINT "game_submissions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mod_actions" ADD CONSTRAINT "mod_actions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey_credentials" ADD CONSTRAINT "passkey_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_phrase_hashes" ADD CONSTRAINT "recovery_phrase_hashes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "device_pairings_code_hash_key" ON "device_pairings" USING btree ("code_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "email_tokens_token_hash_key" ON "email_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "follows_game_idx" ON "follows" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "game_health_checks_game_idx" ON "game_health_checks" USING btree ("game_id","checked_at");--> statement-breakpoint
CREATE INDEX "game_reports_status_idx" ON "game_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "game_submissions_open_key" ON "game_submissions" USING btree ("normalized_key") WHERE status = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "games_slug_key" ON "games" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "games_category_idx" ON "games" USING btree ("category");--> statement-breakpoint
CREATE INDEX "games_status_idx" ON "games" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mod_actions_target_idx" ON "mod_actions" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "mod_actions_created_idx" ON "mod_actions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "passkey_credentials_credential_id_key" ON "passkey_credentials" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "passkey_credentials_user_idx" ON "passkey_credentials" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "results_user_game_puzzle_key" ON "results" USING btree ("user_id","game_id","puzzle_number");--> statement-breakpoint
CREATE INDEX "results_user_date_idx" ON "results" USING btree ("user_id","puzzle_date");--> statement-breakpoint
CREATE INDEX "results_game_puzzle_idx" ON "results" USING btree ("game_id","puzzle_number");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_key" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");
--> statement-breakpoint
-- The moderation audit log is append-only.
CREATE OR REPLACE FUNCTION mod_actions_append_only() RETURNS trigger AS $$
BEGIN
  -- Allow only the ON DELETE SET NULL of the actor when a user account is deleted.
  IF TG_OP = 'UPDATE' AND NEW.actor_id IS NULL
     AND (NEW.id, NEW.action, NEW.target_type, NEW.target_id, NEW.reason, NEW.before, NEW.after, NEW.created_at)
         IS NOT DISTINCT FROM
         (OLD.id, OLD.action, OLD.target_type, OLD.target_id, OLD.reason, OLD.before, OLD.after, OLD.created_at)
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'mod_actions is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER mod_actions_no_update_delete
  BEFORE UPDATE OR DELETE ON "mod_actions"
  FOR EACH ROW EXECUTE FUNCTION mod_actions_append_only();
