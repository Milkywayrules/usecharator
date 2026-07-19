import { aspectRatioToFalImageSize } from "./aspect-ratio";
import {
  downloadImages,
  type GenerateInput,
  type PollResult,
  type ProviderAdapter,
  ProviderRequestError,
  readProviderError,
} from "./types";

function authHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Key ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function extractFalImageUrls(payload: unknown): string[] {
  const data = payload as {
    images?: Array<{ url?: string }>;
    image?: { url?: string };
    output?: { images?: Array<{ url?: string }> };
  };

  const urls: string[] = [];
  for (const image of data.images ?? data.output?.images ?? []) {
    if (image.url) {
      urls.push(image.url);
    }
  }
  if (data.image?.url) {
    urls.push(data.image.url);
  }
  return urls;
}

export const falAdapter: ProviderAdapter = {
  async generate(input: GenerateInput) {
    const imageSize = aspectRatioToFalImageSize(input.aspectRatio);
    const query = input.webhookUrl
      ? `?fal_webhook=${encodeURIComponent(input.webhookUrl)}`
      : "";
    const response = await fetch(
      `https://queue.fal.run/${input.model}${query}`,
      {
        body: JSON.stringify({
          prompt: input.prompt,
          ...(imageSize ? { image_size: imageSize } : {}),
          ...(input.negativePrompt
            ? { negative_prompt: input.negativePrompt }
            : {}),
        }),
        headers: authHeaders(input.apiKey),
        method: "POST",
      }
    );

    if (!response.ok) {
      throw new ProviderRequestError(await readProviderError(response));
    }

    const payload = (await response.json()) as { request_id?: string };
    if (!payload.request_id) {
      throw new ProviderRequestError("fal did not return request_id");
    }

    return { kind: "async", providerJobId: payload.request_id };
  },

  parseWebhook(body, headers) {
    const secret = process.env.FAL_WEBHOOK_SECRET;
    if (!secret) {
      return null;
    }
    const provided = headers.get("x-fal-webhook-secret");
    if (provided !== secret) {
      return null;
    }

    const payload = body as {
      request_id?: string;
      status?: string;
      payload?: unknown;
      error?: string;
    };

    if (!payload.request_id) {
      return null;
    }

    if (payload.status === "ERROR") {
      return {
        error: payload.error ?? "fal webhook reported failure",
        providerJobId: payload.request_id,
        status: "failed",
      };
    }

    const imageUrls = extractFalImageUrls(payload.payload ?? payload);
    return {
      imageUrls,
      providerJobId: payload.request_id,
      status: "succeeded",
    };
  },

  async poll(providerJobId, apiKey, model): Promise<PollResult> {
    const statusResponse = await fetch(
      `https://queue.fal.run/${model}/requests/${providerJobId}/status`,
      { headers: authHeaders(apiKey) }
    );
    if (!statusResponse.ok) {
      throw new ProviderRequestError(await readProviderError(statusResponse));
    }

    const statusPayload = (await statusResponse.json()) as {
      status?: string;
      error?: string;
    };

    if (
      statusPayload.status === "IN_QUEUE" ||
      statusPayload.status === "IN_PROGRESS"
    ) {
      return { status: "running" };
    }

    if (statusPayload.status === "FAILED") {
      return {
        error: statusPayload.error ?? "fal generation failed",
        status: "failed",
      };
    }

    const resultResponse = await fetch(
      `https://queue.fal.run/${model}/requests/${providerJobId}`,
      { headers: authHeaders(apiKey) }
    );
    if (!resultResponse.ok) {
      throw new ProviderRequestError(await readProviderError(resultResponse));
    }

    const resultPayload = await resultResponse.json();
    const imageUrls = extractFalImageUrls(resultPayload);
    if (imageUrls.length === 0) {
      return { error: "fal returned no images", status: "failed" };
    }

    return {
      images: await downloadImages(imageUrls),
      imageUrls,
      status: "succeeded",
    };
  },
  provider: "fal",
};
