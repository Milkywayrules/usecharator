ALTER TABLE "user" ADD COLUMN "tier" text DEFAULT 'free' NOT NULL;
--> statement-breakpoint
CREATE INDEX "sheet_batches_workspace_created_idx" ON "sheet_batches" USING btree ("workspace_id","created_at");
