import { describe, expect, test } from "bun:test";
import { DEV_PAYMENT_WEBHOOK_SECRET, parseAppConfig } from "./config";

const paymentWebhookSecretError = /PAYMENT_WEBHOOK_SECRET/;
const invalidEncryptionKeyError =
  /must decode to 32 bytes|Invalid environment variables/;

const baseEnv: Record<string, string | undefined> = {
  BETTER_AUTH_SECRET: "01234567890123456789012345678901",
  BETTER_AUTH_URL: "http://localhost:3001",
  DATABASE_URL: "postgresql://charator:charator@localhost:5432/charator",
  GITHUB_CLIENT_ID: "test-client-id",
  GITHUB_CLIENT_SECRET: "test-client-secret",
  KEY_ENCRYPTION_MASTER_KEY: Buffer.alloc(32, 7).toString("base64"),
  NODE_ENV: "development",
  PAYMENT_WEBHOOK_SECRET: DEV_PAYMENT_WEBHOOK_SECRET,
  WEB_APP_URL: "http://localhost:3000",
};

describe("production config guard", () => {
  test("throws when payment webhook secret is the dev default in production", () => {
    expect(() =>
      parseAppConfig({
        ...baseEnv,
        NODE_ENV: "production",
        PAYMENT_WEBHOOK_SECRET: DEV_PAYMENT_WEBHOOK_SECRET,
      })
    ).toThrow(paymentWebhookSecretError);
  });

  test("throws when payment webhook secret is unset in production", () => {
    const { PAYMENT_WEBHOOK_SECRET: _removed, ...envWithoutSecret } = {
      ...baseEnv,
      NODE_ENV: "production",
    };
    expect(() => parseAppConfig(envWithoutSecret)).toThrow(
      paymentWebhookSecretError
    );
  });

  test("allows dev default payment webhook secret outside production", () => {
    const cfg = parseAppConfig({
      ...baseEnv,
      NODE_ENV: "development",
      PAYMENT_WEBHOOK_SECRET: DEV_PAYMENT_WEBHOOK_SECRET,
    });
    expect(cfg.PAYMENT_WEBHOOK_SECRET).toBe(DEV_PAYMENT_WEBHOOK_SECRET);
  });

  test("accepts a custom payment webhook secret in production", () => {
    const cfg = parseAppConfig({
      ...baseEnv,
      NODE_ENV: "production",
      PAYMENT_WEBHOOK_SECRET: "prod-webhook-secret-with-enough-entropy",
    });
    expect(cfg.PAYMENT_WEBHOOK_SECRET).toBe(
      "prod-webhook-secret-with-enough-entropy"
    );
  });

  test("allows missing github oauth credentials in production", () => {
    const {
      GITHUB_CLIENT_ID: _id,
      GITHUB_CLIENT_SECRET: _secret,
      ...env
    } = baseEnv;
    const cfg = parseAppConfig({
      ...env,
      NODE_ENV: "production",
      PAYMENT_WEBHOOK_SECRET: "prod-webhook-secret-with-enough-entropy",
    });
    expect(cfg.GITHUB_CLIENT_ID).toBeUndefined();
    expect(cfg.GITHUB_CLIENT_SECRET).toBeUndefined();
  });

  test("treats empty optional env vars as unset", () => {
    const cfg = parseAppConfig({
      ...baseEnv,
      R2_ENDPOINT: "",
      TELEGRAM_BOT_TOKEN: "",
    });
    expect(cfg.R2_ENDPOINT).toBeUndefined();
    expect(cfg.TELEGRAM_BOT_TOKEN).toBeUndefined();
  });
});

describe("KEY_ENCRYPTION_MASTER_KEY validation", () => {
  test("rejects a key that does not decode to 32 bytes", () => {
    expect(() =>
      parseAppConfig({
        ...baseEnv,
        KEY_ENCRYPTION_MASTER_KEY: Buffer.alloc(16, 1).toString("base64"),
      })
    ).toThrow(invalidEncryptionKeyError);
  });

  test("rejects invalid base64", () => {
    expect(() =>
      parseAppConfig({
        ...baseEnv,
        KEY_ENCRYPTION_MASTER_KEY: "not-valid-base64!!!",
      })
    ).toThrow(invalidEncryptionKeyError);
  });

  test("accepts a valid 32-byte base64 key", () => {
    const key = Buffer.alloc(32, 9).toString("base64");
    const cfg = parseAppConfig({
      ...baseEnv,
      KEY_ENCRYPTION_MASTER_KEY: key,
    });
    expect(cfg.KEY_ENCRYPTION_MASTER_KEY).toBe(key);
  });
});
