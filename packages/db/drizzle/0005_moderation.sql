CREATE TYPE "public"."character_report_reason" AS ENUM('inappropriate', 'spam', 'stolen', 'other');--> statement-breakpoint
CREATE TYPE "public"."character_moderation_status" AS ENUM('visible', 'hidden');--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "moderation_status" "character_moderation_status" DEFAULT 'visible' NOT NULL;--> statement-breakpoint
CREATE INDEX "characters_moderation_status_idx" ON "characters" USING btree ("moderation_status");--> statement-breakpoint
CREATE TABLE "character_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"reporter_user_id" text,
	"reason" "character_report_reason" NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "character_reports" ADD CONSTRAINT "character_reports_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_reports" ADD CONSTRAINT "character_reports_reporter_user_id_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "character_reports_character_id_idx" ON "character_reports" USING btree ("character_id");--> statement-breakpoint
CREATE UNIQUE INDEX "character_reports_character_reporter_idx" ON "character_reports" USING btree ("character_id","reporter_user_id") WHERE "reporter_user_id" IS NOT NULL;
