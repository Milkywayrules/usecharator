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

    await expect(page.getByRole("button", { name: "Coming soon" })).toHaveCount(
      4
    );
    await expect(
      page.getByText("generation costs are paid to your provider directly")
    ).toBeVisible();
  });
});
