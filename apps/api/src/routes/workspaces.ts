import { member, organization } from "@charator/db";
import {
  createWorkspaceRequestSchema,
  updateWorkspaceRequestSchema,
} from "@charator/shared";
import { and, asc, eq } from "drizzle-orm";
import {
  type AuthUser,
  auth,
  db,
  requireSessionUser,
  resolveAuthUser,
} from "../auth";
import { HttpError } from "../lib/errors";
import {
  assertWorkspaceCreationAllowed,
  countOwnedWorkspaces,
  getFirstOwnedWorkspaceId,
  setActiveOrganizationForSession,
  userOwnsWorkspace,
  workspaceHasBlockingResources,
  workspaceSlugFromName,
} from "../lib/workspace";
import {
  resolveBearerWorkspaceId,
  resolveSessionWorkspaceId,
} from "../lib/workspace-context";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

function listOwnedWorkspaceRows(userId: string) {
  return db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(and(eq(member.userId, userId), eq(member.role, "owner")))
    .orderBy(asc(member.createdAt));
}

export async function handleWorkspacesList(
  request: Request
): Promise<Response> {
  const user = await requireSessionUser(request);
  const session = await auth.api.getSession({ headers: request.headers });
  const activeWorkspaceId = session?.session.activeOrganizationId ?? null;
  const rows = await listOwnedWorkspaceRows(user.id);

  return json({
    items: rows.map((row) => ({
      id: row.id,
      isActive: row.id === activeWorkspaceId,
      name: row.name,
      slug: row.slug,
    })),
  });
}

export async function handleWorkspacesPost(
  request: Request
): Promise<Response> {
  const user = await requireSessionUser(request);
  const parsed = createWorkspaceRequestSchema.safeParse(
    await readJson(request)
  );
  if (!parsed.success) {
    throw new HttpError(400, {
      code: "validation_error",
      message: parsed.error.issues[0]?.message ?? "invalid request",
    });
  }

  await assertWorkspaceCreationAllowed(db, user.id);

  const slug = workspaceSlugFromName(parsed.data.name);
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(organization).values({
    createdAt: now,
    id,
    name: parsed.data.name,
    slug,
  });

  await db.insert(member).values({
    createdAt: now,
    id: crypto.randomUUID(),
    organizationId: id,
    role: "owner",
    userId: user.id,
  });

  const session = await auth.api.getSession({ headers: request.headers });
  if (session?.session.id) {
    await setActiveOrganizationForSession(db, session.session.id, id);
  }

  return json({ id, name: parsed.data.name, slug }, 201);
}

export async function handleWorkspacesPatch(
  request: Request,
  workspaceId: string
): Promise<Response> {
  const user = await requireSessionUser(request);
  const parsed = updateWorkspaceRequestSchema.safeParse(
    await readJson(request)
  );
  if (!parsed.success) {
    throw new HttpError(400, {
      code: "validation_error",
      message: parsed.error.issues[0]?.message ?? "invalid request",
    });
  }

  if (!(await userOwnsWorkspace(db, user.id, workspaceId))) {
    throw new HttpError(404, {
      code: "not_found",
      message: "workspace not found",
    });
  }

  const [row] = await db
    .update(organization)
    .set({ name: parsed.data.name })
    .where(eq(organization.id, workspaceId))
    .returning({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    });

  if (!row) {
    throw new HttpError(404, {
      code: "not_found",
      message: "workspace not found",
    });
  }

  return json(row);
}

export async function handleWorkspacesDelete(
  request: Request,
  workspaceId: string
): Promise<Response> {
  const user = await requireSessionUser(request);

  if (!(await userOwnsWorkspace(db, user.id, workspaceId))) {
    throw new HttpError(404, {
      code: "not_found",
      message: "workspace not found",
    });
  }

  const ownedCount = await countOwnedWorkspaces(db, user.id);
  if (ownedCount <= 1) {
    throw new HttpError(409, {
      code: "last_workspace",
      message: "cannot delete your only workspace",
    });
  }

  if (await workspaceHasBlockingResources(db, workspaceId)) {
    throw new HttpError(409, {
      code: "workspace_not_empty",
      message:
        "workspace still contains characters, provider keys, or API tokens",
    });
  }

  await db.delete(organization).where(eq(organization.id, workspaceId));
  return new Response(null, { status: 204 });
}

export async function handleWorkspacesActivate(
  request: Request,
  workspaceId: string
): Promise<Response> {
  const user = await requireSessionUser(request);

  if (!(await userOwnsWorkspace(db, user.id, workspaceId))) {
    throw new HttpError(404, {
      code: "not_found",
      message: "workspace not found",
    });
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.session.id) {
    throw new HttpError(401, {
      code: "unauthorized",
      message: "sign in required",
    });
  }

  await setActiveOrganizationForSession(db, session.session.id, workspaceId);
  return json({ workspaceId });
}

export interface WorkspaceContext {
  user: AuthUser;
  workspaceId: string;
}

export async function resolveWorkspaceContext(
  request: Request
): Promise<WorkspaceContext | null> {
  const authUser = await resolveAuthUser(request);
  if (!authUser) {
    return null;
  }

  if (authUser.authMethod === "bearer") {
    const workspaceId = resolveBearerWorkspaceId(authUser.workspaceId);
    if (!workspaceId) {
      return null;
    }
    return { user: authUser, workspaceId };
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.session) {
    return null;
  }

  const activeOrganizationId = session.session.activeOrganizationId ?? null;
  const ownsActive = activeOrganizationId
    ? await userOwnsWorkspace(db, authUser.id, activeOrganizationId)
    : false;
  const firstOwnedWorkspaceId = await getFirstOwnedWorkspaceId(db, authUser.id);
  const resolved = resolveSessionWorkspaceId({
    activeOrganizationId,
    firstOwnedWorkspaceId,
    ownsActiveOrganization: ownsActive,
  });

  if (resolved.shouldSetActive && resolved.workspaceId && session.session.id) {
    await setActiveOrganizationForSession(
      db,
      session.session.id,
      resolved.workspaceId
    );
  }

  if (!resolved.workspaceId) {
    return null;
  }

  return { user: authUser, workspaceId: resolved.workspaceId };
}

export async function requireWorkspaceContext(
  request: Request
): Promise<WorkspaceContext> {
  const context = await resolveWorkspaceContext(request);
  if (!context) {
    const authUser = await resolveAuthUser(request);
    if (authUser) {
      throw new Response(
        JSON.stringify({
          code: "no_workspace",
          message: "no workspace available — create one to continue",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 403,
        }
      );
    }
    throw new Response(
      JSON.stringify({ code: "unauthorized", message: "sign in required" }),
      {
        headers: { "Content-Type": "application/json" },
        status: 401,
      }
    );
  }
  return context;
}

export async function getActiveWorkspaceName(
  workspaceId: string
): Promise<string | null> {
  const [row] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, workspaceId))
    .limit(1);
  return row?.name ?? null;
}
