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
import { seedPactEntitlementsSession } from "./pact-auth";
import { pactEntitlementsSessionCookie } from "./pact-auth.constants";

describe("charator-api provider verification", () => {
  test(
    "honours charator-web consumer contracts",
    async () => {
      if (!shouldRunProviderVerification()) {
        expect(true).toBe(true);
        return;
      }

      await seedPactEntitlementsSession();
      const sessionCookie = await pactEntitlementsSessionCookie();

      const pactPath = path.join(PACT_DIR, PACT_FILE);
      const verifier = new Verifier({
        logLevel: "warn",
        pactUrls: [pactPath],
        provider: PACT_PROVIDER,
        providerBaseUrl: providerBaseUrl(),
        requestFilter: (req, _res, next) => {
          if (
            req.path === "/api/v1/me/entitlements" &&
            req.method === "GET" &&
            req.headers.cookie
          ) {
            req.headers.cookie = sessionCookie;
          }
          next();
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
          "workspace entitlements are available": () =>
            Promise.resolve("entitlements session ready"),
        },
      });

      await verifier.verifyProvider();
    },
    { timeout: 30_000 }
  );
});
