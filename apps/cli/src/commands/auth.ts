import * as readline from "node:readline/promises";
import { defineCommand } from "citty";
import { ApiClient } from "../client";
import { clearToken, configPath, saveToken } from "../config";
import { argString, globalArgDefs, loadRuntime } from "../context";
import { printError, printJson, printLines } from "../output";

export const authCommand = defineCommand({
  meta: {
    description: "Manage API authentication",
    name: "auth",
  },
  subCommands: {
    login: defineCommand({
      args: {
        ...globalArgDefs(),
        token: {
          description: "Bearer token (ct_live_...); prompts if omitted",
          type: "string",
        },
      },
      meta: { description: "Save API token to config", name: "login" },
      async run({ args }) {
        const { clientConfig, json } = loadRuntime(args);
        let token = argString(args.token)?.trim();
        if (!token) {
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          token = (await rl.question("API token (ct_live_...): ")).trim();
          rl.close();
        }
        if (!token) {
          printError(new Error("token is required"), json);
        }
        saveToken(token, clientConfig.apiUrl);
        if (json) {
          printJson({ configPath: configPath(), ok: true });
          return;
        }
        printLines([`saved token to ${configPath()}`]);
      },
    }),
    logout: defineCommand({
      args: globalArgDefs(),
      meta: { description: "Remove saved API token", name: "logout" },
      run({ args }) {
        const { json } = loadRuntime(args);
        clearToken();
        if (json) {
          printJson({ ok: true });
          return;
        }
        printLines(["logged out (token removed from config)"]);
      },
    }),
    status: defineCommand({
      args: globalArgDefs(),
      meta: { description: "Verify saved API token", name: "status" },
      async run({ args }) {
        const { clientConfig, json } = loadRuntime(args);
        const client = new ApiClient(clientConfig);
        try {
          const characters = await client.request<unknown[]>({
            auth: true,
            path: "/characters",
            query: { limit: 1 },
          });
          const payload = {
            apiUrl: clientConfig.apiUrl,
            authenticated: true,
            characterCount: Array.isArray(characters) ? characters.length : 0,
            tokenConfigured: Boolean(clientConfig.token),
          };
          if (json) {
            printJson(payload);
            return;
          }
          printLines([
            `authenticated against ${clientConfig.apiUrl}`,
            `characters visible: ${payload.characterCount}`,
          ]);
        } catch (error) {
          if (json) {
            printError(error, true);
          }
          if (!clientConfig.token) {
            printLines(["not authenticated (no token configured)"]);
            printLines(["hint: run `charator auth login`"]);
            process.exit(1);
          }
          printError(error, false);
        }
      },
    }),
  },
});
