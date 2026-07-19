import { customAdapter } from "./custom";
import { falAdapter } from "./fal";
import { geminiAdapter } from "./gemini";
import { openaiAdapter } from "./openai";
import { openrouterAdapter } from "./openrouter";
import { replicateAdapter } from "./replicate";
import type { ProviderAdapter } from "./types";

const adapters: ProviderAdapter[] = [
	openrouterAdapter,
	openaiAdapter,
	geminiAdapter,
	falAdapter,
	replicateAdapter,
	customAdapter,
];

export const providerRegistry = new Map(
	adapters.map((adapter) => [adapter.provider, adapter]),
);

export function getProviderAdapter(provider: string): ProviderAdapter {
	const adapter = providerRegistry.get(provider as never);
	if (!adapter) {
		throw new Error(`unsupported provider: ${provider}`);
	}
	return adapter;
}

export { adapters };
