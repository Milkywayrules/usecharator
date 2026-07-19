"use client";

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import type * as React from "react";
import { asChildRender } from "@/lib/as-child";
import { cn } from "@/lib/utils";

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({
  asChild = false,
  children,
  ...props
}: SheetPrimitive.Trigger.Props & {
  asChild?: boolean;
}) {
  const { render, children: childContent } = asChildRender(asChild, children);

  return (
    <SheetPrimitive.Trigger
      data-slot="sheet-trigger"
      render={render}
      {...props}
    >
      {childContent}
    </SheetPrimitive.Trigger>
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Backdrop className="data-[closed]:fade-out-0 data-[open]:fade-in-0 fixed inset-0 z-50 bg-black/60 data-[closed]:animate-out data-[open]:animate-in" />
      <SheetPrimitive.Popup
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-background shadow-lg transition ease-in-out data-[closed]:animate-out data-[open]:animate-in data-[closed]:duration-300 data-[open]:duration-500",
          side === "right" &&
            "data-[closed]:slide-out-to-right data-[open]:slide-in-from-right inset-y-0 right-0 h-full w-full max-w-lg border-l",
          side === "left" &&
            "data-[closed]:slide-out-to-left data-[open]:slide-in-from-left inset-y-0 left-0 h-full w-full max-w-lg border-r",
          className
        )}
        data-slot="sheet-content"
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Popup>
    </SheetPrimitive.Portal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 p-4", className)}
      data-slot="sheet-header"
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      className={cn("font-semibold text-foreground", className)}
      data-slot="sheet-title"
      {...props}
    />
  );
}

export { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger };
