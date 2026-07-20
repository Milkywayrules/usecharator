# Chara Tor

Wizard-driven character image generator. Users bring their own API keys (BYOK) for image providers. Characters are defined by a structured 13-section spec with 11 visual theme presets.

## Features

- **Spec wizard** — 13-section character spec with import/export, 11 theme presets, and deterministic prompt rendering
- **BYOK generation** — six providers (OpenRouter, OpenAI, Google Gemini, fal.ai, Replicate, custom OpenAI-compatible); reference-image anchors, aspect ratios, and per-model capability presets
- **Character sheets** — batch multi-pose sheet generation from library characters
- **Workspaces** — multi-tenant workspaces with shared characters, keys, and entitlements
- **Pricing tiers** — Free, Plus, Pro, Studio with mock billing adapter (Stripe/Polar-ready seam)
- **Public gallery** — browse, search, remix, and moderation for public characters
- **Public API v1** — bearer tokens, OpenAPI docs at `/api/v1/docs`, legacy web routes under `/api/*`
- **MCP server** — stdio MCP for themes, spec render, characters, generations, and gallery (`apps/mcp`)
- **CLI** — Bun CLI wrapping `/api/v1` (`apps/cli`)
- **Telegram** — notify-only bot when generation jobs finish (link from Settings)
- **Testing & CI** — Playwright e2e suite; GitHub Actions fast, integration, and e2e jobs on every push/PR

Deployed as one Coolify docker-compose resource on a VPS at [charator.dioilham.com](https://charator.dioilham.com) — Cloudflare DNS, `/` → Next.js, `/api/*` → Elysia (same-origin). Postgres for data, Cloudflare R2 for images, Doppler for secrets, Umami for analytics.

## Repo layout

```
apps/
  web/          Next.js App Router + Tailwind v4 + shadcn/ui
  api/          Elysia on Bun (/api prefix)
  cli/          REST API CLI (`charator`)
  mcp/          MCP server (stdio)
packages/
  spec/         Character spec types, themes, render engine
  shared/       Shared Zod schemas and utilities
  db/           Drizzle ORM + Postgres schema
  payments/     PaymentProvider interface + mock adapter
```

## Prerequisites

- [Bun](https://bun.sh) 1.3+
- [Docker](https://docs.docker.com/get-docker/) (for local Postgres)

## Dev quickstart

```bash
# install dependencies
bun install

# start Postgres
docker compose up -d postgres

# copy env template and adjust if needed
cp .env.example .env

# apply database migrations
bun run --filter=@charator/db db:migrate

# run web + api in dev mode
bun dev
```

Optional — assign a pricing tier manually (bypasses billing webhooks):

```bash
bun scripts/tier-set.ts --user <email-or-id> --tier pro
```

## Billing (mock provider)

Platform tiers (Free, Plus, Pro, Studio) are enforced via entitlements. The default **`PAYMENT_PROVIDER=mock`** implements real gateway-shaped interfaces (`PaymentProvider` in `@charator/payments`) without collecting money:

- `POST /api/billing/checkout` — start checkout; returns a URL to `/billing/mock-checkout`
- `POST /api/billing/portal` — customer portal (mock manage page)
- `GET /api/billing/subscription` — subscription row + current tier
- `POST /api/billing/webhook` — provider-agnostic webhook receiver (`Payment-Signature` HMAC)
- `POST /api/billing/mock/complete` — dev/e2e helper that signs and dispatches `checkout.completed` through the webhook path

**Tier writes** (besides `tier:set`) happen only after a verified webhook event. Cancel-at-period-end keeps the paid tier until `currentPeriodEnd`; entitlements downgrade lazily on the next entitlement check after the period ends.

### Swapping in Stripe or Polar later

1. Implement `PaymentProvider` (`createCheckoutSession`, `createBillingPortalSession`, `getSubscription`, `cancelSubscription`, `verifyWebhook`).
2. Register the adapter in `getPaymentProvider()` and set `PAYMENT_PROVIDER`.
3. Point the provider webhook URL at `POST /api/billing/webhook` — the route and tier-write handler stay provider-agnostic.

Env vars: `PAYMENT_PROVIDER`, `PAYMENT_WEBHOOK_SECRET`, `WEB_APP_URL`. See `.env.example`.

`docker-compose.override.yml` maps Postgres to `${POSTGRES_PORT:-5432}` on the host for local dev. Production deploys (Coolify) use only the root compose file, so Postgres stays on the internal network.

- Web: http://localhost:3000
- API health: http://localhost:3001/api/health

## Scripts

| Command | Description |
| --- | --- |
| `bun dev` | Start all apps in dev mode (Turbo) |
| `bun run build` | Production build (Turbo) |
| `bun run lint` | Biome + Ultracite check |
| `bun run typecheck` | TypeScript `--noEmit` across workspaces |
| `bun run ci:smoke` | API + Postgres smoke checks (requires running API and `DATABASE_URL`) |
| `bun run prod:boot-check -- --env .env.production` | Validate production STOP env keys before deploy |
| `bun run e2e` | Playwright end-to-end tests (Chromium; see Testing below) |

## Testing

**Unit tests** — run across workspaces via Turbo:

```bash
bunx turbo test
```

**API contract tests** — Pact consumer tests write fixtures under `packages/contract-tests/pacts/`; provider verification replays them against a running API (`bun run contract:test`, `bun run contract:verify` with `PACT_PROVIDER_VERIFY=1`).

**End-to-end tests** — Playwright suite in `e2e/` (anonymous flows, degraded API without Postgres). Install Chromium once, then run:

```bash
bunx playwright install chromium
bun run e2e
```

The `e2e` script boots the API (dummy CI env) and Next.js dev server automatically unless servers are already running locally. HTML report on failure: `playwright-report/`.

## CI

GitHub Actions runs on every push to `main` and on pull requests (`.github/workflows/ci.yml`):

- **fast** — `bun install --frozen-lockfile`, then `bunx turbo build lint typecheck test` (Bun + Turbo caches).
- **integration** — Postgres 17 service, Drizzle migrations via `packages/db`, API boot with CI-only dummy auth/env secrets, then `scripts/ci-smoke.ts` (health, empty gallery, seeded read/write path).
- **e2e** — production web build, Playwright Chromium install, then `bun run e2e` (HTML report artifact on failure).

**Release gate:** deploy only from green `main`. Do not promote builds from failing or skipped CI runs.

## Deploy

Full step-by-step runbook: **[docs/DEPLOY.md](./docs/DEPLOY.md)** (Coolify, Doppler, DNS, R2, migrations, smoke checks).

Env key reference: **[docs/DOPPLER-KEYS.md](./docs/DOPPLER-KEYS.md)**.

Pre-deploy validation:

```bash
bun scripts/prod-boot-check.ts --env .env.production
```

Quick facts:

- **Coolify**: deploy root `docker-compose.yml` as one resource (`/` → web, `/api` → API).
- **Secrets**: Doppler → Coolify; API **STOP** keys listed in `docs/DOPPLER-KEYS.md`.
- **Migrations**: compose `migrate` service runs `db:migrate` before API starts.
- **Telegram** (optional): webhook registration command in `docs/DEPLOY.md`.

## Programmatic API

Stable programmatic routes live under `/api/v1/*`. Legacy `/api/*` paths remain for the web app.

- **Base URL (production):** `https://charator.dioilham.com`
- **Interactive docs:** `/api/v1/docs` (JSON spec at `/api/v1/docs/json`)
- **Auth:** create an API token in Settings (session required), then send `Authorization: Bearer ct_live_…` on resource routes. Token management routes accept session cookies only — a leaked token cannot mint more tokens.

Example — create a generation job with a saved provider key:

```bash
curl -sS -X POST "https://charator.dioilham.com/api/v1/generations" \
  -H "Authorization: Bearer ct_live_YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Modern anime illustration of a shrine guardian.",
    "provider": "openrouter",
    "providerKeyId": "YOUR_SAVED_KEY_UUID"
  }'
```

Public metadata (no auth): `GET /api/v1/themes`, `GET /api/v1/spec/catalog`, `POST /api/v1/spec/render`.

## Agent harness

Operational status and King-only blockers live in [`HARNESS-HUMAN-INPUT.md`](./HARNESS-HUMAN-INPUT.md). `HARNESS-START-FILE` is intentionally absent until King completes the live deploy checklist (section F) — agent epics continue without it.
