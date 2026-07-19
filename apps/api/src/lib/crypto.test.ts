import { describe, expect, test } from "bun:test";
import {
  decryptSecret,
  encryptSecret,
  hashReporterIp,
  maskApiKey,
} from "./crypto";

const masterKey = Buffer.alloc(32, 7).toString("base64");

describe("crypto", () => {
  test("roundtrips plaintext", () => {
    const encrypted = encryptSecret("sk-test-key-1234567890", masterKey);
    const decrypted = decryptSecret(encrypted, masterKey);
    expect(decrypted).toBe("sk-test-key-1234567890");
  });

  test("detects tampered ciphertext", () => {
    const encrypted = encryptSecret("secret-value", masterKey);
    const bytes = Buffer.from(encrypted, "base64");
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 0xff;
    const tampered = bytes.toString("base64");
    expect(() => decryptSecret(tampered, masterKey)).toThrow();
  });

  test("masks api keys for responses", () => {
    expect(maskApiKey("abcd1234wxyz9876")).toBe("abcd…9876");
  });

  test("hashes reporter ips deterministically", () => {
    const first = hashReporterIp("203.0.113.10", masterKey);
    const second = hashReporterIp("203.0.113.10", masterKey);
    expect(first).toBe(second);
    expect(first).toHaveLength(64);
    expect(hashReporterIp("10.0.0.1", masterKey)).not.toBe(first);
  });
});
