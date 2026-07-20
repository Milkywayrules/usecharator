import { createDb, member, organization, session, user } from "@charator/db";
import { PACT_ENTITLEMENTS_SESSION_TOKEN } from "./pact-auth.constants";

export const PACT_ENTITLEMENTS_USER_ID = "pact-entitlements-user";
export const PACT_ENTITLEMENTS_WORKSPACE_ID = "ws_pact-entitlements-user";
export const PACT_ENTITLEMENTS_MEMBER_ID = "mbr_pact-entitlements-user";
export const PACT_ENTITLEMENTS_SESSION_ID = "sess_pact-entitlements-user";

export async function seedPactEntitlementsSession(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for pact provider auth seeding");
  }

  const { client, db } = createDb(databaseUrl);
  const now = new Date();
  const expiresAt = new Date(Date.now() + 86_400_000);

  try {
    await db
      .insert(user)
      .values({
        email: "pact-entitlements@example.com",
        emailVerified: true,
        id: PACT_ENTITLEMENTS_USER_ID,
        name: "Pact Entitlements",
        tier: "free",
      })
      .onConflictDoNothing();

    await db
      .insert(organization)
      .values({
        createdAt: now,
        id: PACT_ENTITLEMENTS_WORKSPACE_ID,
        name: "Pact Entitlements Workspace",
        slug: "pact-entitlements",
      })
      .onConflictDoNothing();

    await db
      .insert(member)
      .values({
        createdAt: now,
        id: PACT_ENTITLEMENTS_MEMBER_ID,
        organizationId: PACT_ENTITLEMENTS_WORKSPACE_ID,
        role: "owner",
        userId: PACT_ENTITLEMENTS_USER_ID,
      })
      .onConflictDoNothing();

    await db
      .insert(session)
      .values({
        activeOrganizationId: PACT_ENTITLEMENTS_WORKSPACE_ID,
        createdAt: now,
        expiresAt,
        id: PACT_ENTITLEMENTS_SESSION_ID,
        token: PACT_ENTITLEMENTS_SESSION_TOKEN,
        updatedAt: now,
        userId: PACT_ENTITLEMENTS_USER_ID,
      })
      .onConflictDoUpdate({
        set: {
          activeOrganizationId: PACT_ENTITLEMENTS_WORKSPACE_ID,
          expiresAt,
          updatedAt: now,
        },
        target: session.token,
      });
  } finally {
    await client.end();
  }
}
