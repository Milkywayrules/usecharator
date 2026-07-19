"use client";

import { XIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TagInputProps {
  className?: string;
  onChange: (values: string[]) => void;
  placeholder?: string;
  values: string[];
}

export function TagInput({
  className,
  onChange,
  placeholder = "Type and press Enter",
  values,
}: TagInputProps) {
  const [draft, setDraft] = useState("");

  function commitTag(raw: string) {
    const next = raw.trim();
    if (!next || values.includes(next)) {
      return;
    }
    onChange([...values, next]);
    setDraft("");
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <Badge className="gap-1 pr-1" key={value} variant="secondary">
            {value}
            <button
              aria-label={`Remove ${value}`}
              className="rounded-full p-0.5 hover:bg-background/40"
              onClick={() => onChange(values.filter((item) => item !== value))}
              type="button"
            >
              <XIcon className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitTag(draft);
          }
          if (event.key === "Backspace" && !draft && values.length > 0) {
            onChange(values.slice(0, -1));
          }
        }}
        placeholder={placeholder}
        value={draft}
      />
    </div>
  );
}
