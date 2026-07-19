# Chara Tor

Wizard-driven character image generator. Users bring their own API keys (BYOK) for image providers (OpenRouter, OpenAI `gpt-image-1`, Google Gemini, fal.ai, Replicate, custom OpenAI-compatible endpoints). Characters are defined by a structured spec with theme presets (anime, manga, marvel comic, western cartoon, pixel, watercolor, 3D, chibi, semi-realistic).

Deployed as one Coolify docker-compose resource on a VPS at [charator.dioilham.com](https://charator.dioilham.com) — Cloudflare DNS, `/` → Next.js, `/api/*` → Elysia (same-origin). Postgres for data, Cloudflare R2 for images, Doppler for secrets, Umami for analytics.

## Repo layout

```
apps/
  web/          Next.js App Router + Tailwind v4 + shadcn/ui
  api/          Elysia on Bun (/api prefix)
packages/
  spec/         Character spec types (Epic 1.2)
  shared/       Shared utilities
  db/           Drizzle ORM + Postgres schema (Epic 1.3)
```

## Prerequisites

- [Bun](https://bun.sh) 1.3+
- [Docker](https://docs.docker.com/get-docker/) (for local Postgres)

## Dev quickstart

```bash
# install dependencies
bun install

# start Postgres (optional for Epic 1.1 — schema comes in 1.3)
docker compose up -d postgres

# copy env template and adjust if needed
cp .env.example .env

# run web + api in dev mode
bun dev
```

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
| `bun run e2e` | Playwright end-to-end tests (Chromium; see Testing below) |

## Testing

**Unit tests** — run across workspaces via Turbo:

```bash
bunx turbo test
```

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

**Release gate:** deploy only from green `main`. Do not promote builds from failing or skipped CI runs.

## Deploy notes

- **Coolify**: deploy the root `docker-compose.yml` as a single resource.
- **Secrets**: inject via Doppler in Coolify — do not commit `.env` files.
- **DNS**: point `charator.dioilham.com` to the VPS through Cloudflare.
- **Routing**: Traefik labels in `docker-compose.yml` route `/` to web and `/api` to the API service.
- **Telegram notifications**: set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and optionally `TELEGRAM_BOT_USERNAME` on the API service, then register the webhook once (replace `<token>` and `<secret>`):

```bash
curl -sS "https://api.telegram.org/bot<token>/setWebhook?url=https://charator.dioilham.com/api/webhooks/telegram&secret_token=<secret>"
```

The bot is notify-only — users link their account from Settings via a one-time code and get a DM when generation jobs finish.

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

## Epic 1.1 scope

This foundation epic sets up the monorepo, skeleton apps, Drizzle placeholder, and deploy artifacts. Spec engine, provider adapters, auth, and wizard UI land in later epics.
