import type { Provider } from "./providers";

/** Conservative USD-per-image estimate for BYOK cost transparency. */
export interface GenerationCostEstimate {
  label: string;
  usdMax: number;
  usdMin: number;
}

type PricingEntry = GenerationCostEstimate & {
  modelId: string;
  provider: Provider;
};

/** Manual table — ranges are intentionally conservative; providers bill directly. */
const PROVIDER_PRICING_TABLE: readonly PricingEntry[] = [
  // OpenAI
  {
    label: "GPT Image 1",
    modelId: "gpt-image-1",
    provider: "openai",
    usdMax: 0.08,
    usdMin: 0.04,
  },
  {
    label: "DALL·E 3",
    modelId: "dall-e-3",
    provider: "openai",
    usdMax: 0.12,
    usdMin: 0.04,
  },
  {
    label: "DALL·E 2",
    modelId: "dall-e-2",
    provider: "openai",
    usdMax: 0.04,
    usdMin: 0.02,
  },
  // OpenRouter
  {
    label: "Gemini 2.5 Flash Image",
    modelId: "google/gemini-2.5-flash-image",
    provider: "openrouter",
    usdMax: 0.05,
    usdMin: 0.02,
  },
  {
    label: "Flux 2 Pro",
    modelId: "black-forest-labs/flux.2-pro",
    provider: "openrouter",
    usdMax: 0.1,
    usdMin: 0.05,
  },
  {
    label: "Flux Schnell",
    modelId: "black-forest-labs/flux-schnell",
    provider: "openrouter",
    usdMax: 0.01,
    usdMin: 0.003,
  },
  {
    label: "Stable Diffusion XL",
    modelId: "stability-ai/sdxl",
    provider: "openrouter",
    usdMax: 0.006,
    usdMin: 0.002,
  },
  // Google Gemini
  {
    label: "Gemini 2.5 Flash Image",
    modelId: "gemini-2.5-flash-image",
    provider: "gemini",
    usdMax: 0.04,
    usdMin: 0.02,
  },
  {
    label: "Gemini 3.1 Flash Image",
    modelId: "gemini-3.1-flash-image",
    provider: "gemini",
    usdMax: 0.06,
    usdMin: 0.03,
  },
  {
    label: "Imagen 3",
    modelId: "imagen-3.0-generate-002",
    provider: "gemini",
    usdMax: 0.08,
    usdMin: 0.04,
  },
  // fal.ai
  {
    label: "Flux Dev",
    modelId: "fal-ai/flux/dev",
    provider: "fal",
    usdMax: 0.05,
    usdMin: 0.025,
  },
  {
    label: "Flux Schnell",
    modelId: "fal-ai/flux/schnell",
    provider: "fal",
    usdMax: 0.01,
    usdMin: 0.003,
  },
  {
    label: "Ideogram Character",
    modelId: "fal-ai/ideogram/character",
    provider: "fal",
    usdMax: 0.15,
    usdMin: 0.08,
  },
  {
    label: "Flux Pro",
    modelId: "fal-ai/flux-pro",
    provider: "fal",
    usdMax: 0.08,
    usdMin: 0.05,
  },
  {
    label: "Recraft V3",
    modelId: "fal-ai/recraft-v3",
    provider: "fal",
    usdMax: 0.06,
    usdMin: 0.04,
  },
  // Replicate
  {
    label: "Flux Schnell",
    modelId: "black-forest-labs/flux-schnell",
    provider: "replicate",
    usdMax: 0.01,
    usdMin: 0.003,
  },
  {
    label: "Flux 2 Pro",
    modelId: "black-forest-labs/flux-2-pro",
    provider: "replicate",
    usdMax: 0.1,
    usdMin: 0.05,
  },
  {
    label: "Flux Dev",
    modelId: "black-forest-labs/flux-dev",
    provider: "replicate",
    usdMax: 0.05,
    usdMin: 0.025,
  },
  {
    label: "SDXL",
    modelId: "stability-ai/sdxl",
    provider: "replicate",
    usdMax: 0.006,
    usdMin: 0.002,
  },
  {
    label: "SDXL Lightning",
    modelId: "bytedance/sdxl-lightning-4step",
    provider: "replicate",
    usdMax: 0.003,
    usdMin: 0.001,
  },
  // Custom OpenAI-compatible
  {
    label: "Default image model",
    modelId: "dall-e-3",
    provider: "custom",
    usdMax: 0.12,
    usdMin: 0.04,
  },
];

export function getGenerationCostEstimate(
  provider: Provider,
  modelId: string
): GenerationCostEstimate | null {
  const entry = PROVIDER_PRICING_TABLE.find(
    (row) => row.provider === provider && row.modelId === modelId
  );
  if (!entry) {
    return null;
  }
  return {
    label: entry.label,
    usdMax: entry.usdMax,
    usdMin: entry.usdMin,
  };
}

const TRAILING_ZEROS = /0+$/;
const TRAILING_DOT = /\.$/;

function formatUsd(value: number): string {
  if (value >= 0.1) {
    return value.toFixed(2);
  }
  if (value >= 0.01) {
    return value
      .toFixed(3)
      .replace(TRAILING_ZEROS, "")
      .replace(TRAILING_DOT, "");
  }
  return value.toFixed(4).replace(TRAILING_ZEROS, "").replace(TRAILING_DOT, "");
}

/** Human-readable per-image range for generate panel copy. */
export function formatCostEstimatePerImage(
  estimate: GenerationCostEstimate
): string {
  return `~$${formatUsd(estimate.usdMin)}–$${formatUsd(estimate.usdMax)} per image · provider bills separately`;
}

/** Batch total for sheet presets (N × per-image range). */
export function scaleCostEstimate(
  estimate: GenerationCostEstimate,
  count: number
): GenerationCostEstimate {
  const safeCount = Math.max(0, Math.floor(count));
  return {
    label: estimate.label,
    usdMax: estimate.usdMax * safeCount,
    usdMin: estimate.usdMin * safeCount,
  };
}

/** Human-readable batch total for sheet dialog copy. */
export function formatCostEstimateBatchTotal(
  estimate: GenerationCostEstimate,
  count: number
): string {
  const total = scaleCostEstimate(estimate, count);
  return `~$${formatUsd(total.usdMin)}–$${formatUsd(total.usdMax)} estimated total · provider bills separately`;
}
