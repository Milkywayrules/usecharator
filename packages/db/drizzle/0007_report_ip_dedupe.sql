ALTER TABLE "character_reports" ADD COLUMN "reporter_ip_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "character_reports_character_anonymous_reporter_idx" ON "character_reports" USING btree ("character_id","reporter_ip_hash") WHERE "reporter_user_id" IS NULL AND "reporter_ip_hash" IS NOT NULL;
