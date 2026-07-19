import type * as React from "react";
import { cn } from "@/lib/utils";

function Progress({
  className,
  value = 0,
  ...props
}: React.ComponentProps<"div"> & { value?: number }) {
  return (
    <div
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
        className
      )}
      data-slot="progress"
      {...props}
    >
      <div
        className="h-full bg-accent transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export { Progress };
