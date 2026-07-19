import { specRenderResponseSchema } from "@charator/shared";
import { characterSpecSchema, validateSpec } from "@charator/spec";
import { defineCommand } from "citty";
import { ApiClient } from "../client";
import {
  argString,
  globalArgDefs,
  loadRuntime,
  readJsonFile,
} from "../context";
import { printError, printJson, printLines } from "../output";

interface CatalogResponse {
  corePaths: string[];
  fieldCatalog: Record<string, unknown>;
  sectionTitles: Record<string, string>;
}

export const specCommand = defineCommand({
  meta: {
    description: "Browse and validate character specs",
    name: "spec",
  },
  subCommands: {
    catalog: defineCommand({
      args: {
        ...globalArgDefs(),
        section: {
          description: "Filter catalog to a section id",
          type: "string",
        },
      },
      meta: { description: "Browse spec field catalog", name: "catalog" },
      async run({ args }) {
        const { clientConfig, json } = loadRuntime(args);
        const client = new ApiClient(clientConfig);
        try {
          const catalog = await client.request<CatalogResponse>({
            path: "/spec/catalog",
          });
          if (args.section) {
            const section = argString(args.section);
            if (!section) {
              throw new Error("section must be a string");
            }
            const filtered = {
              fields: Object.fromEntries(
                Object.entries(catalog.fieldCatalog).filter(([path]) =>
                  path.startsWith(`${section}.`)
                )
              ),
              section,
              title: catalog.sectionTitles[section] ?? section,
            };
            if (json) {
              printJson(filtered);
              return;
            }
            printLines([
              `${filtered.title} (${section})`,
              ...Object.keys(filtered.fields).sort(),
            ]);
            return;
          }
          if (json) {
            printJson(catalog);
            return;
          }
          printLines(["sections:"]);
          for (const [id, title] of Object.entries(catalog.sectionTitles)) {
            printLines([`  ${id} — ${title}`]);
          }
        } catch (error) {
          printError(error, json);
        }
      },
    }),
    render: defineCommand({
      args: {
        ...globalArgDefs(),
        file: {
          description: "Spec JSON file",
          required: true,
          type: "positional",
        },
        theme: {
          description: "Theme id for prompt rendering",
          type: "string",
        },
      },
      meta: { description: "Render spec to prompt via API", name: "render" },
      async run({ args }) {
        const { clientConfig, json } = loadRuntime(args);
        const client = new ApiClient(clientConfig);
        try {
          const filePath = argString(args.file);
          if (!filePath) {
            throw new Error("spec file path is required");
          }
          const spec = await readJsonFile(filePath);
          const body: { spec: unknown; theme?: string } = { spec };
          const theme = argString(args.theme);
          if (theme) {
            body.theme = theme;
          }
          const raw = await client.request({
            body,
            path: "/spec/render",
          });
          const rendered = specRenderResponseSchema.parse(raw);
          if (json) {
            printJson(rendered);
            return;
          }
          if (rendered.errors?.length) {
            printLines(["validation warnings:"]);
            for (const err of rendered.errors) {
              printLines([`  - ${err}`]);
            }
          }
          if (rendered.negativePrompt) {
            printLines([`negative: ${rendered.negativePrompt}`, ""]);
          }
          printLines([rendered.prompt ?? ""]);
        } catch (error) {
          printError(error, json);
        }
      },
    }),
    validate: defineCommand({
      args: {
        ...globalArgDefs(),
        file: {
          description: "Spec JSON file",
          required: true,
          type: "positional",
        },
      },
      meta: {
        description: "Validate a local spec JSON file",
        name: "validate",
      },
      async run({ args }) {
        const { json } = loadRuntime(args);
        try {
          const raw = await readJsonFile(argString(args.file) ?? "");
          const parsed = characterSpecSchema.safeParse(raw);
          if (!parsed.success) {
            const message =
              parsed.error.issues[0]?.message ?? "spec schema invalid";
            if (json) {
              printJson({ errors: [message], ok: false });
              process.exit(1);
            }
            printError(new Error(message), false);
          }
          const result = validateSpec(parsed.data);
          if (json) {
            printJson(result);
            if (!result.ok) {
              process.exit(1);
            }
            return;
          }
          if (result.ok) {
            printLines(["spec is valid"]);
            return;
          }
          printLines(["spec validation failed:"]);
          for (const err of result.errors) {
            printLines([`  - ${err}`]);
          }
          process.exit(1);
        } catch (error) {
          printError(error, json);
        }
      },
    }),
  },
});
