import { aspectRatioToOpenAiSize } from "./aspect-ratio";
import {
  decodeBase64Image,
  type GenerateInput,
  type ProviderAdapter,
  ProviderRequestError,
  readProviderError,
} from "./types";

export const openaiAdapter: ProviderAdapter = {
  async generate(input: GenerateInput) {
    const response = await fetch(
      "https://api.openai.com/v1/images/generations",
      {
        body: JSON.stringify({
          model: input.model,
          n: 1,
          prompt: input.prompt,
          size: aspectRatioToOpenAiSize(input.aspectRatio),
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

    const payload = (await response.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };

    const images: Uint8Array[] = [];
    for (const item of payload.data ?? []) {
      if (item.b64_json) {
        images.push(decodeBase64Image(item.b64_json));
      } else if (item.url) {
        const imageResponse = await fetch(item.url);
        if (!imageResponse.ok) {
          throw new ProviderRequestError("failed to download openai image");
        }
        images.push(new Uint8Array(await imageResponse.arrayBuffer()));
      }
    }

    if (images.length === 0) {
      throw new ProviderRequestError("openai returned no images");
    }

    return { images, kind: "sync" };
  },
  provider: "openai",
};
