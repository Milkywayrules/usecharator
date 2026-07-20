process.env.DATABASE_URL ??=
  "postgresql://charator:charator@localhost:5432/charator";
process.env.BETTER_AUTH_SECRET ??= "01234567890123456789012345678901";
process.env.BETTER_AUTH_URL ??= "http://localhost:3001";
process.env.GITHUB_CLIENT_ID ??= "test-client-id";
process.env.GITHUB_CLIENT_SECRET ??= "test-client-secret";
process.env.KEY_ENCRYPTION_MASTER_KEY ??= Buffer.alloc(32, 3).toString(
  "base64"
);
process.env.PAYMENT_PROVIDER ??= "mock";
process.env.PAYMENT_WEBHOOK_SECRET ??= "test-payment-webhook-secret";
process.env.WEB_APP_URL ??= "http://localhost:3000";
process.env.MOCK_BILLING_ENABLED ??= "true";
