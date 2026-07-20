import { relations } from "drizzle-orm";
import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const subscriptions = pgTable("subscriptions", {
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  id: text("id").primaryKey(),
  provider: text("provider").default("mock").notNull(),
  providerRef: text("provider_ref"),
  status: text("status").notNull(),
  tier: text("tier").notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const billingCheckoutSessions = pgTable("billing_checkout_sessions", {
  cancelUrl: text("cancel_url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  id: text("id").primaryKey(),
  status: text("status").default("open").notNull(),
  successUrl: text("success_url").notNull(),
  tier: text("tier").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(user, {
    fields: [subscriptions.userId],
    references: [user.id],
  }),
}));

export const billingCheckoutSessionsRelations = relations(
  billingCheckoutSessions,
  ({ one }) => ({
    user: one(user, {
      fields: [billingCheckoutSessions.userId],
      references: [user.id],
    }),
  })
);
