"use client";

import {
  type CreateGenerationRequest,
  formatCostEstimatePerImage,
  GENERATION_PRESETS,
  getGenerationCostEstimate,
  getModelCapabilityDescriptor,
  type Provider,
  presetsForTheme,
  providerModelDefaults,
  providerModelOptions,
  providerSchema,
} from "@charator/shared";
import {
  type CharacterSpec,
  getTheme,
  renderPrompt,
  type ThemeId,
  validateSpecForGenerate,
} from "@charator/spec";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  getProviderCapabilities,
  listProviderKeys,
  postGeneration,
} from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { getLocalKey, maskApiKey, setLocalKey } from "@/lib/local-keys";
import {
  fileToDataUrl,
  validateReferenceFile,
} from "@/lib/reference-image-client";

interface GeneratePanelProps {
  characterAnchorUrl?: string | null;
  characterId?: string;
  spec: CharacterSpec;
  themeId: ThemeId | null;
}

export function GeneratePanel({
  characterAnchorUrl,
  characterId,
  spec,
  themeId,
}: GeneratePanelProps) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session?.user);

  const [provider, setProvider] = useState<Provider>("openrouter");
  const [model, setModel] = useState(providerModelDefaults.openrouter);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [providerKeyId, setProviderKeyId] = useState<string>("");
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [useAnchor, setUseAnchor] = useState(Boolean(characterAnchorUrl));
  const [referenceStrength, setReferenceStrength] = useState(0.7);
  const [localReferenceDataUrl, setLocalReferenceDataUrl] = useState<
    string | null
  >(null);
  const [referenceFileError, setReferenceFileError] = useState<string | null>(
    null
  );

  const providers = providerSchema.options;

  useQuery({
    queryFn: getProviderCapabilities,
    queryKey: ["provider-capabilities"],
  });

  const modelDescriptor = useMemo(
    () => getModelCapabilityDescriptor(provider, model),
    [provider, model]
  );

  const costEstimate = useMemo(
    () => getGenerationCostEstimate(provider, model),
    [provider, model]
  );

  const modelSupportsRefs =
    modelDescriptor?.supportsReferenceImages.kind === "supported";
  const modelSupportsStrength =
    modelDescriptor?.supportsReferenceStrength === true;
  const anchorActive = signedIn
    ? Boolean(characterAnchorUrl && useAnchor)
    : Boolean(localReferenceDataUrl);
  const refBlocked = anchorActive && !modelSupportsRefs;

  const suggestedPresets = useMemo(() => {
    const themed = themeId ? presetsForTheme(themeId) : GENERATION_PRESETS;
    return themed.slice(0, 4);
  }, [themeId]);

  const keysQuery = useQuery({
    enabled: signedIn,
    queryFn: listProviderKeys,
    queryKey: ["provider-keys"],
  });

  useEffect(() => {
    if (!signedIn) {
      const stored = getLocalKey(provider);
      if (stored) {
        setApiKeyInput(stored);
      }
    }
  }, [provider, signedIn]);

  useEffect(() => {
    setModel(providerModelDefaults[provider]);
    setSelectedPresetId(null);
  }, [provider]);

  useEffect(() => {
    if (characterAnchorUrl) {
      setUseAnchor(true);
    }
  }, [characterAnchorUrl]);

  const applyPreset = (presetId: string) => {
    const preset = GENERATION_PRESETS.find((entry) => entry.id === presetId);
    if (!preset) {
      return;
    }
    setProvider(preset.provider);
    setModel(preset.model);
    setSelectedPresetId(preset.id);
  };

  const mutation = useMutation({
    mutationFn: () => {
      if (refBlocked) {
        throw new Error(
          "Selected model does not support reference images — pick a ref-capable model"
        );
      }

      const validation = validateSpecForGenerate(spec);
      if (!validation.ok) {
        throw new Error(validation.errors.join("; "));
      }
      if (!themeId) {
        throw new Error("Select a visual theme first");
      }

      const theme = getTheme(themeId);
      const prompt = renderPrompt(spec, { theme: themeId });
      const negativePrompt = theme.negativePrompts.join(", ");

      const aspectRatio = spec.generation.aspect_ratio;
      const body: CreateGenerationRequest = {
        ...(aspectRatio === "1:1" ||
        aspectRatio === "3:4" ||
        aspectRatio === "4:3" ||
        aspectRatio === "16:9" ||
        aspectRatio === "9:16"
          ? { aspectRatio }
          : {}),
        model,
        negativePrompt,
        prompt,
        provider,
        specSnapshot: spec,
        ...(signedIn && characterId ? { characterId } : {}),
        ...(signedIn && providerKeyId
          ? { providerKeyId }
          : { apiKey: apiKeyInput }),
        ...(signedIn && characterId && useAnchor && characterAnchorUrl
          ? { useCharacterAnchor: true }
          : {}),
        ...(!signedIn && localReferenceDataUrl
          ? { referenceImageDataUrl: localReferenceDataUrl }
          : {}),
        ...(modelSupportsStrength && anchorActive ? { referenceStrength } : {}),
      };

      return postGeneration(body);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSuccess: (data) => {
      if (!signedIn && apiKeyInput) {
        setLocalKey(provider, apiKeyInput);
      }
      router.push(`/generate/${data.jobId}`);
    },
  });

  const storedMasked = getLocalKey(provider)
    ? maskApiKey(getLocalKey(provider) ?? "")
    : null;

  async function onReferenceFileChange(file: File | null) {
    setReferenceFileError(null);
    if (!file) {
      setLocalReferenceDataUrl(null);
      return;
    }
    const checked = validateReferenceFile(file);
    if (!checked.ok) {
      setReferenceFileError(checked.error);
      setLocalReferenceDataUrl(null);
      return;
    }
    try {
      setLocalReferenceDataUrl(await fileToDataUrl(file));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "invalid reference image";
      setReferenceFileError(message);
      setLocalReferenceDataUrl(null);
    }
  }

  return (
    <div
      className="space-y-6 rounded-xl border bg-card/60 p-6"
      data-testid="generate-panel"
    >
      <div>
        <h2 className="font-display font-semibold text-lg">Generate image</h2>
        <p className="text-muted-foreground text-sm">
          BYOK — your API key never touches our servers unless you sign in and
          save keys for sync.
        </p>
      </div>

      {suggestedPresets.length > 0 ? (
        <div className="space-y-2">
          <Label>Suggested picks</Label>
          <div className="flex flex-wrap gap-2">
            {suggestedPresets.map((preset) => (
              <Button
                aria-pressed={selectedPresetId === preset.id}
                className="h-8 px-3 text-xs"
                key={preset.id}
                onClick={() => applyPreset(preset.id)}
                type="button"
                variant={selectedPresetId === preset.id ? "default" : "outline"}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Provider</Label>
          <Select
            onValueChange={(value) => {
              if (value) {
                setProvider(value as Provider);
              }
            }}
            value={provider}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providers.map((item) => (
                <SelectItem key={item} value={item}>
                  {providerModelOptions[item].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Model</Label>
          <Select
            onValueChange={(value) => {
              if (value) {
                setModel(value);
                setSelectedPresetId(null);
              }
            }}
            value={model}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providerModelOptions[provider].models.map((item) => {
                const descriptor = getModelCapabilityDescriptor(
                  provider,
                  item.id
                );
                const refCapable =
                  descriptor?.supportsReferenceImages.kind === "supported";
                return (
                  <SelectItem key={item.id} value={item.id}>
                    <span className="flex items-center gap-2">
                      {item.label}
                      {refCapable ? (
                        <Badge className="text-[10px]" variant="secondary">
                          ref
                        </Badge>
                      ) : null}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {signedIn && characterAnchorUrl ? (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="use-anchor">Use character anchor</Label>
            <Switch
              checked={useAnchor}
              data-testid="use-anchor-toggle"
              id="use-anchor"
              onCheckedChange={setUseAnchor}
            />
          </div>
          {useAnchor ? (
            <figure className="overflow-hidden rounded-md border">
              {/* biome-ignore lint/performance/noImgElement: presigned anchor url */}
              <img
                alt="Character anchor"
                className="max-h-40 w-full object-cover"
                src={characterAnchorUrl}
              />
            </figure>
          ) : null}
        </div>
      ) : null}

      {signedIn ? null : (
        <div className="space-y-2">
          <Label htmlFor="reference-file">Local reference image</Label>
          <Input
            accept="image/png,image/jpeg,image/webp"
            data-testid="reference-file-input"
            id="reference-file"
            onChange={(event) =>
              onReferenceFileChange(event.target.files?.[0] ?? null)
            }
            type="file"
          />
          {referenceFileError ? (
            <p
              className="text-destructive text-sm"
              data-testid="reference-file-error"
            >
              {referenceFileError}
            </p>
          ) : null}
        </div>
      )}

      {modelSupportsStrength && anchorActive ? (
        <div className="space-y-2">
          <Label htmlFor="reference-strength">
            Reference strength ({referenceStrength.toFixed(2)})
          </Label>
          <input
            className="w-full"
            data-testid="reference-strength-slider"
            id="reference-strength"
            max={1}
            min={0}
            onChange={(event) =>
              setReferenceStrength(Number(event.target.value))
            }
            step={0.05}
            type="range"
            value={referenceStrength}
          />
        </div>
      ) : null}

      {refBlocked ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive text-sm"
          data-testid="reference-model-warning"
        >
          The selected model does not support reference images while an anchor
          is active. Choose a model with the ref badge or disable the anchor.
        </p>
      ) : null}

      {signedIn ? (
        <div className="space-y-2">
          <Label>Saved provider key</Label>
          <Select
            onValueChange={(value) => {
              if (value) {
                setProviderKeyId(value);
              }
            }}
            value={providerKeyId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a saved key" />
            </SelectTrigger>
            <SelectContent>
              {(keysQuery.data ?? [])
                .filter((key) => key.provider === provider)
                .map((key) => (
                  <SelectItem key={key.id} value={key.id}>
                    {key.label} ({key.hint})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>API key</Label>
          <Input
            onChange={(event) => setApiKeyInput(event.target.value)}
            placeholder="sk-…"
            type="password"
            value={apiKeyInput}
          />
          <p className="text-muted-foreground text-xs">
            Stored only in your browser
            {storedMasked ? ` (${storedMasked})` : ""}.
          </p>
        </div>
      )}

      {costEstimate ? (
        <p
          className="rounded-md border bg-muted/40 p-3 text-muted-foreground text-sm"
          data-testid="generate-cost-estimate"
        >
          {formatCostEstimatePerImage(costEstimate)}
        </p>
      ) : null}

      <Button
        disabled={mutation.isPending || refBlocked}
        onClick={() => mutation.mutate()}
        size="lg"
        type="button"
      >
        {mutation.isPending ? (
          <>
            <Loader2Icon className="animate-spin" />
            Submitting…
          </>
        ) : (
          "Generate"
        )}
      </Button>
    </div>
  );
}
