import { expect, test } from "../fixtures/test-fixtures";

const MOCK_TRENDING_LIST = {
  hasMore: false,
  items: [
    {
      coverImageUrl: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "11111111-1111-4111-8111-111111111111",
      name: "Trending Hero",
      owner: { displayName: "Ada" },
      remixCount: 3,
      themeId: "anime",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
  ],
  nextOffset: 1,
};

async function mockTrendingGalleryApi(page: import("@playwright/test").Page) {
  await page.route("**/api/gallery**", async (route) => {
    const url = route.request().url();
    if (
      url.includes("/api/gallery?") ||
      url.endsWith("/api/gallery") ||
      url.includes("sort=most_remixed")
    ) {
      await route.fulfill({
        body: JSON.stringify(MOCK_TRENDING_LIST),
        contentType: "application/json",
        status: 200,
      });
      return;
    }
    await route.continue();
  });
}

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

  test("hero CTAs link to create and gallery", async ({ page }) => {
    await expect(
      page.getByRole("link", { name: "Start creating" })
    ).toHaveAttribute("href", "/create");
    await expect(
      page.getByRole("link", { name: "Browse gallery" })
    ).toHaveAttribute("href", "/gallery");
  });

  test("trending section renders with mocked gallery API", async ({ page }) => {
    await mockTrendingGalleryApi(page);
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 2, name: "Trending in gallery" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "See all trending" })
    ).toHaveAttribute("href", "/gallery?sort=most_remixed");
    await expect(page.getByText("Trending Hero")).toBeVisible();
    await expect(page.getByText("3 remixes")).toBeVisible();
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
