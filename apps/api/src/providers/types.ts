import type { AspectRatio, Provider } from "@charator/shared";

export type GenerateInput = {
	prompt: string;
	negativePrompt?: string;
	aspectRatio?: AspectRatio;
	model: string;
	apiKey: string;
	baseUrl?: string;
	webhookUrl?: string;
};

export type SyncGenerateResult = {
	kind: "sync";
	images: Uint8Array[];
	imageUrls?: string[];
};

export type AsyncGenerateResult = {
	kind: "async";
	providerJobId: string;
};

export type GenerateResult = SyncGenerateResult | AsyncGenerateResult;

export type PollResult =
	| { status: "running" }
	| { status: "succeeded"; images: Uint8Array[]; imageUrls?: string[] }
	| { status: "failed"; error: string };

export interface ProviderAdapter {
	generate(input: GenerateInput): Promise<GenerateResult>;
	parseWebhook?(
		body: unknown,
		headers: Headers,
	): {
		providerJobId: string;
		status: "succeeded" | "failed";
		imageUrls?: string[];
		error?: string;
	} | null;
	poll?(
		providerJobId: string,
		apiKey: string,
		model: string,
	): Promise<PollResult>;
	readonly provider: Provider;
}

export class ProviderRequestError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ProviderRequestError";
	}
}

export async function readProviderError(response: Response): Promise<string> {
	const text = await response.text();
	try {
		const json = JSON.parse(text) as {
			error?: { message?: string };
			detail?: string;
		};
		return json.error?.message ?? json.detail ?? text.slice(0, 240);
	} catch {
		return text.slice(0, 240) || `provider request failed (${response.status})`;
	}
}

export function aspectRatioToOpenAiSize(aspectRatio?: AspectRatio): string {
	switch (aspectRatio) {
		case "16:9":
			return "1536x1024";
		case "9:16":
			return "1024x1536";
		case "4:3":
			return "1536x1152";
		case "3:4":
			return "1152x1536";
		default:
			return "1024x1024";
	}
}

export function decodeBase64Image(data: string): Uint8Array {
	return Uint8Array.from(Buffer.from(data, "base64"));
}

export async function downloadImages(urls: string[]): Promise<Uint8Array[]> {
	return Promise.all(
		urls.map(async (url) => {
			const response = await fetch(url);
			if (!response.ok) {
				throw new ProviderRequestError(
					`failed to fetch image (${response.status})`,
				);
			}
			return new Uint8Array(await response.arrayBuffer());
		}),
	);
}
