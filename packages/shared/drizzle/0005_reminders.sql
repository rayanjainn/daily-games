CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"label" text,
	"last_success_at" timestamp with time zone,
	"failures" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_https" CHECK ("push_subscriptions"."endpoint" ~ '^https://')
);
--> statement-breakpoint
CREATE TABLE "reminder_deliveries" (
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminder_deliveries_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
ALTER TABLE "follows" ADD COLUMN "remind_at" time;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "streak_nudge_at" time;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_deliveries" ADD CONSTRAINT "reminder_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reminder_deliveries_created_idx" ON "reminder_deliveries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "follows_remind_idx" ON "follows" USING btree ("remind_at") WHERE "follows"."remind_at" IS NOT NULL;