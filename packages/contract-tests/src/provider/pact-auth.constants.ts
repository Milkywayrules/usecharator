import { serializeSignedCookie } from "better-call";

export const PACT_ENTITLEMENTS_SESSION_TOKEN = "pact-entitlements-session";

export async function pactEntitlementsSessionCookie(): Promise<string> {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "BETTER_AUTH_SECRET is required for pact provider auth cookies",
    );
  }

  const signed = (
    await serializeSignedCookie("", PACT_ENTITLEMENTS_SESSION_TOKEN, secret)
  ).replace("=", "");

  return `better-auth.session_token=${signed}`;
}
