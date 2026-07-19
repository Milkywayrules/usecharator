import {
  account,
  createDb,
  type Db,
  session as sessionTable,
  user,
  verification,
} from "@charator/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { config } from "./config";

const connection = createDb(config.DATABASE_URL);
export const db: Db = connection.db;

export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: config.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      account,
      session: sessionTable,
      user,
      verification,
    },
  }),
  secret: config.BETTER_AUTH_SECRET,
  socialProviders: {
    github: {
      clientId: config.GITHUB_CLIENT_ID,
      clientSecret: config.GITHUB_CLIENT_SECRET,
    },
  },
});

export interface SessionUser {
  email: string;
  id: string;
  image?: string | null;
  name: string;
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
