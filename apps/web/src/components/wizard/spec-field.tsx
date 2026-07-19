"use client";

import type { CharacterSpec, FieldCatalogEntry } from "@charator/spec";
import type { Control, FieldPath } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";
import { TagInput } from "@/components/ui/tag-input";
import { Textarea } from "@/components/ui/textarea";

interface SpecFieldProps {
  control: Control<CharacterSpec>;
  entry: FieldCatalogEntry;
  error?: string;
}

export function SpecField({ control, entry, error }: SpecFieldProps) {
  const path = entry.path as FieldPath<CharacterSpec>;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={entry.path}>{entry.label}</Label>
        {entry.tier === "core" ? <Badge variant="core">Core</Badge> : null}
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        {entry.description}
      </p>
      <Controller
        control={control}
        name={path}
        render={({ field }) => {
          if (entry.kind === "enum" && entry.options) {
            return (
              <SearchableSelect
                onChange={field.onChange}
                options={entry.options}
                value={String(field.value ?? "")}
              />
            );
          }
          if (entry.kind === "bool") {
            return (
              <Switch
                checked={field.value === true}
                onCheckedChange={(checked) =>
                  field.onChange(checked ? true : null)
                }
              />
            );
          }
          if (entry.kind === "list") {
            return (
              <TagInput
                onChange={field.onChange}
                values={Array.isArray(field.value) ? field.value : []}
              />
            );
          }
          const isLong =
            entry.path.includes("notes") ||
            entry.path.includes("freeform") ||
            entry.path.includes("prompt_extra");
          if (isLong) {
            return (
              <Textarea
                id={entry.path}
                onChange={field.onChange}
                rows={3}
                value={String(field.value ?? "")}
              />
            );
          }
          return (
            <Input
              id={entry.path}
              onChange={field.onChange}
              value={String(field.value ?? "")}
            />
          );
        }}
      />
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
