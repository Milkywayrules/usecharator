import { describe, expect, test } from "bun:test";
import { parseAppConfig } from "../config";
import { isOtelEnabled } from "../lib/otel";

const baseEnv: Record<string, string | undefined> = {
  BETTER_AUTH_SECRET: "01234567890123456789012345678901",
  BETTER_AUTH_URL: "http://localhost:3001",
  DATABASE_URL: "postgresql://charator:charator@localhost:5432/charator",
  KEY_ENCRYPTION_MASTER_KEY: Buffer.alloc(32, 7).toString("base64"),
  NODE_ENV: "development",
  PAYMENT_WEBHOOK_SECRET: "test-payment-webhook-secret",
  WEB_APP_URL: "http://localhost:3000",
};

describe("otel env gate", () => {
  test("is disabled when OTEL_EXPORTER_OTLP_ENDPOINT is unset", () => {
    expect(isOtelEnabled({})).toBe(false);
    expect(isOtelEnabled({ OTEL_EXPORTER_OTLP_ENDPOINT: "" })).toBe(false);
  });

  test("is enabled when OTEL_EXPORTER_OTLP_ENDPOINT is set", () => {
    expect(
      isOtelEnabled({
        OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
      })
    ).toBe(true);
  });

  test("defaults OTEL_SERVICE_NAME to charator-api", () => {
    const cfg = parseAppConfig(baseEnv);
    expect(cfg.OTEL_SERVICE_NAME).toBe("charator-api");
    expect(cfg.OTEL_EXPORTER_OTLP_ENDPOINT).toBeUndefined();
  });
});
