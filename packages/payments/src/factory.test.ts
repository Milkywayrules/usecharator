import { describe, expect, test } from "bun:test";
import { getPaymentProvider, resolvePaymentProviderConfig } from "./factory";

const UNKNOWN_PROVIDER_RE = /unknown PAYMENT_PROVIDER/;

describe("payment provider factory", () => {
  test("defaults to mock provider", () => {
    const config = resolvePaymentProviderConfig({});
    expect(config.paymentProvider).toBe("mock");
    expect(() => getPaymentProvider({} as never, config)).not.toThrow();
  });

  test("unknown provider throws at boot", () => {
    const config = resolvePaymentProviderConfig({
      PAYMENT_PROVIDER: "stripe",
    });
    expect(() => getPaymentProvider({} as never, config)).toThrow(
      UNKNOWN_PROVIDER_RE
    );
  });
});
