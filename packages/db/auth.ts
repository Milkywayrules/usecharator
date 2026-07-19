import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const client = postgres(
	"postgresql://charator:charator@localhost:5432/charator",
	{ max: 1 },
);
const db = drizzle(client);

export const auth = betterAuth({
	baseURL: "http://localhost:3001",
	database: drizzleAdapter(db, {
		provider: "pg",
	}),
	secret: "01234567890123456789012345678901",
	socialProviders: {
		github: {
			clientId: "cli-placeholder",
			clientSecret: "cli-placeholder",
		},
	},
});

export default auth;
