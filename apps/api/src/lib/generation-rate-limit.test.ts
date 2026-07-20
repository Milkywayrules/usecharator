import { describe, expect, test } from "bun:test";

describe("generation rate limit singleton", () => {
  test("module exports one shared limiter pair across importers", async () => {
    const first = await import("./generation-rate-limit");
    const second = await import("./generation-rate-limit");

    expect(first.anonymousGenerationLimiter).toBe(
      second.anonymousGenerationLimiter
    );
    expect(first.authenticatedGenerationLimiter).toBe(
      second.authenticatedGenerationLimiter
    );

    await import("../routes/handlers");
    await import("../routes/reroll");

    const third = await import("./generation-rate-limit");
    expect(third.anonymousGenerationLimiter).toBe(
      first.anonymousGenerationLimiter
    );
  });
});
