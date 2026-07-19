import * as React from "react";

export function asChildRender(
  asChild: boolean | undefined,
  children: React.ReactNode
): { children?: React.ReactNode; render?: React.ReactElement } {
  if (asChild && React.isValidElement(children)) {
    return { render: children };
  }

  return { children };
}
