import { aspectRatioToOpenAiSize } from "./aspect-ratio";
import {
  decodeBase64Image,
  type GenerateInput,
  openAiInputFidelity,
  type ProviderAdapter,
  ProviderRequestError,
  readProviderError,
} from "./types";

export const openaiAdapter: ProviderAdapter = {
  async generate(input: GenerateInput) {
    if (input.referenceImages?.length) {
      return generateViaEdits(input);
    }

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

async function generateViaEdits(
  input: GenerateInput
): Promise<{ images: Uint8Array[]; kind: "sync" }> {
  const form = new FormData();
  form.append("model", input.model);
  form.append("prompt", input.prompt);
  form.append("size", aspectRatioToOpenAiSize(input.aspectRatio));

  for (const ref of input.referenceImages ?? []) {
    if (!ref.bytes) {
      throw new ProviderRequestError(
        "openai edits requires reference image bytes"
      );
    }
    const ext =
      ref.mimeType === "image/jpeg" ? "jpg" : ref.mimeType.split("/")[1];
    form.append(
      "image[]",
      new Blob([Buffer.from(ref.bytes)], { type: ref.mimeType }),
      `reference.${ext ?? "png"}`
    );
  }

  const inputFidelity = openAiInputFidelity(input.referenceStrength);
  if (inputFidelity) {
    form.append("input_fidelity", inputFidelity);
  }

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    body: form,
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
    },
    method: "POST",
  });

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
        throw new ProviderRequestError("failed to download openai edit image");
      }
      images.push(new Uint8Array(await imageResponse.arrayBuffer()));
    }
  }

  if (images.length === 0) {
    throw new ProviderRequestError("openai edits returned no images");
  }

  return { images, kind: "sync" };
}
