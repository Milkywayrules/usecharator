import { relations, sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth-schema";

export const providerEnum = pgEnum("provider", [
  "openrouter",
  "openai",
  "gemini",
  "fal",
  "replicate",
  "custom",
]);

export const generationJobStatusEnum = pgEnum("generation_job_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
]);

export const sheetBatchStatusEnum = pgEnum("sheet_batch_status", [
  "running",
  "completed",
  "partial",
  "failed",
]);

export const visibilityEnum = pgEnum("character_visibility", [
  "public",
  "private",
]);

export const moderationStatusEnum = pgEnum("character_moderation_status", [
  "visible",
  "hidden",
]);

export const characterReportReasonEnum = pgEnum("character_report_reason", [
  "inappropriate",
  "spam",
  "stolen",
  "other",
]);

export const providerKeys = pgTable(
  "provider_keys",
  {
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    customBaseUrl: text("custom_base_url"),
    encryptedKey: text("encrypted_key").notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    label: text("label").notNull(),
    provider: providerEnum("provider").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("provider_keys_user_provider_label_idx").on(
      table.userId,
      table.provider,
      table.label
    ),
    index("provider_keys_user_id_idx").on(table.userId),
    index("provider_keys_workspace_id_idx").on(table.workspaceId),
  ]
);

export const characters = pgTable(
  "characters",
  {
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    moderationStatus: moderationStatusEnum("moderation_status")
      .default("visible")
      .notNull(),
    name: text("name").notNull(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    referenceImageKey: text("reference_image_key"),
    remixedFromCharacterId: uuid("remixed_from_character_id"),
    spec: jsonb("spec").$type<unknown>().notNull(),
    themeId: text("theme_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    visibility: visibilityEnum("visibility").default("public").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("characters_owner_user_id_idx").on(table.ownerUserId),
    index("characters_workspace_id_idx").on(table.workspaceId),
    index("characters_visibility_idx").on(table.visibility),
    index("characters_moderation_status_idx").on(table.moderationStatus),
    index("characters_remixed_from_idx").on(table.remixedFromCharacterId),
    foreignKey({
      columns: [table.remixedFromCharacterId],
      foreignColumns: [table.id],
      name: "characters_remixed_from_character_id_fk",
    }).onDelete("set null"),
  ]
);

export const sheetBatches = pgTable(
  "sheet_batches",
  {
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    id: uuid("id").defaultRandom().primaryKey(),
    model: text("model").notNull(),
    preset: text("preset").notNull(),
    provider: providerEnum("provider").notNull(),
    status: sheetBatchStatusEnum("status").default("running").notNull(),
    totalCount: integer("total_count").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("sheet_batches_user_id_idx").on(table.userId),
    index("sheet_batches_workspace_id_idx").on(table.workspaceId),
    index("sheet_batches_character_id_idx").on(table.characterId),
    index("sheet_batches_status_idx").on(table.status),
  ]
);

export const generationJobs = pgTable(
  "generation_jobs",
  {
    aspectRatio: text("aspect_ratio"),
    characterId: uuid("character_id").references(() => characters.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    error: text("error"),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    id: uuid("id").defaultRandom().primaryKey(),
    imageKeys: text("image_keys").array().default([]).notNull(),
    model: text("model").notNull(),
    negativePrompt: text("negative_prompt"),
    prompt: text("prompt").notNull(),
    provider: providerEnum("provider").notNull(),
    providerJobId: text("provider_job_id"),
    providerKeyId: uuid("provider_key_id").references(() => providerKeys.id, {
      onDelete: "set null",
    }),
    referenceImageKeys: text("reference_image_keys").array(),
    referenceStrength: real("reference_strength"),
    sheetBatchId: uuid("sheet_batch_id").references(() => sheetBatches.id, {
      onDelete: "set null",
    }),
    sheetVariant: text("sheet_variant"),
    specSnapshot: jsonb("spec_snapshot").$type<unknown>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    status: generationJobStatusEnum("status").default("queued").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    workspaceId: text("workspace_id").references(() => organization.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("generation_jobs_user_id_idx").on(table.userId),
    index("generation_jobs_workspace_id_idx").on(table.workspaceId),
    index("generation_jobs_status_idx").on(table.status),
    index("generation_jobs_provider_job_id_idx").on(table.providerJobId),
    index("generation_jobs_sheet_batch_id_idx").on(table.sheetBatchId),
  ]
);

export const providerKeysRelations = relations(providerKeys, ({ one }) => ({
  user: one(user, {
    fields: [providerKeys.userId],
    references: [user.id],
  }),
  workspace: one(organization, {
    fields: [providerKeys.workspaceId],
    references: [organization.id],
  }),
}));

export const characterReports = pgTable(
  "character_reports",
  {
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    detail: text("detail"),
    id: uuid("id").defaultRandom().primaryKey(),
    reason: characterReportReasonEnum("reason").notNull(),
    reporterIpHash: text("reporter_ip_hash"),
    reporterUserId: text("reporter_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("character_reports_character_id_idx").on(table.characterId),
    uniqueIndex("character_reports_character_anonymous_reporter_idx")
      .on(table.characterId, table.reporterIpHash)
      .where(
        sql`${table.reporterUserId} is null and ${table.reporterIpHash} is not null`
      ),
    uniqueIndex("character_reports_character_reporter_idx")
      .on(table.characterId, table.reporterUserId)
      .where(sql`${table.reporterUserId} is not null`),
  ]
);

export const charactersRelations = relations(characters, ({ one, many }) => ({
  generationJobs: many(generationJobs),
  owner: one(user, {
    fields: [characters.ownerUserId],
    references: [user.id],
  }),
  remixedFrom: one(characters, {
    fields: [characters.remixedFromCharacterId],
    references: [characters.id],
    relationName: "characterRemixLineage",
  }),
  remixes: many(characters, { relationName: "characterRemixLineage" }),
  reports: many(characterReports),
  sheetBatches: many(sheetBatches),
  workspace: one(organization, {
    fields: [characters.workspaceId],
    references: [organization.id],
  }),
}));

export const sheetBatchesRelations = relations(
  sheetBatches,
  ({ one, many }) => ({
    character: one(characters, {
      fields: [sheetBatches.characterId],
      references: [characters.id],
    }),
    jobs: many(generationJobs),
    user: one(user, {
      fields: [sheetBatches.userId],
      references: [user.id],
    }),
    workspace: one(organization, {
      fields: [sheetBatches.workspaceId],
      references: [organization.id],
    }),
  })
);

export const characterReportsRelations = relations(
  characterReports,
  ({ one }) => ({
    character: one(characters, {
      fields: [characterReports.characterId],
      references: [characters.id],
    }),
    reporter: one(user, {
      fields: [characterReports.reporterUserId],
      references: [user.id],
    }),
  })
);

export const generationJobsRelations = relations(generationJobs, ({ one }) => ({
  character: one(characters, {
    fields: [generationJobs.characterId],
    references: [characters.id],
  }),
  providerKey: one(providerKeys, {
    fields: [generationJobs.providerKeyId],
    references: [providerKeys.id],
  }),
  sheetBatch: one(sheetBatches, {
    fields: [generationJobs.sheetBatchId],
    references: [sheetBatches.id],
  }),
  user: one(user, {
    fields: [generationJobs.userId],
    references: [user.id],
  }),
  workspace: one(organization, {
    fields: [generationJobs.workspaceId],
    references: [organization.id],
  }),
}));

export const apiTokens = pgTable(
  "api_tokens",
  {
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    tokenHash: text("token_hash").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("api_tokens_user_id_idx").on(table.userId),
    index("api_tokens_workspace_id_idx").on(table.workspaceId),
    uniqueIndex("api_tokens_token_hash_idx").on(table.tokenHash),
  ]
);

export const apiTokensRelations = relations(apiTokens, ({ one }) => ({
  user: one(user, {
    fields: [apiTokens.userId],
    references: [user.id],
  }),
  workspace: one(organization, {
    fields: [apiTokens.workspaceId],
    references: [organization.id],
  }),
}));

export const telegramLinkCodes = pgTable(
  "telegram_link_codes",
  {
    code: text("code").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("telegram_link_codes_user_id_idx").on(table.userId)]
);

export const telegramLinks = pgTable(
  "telegram_links",
  {
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    notifyTelegram: boolean("notify_telegram").default(true).notNull(),
    telegramChatId: text("telegram_chat_id").notNull(),
    telegramUsername: text("telegram_username"),
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("telegram_links_telegram_chat_id_idx").on(table.telegramChatId),
  ]
);

export const telegramLinkCodesRelations = relations(
  telegramLinkCodes,
  ({ one }) => ({
    user: one(user, {
      fields: [telegramLinkCodes.userId],
      references: [user.id],
    }),
  })
);

export const telegramLinksRelations = relations(telegramLinks, ({ one }) => ({
  user: one(user, {
    fields: [telegramLinks.userId],
    references: [user.id],
  }),
}));
