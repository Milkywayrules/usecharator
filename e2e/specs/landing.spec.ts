import { expect, test } from "../fixtures/test-fixtures";

test.describe("landing and navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("landing page loads with brand heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { level: 1, name: "Chara Tor" })
    ).toBeVisible();
    await expect(page.getByText("character generator")).toBeVisible();
  });

  test("header nav links route to Create, Gallery, Library, Settings", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 800, width: 1280 });

    for (const [label, path] of [
      ["Create", "/create"],
      ["Gallery", "/gallery"],
      ["Library", "/library"],
      ["Settings", "/settings"],
    ] as const) {
      await page.getByRole("link", { exact: true, name: label }).click();
      await expect(page).toHaveURL(new RegExp(`${path.replace("/", "\\/")}$`));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("anonymous header shows Sign in instead of user menu", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 800, width: 1280 });
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Test User|Sign out/i })
    ).toHaveCount(0);
  });
});
