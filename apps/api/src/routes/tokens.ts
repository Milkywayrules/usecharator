import { apiTokens } from "@charator/db";
import { createApiTokenRequestSchema } from "@charator/shared";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, requireSessionUser } from "../auth";
import { generateApiTokenSecret } from "../lib/api-token";
import { withWorkspaceEntitlementLock } from "../lib/entitlement-lock";
import { assertApiTokenCreationAllowed } from "../lib/entitlements";
import { HttpError } from "../lib/errors";
import { requireWorkspaceContext } from "./workspaces";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

function assertSessionOnlyAuth(authMethod: "bearer" | "session"): void {
  if (authMethod === "bearer") {
    throw new HttpError(403, {
      code: "forbidden",
      message: "token management requires a session",
    });
  }
}

export async function handleTokensList(request: Request): Promise<Response> {
  await requireSessionUser(request);
  const context = await requireWorkspaceContext(request);
  assertSessionOnlyAuth(context.user.authMethod);
  const rows = await db
    .select()
    .from(apiTokens)
    .where(
      and(
        eq(apiTokens.userId, context.user.id),
        eq(apiTokens.workspaceId, context.workspaceId)
      )
    )
    .orderBy(desc(apiTokens.createdAt));

  return json(
    rows.map((row) => ({
      createdAt: row.createdAt.toISOString(),
      id: row.id,
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      name: row.name,
      prefix: row.prefix,
      revokedAt: row.revokedAt?.toISOString() ?? null,
    }))
  );
}

export async function handleTokensPost(request: Request): Promise<Response> {
  await requireSessionUser(request);
  const context = await requireWorkspaceContext(request);
  assertSessionOnlyAuth(context.user.authMethod);
  const parsed = createApiTokenRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    throw new HttpError(400, {
      code: "validation_error",
      message: parsed.error.issues[0]?.message ?? "invalid request",
    });
  }

  const secret = generateApiTokenSecret();
  const row = await withWorkspaceEntitlementLock(
    db,
    context.workspaceId,
    async (tx) => {
      await assertApiTokenCreationAllowed(tx, context.workspaceId);
      const [inserted] = await tx
        .insert(apiTokens)
        .values({
          name: parsed.data.name,
          prefix: secret.prefix,
          tokenHash: secret.tokenHash,
          userId: context.user.id,
          workspaceId: context.workspaceId,
        })
        .returning();
      return inserted;
    }
  );

  if (!row) {
    throw new HttpError(500, {
      code: "internal_error",
      message: "failed to create token",
    });
  }

  return json(
    {
      createdAt: row.createdAt.toISOString(),
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      token: secret.token,
    },
    201
  );
}

export async function handleTokensDelete(
  request: Request,
  tokenId: string
): Promise<Response> {
  await requireSessionUser(request);
  const context = await requireWorkspaceContext(request);
  assertSessionOnlyAuth(context.user.authMethod);
  const [row] = await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiTokens.id, tokenId),
        eq(apiTokens.userId, context.user.id),
        eq(apiTokens.workspaceId, context.workspaceId),
        isNull(apiTokens.revokedAt)
      )
    )
    .returning({ id: apiTokens.id });

  if (!row) {
    throw new HttpError(404, {
      code: "not_found",
      message: "token not found",
    });
  }

  return new Response(null, { status: 204 });
}
