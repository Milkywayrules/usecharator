import { expect, test } from "../fixtures/test-fixtures";

const MOCK_ONBOARDING = {
  activatedAt: null,
  progress: 33,
  steps: [
    { done: true, id: "has_provider_key", label: "Add a provider API key" },
    { done: false, id: "has_character", label: "Create a character" },
    { done: false, id: "has_generation", label: "Run your first generation" },
  ],
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

test.describe("activation onboarding", () => {
  test("checklist renders with mocked onboarding API", async ({ page }) => {
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

      if (url.includes("/api/me/onboarding")) {
        await route.fulfill({
          body: JSON.stringify(MOCK_ONBOARDING),
          contentType: "application/json",
          status: 200,
        });
        return;
      }

      if (url.includes("/api/workspaces")) {
        await route.fulfill({
          body: JSON.stringify({
            items: [
              {
                id: "ws-e2e",
                isActive: true,
                name: "Personal",
                slug: "personal",
              },
            ],
          }),
          contentType: "application/json",
          status: 200,
        });
        return;
      }

      await route.continue();
    });

    await page.goto("/settings#onboarding");

    await expect(page.getByText("Getting started")).toBeVisible();
    await expect(
      page.getByTestId("onboarding-step-has_provider_key")
    ).toBeVisible();
    await expect(page.getByText("Add a provider API key")).toBeVisible();
    await expect(page.getByText("Activation progress")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Create character" })
    ).toBeVisible();
  });

  test("banner shows on home when onboarding incomplete", async ({ page }) => {
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

      if (url.includes("/api/me/onboarding")) {
        await route.fulfill({
          body: JSON.stringify(MOCK_ONBOARDING),
          contentType: "application/json",
          status: 200,
        });
        return;
      }

      await route.continue();
    });

    await page.goto("/");

    await expect(page.getByTestId("onboarding-banner")).toBeVisible();
    await expect(page.getByText("Finish setup (33%)")).toBeVisible();
  });
});
