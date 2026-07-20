import { SiteHeader } from "@/components/layout/site-header";
import { OnboardingBanner } from "@/components/onboarding/onboarding-panel";
import { WizardDraftPromotion } from "@/components/onboarding/wizard-draft-promotion";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grain relative flex min-h-dvh flex-col">
      <SiteHeader />
      <WizardDraftPromotion />
      <OnboardingBanner />
      <main className="flex-1">{children}</main>
    </div>
  );
}
