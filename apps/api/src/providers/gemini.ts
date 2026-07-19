import {
	decodeBase64Image,
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
		const url = `https://generativelanguage.googleapis.com/v1beta/models/${input.model}:generateContent`;
		const response = await fetch(url, {
			body: JSON.stringify({
				contents: [{ parts: [{ text: input.prompt }] }],
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
