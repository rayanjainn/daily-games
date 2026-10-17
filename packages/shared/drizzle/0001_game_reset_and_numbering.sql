ALTER TABLE "games" DROP CONSTRAINT "games_reset_hour_check";--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "reset_grace_hours" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "reset_note" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "numbering_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "scoring_unit" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "admin_edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_reset_grace_check" CHECK ("games"."reset_grace_hours" BETWEEN 0 AND 12);--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_reset_hour_check" CHECK ("games"."reset_hour" BETWEEN -12 AND 23);