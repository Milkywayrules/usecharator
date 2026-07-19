"use client";

import {
  type Provider,
  providerModelOptions,
  providerSchema,
} from "@charator/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoonIcon, SunIcon, Trash2Icon } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";
import { SignInButton } from "@/components/auth/sign-in-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createProviderKey,
  deleteProviderKey,
  listProviderKeys,
} from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import {
  clearLocalKey,
  getLocalKey,
  maskApiKey,
  readLocalKeys,
  setLocalKey,
} from "@/lib/local-keys";

export default function SettingsPage() {
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session?.user);
  const { resolvedTheme, setTheme } = useTheme();
  const queryClient = useQueryClient();

  const [provider, setProvider] = useState<Provider>("openrouter");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [localDraft, setLocalDraft] = useState("");

  const keysQuery = useQuery({
    enabled: signedIn,
    queryFn: listProviderKeys,
    queryKey: ["provider-keys"],
  });

  const addKeyMutation = useMutation({
    mutationFn: async () => {
      await createProviderKey({
        apiKey,
        customBaseUrl: provider === "custom" ? customBaseUrl : undefined,
        label,
        provider,
      });
    },
    onError: () => toast.error("Could not save key"),
    onSuccess: async () => {
      toast.success("Key saved");
      setApiKey("");
      setLabel("");
      setCustomBaseUrl("");
      await queryClient.invalidateQueries({ queryKey: ["provider-keys"] });
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: deleteProviderKey,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["provider-keys"] }),
  });

  const localKeys = readLocalKeys();

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <div>
        <h1 className="font-display font-semibold text-3xl tracking-tight">
          Settings
        </h1>
        <p className="mt-2 text-muted-foreground">
          Provider keys, appearance, and account preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Toggle light or dark mode.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
            type="button"
            variant="outline"
          >
            {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
            {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
          </Button>
        </CardContent>
      </Card>

      {signedIn ? (
        <Card>
          <CardHeader>
            <CardTitle>Server provider keys</CardTitle>
            <CardDescription>
              Encrypted keys stored on the server. Only masked hints are shown.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ul className="space-y-2">
              {(keysQuery.data ?? []).map((key) => (
                <li
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  key={key.id}
                >
                  <div>
                    <p className="font-medium">{key.label}</p>
                    <p className="text-muted-foreground text-xs">
                      {providerModelOptions[key.provider].label} · {key.hint}
                    </p>
                  </div>
                  <Button
                    onClick={() => deleteKeyMutation.mutate(key.id)}
                    size="default"
                    type="button"
                    variant="outline"
                  >
                    <Trash2Icon />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="grid gap-4 border-t pt-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select
                  onValueChange={(value) => setProvider(value as Provider)}
                  value={provider}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {providerSchema.options.map((item) => (
                      <SelectItem key={item} value={item}>
                        {providerModelOptions[item].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  onChange={(e) => setLabel(e.target.value)}
                  value={label}
                />
              </div>
              <div className="space-y-2">
                <Label>API key</Label>
                <Input
                  onChange={(e) => setApiKey(e.target.value)}
                  type="password"
                  value={apiKey}
                />
              </div>
              {provider === "custom" ? (
                <div className="space-y-2">
                  <Label>Custom base URL</Label>
                  <Input
                    onChange={(e) => setCustomBaseUrl(e.target.value)}
                    placeholder="https://…"
                    value={customBaseUrl}
                  />
                </div>
              ) : null}
              <Button
                disabled={!(label && apiKey) || addKeyMutation.isPending}
                onClick={() => addKeyMutation.mutate()}
                type="button"
              >
                Add key
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Browser-stored keys</CardTitle>
            <CardDescription>
              Anonymous BYOK keys live only in this browser. Sign in to sync
              keys across devices.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ul className="space-y-2">
              {providerSchema.options.map((item) => {
                const stored = localKeys[item]?.apiKey;
                return (
                  <li
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                    key={item}
                  >
                    <div>
                      <p className="font-medium">
                        {providerModelOptions[item].label}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {stored ? maskApiKey(stored) : "Not set"}
                      </p>
                    </div>
                    {stored ? (
                      <Button
                        onClick={() => {
                          clearLocalKey(item);
                          toast.success("Key cleared");
                          window.location.reload();
                        }}
                        type="button"
                        variant="outline"
                      >
                        Clear
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <div className="grid gap-4 border-t pt-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select
                  onValueChange={(value) => {
                    setProvider(value as Provider);
                    setLocalDraft(getLocalKey(value as Provider) ?? "");
                  }}
                  value={provider}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {providerSchema.options.map((item) => (
                      <SelectItem key={item} value={item}>
                        {providerModelOptions[item].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>API key</Label>
                <Input
                  onChange={(e) => setLocalDraft(e.target.value)}
                  type="password"
                  value={localDraft}
                />
              </div>
              <Button
                disabled={!localDraft}
                onClick={() => {
                  setLocalKey(provider, localDraft);
                  toast.success("Key saved locally");
                }}
                type="button"
              >
                Save to browser
              </Button>
            </div>
            <div className="rounded-lg border bg-secondary/40 p-4">
              <p className="mb-3 text-sm">
                Sign in to store keys on the server and sync characters.
              </p>
              <SignInButton />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
