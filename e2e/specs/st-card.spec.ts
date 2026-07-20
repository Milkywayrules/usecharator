import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "../fixtures/test-fixtures";

const FIXTURE_SPEC = JSON.parse(
  readFileSync(
    join(process.cwd(), "packages/spec/test/fixtures/gojo.json"),
    "utf8"
  )
);

const FIXTURE_CARD = {
  data: {
    alternate_greetings: ["Hey!"],
    creator: "Fixture Author",
    creator_notes: "Fixture card for e2e",
    description: "A test companion",
    first_mes: "Hello traveler",
    group_only_greetings: [],
    mes_example: "<START>",
    name: "Fixture ST Hero",
    personality: "Curious and warm",
    scenario: "A quiet tavern",
    system_prompt: "Stay playful",
    tags: ["test", "fixture"],
  },
  spec: "chara_card_v3",
  spec_version: "3.0",
};

const MOCK_IMPORT_RESPONSE = {
  lossyFields: [
    { destination: "meta.notes", field: "data.first_mes" },
    { destination: "meta.notes", field: "data.system_prompt" },
  ],
  reviewRequired: true,
  sourceFormat: "ccv3-json",
  spec: FIXTURE_SPEC,
};

const OWNER_CHARACTER_ID = "44444444-4444-4444-8444-444444444444";

test.describe("sillytavern card import/export", () => {
  test("import dialog shows review-required list from fixture JSON", async ({
    page,
  }) => {
    await page.route("**/api/v1/spec/import/st-card", async (route) => {
      await route.fulfill({
        body: JSON.stringify(MOCK_IMPORT_RESPONSE),
        contentType: "application/json",
        status: 200,
      });
    });

    const fixturePath = join(test.info().outputDir, "fixture-st-card.json");
    mkdirSync(test.info().outputDir, { recursive: true });
    writeFileSync(fixturePath, JSON.stringify(FIXTURE_CARD));

    await page.goto("/library");
    await page.getByRole("button", { name: "Import SillyTavern card" }).click();
    await page
      .locator('[data-testid="st-card-file-input"]')
      .setInputFiles(fixturePath);

    await expect(page.getByRole("dialog", { name: "Review imported card" })).toBeVisible();
    await expect(page.getByTestId("st-card-lossy-fields")).toContainText(
      "data.first_mes"
    );
    await expect(page.getByTestId("st-card-lossy-fields")).toContainText(
      "data.system_prompt"
    );
  });

  test("export button visible on owned gallery character mock", async ({
    page,
  }) => {
    await page.route(`**/api/gallery/${OWNER_CHARACTER_ID}**`, async (route) => {
      const url = route.request().url();
      if (url.includes("/lineage")) {
        await route.fulfill({
          body: JSON.stringify({
            ancestors: [],
            children: { items: [], page: 1, total: 0 },
            depthCapped: false,
            parent: null,
          }),
          contentType: "application/json",
          status: 200,
        });
        return;
      }
      await route.fulfill({
        body: JSON.stringify({
          createdAt: "2026-01-01T00:00:00.000Z",
          id: OWNER_CHARACTER_ID,
          isOwner: true,
          name: "Owner Hero",
          owner: { displayName: "Owner" },
          remixCount: 0,
          remixedFrom: null,
          renders: [],
          spec: FIXTURE_SPEC,
          themeId: "anime",
          updatedAt: "2026-01-02T00:00:00.000Z",
          visibility: "public",
        }),
        contentType: "application/json",
        status: 200,
      });
    });

    await page.goto(`/gallery/${OWNER_CHARACTER_ID}`);
    await expect(page.getByText("Loading character…")).toBeHidden({
      timeout: 15_000,
    });
    await expect(page.getByTestId("export-st-card-button")).toBeVisible();
  });
});
