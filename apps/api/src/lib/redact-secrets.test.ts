import { describe, expect, test } from "bun:test";
import { redactSecrets } from "./redact-secrets";

describe("redactSecrets", () => {
  test("redacts bearer tokens, api keys, and provider secrets", () => {
    const input =
      "auth Bearer sk-live-abc123 failed with Key secret-key and r8_abcd1234";
    expect(redactSecrets(input)).toBe(
      "auth Bearer [redacted] failed with Key [redacted] and [redacted]"
    );
  });
});
