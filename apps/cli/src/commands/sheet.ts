import {
  type CreateSheetRequest,
  createSheetResponseSchema,
  sheetBatchResponseSchema,
} from "@charator/shared";
import { defineCommand } from "citty";
import pc from "picocolors";
import type { ApiClient } from "../client";
import { argString, globalArgDefs, loadRuntime } from "../context";
import { createClient } from "../jobs-util";
import { printError, printJson, printLines } from "../output";

async function waitForSheetBatch(
  client: ApiClient,
  batchId: string,
  onPoll?: (batch: { status: string }) => void
): Promise<unknown> {
  const terminal = new Set(["completed", "partial", "failed"]);
  for (;;) {
    const raw = await client.request({
      auth: true,
      path: `/sheets/${batchId}`,
    });
    const batch = sheetBatchResponseSchema.parse(raw);
    onPoll?.(batch);
    if (terminal.has(batch.status)) {
      return batch;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

export const sheetCommand = defineCommand({
  args: {
    ...globalArgDefs(),
    "api-key": { description: "Inline provider API key", type: "string" },
    characterId: {
      description: "Character id",
      required: true,
      type: "positional",
    },
    "key-id": { description: "Saved provider key id", type: "string" },
    model: { description: "Provider model override", type: "string" },
    preset: {
      default: "turnaround",
      description: "Sheet preset (turnaround, expressions, poses)",
      type: "string",
    },
    provider: {
      default: "openrouter",
      description: "Provider key",
      type: "string",
    },
    "use-anchor": {
      default: false,
      description: "Pass character anchor when model supports refs",
      type: "boolean",
    },
    wait: {
      default: false,
      description: "Poll batch endpoint until terminal status",
      type: "boolean",
    },
  },
  meta: {
    description: "Generate a character sheet batch",
    name: "sheet",
  },
  async run({ args }) {
    const { clientConfig, json } = loadRuntime(args);
    const client = createClient(clientConfig);
    try {
      const characterId = argString(args.characterId);
      const apiKey = argString(args["api-key"]);
      const keyId = argString(args["key-id"]);
      const preset = argString(args.preset) ?? "turnaround";
      const provider = argString(args.provider) ?? "openrouter";
      const model = argString(args.model);

      if (!characterId) {
        throw new Error("character id is required");
      }
      if (apiKey && keyId) {
        throw new Error("use only one of --api-key or --key-id");
      }
      if (!(apiKey || keyId)) {
        throw new Error("provide --api-key or --key-id");
      }

      const body: CreateSheetRequest = {
        ...(apiKey ? { apiKey } : {}),
        ...(keyId ? { providerKeyId: keyId } : {}),
        ...(model ? { model } : {}),
        ...(args["use-anchor"] ? { useAnchor: true } : {}),
        preset: preset as CreateSheetRequest["preset"],
        provider: provider as CreateSheetRequest["provider"],
      };

      const createdRaw = await client.request({
        auth: Boolean(keyId),
        body,
        path: `/characters/${characterId}/sheet`,
      });
      const created = createSheetResponseSchema.parse(createdRaw);

      if (args.wait) {
        const spinner = json
          ? undefined
          : (batch: { status: string }) => {
              process.stdout.write(
                `\r${pc.cyan(`batch ${created.batchId}: ${batch.status}`)}`
              );
            };
        const batch = await waitForSheetBatch(client, created.batchId, spinner);
        if (!json) {
          process.stdout.write("\n");
        }
        if (json) {
          printJson({ batch, ...created });
          return;
        }
        printLines([
          `batch ${created.batchId} ${(batch as { status: string }).status}`,
        ]);
        return;
      }

      if (json) {
        printJson(created);
        return;
      }
      printLines([
        `queued sheet batch ${created.batchId} (${created.estimatedCalls} calls)`,
        `check status: charator sheet ${characterId} --preset ${preset} (use GET /sheets/${created.batchId})`,
      ]);
    } catch (error) {
      printError(error, json);
    }
  },
});
