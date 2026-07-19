import type { Metadata } from "next";
import { SignInButton } from "@/components/auth/sign-in-button";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function SignInPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <h1 className="font-display font-semibold text-3xl tracking-tight">
        Sign in
      </h1>
      <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
        Connect with GitHub to sync characters and provider keys across devices.
      </p>
      <div className="mt-8">
        <SignInButton />
      </div>
    </div>
  );
}
