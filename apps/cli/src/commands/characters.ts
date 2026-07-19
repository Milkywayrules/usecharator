import {
  type CharacterResponse,
  type CreateCharacterRequest,
  characterResponseSchema,
  type UpdateCharacterRequest,
} from "@charator/shared";
import { defineCommand } from "citty";
import { ApiClient } from "../client";
import {
  argString,
  globalArgDefs,
  loadRuntime,
  readJsonFile,
} from "../context";
import { printError, printJson, printLines, printTable } from "../output";

async function listCharacters(client: ApiClient): Promise<CharacterResponse[]> {
  const raw = await client.request<unknown[]>({
    auth: true,
    path: "/characters",
  });
  return raw.map((item) => characterResponseSchema.parse(item));
}

async function findCharacter(
  client: ApiClient,
  id: string
): Promise<CharacterResponse> {
  const characters = await listCharacters(client);
  const match = characters.find((row) => row.id === id);
  if (!match) {
    throw new Error(`character not found: ${id}`);
  }
  return match;
}

export const charactersCommand = defineCommand({
  meta: {
    description: "Manage saved characters",
    name: "characters",
  },
  subCommands: {
    create: defineCommand({
      args: {
        ...globalArgDefs(),
        name: { description: "Character name", required: true, type: "string" },
        spec: {
          description: "Path to spec JSON file",
          required: true,
          type: "string",
        },
        theme: { description: "Theme id", type: "string" },
        visibility: {
          default: "public",
          description: "public or private",
          type: "string",
        },
      },
      meta: { description: "Create a character", name: "create" },
      async run({ args }) {
        const { clientConfig, json } = loadRuntime(args);
        const client = new ApiClient(clientConfig);
        try {
          const name = argString(args.name);
          const specPath = argString(args.spec);
          if (!(name && specPath)) {
            throw new Error("--name and --spec are required");
          }
          const spec = await readJsonFile(specPath);
          const theme = argString(args.theme);
          const visibilityArg = argString(args.visibility);
          const body: CreateCharacterRequest = {
            name,
            spec,
            themeId: theme ?? null,
            visibility: visibilityArg === "private" ? "private" : "public",
          };
          const raw = await client.request({
            auth: true,
            body,
            path: "/characters",
          });
          const created = characterResponseSchema.parse(raw);
          if (json) {
            printJson(created);
            return;
          }
          printLines([`created ${created.name} (${created.id})`]);
        } catch (error) {
          printError(error, json);
        }
      },
    }),
    delete: defineCommand({
      args: {
        ...globalArgDefs(),
        id: {
          description: "Character id",
          required: true,
          type: "positional",
        },
      },
      meta: { description: "Delete a character", name: "delete" },
      async run({ args }) {
        const { clientConfig, json } = loadRuntime(args);
        const client = new ApiClient(clientConfig);
        try {
          await client.request({
            auth: true,
            method: "DELETE",
            path: `/characters/${args.id}`,
          });
          if (json) {
            printJson({ deleted: true, id: args.id });
            return;
          }
          printLines([`deleted ${args.id}`]);
        } catch (error) {
          printError(error, json);
        }
      },
    }),
    get: defineCommand({
      args: {
        ...globalArgDefs(),
        id: {
          description: "Character id",
          required: true,
          type: "positional",
        },
      },
      meta: { description: "Get a character by id", name: "get" },
      async run({ args }) {
        const { clientConfig, json } = loadRuntime(args);
        const client = new ApiClient(clientConfig);
        try {
          const character = await findCharacter(client, String(args.id));
          if (json) {
            printJson(character);
            return;
          }
          printLines([
            `${character.name} (${character.id})`,
            `theme: ${character.themeId ?? "(none)"}`,
            `visibility: ${character.visibility}`,
            `updated: ${character.updatedAt}`,
          ]);
        } catch (error) {
          printError(error, json);
        }
      },
    }),
    list: defineCommand({
      args: globalArgDefs(),
      meta: { description: "List your characters", name: "list" },
      async run({ args }) {
        const { clientConfig, json } = loadRuntime(args);
        const client = new ApiClient(clientConfig);
        try {
          const characters = await listCharacters(client);
          if (json) {
            printJson(characters);
            return;
          }
          printTable(
            ["id", "name", "theme", "visibility"],
            characters.map((row) => [
              row.id,
              row.name,
              row.themeId ?? "",
              row.visibility,
            ])
          );
        } catch (error) {
          printError(error, json);
        }
      },
    }),
    remix: defineCommand({
      args: {
        ...globalArgDefs(),
        id: {
          description: "Source character id",
          required: true,
          type: "positional",
        },
      },
      meta: { description: "Remix a character", name: "remix" },
      async run({ args }) {
        const { clientConfig, json } = loadRuntime(args);
        const client = new ApiClient(clientConfig);
        try {
          const raw = await client.request({
            auth: true,
            path: `/characters/${args.id}/remix`,
          });
          const created = characterResponseSchema.parse(raw);
          if (json) {
            printJson(created);
            return;
          }
          printLines([`remixed to ${created.name} (${created.id})`]);
        } catch (error) {
          printError(error, json);
        }
      },
    }),
    update: defineCommand({
      args: {
        ...globalArgDefs(),
        id: {
          description: "Character id",
          required: true,
          type: "positional",
        },
        name: { description: "New name", type: "string" },
        spec: { description: "Path to spec JSON file", type: "string" },
        theme: { description: "Theme id", type: "string" },
        visibility: { description: "public or private", type: "string" },
      },
      meta: { description: "Update a character", name: "update" },
      async run({ args }) {
        const { clientConfig, json } = loadRuntime(args);
        const client = new ApiClient(clientConfig);
        try {
          const body: UpdateCharacterRequest = {};
          const name = argString(args.name);
          const specPath = argString(args.spec);
          const theme = argString(args.theme);
          const visibilityArg = argString(args.visibility);
          if (name) {
            body.name = name;
          }
          if (specPath) {
            body.spec = await readJsonFile(specPath);
          }
          if (args.theme !== undefined) {
            body.themeId = theme || null;
          }
          if (visibilityArg) {
            body.visibility =
              visibilityArg === "private" ? "private" : "public";
          }
          const raw = await client.request({
            auth: true,
            body,
            method: "PATCH",
            path: `/characters/${args.id}`,
          });
          const updated = characterResponseSchema.parse(raw);
          if (json) {
            printJson(updated);
            return;
          }
          printLines([`updated ${updated.name} (${updated.id})`]);
        } catch (error) {
          printError(error, json);
        }
      },
    }),
  },
});
