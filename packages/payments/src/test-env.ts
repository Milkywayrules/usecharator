process.env.DATABASE_URL ??=
  "postgresql://charator:charator@localhost:5432/charator";
process.env.PAYMENT_WEBHOOK_SECRET ??= "test-payment-webhook-secret";
process.env.WEB_APP_URL ??= "http://localhost:3000";
