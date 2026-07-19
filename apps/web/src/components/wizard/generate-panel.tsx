"use client";

import {
  type CreateGenerationRequest,
  type Provider,
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
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { listProviderKeys, postGeneration } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { getLocalKey, maskApiKey, setLocalKey } from "@/lib/local-keys";

interface GeneratePanelProps {
  spec: CharacterSpec;
  themeId: ThemeId | null;
}

export function GeneratePanel({ spec, themeId }: GeneratePanelProps) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session?.user);

  const [provider, setProvider] = useState<Provider>("openrouter");
  const [model, setModel] = useState(providerModelDefaults.openrouter);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [providerKeyId, setProviderKeyId] = useState<string>("");

  const providers = providerSchema.options;

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
  }, [provider]);

  const mutation = useMutation({
    mutationFn: async () => {
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
        ...(signedIn && providerKeyId
          ? { providerKeyId }
          : { apiKey: apiKeyInput }),
      };

      const data = await postGeneration(body);
      return data;
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

  return (
    <div className="space-y-6 rounded-xl border bg-card/60 p-6">
      <div>
        <h2 className="font-display font-semibold text-lg">Generate image</h2>
        <p className="text-muted-foreground text-sm">
          BYOK — your API key never touches our servers unless you sign in and
          save keys for sync.
        </p>
      </div>

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
              }
            }}
            value={model}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providerModelOptions[provider].models.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

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
          <p className="text-muted-foreground text-xs">
            Manage keys in Settings. Only masked hints are shown here.
          </p>
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

      <Button
        disabled={mutation.isPending}
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
