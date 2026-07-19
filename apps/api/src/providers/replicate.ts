import { aspectRatioToReplicateParam } from "./aspect-ratio";
import {
  downloadImages,
  type GenerateInput,
  type PollResult,
  type ProviderAdapter,
  ProviderRequestError,
  readProviderError,
} from "./types";

function replicateAuth(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function parseModelSlug(model: string): { owner: string; name: string } {
  const [owner, name] = model.split("/");
  if (!(owner && name)) {
    throw new ProviderRequestError("replicate model must be owner/name");
  }
  return { name, owner };
}

function extractReplicateOutput(output: unknown): string[] {
  if (typeof output === "string") {
    return [output];
  }
  if (Array.isArray(output)) {
    return output.filter((item): item is string => typeof item === "string");
  }
  return [];
}

export const replicateAdapter: ProviderAdapter = {
  async generate(input: GenerateInput) {
    const { owner, name } = parseModelSlug(input.model);
    const aspectRatio = aspectRatioToReplicateParam(input.aspectRatio);
    const response = await fetch(
      `https://api.replicate.com/v1/models/${owner}/${name}/predictions`,
      {
        body: JSON.stringify({
          input: {
            prompt: input.prompt,
            ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
            ...(input.negativePrompt
              ? { negative_prompt: input.negativePrompt }
              : {}),
          },
          ...(input.webhookUrl
            ? {
                webhook: input.webhookUrl,
                webhook_events_filter: ["completed"],
              }
            : {}),
        }),
        headers: replicateAuth(input.apiKey),
        method: "POST",
      }
    );

    if (!response.ok) {
      throw new ProviderRequestError(await readProviderError(response));
    }

    const payload = (await response.json()) as {
      id?: string;
      status?: string;
      output?: unknown;
    };
    if (!payload.id) {
      throw new ProviderRequestError("replicate did not return prediction id");
    }

    if (payload.status === "succeeded") {
      const urls = extractReplicateOutput(payload.output);
      if (urls.length === 0) {
        throw new ProviderRequestError("replicate returned no output");
      }
      return {
        images: await downloadImages(urls),
        imageUrls: urls,
        kind: "sync",
      };
    }

    return { kind: "async", providerJobId: payload.id };
  },

  parseWebhook(body, headers) {
    const secret = process.env.REPLICATE_WEBHOOK_SECRET;
    if (!secret) {
      return null;
    }
    const provided = headers.get("x-replicate-webhook-secret");
    if (provided !== secret) {
      return null;
    }

    const payload = body as {
      id?: string;
      status?: string;
      error?: string;
      output?: unknown;
    };

    if (!payload.id) {
      return null;
    }

    if (payload.status === "failed" || payload.status === "canceled") {
      return {
        error: payload.error ?? "replicate webhook reported failure",
        providerJobId: payload.id,
        status: "failed",
      };
    }

    if (payload.status === "succeeded") {
      return {
        imageUrls: extractReplicateOutput(payload.output),
        providerJobId: payload.id,
        status: "succeeded",
      };
    }

    return null;
  },

  async poll(providerJobId, apiKey): Promise<PollResult> {
    const response = await fetch(
      `https://api.replicate.com/v1/predictions/${providerJobId}`,
      {
        headers: replicateAuth(apiKey),
      }
    );
    if (!response.ok) {
      throw new ProviderRequestError(await readProviderError(response));
    }

    const payload = (await response.json()) as {
      status?: string;
      error?: string;
      output?: unknown;
    };

    if (payload.status === "processing" || payload.status === "starting") {
      return { status: "running" };
    }

    if (payload.status === "failed" || payload.status === "canceled") {
      return {
        error: payload.error ?? "replicate generation failed",
        status: "failed",
      };
    }

    if (payload.status === "succeeded") {
      const urls = extractReplicateOutput(payload.output);
      if (urls.length === 0) {
        return { error: "replicate returned no output", status: "failed" };
      }
      return {
        images: await downloadImages(urls),
        imageUrls: urls,
        status: "succeeded",
      };
    }

    return { status: "running" };
  },
  provider: "replicate",
};
