import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

const WIZARD_STORAGE_KEY = "charator-wizard-draft";

/** Mirrors `WIZARD_STEPS` order in apps/web/src/lib/wizard-sections.ts */
const STEP_INDEX: Record<string, number> = {
  appearance: 4,
  archetype: 3,
  art: 11,
  control: 14,
  framing: 8,
  generation: 12,
  identity: 1,
  magic: 6,
  meta: 0,
  outfit: 5,
  personality: 2,
  pose: 7,
  props: 10,
  review: 15,
  setting: 9,
  theme: 13,
};

export function stepIndex(id: keyof typeof STEP_INDEX): number {
  return STEP_INDEX[id];
}

export async function waitForWizardDraft(
  page: Page,
  { name }: { name: string }
): Promise<void> {
  await expect.poll(async () => readWizardDraftName(page)).toBe(name);
}

export async function setWizardStep(
  page: Page,
  stepIndexValue: number
): Promise<void> {
  await page.goto("/create");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const draftName = await readWizardDraftName(page);
  if (!draftName?.trim()) {
    await fillBasicsFields(page, { name: "_e2e" });
    await expect
      .poll(async () => readWizardDraftName(page), { timeout: 15_000 })
      .toBe("_e2e");
  }

  await page.evaluate(
    ({ key, index }) => {
      const raw = localStorage.getItem(key);
      if (!raw) {
        throw new Error("wizard draft missing in localStorage");
      }
      const parsed = JSON.parse(raw) as {
        state?: Record<string, unknown>;
        version?: number;
      };
      parsed.state = { ...parsed.state, stepIndex: index };
      localStorage.setItem(key, JSON.stringify(parsed));
    },
    { index: stepIndexValue, key: WIZARD_STORAGE_KEY }
  );
  await page.reload();
  await expect
    .poll(async () => readWizardDraftStepIndex(page))
    .toBe(stepIndexValue);
}

export async function jumpToWizardStep(
  page: Page,
  id: keyof typeof STEP_INDEX
): Promise<void> {
  await setWizardStep(page, stepIndex(id));
}

export async function fillBasicsFields(
  page: Page,
  { name }: { name: string; id?: string }
): Promise<void> {
  const nameInput = page.getByLabel("name", { exact: true });
  await nameInput.click();
  await nameInput.fill("");
  await nameInput.pressSequentially(name, { delay: 20 });
  await expect(nameInput).toHaveValue(name, { timeout: 10_000 });
}

export async function readWizardDraftStepIndex(page: Page): Promise<number> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return 0;
    }
    const parsed = JSON.parse(raw) as { state?: { stepIndex?: number } };
    return parsed.state?.stepIndex ?? 0;
  }, WIZARD_STORAGE_KEY);
}

export async function readWizardDraftName(page: Page): Promise<string | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as {
      state?: { spec?: { meta?: { name?: string } } };
    };
    return parsed.state?.spec?.meta?.name ?? null;
  }, WIZARD_STORAGE_KEY);
}
