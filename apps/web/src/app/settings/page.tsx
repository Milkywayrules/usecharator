"use client";

import {
  type Provider,
  providerModelOptions,
  providerSchema,
} from "@charator/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CopyIcon, MoonIcon, SunIcon, Trash2Icon } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  createApiToken,
  createProviderKey,
  deleteProviderKey,
  listApiTokens,
  listProviderKeys,
  revokeApiToken,
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
  const [tokenName, setTokenName] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const keysQuery = useQuery({
    enabled: signedIn,
    queryFn: listProviderKeys,
    queryKey: ["provider-keys"],
  });

  const tokensQuery = useQuery({
    enabled: signedIn,
    queryFn: listApiTokens,
    queryKey: ["api-tokens"],
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

  const createTokenMutation = useMutation({
    mutationFn: async () => createApiToken({ name: tokenName.trim() }),
    onError: () => toast.error("Could not create API token"),
    onSuccess: (result) => {
      setCreatedToken(result.token);
      setTokenDialogOpen(true);
      setTokenName("");
      queryClient.invalidateQueries({ queryKey: ["api-tokens"] });
    },
  });

  const revokeTokenMutation = useMutation({
    mutationFn: revokeApiToken,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["api-tokens"] }),
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
        <>
          <Card>
            <CardHeader>
              <CardTitle>API tokens</CardTitle>
              <CardDescription>
                Programmatic access for CLI and integrations. Tokens are shown
                once at creation.{" "}
                <a
                  className="text-primary underline-offset-4 hover:underline"
                  href="/api/v1/docs"
                  rel="noreferrer"
                  target="_blank"
                >
                  Open API docs
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-2">
                {(tokensQuery.data ?? []).map((token) => (
                  <li
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                    key={token.id}
                  >
                    <div>
                      <p className="font-medium">{token.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {token.prefix} · created{" "}
                        {new Date(token.createdAt).toLocaleDateString()}
                        {token.lastUsedAt
                          ? ` · last used ${new Date(token.lastUsedAt).toLocaleDateString()}`
                          : ""}
                        {token.revokedAt ? " · revoked" : ""}
                      </p>
                    </div>
                    <Button
                      disabled={Boolean(token.revokedAt)}
                      onClick={() =>
                        setRevokeTarget({ id: token.id, name: token.name })
                      }
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
                  <Label>Token name</Label>
                  <Input
                    onChange={(e) => setTokenName(e.target.value)}
                    placeholder="CLI on laptop"
                    value={tokenName}
                  />
                </div>
                <Button
                  disabled={!tokenName.trim() || createTokenMutation.isPending}
                  onClick={() => createTokenMutation.mutate()}
                  type="button"
                >
                  Create token
                </Button>
              </div>
            </CardContent>
          </Card>

          <Dialog
            onOpenChange={(open) => {
              setTokenDialogOpen(open);
              if (!open) {
                setCreatedToken(null);
              }
            }}
            open={tokenDialogOpen}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Copy your API token</DialogTitle>
                <DialogDescription>
                  This token is shown only once. Store it securely — you cannot
                  view it again after closing this dialog.
                </DialogDescription>
              </DialogHeader>
              {createdToken ? (
                <div className="space-y-4">
                  <pre className="overflow-x-auto rounded-lg border bg-secondary/40 p-3 font-mono text-xs">
                    {createdToken}
                  </pre>
                  <Button
                    onClick={async () => {
                      await navigator.clipboard.writeText(createdToken);
                      toast.success("Token copied");
                    }}
                    type="button"
                    variant="outline"
                  >
                    <CopyIcon />
                    Copy token
                  </Button>
                </div>
              ) : null}
            </DialogContent>
          </Dialog>

          <Dialog
            onOpenChange={(open) => {
              if (!open) {
                setRevokeTarget(null);
              }
            }}
            open={Boolean(revokeTarget)}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Revoke API token?</DialogTitle>
                <DialogDescription>
                  {revokeTarget
                    ? `"${revokeTarget.name}" will stop working immediately. This cannot be undone.`
                    : null}
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setRevokeTarget(null)}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  disabled={!revokeTarget || revokeTokenMutation.isPending}
                  onClick={() => {
                    if (!revokeTarget) {
                      return;
                    }
                    revokeTokenMutation.mutate(revokeTarget.id, {
                      onSuccess: () => setRevokeTarget(null),
                    });
                  }}
                  type="button"
                  variant="default"
                >
                  Revoke token
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Card>
            <CardHeader>
              <CardTitle>Server provider keys</CardTitle>
              <CardDescription>
                Encrypted keys stored on the server. Only masked hints are
                shown.
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
        </>
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
