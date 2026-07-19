"use client";

import { GithubIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignInButton() {
  return (
    <Button
      onClick={() =>
        authClient.signIn.social({
          callbackURL: window.location.pathname,
          provider: "github",
        })
      }
      size="default"
      type="button"
      variant="outline"
    >
      <GithubIcon />
      Sign in
    </Button>
  );
}
