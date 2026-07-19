import { describe, expect, test } from "bun:test";
import { evaluateRerollEligibility } from "./reroll";

describe("evaluateRerollEligibility", () => {
  test("rejects non-terminal jobs", () => {
    const result = evaluateRerollEligibility({
      hasInlineApiKey: true,
      hasProviderKeyId: false,
      requestUserId: "user-1",
      sourceStatus: "running",
      sourceUserId: "user-1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid_state");
    }
  });

  test("rejects owner mismatch", () => {
    const result = evaluateRerollEligibility({
      hasInlineApiKey: true,
      hasProviderKeyId: false,
      requestUserId: "user-2",
      sourceStatus: "succeeded",
      sourceUserId: "user-1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("forbidden");
    }
  });

  test("requires inline key for anonymous source jobs", () => {
    const result = evaluateRerollEligibility({
      hasInlineApiKey: false,
      hasProviderKeyId: true,
      requestUserId: null,
      sourceStatus: "succeeded",
      sourceUserId: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid_key");
    }
  });

  test("allows anonymous reroll with inline key", () => {
    const result = evaluateRerollEligibility({
      hasInlineApiKey: true,
      hasProviderKeyId: false,
      requestUserId: null,
      sourceStatus: "failed",
      sourceUserId: null,
    });
    expect(result.ok).toBe(true);
  });

  test("requires key for authenticated owner reroll", () => {
    const result = evaluateRerollEligibility({
      hasInlineApiKey: false,
      hasProviderKeyId: false,
      requestUserId: "user-1",
      sourceStatus: "succeeded",
      sourceUserId: "user-1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid_key");
    }
  });

  test("allows authenticated owner reroll with saved key", () => {
    const result = evaluateRerollEligibility({
      hasInlineApiKey: false,
      hasProviderKeyId: true,
      requestUserId: "user-1",
      sourceStatus: "succeeded",
      sourceUserId: "user-1",
    });
    expect(result.ok).toBe(true);
  });
});
