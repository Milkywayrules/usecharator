import { describe, expect, test } from "bun:test";
import path from "node:path";
import { Verifier } from "@pact-foundation/pact";
import {
  PACT_DIR,
  PACT_FILE,
  PACT_PROVIDER,
  providerBaseUrl,
  shouldRunProviderVerification,
} from "../pact-config";
import {
  pactEntitlementsSessionCookie,
  seedPactEntitlementsSession,
} from "./pact-auth";

describe("charator-api provider verification", () => {
  test("honours charator-web consumer contracts", async () => {
    if (!shouldRunProviderVerification()) {
      expect(true).toBe(true);
      return;
    }

    const pactPath = path.join(PACT_DIR, PACT_FILE);
    const verifier = new Verifier({
      logLevel: "warn",
      pactUrls: [pactPath],
      provider: PACT_PROVIDER,
      providerBaseUrl: providerBaseUrl(),
      requestFilter: (req) => {
        if (
          req.path === "/api/v1/me/entitlements" &&
          req.method === "GET" &&
          !req.headers.cookie?.includes("better-auth.session_token")
        ) {
          req.headers.cookie = [
            req.headers.cookie,
            pactEntitlementsSessionCookie(),
          ]
            .filter(Boolean)
            .join("; ");
        }
        return req;
      },
      stateHandlers: {
        "api is healthy": () => Promise.resolve("api healthy"),
        "gallery listing is available": () =>
          Promise.resolve("gallery available"),
        "generation job does not exist": () =>
          Promise.resolve("generation missing"),
        "provider capabilities are configured": () =>
          Promise.resolve("capabilities ready"),
        "spec catalog is available": () =>
          Promise.resolve("spec catalog ready"),
        "spec render accepts minimal body": () =>
          Promise.resolve("spec render ready"),
        "themes catalog is available": () => Promise.resolve("themes ready"),
        "user is not authenticated": () =>
          Promise.resolve("no authenticated user"),
        "workspace entitlements are available": async () => {
          await seedPactEntitlementsSession();
          return "entitlements session ready";
        },
      },
    });

    await verifier.verifyProvider();
  });
});
