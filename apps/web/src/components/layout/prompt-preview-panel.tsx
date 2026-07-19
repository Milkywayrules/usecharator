"use client";

import {
  type CharacterSpec,
  renderPrompt,
  type ThemeId,
  validateSpec,
} from "@charator/spec";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface PromptPreviewPanelProps {
  className?: string;
  spec: CharacterSpec;
  themeId: ThemeId | null;
}

export function PromptPreviewPanel({
  className,
  spec,
  themeId,
}: PromptPreviewPanelProps) {
  const prompt = renderPrompt(spec, themeId ? { theme: themeId } : undefined);
  const validation = validateSpec(spec);

  return (
    <div
      className={cn("flex h-full flex-col", className)}
      data-testid="prompt-preview-panel"
    >
      <div className="border-b px-4 py-3">
        <h2 className="font-display font-semibold text-sm">Live prompt</h2>
        <p className="text-muted-foreground text-xs">
          Updates as you edit the spec
        </p>
      </div>
      {validation.ok ? null : (
        <div className="border-b bg-destructive/10 px-4 py-2">
          <p className="mb-1 font-medium text-destructive text-xs">
            Validation issues
          </p>
          <ul className="space-y-0.5 text-destructive/90 text-xs">
            {validation.errors.slice(0, 5).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      <ScrollArea className="flex-1 p-4">
        <pre className="whitespace-pre-wrap font-mono text-foreground/90 text-xs leading-relaxed">
          {prompt}
        </pre>
      </ScrollArea>
    </div>
  );
}
