DROP TABLE "recovery_phrase_hashes" CASCADE;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "recovery_confirmed_at";