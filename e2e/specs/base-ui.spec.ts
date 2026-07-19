import { expect, test } from "../fixtures/test-fixtures";
import { jumpToWizardStep } from "../helpers/wizard";

test.describe("Base UI interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/create");
  });

  test("Select dropdown: click and keyboard selection on control step", async ({
    page,
  }) => {
    await jumpToWizardStep(page, "control");
    const sectionSelect = page.getByRole("combobox").first();
    await sectionSelect.click();
    await page.getByRole("option", { name: "strict" }).click();
    await expect(sectionSelect).toContainText("strict");

    await sectionSelect.click();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(sectionSelect).toBeVisible();
  });

  test("SearchableSelect: type-to-filter and select on identity step", async ({
    page,
  }) => {
    await jumpToWizardStep(page, "identity");
    const genderTrigger = page.getByLabel("gender", { exact: true });
    await genderTrigger.click();
    await page.getByPlaceholder("Search…").fill("fem");
    await page.getByRole("menuitem", { exact: true, name: "female" }).click();
    await expect(genderTrigger).toContainText("female", { timeout: 10_000 });
  });

  test("Switch toggles boolean field on appearance step", async ({ page }) => {
    await jumpToWizardStep(page, "appearance");
    const freckles = page.getByRole("switch", { name: "freckles" });
    await expect(freckles).not.toBeChecked();
    await freckles.click();
    await expect(freckles).toBeChecked();
    await freckles.click();
    await expect(freckles).not.toBeChecked();
  });

  test("prompt preview Sheet: open, ESC and backdrop close on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 812, width: 390 });
    await jumpToWizardStep(page, "meta");

    await page.getByRole("button", { name: "Prompt" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("Live prompt")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();

    await page.getByRole("button", { name: "Prompt" }).click();
    await expect(sheet).toBeVisible();
    await page
      .locator('[data-slot="sheet-content"]')
      .locator("xpath=../preceding-sibling::*[1]")
      .click({
        force: true,
        position: { x: 10, y: 10 },
      });
    await expect(sheet).toBeHidden();
  });

  test("anonymous header shows Sign in; signed-in menu navigates when mocked", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 800, width: 1280 });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

    await page.route("**/api/auth/**", async (route) => {
      if (route.request().url().includes("get-session")) {
        await route.fulfill({
          body: JSON.stringify({
            session: {
              expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
              id: "e2e-session",
              token: "e2e-token",
              userId: "e2e-user",
            },
            user: {
              email: "e2e@test.local",
              id: "e2e-user",
              image: null,
              name: "E2E User",
            },
          }),
          contentType: "application/json",
          status: 200,
        });
        return;
      }
      await route.continue();
    });
    await page.goto("/");
    await page.reload();
    await expect(page.getByRole("button", { name: "E2E User" })).toBeVisible();
    await page.getByRole("button", { name: "E2E User" }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test("library import dialog: focus trap and ESC closes", async ({ page }) => {
    await page.route("**/api/auth/**", async (route) => {
      if (route.request().url().includes("get-session")) {
        await route.fulfill({
          body: JSON.stringify({
            session: {
              expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
              id: "e2e-session",
              token: "e2e-token",
              userId: "e2e-user",
            },
            user: {
              email: "e2e@test.local",
              id: "e2e-user",
              image: null,
              name: "E2E User",
            },
          }),
          contentType: "application/json",
          status: 200,
        });
        return;
      }
      await route.continue();
    });
    await page.route("**/api/characters**", async (route) => {
      await route.fulfill({
        body: JSON.stringify([]),
        contentType: "application/json",
        status: 200,
      });
    });

    await page.goto("/library");
    await page.evaluate(async () => {
      const request = indexedDB.open("charator-local", 1);
      await new Promise<void>((resolve, reject) => {
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("characters")) {
            const store = db.createObjectStore("characters", { keyPath: "id" });
            store.createIndex("by-updated", "updatedAt");
          }
        };
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("characters", "readwrite");
          tx.objectStore("characters").put({
            id: "local-e2e",
            name: "Local Seed",
            spec: {
              appearance: {
                body: { build: null, height: null, skin_tone: null },
                face: {
                  ears: null,
                  expression: null,
                  eye_color: null,
                  eye_shape: null,
                  freckles: null,
                  hair_color: null,
                  hair_length: null,
                  hair_style: null,
                  mole: null,
                  nose: null,
                },
              },
              archetype: { role: null, subtype: null },
              art: {
                color_palette: null,
                composition: null,
                line_weight: null,
                mood: null,
                style_notes: null,
              },
              control: {
                fill_policy: null,
                locked: [],
                mode: "balanced",
                section_modes: {},
              },
              framing: { aspect: null, camera_angle: null, shot_type: null },
              generation: {
                negative_prompt: null,
                prompt_extra: null,
                seed: null,
              },
              identity: {
                age_notes: null,
                age_range: null,
                ethnicity_appearance: null,
                gender: null,
                gender_notes: null,
                vibe_keywords: [],
              },
              magic: { aura: null, effects: [], school: null },
              meta: {
                id: "local-e2e",
                inspiration: null,
                name: "Local Seed",
                notes: null,
                tags: [],
              },
              outfit: {
                accessories: [],
                footwear: null,
                headwear: null,
                layers: [],
                primary: null,
              },
              personality: { alignment: null, traits: [] },
              pose: { action: null, energy: null, gaze: null, stance: null },
              props: { held: [], nearby: [] },
              setting: {
                environment: null,
                era: null,
                lighting: null,
                location: null,
                weather: null,
              },
            },
            themeId: "anime",
            updatedAt: new Date().toISOString(),
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      });
    });

    await page.reload();
    const dialog = page.getByTestId("library-import-dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Import local characters?" })
    ).toBeVisible();

    await dialog.getByRole("button", { name: "Later" }).focus();
    await page.keyboard.press("Tab");
    const focusedInDialog = await page.evaluate(() => {
      const active = document.activeElement;
      return active?.closest('[data-testid="library-import-dialog"]') !== null;
    });
    expect(focusedInDialog).toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
