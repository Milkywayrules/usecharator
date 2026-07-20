"use client";

import { GithubIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

interface SignInButtonProps extends ComponentProps<typeof Button> {
  label?: string;
}

export function SignInButton({
  className,
  label = "Sign in",
  variant = "outline",
  ...props
}: SignInButtonProps) {
  return (
    <Button
      className={className}
      onClick={() =>
        authClient.signIn.social({
          callbackURL: window.location.pathname,
          provider: "github",
        })
      }
      size="default"
      type="button"
      variant={variant}
      {...props}
    >
      <GithubIcon />
      {label}
    </Button>
  );
}
