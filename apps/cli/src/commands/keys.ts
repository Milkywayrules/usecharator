import {
  type CreateProviderKeyRequest,
  providerKeyResponseSchema,
} from "@charator/shared";
import { defineCommand } from "citty";
import { ApiClient } from "../client";
import { argString, globalArgDefs, loadRuntime } from "../context";
import { printError, printJson, printLines, printTable } from "../output";

export const keysCommand = defineCommand({
  meta: { description: "Manage saved provider keys", name: "keys" },
  subCommands: {
    add: defineCommand({
      args: {
        ...globalArgDefs(),
        "base-url": {
          description: "Custom provider base URL (https)",
          type: "string",
        },
        key: {
          description: "Provider API key",
          required: true,
          type: "string",
        },
        label: { description: "Key label", type: "string" },
        provider: {
          description: "Provider id",
          required: true,
          type: "string",
        },
      },
      meta: { description: "Add a provider key", name: "add" },
      async run({ args }) {
        const { clientConfig, json } = loadRuntime(args);
        const client = new ApiClient(clientConfig);
        try {
          const provider = argString(args.provider);
          const key = argString(args.key);
          if (!(provider && key)) {
            throw new Error("--provider and --key are required");
          }
          const body: CreateProviderKeyRequest = {
            apiKey: key,
            customBaseUrl: argString(args["base-url"]),
            label: argString(args.label) ?? `${provider}-default`,
            provider: provider as CreateProviderKeyRequest["provider"],
          };
          const raw = await client.request({
            auth: true,
            body,
            path: "/keys",
          });
          const created = providerKeyResponseSchema.parse(raw);
          if (json) {
            printJson(created);
            return;
          }
          printLines([
            `saved ${created.provider} key ${created.label} (${created.id})`,
          ]);
        } catch (error) {
          printError(error, json);
        }
      },
    }),
    list: defineCommand({
      args: globalArgDefs(),
      meta: { description: "List saved provider keys", name: "list" },
      async run({ args }) {
        const { clientConfig, json } = loadRuntime(args);
        const client = new ApiClient(clientConfig);
        try {
          const raw = await client.request<unknown[]>({
            auth: true,
            path: "/keys",
          });
          const keys = raw.map((row) => providerKeyResponseSchema.parse(row));
          if (json) {
            printJson(keys);
            return;
          }
          printTable(
            ["id", "provider", "label", "hint"],
            keys.map((row) => [row.id, row.provider, row.label, row.hint])
          );
        } catch (error) {
          printError(error, json);
        }
      },
    }),
    remove: defineCommand({
      args: {
        ...globalArgDefs(),
        id: {
          description: "Provider key id",
          required: true,
          type: "positional",
        },
      },
      meta: { description: "Remove a provider key", name: "remove" },
      async run({ args }) {
        const { clientConfig, json } = loadRuntime(args);
        const client = new ApiClient(clientConfig);
        try {
          await client.request({
            auth: true,
            method: "DELETE",
            path: `/keys/${args.id}`,
          });
          if (json) {
            printJson({ deleted: true, id: args.id });
            return;
          }
          printLines([`removed key ${args.id}`]);
        } catch (error) {
          printError(error, json);
        }
      },
    }),
  },
});
