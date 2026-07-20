import { Suspense } from "react";
import MockCheckoutClient from "./mock-checkout-client";

export default function MockCheckoutPage() {
  return (
    <Suspense
      fallback={<p className="px-4 py-16 text-center text-sm">Loading…</p>}
    >
      <MockCheckoutClient />
    </Suspense>
  );
}
