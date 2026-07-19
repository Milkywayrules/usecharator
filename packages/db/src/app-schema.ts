import { relations } from "drizzle-orm";
import {
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

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

export const visibilityEnum = pgEnum("character_visibility", [
  "public",
  "private",
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
  },
  (table) => [
    uniqueIndex("provider_keys_user_provider_label_idx").on(
      table.userId,
      table.provider,
      table.label
    ),
    index("provider_keys_user_id_idx").on(table.userId),
  ]
);

export const characters = pgTable(
  "characters",
  {
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    remixedFromCharacterId: uuid("remixed_from_character_id"),
    spec: jsonb("spec").$type<unknown>().notNull(),
    themeId: text("theme_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    visibility: visibilityEnum("visibility").default("public").notNull(),
  },
  (table) => [
    index("characters_owner_user_id_idx").on(table.ownerUserId),
    index("characters_visibility_idx").on(table.visibility),
    index("characters_remixed_from_idx").on(table.remixedFromCharacterId),
    foreignKey({
      columns: [table.remixedFromCharacterId],
      foreignColumns: [table.id],
      name: "characters_remixed_from_character_id_fk",
    }).onDelete("set null"),
  ]
);

export const generationJobs = pgTable(
  "generation_jobs",
  {
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
    specSnapshot: jsonb("spec_snapshot").$type<unknown>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    status: generationJobStatusEnum("status").default("queued").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    index("generation_jobs_user_id_idx").on(table.userId),
    index("generation_jobs_status_idx").on(table.status),
    index("generation_jobs_provider_job_id_idx").on(table.providerJobId),
  ]
);

export const providerKeysRelations = relations(providerKeys, ({ one }) => ({
  user: one(user, {
    fields: [providerKeys.userId],
    references: [user.id],
  }),
}));

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
}));

export const generationJobsRelations = relations(generationJobs, ({ one }) => ({
  character: one(characters, {
    fields: [generationJobs.characterId],
    references: [characters.id],
  }),
  providerKey: one(providerKeys, {
    fields: [generationJobs.providerKeyId],
    references: [providerKeys.id],
  }),
  user: one(user, {
    fields: [generationJobs.userId],
    references: [user.id],
  }),
}));
