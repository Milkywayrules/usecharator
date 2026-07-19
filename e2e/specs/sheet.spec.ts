import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "../fixtures/test-fixtures";

const FIXTURE_SPEC = JSON.parse(
  readFileSync(
    join(process.cwd(), "packages/spec/test/fixtures/gojo.json"),
    "utf8"
  )
);

const MOCK_BATCH = {
  batchId: "550e8400-e29b-41d4-a716-446655440001",
  characterId: "550e8400-e29b-41d4-a716-446655440002",
  createdAt: new Date().toISOString(),
  estimatedCalls: 4,
  finishedAt: null,
  model: "google/gemini-2.5-flash-image",
  preset: "turnaround",
  provider: "openrouter",
  status: "running",
  variants: [
    {
      error: null,
      jobId: "550e8400-e29b-41d4-a716-446655440003",
      label: "Front",
      status: "queued",
      variantId: "front",
    },
    {
      error: null,
      jobId: "550e8400-e29b-41d4-a716-446655440004",
      label: "Three-quarter",
      status: "queued",
      variantId: "three_quarter",
    },
  ],
};

const MOCK_CHARACTER = {
  createdAt: new Date().toISOString(),
  id: MOCK_BATCH.characterId,
  name: "Test Hero",
  spec: FIXTURE_SPEC,
  themeId: "anime",
  updatedAt: new Date().toISOString(),
  visibility: "private",
};

const SESSION_BODY = JSON.stringify({
  session: {
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    id: "550e8400-e29b-41d4-a716-446655440010",
    token: "e2e-token",
    userId: "550e8400-e29b-41d4-a716-446655440011",
  },
  user: {
    email: "e2e@test.local",
    id: "550e8400-e29b-41d4-a716-446655440011",
    image: null,
    name: "E2E User",
  },
});

async function mockSheetApi(
  page: import("@playwright/test").Page,
  options?: { includeCharacters?: boolean; includeKeys?: boolean; includeBatch?: boolean }
) {
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    const { method } = route.request();

    if (url.includes("get-session")) {
      await route.fulfill({
        body: SESSION_BODY,
        contentType: "application/json",
        status: 200,
      });
      return;
    }

    if (
      options?.includeBatch &&
      url.includes("/api/") &&
      url.includes("/sheets/")
    ) {
      await route.fulfill({
        body: JSON.stringify(MOCK_BATCH),
        contentType: "application/json",
        status: 200,
      });
      return;
    }

    if (options?.includeCharacters && method === "GET") {
      const { pathname } = new URL(url);
      if (/\/api\/(v1\/)?characters\/?$/.test(pathname)) {
        await route.fulfill({
          body: JSON.stringify([MOCK_CHARACTER]),
          contentType: "application/json",
          status: 200,
        });
        return;
      }
    }

    if (options?.includeKeys && method === "GET") {
      const { pathname } = new URL(url);
      if (/\/api\/(v1\/)?keys\/?$/.test(pathname)) {
        await route.fulfill({
          body: JSON.stringify([
            {
              createdAt: new Date().toISOString(),
              hint: "…abc",
              id: "550e8400-e29b-41d4-a716-446655440005",
              label: "Main",
              provider: "openrouter",
            },
          ]),
          contentType: "application/json",
          status: 200,
        });
        return;
      }
    }

    await route.continue();
  });
}

test.describe("character sheet UI", () => {
  test("sheet dialog shows provider call estimate", async ({ page }) => {
    await mockSheetApi(page, {
      includeCharacters: true,
      includeKeys: true,
    });

    await page.addInitScript((character) => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";
        if (
          method === "GET" &&
          url.includes("/api/") &&
          url.includes("/characters") &&
          !url.match(/\/characters\/[^/?#]+/)
        ) {
          return new Response(JSON.stringify([character]), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          });
        }
        return originalFetch(input, init);
      };
    }, MOCK_CHARACTER);

    await page.goto("/library");
    await expect(page.getByText("Your saved characters on the server.")).toBeVisible();
    await expect(page.getByText("Test Hero")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Generate sheet" }).first().click();

    const dialog = page.getByTestId("sheet-generate-dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("sheet-cost-estimate")).toContainText(
      "4 provider calls"
    );
  });

  test("sheet batch page renders variant slots", async ({ page }) => {
    await mockSheetApi(page, { includeBatch: true });

    await page.goto(`/sheets/${MOCK_BATCH.batchId}`);
    await expect(page.getByTestId("sheet-batch-banner")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("sheet-variant-grid")).toBeVisible();
    await expect(page.getByTestId("sheet-variant-grid")).toContainText("Front");
    await expect(page.getByTestId("sheet-variant-grid")).toContainText(
      "Three-quarter"
    );
  });
});
