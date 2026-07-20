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
      stateHandlers: {
        "api is healthy": () => Promise.resolve("api healthy"),
        "gallery listing is available": () =>
          Promise.resolve("gallery available"),
        "generation job does not exist": () =>
          Promise.resolve("generation missing"),
        "provider capabilities are configured": () =>
          Promise.resolve("capabilities ready"),
        "themes catalog is available": () => Promise.resolve("themes ready"),
      },
    });

    await verifier.verifyProvider();
  });
});
