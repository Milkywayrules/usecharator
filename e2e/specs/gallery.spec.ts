import { expect, test } from "../fixtures/test-fixtures";

test.describe("gallery", () => {
  test("renders degraded state without crashing", async ({ page }) => {
    await page.goto("/gallery");
    await expect(
      page.getByRole("heading", { level: 1, name: "Gallery" })
    ).toBeVisible();
    await expect(
      page.getByText("Gallery data is temporarily unavailable", {
        exact: false,
      })
    ).toBeVisible();
    await expect(
      page.getByText("Gallery is unavailable right now", { exact: false })
    ).toBeVisible();
  });

  test("search input updates URL query param", async ({ page }) => {
    await page.goto("/gallery");
    const search = page.getByLabel("Search gallery by character name");
    await search.fill("shrine guardian");
    await expect(page).toHaveURL(
      /[?&]q=shrine\+guardian|[?&]q=shrine%20guardian/
    );
  });
});
