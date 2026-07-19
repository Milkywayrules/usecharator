"use client";

import {
  type CharacterSpec,
  CORE_PATHS,
  countCoreFilled,
  getTheme,
  renderPrompt,
  type ThemeId,
  validateSpecForGenerate,
} from "@charator/spec";
import { ExportSpecButton } from "@/components/spec/export-spec-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ReviewStepProps {
  spec: CharacterSpec;
  themeId: ThemeId | null;
}

export function ReviewStep({ spec, themeId }: ReviewStepProps) {
  const validation = validateSpecForGenerate(spec);
  const theme = themeId ? getTheme(themeId) : null;
  const promptPreview = renderPrompt(
    spec,
    themeId ? { theme: themeId } : undefined
  ).slice(0, 480);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-semibold text-2xl tracking-tight">
          Review
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Confirm your character before generating.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="py-4">
          <CardHeader className="px-4 pb-1">
            <CardTitle className="text-sm">Name</CardTitle>
          </CardHeader>
          <CardContent className="px-4 font-medium">
            {spec.meta.name || "Untitled"}
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardHeader className="px-4 pb-1">
            <CardTitle className="text-sm">Theme</CardTitle>
          </CardHeader>
          <CardContent className="px-4 font-medium">
            {theme ? theme.label : "None selected"}
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardHeader className="px-4 pb-1">
            <CardTitle className="text-sm">Core progress</CardTitle>
          </CardHeader>
          <CardContent className="px-4 font-medium tabular-nums">
            {countCoreFilled(spec)}/{CORE_PATHS.length}
          </CardContent>
        </Card>
      </div>

      {validation.ok ? (
        <Badge variant="secondary">Ready to generate</Badge>
      ) : (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
          <p className="mb-2 font-medium text-destructive text-sm">
            Fix before generating
          </p>
          <ul className="space-y-1 text-destructive/90 text-xs">
            {validation.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border bg-card/60 p-4">
        <p className="mb-2 font-medium text-sm">Prompt excerpt</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {promptPreview}
          {promptPreview.length >= 480 ? "…" : ""}
        </p>
      </div>

      <ExportSpecButton spec={spec} themeId={themeId} />
    </div>
  );
}
