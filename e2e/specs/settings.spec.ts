import { expect, test } from "../fixtures/test-fixtures";

test.describe("settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
    await page.evaluate(() => {
      localStorage.removeItem("charator-byok-keys");
      localStorage.removeItem("theme");
    });
    await page.reload();
  });

  test("anonymous BYOK: add, mask, and clear a provider key", async ({
    page,
  }) => {
    await expect(page.getByText("Browser-stored keys")).toBeVisible();

    await page
      .getByLabel("API key")
      .fill("sk-test-fake-openrouter-key-1234567890");
    await page.getByRole("button", { name: "Save to browser" }).click();
    await expect(page.getByText("Key saved locally")).toBeVisible();
    await expect(page.getByText("sk-t")).toBeVisible();
    await expect(page.getByText("7890")).toBeVisible();

    await page.getByRole("button", { name: "Clear" }).first().click();
    await expect(page.getByText("Key cleared")).toBeVisible();
    await expect(page.getByText("Not set").first()).toBeVisible();
  });

  test("theme toggle flips html dark/light class", async ({ page }) => {
    const html = page.locator("html");
    const toggle = page.getByRole("button", {
      name: /Light mode|Dark mode|Toggle theme/,
    });
    await expect(toggle).toBeVisible();

    const before = await html.evaluate((el) => el.classList.contains("dark"));
    await toggle.click();
    await expect
      .poll(async () => html.evaluate((el) => el.classList.contains("dark")))
      .not.toBe(before);

    await toggle.click();
    await expect
      .poll(async () => html.evaluate((el) => el.classList.contains("dark")))
      .toBe(before);
  });
});
