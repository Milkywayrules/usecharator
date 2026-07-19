import {
  getModelCapabilityDescriptor,
  PROVIDER_CAPABILITY_DESCRIPTORS,
} from "./provider-capabilities";
import type { Provider } from "./providers";

export interface ReferenceCapableModel {
  label: string;
  modelId: string;
  provider: Provider;
}

export function listReferenceCapableModels(): ReferenceCapableModel[] {
  const models: ReferenceCapableModel[] = [];
  for (const provider of PROVIDER_CAPABILITY_DESCRIPTORS) {
    for (const model of provider.models) {
      if (model.supportsReferenceImages.kind === "supported") {
        models.push({
          label: model.label,
          modelId: model.id,
          provider: provider.provider,
        });
      }
    }
  }
  return models;
}

export function formatReferenceCapableAlternatives(): string {
  const models = listReferenceCapableModels();
  if (models.length === 0) {
    return "no models currently support reference images";
  }
  return models
    .map((entry) => `${entry.provider}/${entry.modelId} (${entry.label})`)
    .join("; ");
}

export function modelSupportsReferenceImages(
  provider: Provider,
  modelId: string
): boolean {
  return (
    getModelCapabilityDescriptor(provider, modelId)?.supportsReferenceImages
      .kind === "supported"
  );
}

export function modelSupportsReferenceStrength(
  provider: Provider,
  modelId: string
): boolean {
  return (
    getModelCapabilityDescriptor(provider, modelId)
      ?.supportsReferenceStrength === true
  );
}

export function referenceImageMaxCount(
  provider: Provider,
  modelId: string
): number {
  const capability = getModelCapabilityDescriptor(
    provider,
    modelId
  )?.supportsReferenceImages;
  if (capability?.kind === "supported") {
    return capability.maxCount;
  }
  return 0;
}
