CREATE UNIQUE INDEX "sheet_batches_active_uniq" ON "sheet_batches" USING btree ("character_id","preset") WHERE "status" = 'running';--> statement-breakpoint
