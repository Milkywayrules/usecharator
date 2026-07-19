"use client";

import {
  type CreateSheetRequest,
  getModelCapabilityDescriptor,
  type Provider,
  providerModelDefaults,
  providerModelOptions,
  providerSchema,
  type SheetPresetId,
} from "@charator/shared";
import { listSheetPresets, sheetVariantCount } from "@charator/spec";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { listProviderKeys, postCharacterSheet } from "@/lib/api-client";

interface SheetGenerateDialogProps {
  characterAnchorUrl?: string | null;
  characterId: string;
  characterName: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function SheetGenerateDialog({
  characterAnchorUrl,
  characterId,
  characterName,
  onOpenChange,
  open,
}: SheetGenerateDialogProps) {
  const router = useRouter();
  const presets = useMemo(() => listSheetPresets(), []);

  const [preset, setPreset] = useState<SheetPresetId>("turnaround");
  const [provider, setProvider] = useState<Provider>("openrouter");
  const [model, setModel] = useState(providerModelDefaults.openrouter);
  const [providerKeyId, setProviderKeyId] = useState("");
  const [useAnchor, setUseAnchor] = useState(Boolean(characterAnchorUrl));

  const providers = providerSchema.options;
  const selectedPreset = presets.find((entry) => entry.id === preset);
  const estimatedCalls = sheetVariantCount(preset);

  const modelDescriptor = useMemo(
    () => getModelCapabilityDescriptor(provider, model),
    [provider, model]
  );
  const modelSupportsRefs =
    modelDescriptor?.supportsReferenceImages.kind === "supported";
  const anchorRequested = Boolean(characterAnchorUrl && useAnchor);
  const textOnlyAnchor = anchorRequested && !modelSupportsRefs;

  const keysQuery = useQuery({
    queryFn: listProviderKeys,
    queryKey: ["provider-keys"],
  });

  useEffect(() => {
    setModel(providerModelDefaults[provider]);
  }, [provider]);

  useEffect(() => {
    if (characterAnchorUrl) {
      setUseAnchor(true);
    }
  }, [characterAnchorUrl]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!providerKeyId) {
        throw new Error("Select a saved provider key");
      }
      const body: CreateSheetRequest = {
        model,
        preset,
        provider,
        providerKeyId,
        ...(useAnchor && characterAnchorUrl ? { useAnchor: true } : {}),
      };
      return postCharacterSheet(characterId, body);
    },
    onError: (error: Error) => toast.error(error.message),
    onSuccess: (data) => {
      toast.success("Sheet batch queued");
      onOpenChange(false);
      router.push(`/sheets/${data.batchId}`);
    },
  });

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg" data-testid="sheet-generate-dialog">
        <DialogHeader>
          <DialogTitle>Generate character sheet</DialogTitle>
          <DialogDescription>
            Batch preset for {characterName}. Each variant becomes its own
            generation job.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Sheet preset</Label>
            <Select
              onValueChange={(value) => {
                if (value) {
                  setPreset(value as SheetPresetId);
                }
              }}
              value={preset}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {presets.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.label} ({entry.variants.length} variants)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPreset ? (
              <ul className="text-muted-foreground text-xs">
                {selectedPreset.variants.map((variant) => (
                  <li key={variant.id}>
                    {variant.label} ({variant.id})
                  </li>
                ))}
              </ul>
            ) : null}
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

          {characterAnchorUrl ? (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="sheet-use-anchor">Use character anchor</Label>
                <Switch
                  checked={useAnchor}
                  id="sheet-use-anchor"
                  onCheckedChange={setUseAnchor}
                />
              </div>
              {useAnchor ? (
                <figure className="overflow-hidden rounded-md border">
                  {/* biome-ignore lint/performance/noImgElement: presigned anchor url */}
                  <img
                    alt="Character anchor"
                    className="max-h-32 w-full object-cover"
                    src={characterAnchorUrl}
                  />
                </figure>
              ) : null}
            </div>
          ) : null}

          {textOnlyAnchor ? (
            <p
              className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-amber-900 text-sm dark:text-amber-100"
              data-testid="sheet-text-only-notice"
            >
              Use character anchor requires a reference-capable model. Choose a
              model marked ref or turn off the anchor toggle.
            </p>
          ) : null}

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

          <p
            className="rounded-md border bg-muted/40 p-3 text-sm"
            data-testid="sheet-cost-estimate"
          >
            This will make <strong>{estimatedCalls} provider calls</strong> with
            your key.
          </p>

          <Button
            className="w-full"
            disabled={mutation.isPending || !providerKeyId || textOnlyAnchor}
            onClick={() => mutation.mutate()}
            type="button"
          >
            {mutation.isPending ? (
              <>
                <Loader2Icon className="animate-spin" />
                Starting sheet…
              </>
            ) : (
              "Generate sheet"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
