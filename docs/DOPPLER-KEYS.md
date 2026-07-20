# Doppler production keys

Reference for Coolify/Doppler injection. Generated from the API t3 env schema (`apps/api/src/config.ts`) and production boot guards (`apps/api/src/lib/startup-guards.ts`).

**Never commit secret values.** Use `openssl rand -base64 32` or `openssl rand -hex 32` where noted in [DEPLOY.md](./DEPLOY.md).

Legend:

| Column | Meaning |
| --- | --- |
| **Required** | **STOP** — API refuses to boot in `NODE_ENV=production` when missing or invalid |
| **Optional** | **CONTINUE** — warn at boot; feature degrades or stays off |

## Core

| Key | Required | Type / default | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | Yes | `production` | Must be `production` on VPS |
| `PORT` | No | `3001` | API listen port (compose sets explicitly) |
| `DATABASE_URL` | Yes | string | Postgres connection URL |
| `WEB_APP_URL` | No | `http://localhost:3000` | Public web origin for billing redirects; set to prod URL |

## Auth

| Key | Required | Type / default | Notes |
| --- | --- | --- | --- |
| `BETTER_AUTH_SECRET` | Yes | string (min 32) | Session signing — `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Yes | URL | Public site URL (`https://charator.dioilham.com`) |
| `GITHUB_CLIENT_ID` | Yes | string | Production GitHub OAuth app |
| `GITHUB_CLIENT_SECRET` | Yes | string | Production GitHub OAuth app |
| `KEY_ENCRYPTION_MASTER_KEY` | Yes | base64 (32 bytes) | BYOK key encryption — `openssl rand -base64 32` |

## R2 (object storage)

| Key | Required | Type / default | Notes |
| --- | --- | --- | --- |
| `R2_ACCOUNT_ID` | Yes | string | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | Yes | string | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | Yes | string | R2 API token secret |
| `R2_BUCKET` | Yes | string | Bucket name (e.g. `charator-prod`) |
| `R2_ENDPOINT` | Yes | URL | `https://{account_id}.r2.cloudflarestorage.com` |

## Webhooks (async providers)

| Key | Required | Type / default | Notes |
| --- | --- | --- | --- |
| `FAL_WEBHOOK_SECRET` | No | string | Inbound fal.ai webhook verification; poll fallback if unset |
| `REPLICATE_WEBHOOK_SECRET` | No | string | Inbound Replicate webhook verification; poll fallback if unset |

## Billing

| Key | Required | Type / default | Notes |
| --- | --- | --- | --- |
| `PAYMENT_PROVIDER` | No | `mock` | Mock adapter until Stripe/Polar |
| `PAYMENT_WEBHOOK_SECRET` | Yes | string | Must not be dev default; `openssl rand -hex 32` |
| `MOCK_BILLING_ENABLED` | Yes* | `"true"` \| `"false"` | Must be `false` or unset in prod (* `"true"` **STOP**s boot) |

## Telegram

| Key | Required | Type / default | Notes |
| --- | --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | No | string | Notify-only bot; feature off if unset |
| `TELEGRAM_BOT_USERNAME` | No | string | Optional display fallback |
| `TELEGRAM_WEBHOOK_SECRET` | No | string | `X-Telegram-Bot-Api-Secret-Token` header check |

## OpenTelemetry

| Key | Required | Type / default | Notes |
| --- | --- | --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | URL | Tracing disabled when unset |
| `OTEL_SERVICE_NAME` | No | `charator-api` | Service name for exported spans |

## Rate limits & generation tuning

| Key | Required | Type / default | Notes |
| --- | --- | --- | --- |
| `GENERATION_JOB_TIMEOUT_MS` | No | `300000` | Job timeout (ms) |
| `GENERATION_POLL_INTERVAL_MS` | No | `15000` | Provider poll interval (ms) |
| `PRESIGNED_URL_TTL_SECONDS` | No | `900` | R2 presigned URL TTL |
| `RATE_LIMIT_ANONYMOUS_PER_HOUR` | No | `10` | Anonymous API rate limit |
| `RATE_LIMIT_AUTHENTICATED_PER_HOUR` | No | `60` | Authenticated API rate limit |

## Compose-only (Postgres service)

Not parsed by API t3 schema; required by `docker-compose.yml` postgres service:

| Key | Required | Type / default | Notes |
| --- | --- | --- | --- |
| `POSTGRES_USER` | No | `charator` | Postgres superuser name |
| `POSTGRES_PASSWORD` | Yes* | string | Required when using bundled postgres (* compose) |
| `POSTGRES_DB` | No | `charator` | Database name |

## Web app (build-time, optional)

Inject on the **web** service in compose — not in API t3 schema:

| Key | Required | Type / default | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_UMAMI_SRC` | No | string | Umami script URL |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | No | string | Umami site ID |

## Local-only (do not put in Doppler prod)

| Key | Notes |
| --- | --- |
| `GH_TOKEN`, `GH_REPO` | GitHub CLI for local agent harness |
| `POSTGRES_PORT` | Host port override in `docker-compose.override.yml` dev only |
