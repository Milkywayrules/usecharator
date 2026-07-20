import { expect, test } from "../fixtures/test-fixtures";

test.describe("pricing page", () => {
  test("renders four tier cards with placeholder prices", async ({ page }) => {
    await page.goto("/pricing");

    await expect(
      page.getByRole("heading", { level: 1, name: "Pricing" })
    ).toBeVisible();

    for (const [name, price] of [
      ["Free", "$0"],
      ["Plus", "$12"],
      ["Pro", "$39"],
      ["Studio", "$99"],
    ] as const) {
      await expect(
        page.locator('[data-slot="card-title"]').filter({ hasText: name })
      ).toBeVisible();
      await expect(page.getByText(price, { exact: false })).toBeVisible();
    }

    await expect(
      page.getByRole("button", { name: "Sign in for Plus" })
    ).toBeVisible();
    await expect(
      page.getByText("generation costs are paid to your provider directly")
    ).toBeVisible();
  });
});

test.describe("mock checkout page", () => {
  test("renders confirm button for session param with mocked auth", async ({
    page,
  }) => {
    await page.route("**/*", async (route) => {
      const url = route.request().url();
      if (url.includes("get-session")) {
        await route.fulfill({
          body: JSON.stringify({
            session: {
              expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
              id: "e2e-billing-session",
              token: "e2e-billing-token",
              userId: "e2e-billing-user",
            },
            user: {
              email: "e2e-billing@test.local",
              id: "e2e-billing-user",
              image: null,
              name: "E2E Billing",
            },
          }),
          contentType: "application/json",
          status: 200,
        });
        return;
      }
      await route.continue();
    });

    await page.goto(
      "/billing/mock-checkout?session=cs_mock_e2e_test_session"
    );

    await expect(page.getByText("Mock checkout")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Confirm payment (mock)" })
    ).toBeVisible();
    await expect(page.getByText("No real payment is collected")).toBeVisible();
  });
});
