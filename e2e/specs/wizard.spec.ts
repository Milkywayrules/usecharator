import { expect, test } from "../fixtures/test-fixtures";
import {
  fillBasicsFields,
  jumpToWizardStep,
  readWizardDraftName,
  readWizardDraftStepIndex,
  stepIndex,
} from "../helpers/wizard";

test.describe("create wizard", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(async ({ page }) => {
    await page.goto("/create");
    await page.evaluate(() => {
      localStorage.removeItem("charator-wizard-draft");
    });
    await page.reload();
  });

  test("step 1 Basics renders and accepts input", async ({ page }) => {
    await expect(
      page.getByRole("heading", { level: 1, name: "Basics" })
    ).toBeVisible();
    await fillBasicsFields(page, { name: "E2E Test Hero" });
    await expect(page.getByLabel("name", { exact: true })).toHaveValue(
      "E2E Test Hero"
    );
  });

  test("Next advances steps and draft persists across reload", async ({
    page,
  }) => {
    await fillBasicsFields(page, { name: "Persist Me" });
    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Identity" })
    ).toBeVisible();

    const indexAfterNext = await readWizardDraftStepIndex(page);
    expect(indexAfterNext).toBe(stepIndex("identity"));

    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: "Identity" })
    ).toBeVisible();
    expect(await readWizardDraftStepIndex(page)).toBe(stepIndex("identity"));
    expect(await readWizardDraftName(page)).toBe("Persist Me");
  });

  test("theme step selects a card and control preset updates live prompt", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: 1280 });
    await fillBasicsFields(page, { name: "Theme Tester" });
    await expect
      .poll(async () => readWizardDraftName(page), { timeout: 15_000 })
      .toBe("Theme Tester");
    await jumpToWizardStep(page, "theme");

    await expect(
      page.getByRole("heading", { level: 1, name: "Visual theme" })
    ).toBeVisible();
    await page.locator("button").filter({ hasText: "Anime" }).first().click();

    const preview = page.getByTestId("prompt-preview-panel");
    await expect(preview).toBeVisible();
    const beforeControl = await preview.locator("pre").textContent();

    await jumpToWizardStep(page, "control");
    await expect(
      page.getByRole("heading", { level: 1, name: "Generation control" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Apply" }).first().click();
    const afterControl = await preview.locator("pre").textContent();
    expect(afterControl).toBeTruthy();
    expect(afterControl).not.toEqual(beforeControl);
  });
});
