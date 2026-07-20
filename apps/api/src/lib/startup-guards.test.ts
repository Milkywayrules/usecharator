import { describe, expect, test } from "bun:test";
import {
  assertProductionReady,
  DEV_PAYMENT_WEBHOOK_SECRET,
  getHealthPayload,
  getProductionStopViolations,
  getProductionWarnMissing,
  type ProductionGuardConfig,
} from "./startup-guards";

const githubClientIdError = /GITHUB_CLIENT_ID/;

const prodBase: ProductionGuardConfig = {
  BETTER_AUTH_SECRET: "01234567890123456789012345678901",
  BETTER_AUTH_URL: "https://charator.example.com",
  DATABASE_URL: "postgresql://charator:charator@localhost:5432/charator",
  GITHUB_CLIENT_ID: "gh-client-id",
  GITHUB_CLIENT_SECRET: "gh-client-secret",
  KEY_ENCRYPTION_MASTER_KEY: Buffer.alloc(32, 7).toString("base64"),
  NODE_ENV: "production",
  PAYMENT_WEBHOOK_SECRET: "prod-webhook-secret-with-enough-entropy",
  R2_ACCESS_KEY_ID: "access",
  R2_ACCOUNT_ID: "acct",
  R2_BUCKET: "bucket",
  R2_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
  R2_SECRET_ACCESS_KEY: "secret",
};

describe("getProductionStopViolations", () => {
  test("returns empty outside production", () => {
    expect(
      getProductionStopViolations({ ...prodBase, NODE_ENV: "development" })
    ).toEqual([]);
  });

  test("returns empty for a fully configured production env", () => {
    expect(getProductionStopViolations(prodBase)).toEqual([]);
  });

  test("flags dev payment webhook secret in production", () => {
    expect(
      getProductionStopViolations({
        ...prodBase,
        PAYMENT_WEBHOOK_SECRET: DEV_PAYMENT_WEBHOOK_SECRET,
      })
    ).toContain("PAYMENT_WEBHOOK_SECRET");
  });

  test("flags missing github oauth pair in production", () => {
    const violations = getProductionStopViolations({
      ...prodBase,
      GITHUB_CLIENT_ID: undefined,
      GITHUB_CLIENT_SECRET: undefined,
    });
    expect(violations).toContain("GITHUB_CLIENT_ID");
    expect(violations).toContain("GITHUB_CLIENT_SECRET");
  });

  test("flags partial r2 tuple in production", () => {
    const violations = getProductionStopViolations({
      ...prodBase,
      R2_ENDPOINT: undefined,
    });
    expect(violations).toContain("R2_ENDPOINT");
  });

  test("flags mock billing enabled in production", () => {
    expect(
      getProductionStopViolations({
        ...prodBase,
        MOCK_BILLING_ENABLED: "true",
      })
    ).toContain("MOCK_BILLING_ENABLED");
  });
});

describe("assertProductionReady", () => {
  test("throws with all missing stop keys listed", () => {
    expect(() =>
      assertProductionReady({
        ...prodBase,
        GITHUB_CLIENT_ID: undefined,
        R2_BUCKET: undefined,
      })
    ).toThrow(githubClientIdError);
  });
});

describe("getProductionWarnMissing", () => {
  test("lists optional integrations missing in production", () => {
    expect(getProductionWarnMissing(prodBase)).toEqual([
      "FAL_WEBHOOK_SECRET",
      "REPLICATE_WEBHOOK_SECRET",
      "TELEGRAM_BOT_TOKEN",
      "TELEGRAM_WEBHOOK_SECRET",
      "OTEL_EXPORTER_OTLP_ENDPOINT",
    ]);
  });

  test("returns empty when optional integrations are configured", () => {
    expect(
      getProductionWarnMissing({
        ...prodBase,
        FAL_WEBHOOK_SECRET: "fal",
        OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel:4318",
        REPLICATE_WEBHOOK_SECRET: "rep",
        TELEGRAM_BOT_TOKEN: "token",
        TELEGRAM_WEBHOOK_SECRET: "tg",
      })
    ).toEqual([]);
  });
});

describe("getHealthPayload", () => {
  test("returns bare ok payload outside production", () => {
    expect(getHealthPayload({ ...prodBase, NODE_ENV: "development" })).toEqual({
      status: "ok",
    });
  });

  test("returns ready with missing optional keys in production", () => {
    expect(getHealthPayload(prodBase)).toEqual({
      missing: [
        "FAL_WEBHOOK_SECRET",
        "REPLICATE_WEBHOOK_SECRET",
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_WEBHOOK_SECRET",
        "OTEL_EXPORTER_OTLP_ENDPOINT",
      ],
      ready: true,
      status: "ok",
    });
  });

  test("omits missing when all optional integrations are configured", () => {
    expect(
      getHealthPayload({
        ...prodBase,
        FAL_WEBHOOK_SECRET: "fal",
        OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel:4318",
        REPLICATE_WEBHOOK_SECRET: "rep",
        TELEGRAM_BOT_TOKEN: "token",
        TELEGRAM_WEBHOOK_SECRET: "tg",
      })
    ).toEqual({ ready: true, status: "ok" });
  });
});
