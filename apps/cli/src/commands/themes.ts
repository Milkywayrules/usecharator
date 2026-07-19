import { defineCommand } from "citty";
import { ApiClient } from "../client";
import { globalArgDefs, loadRuntime } from "../context";
import { printError, printJson, printTable } from "../output";

interface ThemeRow {
  description: string;
  id: string;
  label: string;
}

export const themesCommand = defineCommand({
  args: globalArgDefs(),
  meta: {
    description: "List available render themes",
    name: "themes",
  },
  async run({ args }) {
    const { clientConfig, json } = loadRuntime(args);
    const client = new ApiClient(clientConfig);
    try {
      const themes = await client.request<ThemeRow[]>({
        path: "/themes",
      });
      if (json) {
        printJson(themes);
        return;
      }
      printTable(
        ["id", "label", "description"],
        themes.map((theme) => [theme.id, theme.label, theme.description])
      );
    } catch (error) {
      printError(error, json);
    }
  },
});
