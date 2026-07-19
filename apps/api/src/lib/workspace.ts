import {
  apiTokens,
  characters,
  type Db,
  member,
  organization,
  providerKeys,
  session as sessionTable,
} from "@charator/db";
import { and, asc, eq, sql } from "drizzle-orm";

export function personalWorkspaceName(userName: string): string {
  const trimmed = userName.trim();
  const base = trimmed.length > 0 ? trimmed : "User";
  return `${base}'s Workspace`;
}

export function personalWorkspaceSlug(userId: string): string {
  return `personal-${userId.replace(/[^a-zA-Z0-9]+/g, "-")}`.slice(0, 120);
}

export function workspaceSlugFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0
    ? slug.slice(0, 120)
    : `workspace-${crypto.randomUUID()}`;
}

export async function createPersonalWorkspace(
  db: Db,
  userId: string,
  userName: string
): Promise<{ id: string; name: string; slug: string }> {
  const id = crypto.randomUUID();
  const name = personalWorkspaceName(userName);
  const slug = personalWorkspaceSlug(userId);

  await db.insert(organization).values({
    createdAt: new Date(),
    id,
    name,
    slug,
  });

  await db.insert(member).values({
    createdAt: new Date(),
    id: crypto.randomUUID(),
    organizationId: id,
    role: "owner",
    userId,
  });

  return { id, name, slug };
}

export async function userOwnsWorkspace(
  db: Db,
  userId: string,
  workspaceId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.userId, userId),
        eq(member.organizationId, workspaceId),
        eq(member.role, "owner")
      )
    )
    .limit(1);
  return Boolean(row);
}

export async function getFirstOwnedWorkspaceId(
  db: Db,
  userId: string
): Promise<string | null> {
  const [row] = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.role, "owner")))
    .orderBy(asc(member.createdAt))
    .limit(1);
  return row?.organizationId ?? null;
}

export async function setActiveOrganizationForSession(
  db: Db,
  sessionId: string,
  workspaceId: string
): Promise<void> {
  await db
    .update(sessionTable)
    .set({ activeOrganizationId: workspaceId })
    .where(eq(sessionTable.id, sessionId));
}

export async function countOwnedWorkspaces(
  db: Db,
  userId: string
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.role, "owner")));
  return row?.count ?? 0;
}

export async function workspaceHasBlockingResources(
  db: Db,
  workspaceId: string
): Promise<boolean> {
  const [characterCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(characters)
    .where(eq(characters.workspaceId, workspaceId));
  if ((characterCount?.count ?? 0) > 0) {
    return true;
  }

  const [keyCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(providerKeys)
    .where(eq(providerKeys.workspaceId, workspaceId));
  if ((keyCount?.count ?? 0) > 0) {
    return true;
  }

  const [tokenCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(apiTokens)
    .where(eq(apiTokens.workspaceId, workspaceId));
  return (tokenCount?.count ?? 0) > 0;
}

/** Epic 7.2: replace with plan-backed workspace count entitlement. */
export function assertWorkspaceCreationAllowed(_db: Db, _userId: string): void {
  // entitlement seam for epic 7.2
}
