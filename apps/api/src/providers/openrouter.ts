import {
  decodeBase64Image,
  type GenerateInput,
  type ProviderAdapter,
  ProviderRequestError,
  readProviderError,
} from "./types";

function extractOpenRouterImages(payload: unknown): Uint8Array[] {
  const images: Uint8Array[] = [];
  const data = payload as {
    choices?: Array<{
      message?: {
        images?: Array<{
          image_url?: { url?: string };
          type?: string;
          image?: string;
        }>;
        content?:
          | string
          | Array<{
              type?: string;
              image_url?: { url?: string };
              image?: string;
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

export const openrouterAdapter: ProviderAdapter = {
  async generate(input: GenerateInput) {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        body: JSON.stringify({
          messages: [{ content: input.prompt, role: "user" }],
          modalities: ["image", "text"],
          model: input.model,
        }),
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      }
    );

    if (!response.ok) {
      throw new ProviderRequestError(await readProviderError(response));
    }

    const payload = await response.json();
    const images = extractOpenRouterImages(payload);
    if (images.length === 0) {
      throw new ProviderRequestError("openrouter returned no images");
    }

    return { images, kind: "sync" };
  },
  provider: "openrouter",
};
