import { aspectRatioToGeminiImageConfig } from "./aspect-ratio";
import {
  decodeBase64Image,
  encodeBase64Image,
  type GenerateInput,
  type ProviderAdapter,
  ProviderRequestError,
  readProviderError,
} from "./types";

function extractGeminiImages(payload: unknown): Uint8Array[] {
  const images: Uint8Array[] = [];
  const data = payload as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { data?: string; mimeType?: string };
          inline_data?: { data?: string; mime_type?: string };
        }>;
      };
    }>;
  };

  for (const candidate of data.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      const inline = part.inlineData ?? part.inline_data;
      if (inline?.data) {
        images.push(decodeBase64Image(inline.data));
      }
    }
  }

  return images;
}

export const geminiAdapter: ProviderAdapter = {
  async generate(input: GenerateInput) {
    const imageConfig = aspectRatioToGeminiImageConfig(input.aspectRatio);
    const parts: Record<string, unknown>[] = [];

    for (const ref of input.referenceImages ?? []) {
      if (!ref.bytes) {
        throw new ProviderRequestError(
          "gemini reference images require inline bytes"
        );
      }
      parts.push({
        inline_data: {
          data: encodeBase64Image(ref.bytes),
          mime_type: ref.mimeType,
        },
      });
    }

    parts.push({ text: input.prompt });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${input.model}:generateContent`;
    const response = await fetch(url, {
      body: JSON.stringify({
        contents: [{ parts }],
        ...(imageConfig
          ? {
              generationConfig: {
                imageConfig,
                responseModalities: ["TEXT", "IMAGE"],
              },
            }
          : {}),
      }),
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": input.apiKey,
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new ProviderRequestError(await readProviderError(response));
    }

    const payload = await response.json();
    const images = extractGeminiImages(payload);
    if (images.length === 0) {
      throw new ProviderRequestError("gemini returned no images");
    }

    return { images, kind: "sync" };
  },
  provider: "gemini",
};
