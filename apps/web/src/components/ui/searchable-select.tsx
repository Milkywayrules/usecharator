"use client";

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchableSelectProps {
  className?: string;
  disabled?: boolean;
  id?: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  value: string;
}

export function SearchableSelect({
  className,
  disabled,
  id,
  onChange,
  options,
  placeholder = "Select…",
  value,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return options;
    }
    return options.filter((option) => option.toLowerCase().includes(q));
  }, [options, query]);

  const label = value || placeholder;

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger asChild>
        <Button
          className={cn("w-full justify-between font-normal", className)}
          disabled={disabled}
          id={id}
          type="button"
          variant="outline"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDownIcon className="size-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-(--anchor-width) p-2">
        <Input
          className="mb-2 h-8"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search…"
          value={query}
        />
        <div className="max-h-56 overflow-y-auto">
          <DropdownMenuItem
            onSelect={() => {
              onChange("");
              setOpen(false);
              setQuery("");
            }}
          >
            <span className="text-muted-foreground">Clear</span>
          </DropdownMenuItem>
          {filtered.map((option) => (
            <DropdownMenuItem
              key={option}
              onSelect={() => {
                onChange(option);
                setOpen(false);
                setQuery("");
              }}
            >
              <span className="flex-1 truncate">{option}</span>
              {value === option ? <CheckIcon className="size-4" /> : null}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
