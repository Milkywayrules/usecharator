import {
  type CreateGenerationRequest,
  characterResponseSchema,
  createGenerationResponseSchema,
  specRenderResponseSchema,
} from "@charator/shared";
import { defineCommand } from "citty";
import pc from "picocolors";
import type { ApiClient } from "../client";
import {
  argString,
  globalArgDefs,
  loadRuntime,
  readJsonFile,
} from "../context";
import {
  createClient,
  defaultOutputDir,
  waitAndDownloadJob,
} from "../jobs-util";
import { printError, printJson, printLines } from "../output";

async function renderSpecPrompt(
  client: ApiClient,
  spec: unknown,
  theme?: string
): Promise<{ negativePrompt?: string; prompt: string }> {
  const body: { spec: unknown; theme?: string } = { spec };
  if (theme) {
    body.theme = theme;
  }
  const raw = await client.request({ body, path: "/spec/render" });
  const rendered = specRenderResponseSchema.parse(raw);
  if (!rendered.prompt) {
    throw new Error("API returned empty prompt");
  }
  return {
    negativePrompt: rendered.negativePrompt,
    prompt: rendered.prompt,
  };
}

export const generateCommand = defineCommand({
  args: {
    ...globalArgDefs(),
    "api-key": { description: "Inline provider API key", type: "string" },
    character: { description: "Character id to generate from", type: "string" },
    "key-id": { description: "Saved provider key id", type: "string" },
    model: { description: "Provider model override", type: "string" },
    output: {
      default: defaultOutputDir(),
      description: "Output directory for downloaded images",
      type: "string",
    },
    provider: { description: "Provider key", required: true, type: "string" },
    spec: {
      description: "Spec JSON file (instead of --character)",
      type: "string",
    },
    theme: { description: "Theme id for rendering", type: "string" },
    wait: {
      default: false,
      description: "Poll until complete and download images",
      type: "boolean",
    },
  },
  meta: {
    description: "Create an image generation job",
    name: "generate",
  },
  async run({ args }) {
    const { clientConfig, json } = loadRuntime(args);
    const client = createClient(clientConfig);
    try {
      const characterIdArg = argString(args.character);
      const specPath = argString(args.spec);
      const apiKey = argString(args["api-key"]);
      const keyId = argString(args["key-id"]);
      const provider = argString(args.provider);
      const model = argString(args.model);
      const outputDir = argString(args.output) ?? defaultOutputDir();
      let theme = argString(args.theme);

      if (!(characterIdArg || specPath)) {
        throw new Error("provide --character or --spec");
      }
      if (characterIdArg && specPath) {
        throw new Error("use only one of --character or --spec");
      }
      if (apiKey && keyId) {
        throw new Error("use only one of --api-key or --key-id");
      }
      if (!(apiKey || keyId)) {
        throw new Error("provide --api-key or --key-id");
      }
      if (!provider) {
        throw new Error("--provider is required");
      }

      let spec: unknown;
      let characterId: string | undefined;

      if (characterIdArg) {
        const rawCharacter = await client.request({
          auth: true,
          path: "/characters",
        });
        const characters = (rawCharacter as unknown[]).map((row) =>
          characterResponseSchema.parse(row)
        );
        const character = characters.find((row) => row.id === characterIdArg);
        if (!character) {
          throw new Error(`character not found: ${characterIdArg}`);
        }
        spec = character.spec;
        characterId = character.id;
        theme = theme ?? character.themeId ?? undefined;
      } else {
        spec = await readJsonFile(specPath as string);
      }

      const rendered = await renderSpecPrompt(client, spec, theme);
      const body: CreateGenerationRequest = {
        ...(apiKey ? { apiKey } : {}),
        ...(keyId ? { providerKeyId: keyId } : {}),
        ...(characterId ? { characterId } : {}),
        ...(rendered.negativePrompt
          ? { negativePrompt: rendered.negativePrompt }
          : {}),
        model,
        prompt: rendered.prompt,
        provider: provider as CreateGenerationRequest["provider"],
        specSnapshot: spec,
      };

      const createdRaw = await client.request({
        auth: Boolean(keyId),
        body,
        path: "/generations",
      });
      const created = createGenerationResponseSchema.parse(createdRaw);

      if (args.wait) {
        const spinner = json
          ? undefined
          : (job: { status: string }) => {
              process.stdout.write(
                `\r${pc.cyan(`job ${created.jobId}: ${job.status}`)}`
              );
            };
        const { files, job } = await waitAndDownloadJob(
          client,
          created.jobId,
          outputDir,
          spinner
        );
        if (!json) {
          process.stdout.write("\n");
        }
        if (json) {
          printJson({ files, job, jobId: created.jobId });
          return;
        }
        printLines([`job ${created.jobId} ${job.status}`]);
        for (const file of files) {
          printLines([file]);
        }
        return;
      }

      if (json) {
        printJson(created);
        return;
      }
      printLines([
        `queued job ${created.jobId}`,
        `check status: charator jobs get ${created.jobId}${args.wait ? "" : " --wait"}`,
      ]);
    } catch (error) {
      printError(error, json);
    }
  },
});

export const jobsCommand = defineCommand({
  meta: { description: "Inspect generation jobs", name: "jobs" },
  subCommands: {
    get: defineCommand({
      args: {
        ...globalArgDefs(),
        jobId: {
          description: "Generation job id",
          required: true,
          type: "positional",
        },
        output: {
          default: defaultOutputDir(),
          description: "Output directory when using --wait",
          type: "string",
        },
        wait: {
          default: false,
          description: "Poll until complete and download images",
          type: "boolean",
        },
      },
      meta: { description: "Get generation job status", name: "get" },
      async run({ args }) {
        const { clientConfig, json } = loadRuntime(args);
        const client = createClient(clientConfig);
        const jobId = argString(args.jobId);
        if (!jobId) {
          throw new Error("job id is required");
        }
        const outputDir = argString(args.output) ?? defaultOutputDir();
        try {
          if (args.wait) {
            const spinner = json
              ? undefined
              : (job: { status: string }) => {
                  process.stdout.write(
                    `\r${pc.cyan(`job ${jobId}: ${job.status}`)}`
                  );
                };
            const { files, job } = await waitAndDownloadJob(
              client,
              jobId,
              outputDir,
              spinner
            );
            if (!json) {
              process.stdout.write("\n");
            }
            if (json) {
              printJson({ files, job });
              return;
            }
            printLines([`job ${job.id} ${job.status}`]);
            for (const file of files) {
              printLines([file]);
            }
            return;
          }

          const job = await client.request({
            auth: Boolean(clientConfig.token),
            path: `/generations/${jobId}`,
          });
          if (json) {
            printJson(job);
            return;
          }
          printLines([`${jobId}: ${(job as { status: string }).status}`]);
        } catch (error) {
          printError(error, json);
        }
      },
    }),
  },
});
