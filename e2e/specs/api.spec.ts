import { expect, test } from "../fixtures/test-fixtures";

const API_ORIGIN = process.env.API_URL ?? "http://127.0.0.1:3001";

test.describe("API health and catalog", () => {
  test("/api/health returns ok", async ({ request }) => {
    const response = await request.get(`${API_ORIGIN}/api/health`);
    expect(response.ok()).toBeTruthy();
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  test("/api/v1/themes returns 11+ themes", async ({ request }) => {
    const response = await request.get(`${API_ORIGIN}/api/v1/themes`);
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as unknown;
    const themes = Array.isArray(body)
      ? body
      : ((body as { themes?: unknown[] }).themes ?? []);
    expect(themes.length).toBeGreaterThanOrEqual(11);
  });
});
