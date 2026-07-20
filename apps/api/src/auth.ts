import {
  account,
  apiTokens,
  createDb,
  type Db,
  invitation,
  member,
  organization,
  session as sessionTable,
  user,
  verification,
} from "@charator/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization as organizationPlugin } from "better-auth/plugins";
import { and, eq, isNull } from "drizzle-orm";
import { config, githubConfigured } from "./config";
import {
  hashApiToken,
  isValidApiTokenFormat,
  parseBearerToken,
} from "./lib/api-token";
import {
  createPersonalWorkspace,
  getFirstOwnedWorkspaceId,
} from "./lib/workspace";

const connection = createDb(config.DATABASE_URL);
export const db: Db = connection.db;

export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: config.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      account,
      invitation,
      member,
      organization,
      session: sessionTable,
      user,
      verification,
    },
  }),
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const workspaceId = await getFirstOwnedWorkspaceId(
            db,
            session.userId
          );
          if (!workspaceId) {
            return { data: session };
          }
          return {
            data: {
              ...session,
              activeOrganizationId: workspaceId,
            },
          };
        },
      },
    },
    user: {
      create: {
        after: async (createdUser) => {
          await createPersonalWorkspace(db, createdUser.id, createdUser.name);
        },
      },
    },
  },
  plugins: [
    organizationPlugin({
      teams: { enabled: false },
    }),
  ],
  secret: config.BETTER_AUTH_SECRET,
  socialProviders: {
    ...(githubConfigured(config)
      ? {
          github: {
            clientId: config.GITHUB_CLIENT_ID as string,
            clientSecret: config.GITHUB_CLIENT_SECRET as string,
          },
        }
      : {}),
  },
});

export interface SessionUser {
  email: string;
  id: string;
  image?: string | null;
  name: string;
}

export type AuthMethod = "bearer" | "session";

export interface AuthUser extends SessionUser {
  authMethod: AuthMethod;
  tokenId?: string;
  workspaceId?: string;
}

const tokenLastUsedWrites = new Map<string, number>();
const TOKEN_LAST_USED_THROTTLE_MS = 60_000;

async function touchApiTokenLastUsed(
  tokenId: string,
  previousLastUsedAt: Date | null
): Promise<void> {
  const nowMs = Date.now();
  const previousMs = previousLastUsedAt?.getTime() ?? 0;
  if (nowMs - previousMs < TOKEN_LAST_USED_THROTTLE_MS) {
    return;
  }

  const lastWriteMs = tokenLastUsedWrites.get(tokenId) ?? 0;
  if (nowMs - lastWriteMs < TOKEN_LAST_USED_THROTTLE_MS) {
    return;
  }

  tokenLastUsedWrites.set(tokenId, nowMs);
  await db
    .update(apiTokens)
    .set({ lastUsedAt: new Date(nowMs) })
    .where(eq(apiTokens.id, tokenId))
    .catch(() => {
      tokenLastUsedWrites.delete(tokenId);
    });
}

export async function resolveUserFromBearerToken(
  token: string
): Promise<AuthUser | null> {
  if (!isValidApiTokenFormat(token)) {
    return null;
  }

  const tokenHash = hashApiToken(token);
  try {
    const [row] = await db
      .select({
        id: apiTokens.id,
        lastUsedAt: apiTokens.lastUsedAt,
        revokedAt: apiTokens.revokedAt,
        userEmail: user.email,
        userId: user.id,
        userImage: user.image,
        userName: user.name,
        workspaceId: apiTokens.workspaceId,
      })
      .from(apiTokens)
      .innerJoin(user, eq(apiTokens.userId, user.id))
      .where(
        and(eq(apiTokens.tokenHash, tokenHash), isNull(apiTokens.revokedAt))
      )
      .limit(1);

    if (!row) {
      return null;
    }

    touchApiTokenLastUsed(row.id, row.lastUsedAt).catch(() => undefined);

    return {
      authMethod: "bearer",
      email: row.userEmail,
      id: row.userId,
      image: row.userImage,
      name: row.userName,
      tokenId: row.id,
      workspaceId: row.workspaceId,
    };
  } catch {
    return null;
  }
}

export async function getSessionUser(
  request: Request
): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return null;
  }
  return {
    email: session.user.email,
    id: session.user.id,
    image: session.user.image,
    name: session.user.name,
  };
}

export async function resolveAuthUser(
  request: Request
): Promise<AuthUser | null> {
  const sessionUser = await getSessionUser(request);
  if (sessionUser) {
    return { ...sessionUser, authMethod: "session" };
  }

  const bearerToken = parseBearerToken(request.headers.get("authorization"));
  if (!bearerToken) {
    return null;
  }

  return resolveUserFromBearerToken(bearerToken);
}

export async function requireAuthUser(request: Request): Promise<AuthUser> {
  const authUser = await resolveAuthUser(request);
  if (!authUser) {
    throw new Response(
      JSON.stringify({ code: "unauthorized", message: "sign in required" }),
      {
        headers: { "Content-Type": "application/json" },
        status: 401,
      }
    );
  }
  return authUser;
}

export async function requireSessionUser(
  request: Request
): Promise<SessionUser> {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    throw new Response(
      JSON.stringify({ code: "unauthorized", message: "sign in required" }),
      {
        headers: { "Content-Type": "application/json" },
        status: 401,
      }
    );
  }
  return sessionUser;
}
