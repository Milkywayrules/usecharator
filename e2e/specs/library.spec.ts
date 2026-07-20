import path from "node:path";
import { expect, test } from "../fixtures/test-fixtures";
import { fillBasicsFields, jumpToWizardStep } from "../helpers/wizard";

test.describe("library", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(async ({ page }) => {
    await page.goto("/library");
    await page.evaluate(async () => {
      localStorage.clear();
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase("charator-local");
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => resolve();
      });
    });
  });

  test("empty state renders with import action", async ({ page }) => {
    await expect(
      page.getByRole("heading", { level: 1, name: "Library" })
    ).toBeVisible();
    await expect(page.getByText("No characters yet.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Import JSON" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Create your first" })
    ).toBeVisible();
  });

  test("export/import roundtrip via local library", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1280 });

    await page.goto("/create");
    await page.evaluate(() => localStorage.removeItem("charator-wizard-draft"));
    await page.reload();

    await fillBasicsFields(page, { name: "Roundtrip Char" });
    await jumpToWizardStep(page, "theme");
    await page.locator("button").filter({ hasText: "Manga" }).first().click();
    await jumpToWizardStep(page, "review");

    await page.getByRole("button", { name: "Save to library" }).click();
    await expect(page.getByText("Saved locally")).toBeVisible();

    await page.goto("/library");
    await expect(page.getByText("Roundtrip Char")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export JSON" }).click();
    const download = await downloadPromise;
    const downloadPath = path.join(
      test.info().outputDir,
      download.suggestedFilename()
    );
    await download.saveAs(downloadPath);

    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("No characters yet.")).toBeVisible();

    const fileInput = page.getByTestId("spec-file-input");
    await fileInput.setInputFiles(downloadPath);
    await expect(
      page.getByText("Character imported — continue in the wizard")
    ).toBeVisible();
    await expect(page).toHaveURL(/\/create$/);
    await expect(page.getByLabel("name", { exact: true })).toHaveValue(
      "Roundtrip Char"
    );

    await jumpToWizardStep(page, "review");
    await page.getByRole("button", { name: "Save to library" }).click();
    await expect(page.getByText("Saved locally")).toBeVisible();

    await page.goto("/library");
    await expect(page.getByText("Roundtrip Char")).toBeVisible();
  });
});
