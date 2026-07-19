CREATE TYPE "public"."sheet_batch_status" AS ENUM('running', 'completed', 'partial', 'failed');--> statement-breakpoint
CREATE TABLE "sheet_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"character_id" uuid NOT NULL,
	"preset" text NOT NULL,
	"provider" "provider" NOT NULL,
	"model" text NOT NULL,
	"status" "sheet_batch_status" DEFAULT 'running' NOT NULL,
	"total_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "sheet_batch_id" uuid;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "sheet_variant" text;--> statement-breakpoint
ALTER TABLE "sheet_batches" ADD CONSTRAINT "sheet_batches_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_batches" ADD CONSTRAINT "sheet_batches_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_sheet_batch_id_sheet_batches_id_fk" FOREIGN KEY ("sheet_batch_id") REFERENCES "public"."sheet_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sheet_batches_user_id_idx" ON "sheet_batches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sheet_batches_character_id_idx" ON "sheet_batches" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "sheet_batches_status_idx" ON "sheet_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "generation_jobs_sheet_batch_id_idx" ON "generation_jobs" USING btree ("sheet_batch_id");
