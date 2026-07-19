ALTER TABLE "characters" ADD COLUMN "remixed_from_character_id" uuid;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_remixed_from_character_id_fk" FOREIGN KEY ("remixed_from_character_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "characters_visibility_idx" ON "characters" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "characters_remixed_from_idx" ON "characters" USING btree ("remixed_from_character_id");
