"use client";

import { listThemes, type ThemeId } from "@charator/spec";
import { CheckIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ThemeStepProps {
  onSelect: (themeId: ThemeId) => void;
  selected: ThemeId | null;
}

export function ThemeStep({ onSelect, selected }: ThemeStepProps) {
  const themes = listThemes();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-semibold text-2xl tracking-tight">
          Visual theme
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Pick an art direction layered onto your character prompt.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {themes.map((theme) => {
          const active = selected === theme.id;
          return (
            <button
              className="text-left"
              key={theme.id}
              onClick={() => onSelect(theme.id)}
              type="button"
            >
              <Card
                className={cn(
                  "h-full cursor-pointer transition-all hover:border-accent/50",
                  active && "border-accent ring-2 ring-accent/30"
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{theme.label}</CardTitle>
                    {active ? (
                      <CheckIcon className="size-4 shrink-0 text-accent" />
                    ) : null}
                  </div>
                  <CardDescription>{theme.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {theme.promptFlavor.join(" · ")}
                  </p>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}
