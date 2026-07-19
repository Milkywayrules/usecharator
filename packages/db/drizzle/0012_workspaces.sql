CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "member_user_id_idx" ON "member" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "member_organization_id_idx" ON "member" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "invitation_organization_id_idx" ON "invitation" USING btree ("organization_id");
--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "active_organization_id" text;
--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "workspace_id" text;
--> statement-breakpoint
ALTER TABLE "provider_keys" ADD COLUMN "workspace_id" text;
--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "workspace_id" text;
--> statement-breakpoint
ALTER TABLE "sheet_batches" ADD COLUMN "workspace_id" text;
--> statement-breakpoint
ALTER TABLE "api_tokens" ADD COLUMN "workspace_id" text;
--> statement-breakpoint
INSERT INTO "organization" ("id", "name", "slug", "created_at")
SELECT
	'ws_' || u."id",
	COALESCE(NULLIF(TRIM(u."name"), ''), 'User') || '''s Workspace',
	'personal-' || regexp_replace(u."id", '[^a-zA-Z0-9]+', '-', 'g'),
	NOW()
FROM "user" u
WHERE NOT EXISTS (
	SELECT 1 FROM "member" m WHERE m."user_id" = u."id" AND m."role" = 'owner'
);
--> statement-breakpoint
INSERT INTO "member" ("id", "organization_id", "user_id", "role", "created_at")
SELECT
	'mbr_' || u."id",
	'ws_' || u."id",
	u."id",
	'owner',
	NOW()
FROM "user" u
WHERE NOT EXISTS (
	SELECT 1 FROM "member" m WHERE m."user_id" = u."id"
);
--> statement-breakpoint
UPDATE "characters" AS c
SET "workspace_id" = m."organization_id"
FROM "member" AS m
WHERE c."owner_user_id" = m."user_id"
	AND m."role" = 'owner'
	AND c."workspace_id" IS NULL;
--> statement-breakpoint
UPDATE "provider_keys" AS pk
SET "workspace_id" = m."organization_id"
FROM "member" AS m
WHERE pk."user_id" = m."user_id"
	AND m."role" = 'owner'
	AND pk."workspace_id" IS NULL;
--> statement-breakpoint
UPDATE "sheet_batches" AS sb
SET "workspace_id" = m."organization_id"
FROM "member" AS m
WHERE sb."user_id" = m."user_id"
	AND m."role" = 'owner'
	AND sb."workspace_id" IS NULL;
--> statement-breakpoint
UPDATE "api_tokens" AS t
SET "workspace_id" = m."organization_id"
FROM "member" AS m
WHERE t."user_id" = m."user_id"
	AND m."role" = 'owner'
	AND t."workspace_id" IS NULL;
--> statement-breakpoint
UPDATE "generation_jobs" AS gj
SET "workspace_id" = m."organization_id"
FROM "member" AS m
WHERE gj."user_id" = m."user_id"
	AND m."role" = 'owner'
	AND gj."workspace_id" IS NULL
	AND gj."user_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "characters" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "provider_keys" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "sheet_batches" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "api_tokens" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "provider_keys" ADD CONSTRAINT "provider_keys_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sheet_batches" ADD CONSTRAINT "sheet_batches_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "characters_workspace_id_idx" ON "characters" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX "provider_keys_workspace_id_idx" ON "provider_keys" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX "generation_jobs_workspace_id_idx" ON "generation_jobs" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX "sheet_batches_workspace_id_idx" ON "sheet_batches" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX "api_tokens_workspace_id_idx" ON "api_tokens" USING btree ("workspace_id");
