ALTER TABLE "characters" ADD COLUMN "reference_image_key" text;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "reference_image_keys" text[];--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "reference_strength" real;
