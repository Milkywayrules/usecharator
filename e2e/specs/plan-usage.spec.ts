import { expect, test } from "../fixtures/test-fixtures";

const MOCK_ENTITLEMENTS = {
  limits: {
    anchorImagesPerWorkspace: 10,
    apiTokensPerWorkspace: 1,
    authenticatedGenerationsPerHour: 60,
    charactersPerWorkspace: 15,
    sheetBatchesPerMonth: 3,
    storedGenerationsPerWorkspace: 100,
    workspaces: 1,
  },
  tier: "free",
  usage: {
    anchorImages: 2,
    apiTokens: 1,
    characters: 4,
    sheetBatchesThisMonth: 1,
    storedGenerations: 12,
    workspaces: 1,
  },
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

test.describe("plan and usage settings", () => {
  test("signed-out settings stay anonymous", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("Browser-stored keys")).toBeVisible();
    await expect(page.getByText("Plan & usage")).toHaveCount(0);
  });

  test("plan section renders with mocked entitlements", async ({ page }) => {
    await page.route("**/*", async (route) => {
      const url = route.request().url();

      if (url.includes("get-session")) {
        await route.fulfill({
          body: SESSION_BODY,
          contentType: "application/json",
          status: 200,
        });
        return;
      }

      if (url.includes("/api/me/entitlements")) {
        await route.fulfill({
          body: JSON.stringify(MOCK_ENTITLEMENTS),
          contentType: "application/json",
          status: 200,
        });
        return;
      }

      if (url.includes("/api/workspaces")) {
        await route.fulfill({
          body: JSON.stringify({ items: [] }),
          contentType: "application/json",
          status: 200,
        });
        return;
      }

      await route.continue();
    });

    await page.goto("/settings#plan");

    await expect(page.getByText("Plan & usage")).toBeVisible();
    await expect(page.getByText("Free")).toBeVisible();
    await expect(page.getByText("4 / 15")).toBeVisible();
    await expect(page.getByText("12 / 100")).toBeVisible();
    await expect(page.getByRole("link", { name: "View pricing" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Upgrade — coming soon" })
    ).toBeVisible();
  });
});
