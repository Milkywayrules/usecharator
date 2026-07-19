ALTER TABLE "characters" ADD COLUMN "theme_id" text;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "provider_key_id" uuid;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_provider_key_id_provider_keys_id_fk" FOREIGN KEY ("provider_key_id") REFERENCES "public"."provider_keys"("id") ON DELETE set null ON UPDATE no action;
