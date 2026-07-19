import { test as base, expect } from "@playwright/test";
import { isAllowedConsoleError } from "../helpers/console-allowlist";

type ConsoleEntry = { text: string; type: string };

export const test = base.extend({
  page: async ({ page }, use) => {
    const consoleErrors: ConsoleEntry[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push({ text: message.text(), type: message.type() });
      }
    });

    page.on("pageerror", (error) => {
      consoleErrors.push({ text: error.message, type: "pageerror" });
    });

    await use(page);

    const unexpected = consoleErrors.filter(
      (entry) => !isAllowedConsoleError(entry.text)
    );
    expect(
      unexpected,
      `unexpected console errors:\n${unexpected.map((e) => `- ${e.text}`).join("\n")}`
    ).toEqual([]);
  },
});

export { expect } from "@playwright/test";
