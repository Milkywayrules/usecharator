import {
  galleryDetailResponseSchema,
  galleryListResponseSchema,
} from "@charator/shared";
import { defineCommand } from "citty";
import { ApiClient } from "../client";
import { argString, globalArgDefs, loadRuntime } from "../context";
import { printError, printJson, printTable } from "../output";

export const galleryCommand = defineCommand({
  meta: { description: "Browse public gallery", name: "gallery" },
  subCommands: {
    get: defineCommand({
      args: {
        ...globalArgDefs(),
        id: {
          description: "Gallery character id",
          required: true,
          type: "positional",
        },
      },
      meta: { description: "Get gallery character detail", name: "get" },
      async run({ args }) {
        const { clientConfig, json } = loadRuntime(args);
        const client = new ApiClient(clientConfig);
        try {
          const raw = await client.request({
            path: `/gallery/${args.id}`,
          });
          const detail = galleryDetailResponseSchema.parse(raw);
          if (json) {
            printJson(detail);
            return;
          }
          printTable(
            ["field", "value"],
            [
              ["id", detail.id],
              ["name", detail.name],
              ["owner", detail.owner.displayName],
              ["theme", detail.themeId ?? ""],
              ["remixes", String(detail.remixCount)],
              ["renders", String(detail.renders.length)],
            ]
          );
        } catch (error) {
          printError(error, json);
        }
      },
    }),
    list: defineCommand({
      args: {
        ...globalArgDefs(),
        theme: { description: "Filter by theme id", type: "string" },
      },
      meta: { description: "List public gallery items", name: "list" },
      async run({ args }) {
        const { clientConfig, json } = loadRuntime(args);
        const client = new ApiClient(clientConfig);
        try {
          const raw = await client.request({
            path: "/gallery",
            query: { theme: argString(args.theme) },
          });
          const list = galleryListResponseSchema.parse(raw);
          if (json) {
            printJson(list);
            return;
          }
          printTable(
            ["id", "name", "owner", "theme"],
            list.items.map((item) => [
              item.id,
              item.name,
              item.owner.displayName,
              item.themeId ?? "",
            ])
          );
        } catch (error) {
          printError(error, json);
        }
      },
    }),
  },
});
