import { describe, expect, test } from "bun:test";
import { markUserActivatedOnFirstSuccess } from "./user-activation";

describe("markUserActivatedOnFirstSuccess", () => {
  test("no-ops when userId is null", async () => {
    await expect(
      markUserActivatedOnFirstSuccess({} as never, null)
    ).resolves.toBeUndefined();
  });
});
