import { beforeAll, describe, expect, test } from "bun:test";
import type { App } from "../app";
import { createApp } from "../app";
import { parseAppConfig } from "../config";

const testConfig = parseAppConfig({
  BETTER_AUTH_SECRET: "01234567890123456789012345678901",
  BETTER_AUTH_URL: "http://localhost:3001",
  DATABASE_URL: "postgresql://charator:charator@localhost:5432/charator",
  GITHUB_CLIENT_ID: "test-client-id",
  GITHUB_CLIENT_SECRET: "test-client-secret",
  KEY_ENCRYPTION_MASTER_KEY: Buffer.alloc(32, 3).toString("base64"),
  NODE_ENV: "test",
  PAYMENT_WEBHOOK_SECRET: "test-payment-webhook-secret",
  WEB_APP_URL: "http://localhost:3000",
});

describe("observability middleware", () => {
  let app: App;

  beforeAll(() => {
    app = createApp(testConfig);
  });

  test("sets baseline headers on API responses", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/health")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("content-security-policy")).toBeNull();
  });

  test("sets HSTS when the request is forwarded as HTTPS", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/health", {
        headers: { "x-forwarded-proto": "https" },
      })
    );

    expect(response.headers.get("strict-transport-security")).toBe(
      "max-age=31536000; includeSubDomains"
    );
  });

  test("adds X-Robots-Tag on docs routes only", async () => {
    const docsHtml = await app.handle(
      new Request("http://localhost/api/v1/docs")
    );
    const docsJson = await app.handle(
      new Request("http://localhost/api/v1/docs/json")
    );
    const health = await app.handle(new Request("http://localhost/api/health"));

    expect(docsHtml.headers.get("x-robots-tag")).toBe("noindex");
    expect(docsJson.headers.get("x-robots-tag")).toBe("noindex");
    expect(health.headers.get("x-robots-tag")).toBeNull();
  });

  test("echoes incoming X-Request-Id", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/health", {
        headers: { "x-request-id": "req-test-123" },
      })
    );

    expect(response.headers.get("x-request-id")).toBe("req-test-123");
  });

  test("generates X-Request-Id when absent", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/health")
    );
    const requestId = response.headers.get("x-request-id");

    expect(requestId).toBeTruthy();
    expect(requestId?.length).toBeGreaterThan(8);
  });

  test("docs HTML and JSON remain reachable", async () => {
    const html = await app.handle(new Request("http://localhost/api/v1/docs"));
    const json = await app.handle(
      new Request("http://localhost/api/v1/docs/json")
    );

    expect(html.status).toBe(200);
    expect(await html.text()).toContain("scalar");

    expect(json.status).toBe(200);
    const spec = (await json.json()) as { openapi?: string };
    expect(spec.openapi).toBeTruthy();
  });
});
