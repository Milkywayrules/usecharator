import { openRouterUsesImageApi } from "@charator/shared";
import { aspectRatioToOpenRouterParam } from "./aspect-ratio";
import {
  decodeBase64Image,
  type GenerateInput,
  type ProviderAdapter,
  ProviderRequestError,
  readProviderError,
} from "./types";

const OPENROUTER_IMAGE_URL = "https://openrouter.ai/api/v1/images";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

function authHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function extractOpenRouterChatImages(payload: unknown): Uint8Array[] {
  const images: Uint8Array[] = [];
  const data = payload as {
    choices?: Array<{
      message?: {
        images?: Array<{
          image_url?: { url?: string };
        }>;
        content?:
          | string
          | Array<{
              type?: string;
              image_url?: { url?: string };
            }>;
      };
    }>;
  };

  for (const choice of data.choices ?? []) {
    const message = choice.message;
    if (!message) {
      continue;
    }

    if (Array.isArray(message.images)) {
      for (const image of message.images) {
        const url = image.image_url?.url;
        if (url?.startsWith("data:")) {
          const base64 = url.split(",")[1];
          if (base64) {
            images.push(decodeBase64Image(base64));
          }
        }
      }
    }

    if (Array.isArray(message.content)) {
      for (const part of message.content) {
        const url = part.image_url?.url;
        if (url?.startsWith("data:")) {
          const base64 = url.split(",")[1];
          if (base64) {
            images.push(decodeBase64Image(base64));
          }
        }
      }
    }
  }

  return images;
}

function extractOpenRouterImageApiPayload(payload: unknown): Uint8Array[] {
  const images: Uint8Array[] = [];
  const data = payload as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };

  for (const item of data.data ?? []) {
    if (item.b64_json) {
      images.push(decodeBase64Image(item.b64_json));
    }
  }

  return images;
}

class OpenRouterHttpError extends ProviderRequestError {
  httpStatus: number;

  constructor(message: string, httpStatus: number) {
    super(message);
    this.name = "OpenRouterHttpError";
    this.httpStatus = httpStatus;
  }
}

async function generateViaImageApi(
  input: GenerateInput
): Promise<{ images: Uint8Array[]; kind: "sync" }> {
  const aspectRatio = aspectRatioToOpenRouterParam(input.aspectRatio);
  const response = await fetch(OPENROUTER_IMAGE_URL, {
    body: JSON.stringify({
      model: input.model,
      prompt: input.prompt,
      ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
    }),
    headers: authHeaders(input.apiKey),
    method: "POST",
  });

  if (!response.ok) {
    throw new OpenRouterHttpError(
      await readProviderError(response),
      response.status
    );
  }

  const payload = await response.json();
  const images = extractOpenRouterImageApiPayload(payload);
  if (images.length === 0) {
    throw new ProviderRequestError("openrouter image api returned no images");
  }

  return { images, kind: "sync" };
}

async function generateViaChatCompletions(
  input: GenerateInput
): Promise<{ images: Uint8Array[]; kind: "sync" }> {
  const response = await fetch(OPENROUTER_CHAT_URL, {
    body: JSON.stringify({
      messages: [{ content: input.prompt, role: "user" }],
      modalities: ["image", "text"],
      model: input.model,
    }),
    headers: authHeaders(input.apiKey),
    method: "POST",
  });

  if (!response.ok) {
    throw new ProviderRequestError(await readProviderError(response));
  }

  const payload = await response.json();
  const images = extractOpenRouterChatImages(payload);
  if (images.length === 0) {
    throw new ProviderRequestError("openrouter returned no images");
  }

  return { images, kind: "sync" };
}

export function shouldFallbackOpenRouterToChat(status: number): boolean {
  return status === 404 || status === 400 || status === 422;
}

export async function generateOpenRouterImage(input: GenerateInput) {
  if (!openRouterUsesImageApi(input.model)) {
    return generateViaChatCompletions(input);
  }

  try {
    return await generateViaImageApi(input);
  } catch (error) {
    if (
      error instanceof OpenRouterHttpError &&
      shouldFallbackOpenRouterToChat(error.httpStatus)
    ) {
      return generateViaChatCompletions(input);
    }
    throw error;
  }
}

export const openrouterAdapter: ProviderAdapter = {
  generate: generateOpenRouterImage,
  provider: "openrouter",
};
