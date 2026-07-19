import { describe, expect, test } from "bun:test";
import { resolveUserFromBearerToken } from "./auth";
import { API_TOKEN_LIVE_PREFIX, hashApiToken } from "./lib/api-token";

describe("bearer auth resolution", () => {
  test("rejects malformed bearer tokens without querying user fields", async () => {
    await expect(
      resolveUserFromBearerToken("ct_live_short")
    ).resolves.toBeNull();
    await expect(
      resolveUserFromBearerToken(`${API_TOKEN_LIVE_PREFIX}not-a-real-token`)
    ).resolves.toBeNull();
  });

  test("rejects revoked or unknown token hashes", async () => {
    const unknown = `${API_TOKEN_LIVE_PREFIX}unknownunknownunknownunknownunknown12`;
    expect(hashApiToken(unknown)).toHaveLength(64);
    await expect(resolveUserFromBearerToken(unknown)).resolves.toBeNull();
  });
});
