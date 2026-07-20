import { expect, test } from "../fixtures/test-fixtures";
import { jumpToWizardStep } from "../helpers/wizard";

test.describe("generate panel reference UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/v1/providers/capabilities", async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          presets: [],
          providers: [
            {
              defaultModel: "gpt-image-1",
              label: "OpenAI",
              models: [
                {
                  execution: "sync",
                  id: "gpt-image-1",
                  label: "GPT Image 1",
                  costEstimate: {
                    label: "GPT Image 1",
                    usdMax: 0.08,
                    usdMin: 0.04,
                  },
                  supportsAspectRatios: { kind: "fixed", values: ["1:1"] },
                  supportsNegativePrompt: false,
                  supportsReferenceImages: { kind: "supported", maxCount: 1 },
                  supportsReferenceStrength: true,
                },
              ],
              provider: "openai",
            },
            {
              defaultModel: "google/gemini-2.5-flash-image",
              label: "OpenRouter",
              models: [
                {
                  execution: "sync",
                  id: "google/gemini-2.5-flash-image",
                  label: "Gemini 2.5 Flash Image",
                  openRouterImageApi: true,
                  supportsAspectRatios: { kind: "fixed", values: ["1:1"] },
                  supportsNegativePrompt: false,
                  supportsReferenceImages: { kind: "none" },
                },
              ],
              provider: "openrouter",
            },
          ],
        }),
        contentType: "application/json",
        status: 200,
      });
    });

    await page.goto("/create");
    await page.evaluate(() => {
      localStorage.removeItem("charator-wizard-draft");
    });
    await page.reload();
  });

  test("shows reference file validation for wrong type", async ({ page }) => {
    await jumpToWizardStep(page, "review");

    const panel = page.getByTestId("generate-panel");
    await expect(panel).toBeVisible();

    await panel.getByTestId("reference-file-input").setInputFiles({
      buffer: Buffer.from("not-an-image"),
      mimeType: "text/plain",
      name: "notes.txt",
    });

    await expect(panel.getByTestId("reference-file-error")).toContainText(
      "png, jpeg, or webp"
    );
  });

  test("shows BYOK cost estimate before generate when model is priced", async ({
    page,
  }) => {
    await jumpToWizardStep(page, "review");

    const panel = page.getByTestId("generate-panel");
    await panel.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "OpenAI", exact: true }).click();

    await expect(panel.getByTestId("generate-cost-estimate")).toContainText(
      "per image"
    );
    await expect(panel.getByTestId("generate-cost-estimate")).toContainText(
      "provider bills separately"
    );
  });
});
