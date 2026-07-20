import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "../fixtures/test-fixtures";

const FIXTURE_SPEC = JSON.parse(
  readFileSync(
    join(process.cwd(), "packages/spec/test/fixtures/gojo.json"),
    "utf8"
  )
);

const CHARACTER_ID = "11111111-1111-4111-8111-111111111111";
const PARENT_ID = "22222222-2222-4222-8222-222222222222";
const CHILD_ID = "33333333-3333-4333-8333-333333333333";

const MOCK_DETAIL = {
  createdAt: "2026-01-01T00:00:00.000Z",
  id: CHARACTER_ID,
  isOwner: false,
  name: "Remix Hero",
  owner: { displayName: "Ada" },
  remixCount: 1,
  remixedFrom: { id: PARENT_ID, name: "Original Hero" },
  renders: [],
  spec: FIXTURE_SPEC,
  themeId: "anime",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const MOCK_LINEAGE = {
  ancestors: [],
  children: {
    items: [
      {
        coverImageUrl: null,
        createdAt: "2026-01-03T00:00:00.000Z",
        id: CHILD_ID,
        name: "Child Remix",
        owner: { displayName: "Bob" },
        themeId: "anime",
        updatedAt: "2026-01-03T00:00:00.000Z",
      },
    ],
    page: 1,
    total: 1,
  },
  depthCapped: false,
  parent: {
    coverImageUrl: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    id: PARENT_ID,
    name: "Original Hero",
    owner: { displayName: "Ada" },
    themeId: "anime",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
};

const MOCK_SPEC_DIFF = {
  character: { id: CHARACTER_ID, name: "Remix Hero" },
  other: { id: PARENT_ID, name: "Original Hero" },
  sections: [
    {
      changes: [
        {
          from: null,
          path: "identity.gender",
          to: "male",
        },
      ],
      sectionKey: "identity",
      title: "Identity",
    },
  ],
};

async function mockGalleryDetailApis(page: import("@playwright/test").Page) {
  await page.route("**/api/gallery/**", async (route) => {
    const url = route.request().url();

    if (url.includes(`/api/gallery/${CHARACTER_ID}/lineage`)) {
      await route.fulfill({
        body: JSON.stringify(MOCK_LINEAGE),
        contentType: "application/json",
        status: 200,
      });
      return;
    }

    if (url.includes(`/api/gallery/${CHARACTER_ID}/spec-diff`)) {
      await route.fulfill({
        body: JSON.stringify(MOCK_SPEC_DIFF),
        contentType: "application/json",
        status: 200,
      });
      return;
    }

    if (url.includes(`/api/gallery/${CHARACTER_ID}`)) {
      await route.fulfill({
        body: JSON.stringify(MOCK_DETAIL),
        contentType: "application/json",
        status: 200,
      });
      return;
    }

    await route.continue();
  });
}

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

  test("sort dropdown includes most remixed option", async ({ page }) => {
    await page.goto("/gallery");
    await page.getByLabel("Sort gallery").click();
    await expect(page.getByRole("option", { name: "Most remixed" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Most recent" })).toBeVisible();
  });

  test("lineage section renders with mocked API responses", async ({ page }) => {
    await mockGalleryDetailApis(page);
    await page.goto(`/gallery/${CHARACTER_ID}`);
    await expect(page.getByText("Loading character…")).toBeHidden({
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: "Lineage" })).toBeVisible();
    await expect(page.getByText("Original Hero")).toBeVisible();
    await expect(page.getByText("Remixes (1)")).toBeVisible();
    await expect(page.getByText("Child Remix")).toBeVisible();
  });

  test("spec diff panel renders rows from mocked diff", async ({ page }) => {
    await mockGalleryDetailApis(page);
    await page.goto(`/gallery/${CHARACTER_ID}`);
    await expect(page.getByText("Loading character…")).toBeHidden({
      timeout: 15_000,
    });
    await page.getByText("What changed vs original").click();
    await expect(page.getByText("Identity")).toBeVisible();
    await expect(page.getByText("male")).toBeVisible();
  });
});
