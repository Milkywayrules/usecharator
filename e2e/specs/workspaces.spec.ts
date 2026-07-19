import { expect, test } from "@playwright/test";

test.describe("workspace switcher", () => {
  test("anonymous header stays unchanged without workspace UI", async ({
    page,
  }) => {
    await page.goto("/gallery");
    await expect(page.getByLabel("Switch workspace")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
});
