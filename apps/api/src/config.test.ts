import { describe, expect, test } from "bun:test";
import { parseAppConfig } from "./config";
import { DEV_PAYMENT_WEBHOOK_SECRET } from "./lib/startup-guards";

const paymentWebhookSecretError = /PAYMENT_WEBHOOK_SECRET/;
const productionBlockedError = /production startup blocked/;
const r2EndpointError = /R2_ENDPOINT/;
const mockBillingEnabledError = /MOCK_BILLING_ENABLED/;
const invalidEncryptionKeyError =
  /must decode to 32 bytes|Invalid environment variables/;

const prodR2Env = {
  R2_ACCESS_KEY_ID: "access",
  R2_ACCOUNT_ID: "acct",
  R2_BUCKET: "bucket",
  R2_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
  R2_SECRET_ACCESS_KEY: "secret",
};

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

const productionEnv: Record<string, string | undefined> = {
  ...baseEnv,
  BETTER_AUTH_URL: "https://charator.example.com",
  NODE_ENV: "production",
  PAYMENT_WEBHOOK_SECRET: "prod-webhook-secret-with-enough-entropy",
  ...prodR2Env,
};

describe("production config guard", () => {
  test("throws when payment webhook secret is the dev default in production", () => {
    expect(() =>
      parseAppConfig({
        ...productionEnv,
        PAYMENT_WEBHOOK_SECRET: DEV_PAYMENT_WEBHOOK_SECRET,
      })
    ).toThrow(paymentWebhookSecretError);
  });

  test("throws when payment webhook secret is unset in production", () => {
    const { PAYMENT_WEBHOOK_SECRET: _removed, ...envWithoutSecret } =
      productionEnv;
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
    const cfg = parseAppConfig(productionEnv);
    expect(cfg.PAYMENT_WEBHOOK_SECRET).toBe(
      "prod-webhook-secret-with-enough-entropy"
    );
  });

  test("throws when github oauth credentials are missing in production", () => {
    const {
      GITHUB_CLIENT_ID: _id,
      GITHUB_CLIENT_SECRET: _secret,
      ...env
    } = productionEnv;
    expect(() => parseAppConfig(env)).toThrow(productionBlockedError);
  });

  test("throws when r2 tuple is incomplete in production", () => {
    const { R2_ENDPOINT: _endpoint, ...env } = productionEnv;
    expect(() => parseAppConfig(env)).toThrow(r2EndpointError);
  });

  test("throws when mock billing is enabled in production", () => {
    expect(() =>
      parseAppConfig({
        ...productionEnv,
        MOCK_BILLING_ENABLED: "true",
      })
    ).toThrow(mockBillingEnabledError);
  });

  test("accepts fully configured production env", () => {
    const cfg = parseAppConfig(productionEnv);
    expect(cfg.NODE_ENV).toBe("production");
    expect(cfg.R2_BUCKET).toBe("bucket");
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
