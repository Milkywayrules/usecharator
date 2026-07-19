import { apiTokens } from "@charator/db";
import { createApiTokenRequestSchema } from "@charator/shared";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, requireSessionUser } from "../auth";
import { generateApiTokenSecret } from "../lib/api-token";
import { HttpError } from "../lib/errors";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

export async function handleTokensList(request: Request): Promise<Response> {
  const user = await requireSessionUser(request);
  const rows = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.userId, user.id))
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
  const user = await requireSessionUser(request);
  const parsed = createApiTokenRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    throw new HttpError(400, {
      code: "validation_error",
      message: parsed.error.issues[0]?.message ?? "invalid request",
    });
  }

  const secret = generateApiTokenSecret();
  const [row] = await db
    .insert(apiTokens)
    .values({
      name: parsed.data.name,
      prefix: secret.prefix,
      tokenHash: secret.tokenHash,
      userId: user.id,
    })
    .returning();

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
  const user = await requireSessionUser(request);
  const [row] = await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiTokens.id, tokenId),
        eq(apiTokens.userId, user.id),
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
