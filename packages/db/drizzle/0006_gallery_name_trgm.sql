CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "characters_name_trgm_idx" ON "characters" USING gin ("name" gin_trgm_ops);
