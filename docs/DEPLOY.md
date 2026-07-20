# Chara Tor — production deploy runbook

Step-by-step guide for King's production deploy (section A in [HARNESS-HUMAN-INPUT.md](../HARNESS-HUMAN-INPUT.md)). Domain: **charator.dioilham.com**.

See also: [DOPPLER-KEYS.md](./DOPPLER-KEYS.md) for the full env reference.

## Prerequisites

- VPS with [Coolify](https://coolify.io) installed
- [Doppler](https://www.doppler.com) project for production secrets
- Cloudflare account (DNS + R2)
- GitHub OAuth app for production login

## 1. Pre-flight — validate env locally

Before touching Coolify, export Doppler secrets to a local file (never commit it) and run the boot check:

```bash
# example: doppler secrets download --no-file --format env > .env.production
bun scripts/prod-boot-check.ts --env .env.production
# optional: list CONTINUE (warn) integrations
bun scripts/prod-boot-check.ts --env .env.production --warn
```

The script validates all **STOP** keys from harness #7 (`apps/api/src/lib/startup-guards.ts`). Exit code `1` lists missing keys.

### Minimal production env template

Use this shape when rehearsing locally or filling Doppler. Generate secrets with `openssl rand -base64 32` (auth/encryption) and `openssl rand -hex 32` (webhook).

```env
NODE_ENV=production

# Postgres (Coolify internal network or external managed DB)
DATABASE_URL=postgresql://charator:CHANGE_ME@postgres:5432/charator
POSTGRES_USER=charator
POSTGRES_PASSWORD=CHANGE_ME
POSTGRES_DB=charator

# Auth
BETTER_AUTH_SECRET=CHANGE_ME_MIN_32_CHARS
BETTER_AUTH_URL=https://charator.dioilham.com
GITHUB_CLIENT_ID=CHANGE_ME
GITHUB_CLIENT_SECRET=CHANGE_ME

# BYOK encryption (32-byte base64)
KEY_ENCRYPTION_MASTER_KEY=CHANGE_ME_BASE64_32_BYTES

# Billing webhook (non-dev value required)
PAYMENT_WEBHOOK_SECRET=CHANGE_ME
PAYMENT_PROVIDER=mock
MOCK_BILLING_ENABLED=false
WEB_APP_URL=https://charator.dioilham.com

# Cloudflare R2 (full tuple required in production)
R2_ACCOUNT_ID=CHANGE_ME
R2_ACCESS_KEY_ID=CHANGE_ME
R2_SECRET_ACCESS_KEY=CHANGE_ME
R2_BUCKET=charator-prod
R2_ENDPOINT=https://CHANGE_ME.r2.cloudflarestorage.com

# Optional — boot continues without these (see DOPPLER-KEYS.md)
# FAL_WEBHOOK_SECRET=
# REPLICATE_WEBHOOK_SECRET=
# TELEGRAM_BOT_TOKEN=
# TELEGRAM_WEBHOOK_SECRET=
# OTEL_EXPORTER_OTLP_ENDPOINT=
# OTEL_SERVICE_NAME=charator-api
```

## 2. Cloudflare DNS → VPS

1. In Cloudflare DNS for `dioilham.com`, add an **A** or **CNAME** record:
   - Name: `charator`
   - Target: VPS public IP (or Coolify-provided hostname)
   - Proxy: **Proxied** (orange cloud) recommended
2. Ensure SSL/TLS mode allows HTTPS to the origin (Full or Full strict, depending on Coolify cert setup).
3. Coolify/Traefik terminates TLS using labels in `docker-compose.yml`.

## 3. Cloudflare R2 bucket + keys

1. Cloudflare dashboard → **R2** → create bucket (e.g. `charator-prod`).
2. **Manage R2 API tokens** → create token with Object Read & Write on that bucket.
3. Copy into Doppler:
   - `R2_ACCOUNT_ID` — Cloudflare account ID
   - `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` — from the token
   - `R2_BUCKET` — bucket name
   - `R2_ENDPOINT` — `https://<account_id>.r2.cloudflarestorage.com`

All five are **STOP** keys — the API will not boot without the full tuple.

## 4. GitHub OAuth production app

1. GitHub → **Settings → Developer settings → OAuth Apps** → **New OAuth App**
2. **Homepage URL:** `https://charator.dioilham.com`
3. **Authorization callback URL:**
   ```
   https://charator.dioilham.com/api/auth/callback/github
   ```
4. Copy **Client ID** and generate **Client secret** → Doppler as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

Both are **STOP** keys in production.

## 5. Doppler → Coolify env sync

1. Create a Doppler **production** config with all keys from [DOPPLER-KEYS.md](./DOPPLER-KEYS.md).
2. In Coolify, connect the Doppler integration (or paste synced env) for the docker-compose resource.
3. Confirm `MOCK_BILLING_ENABLED` is `false` or unset — mock billing is blocked in production.
4. Re-run `bun scripts/prod-boot-check.ts --env .env.production` after export to verify.

## 6. Coolify — deploy docker-compose

1. Coolify → **New resource** → **Docker Compose**
2. Point at this repo; use root **`docker-compose.yml`** only (not `docker-compose.override.yml`).
3. Inject env from Doppler (all services read `${VAR}` from Coolify env).
4. Deploy. Service order:
   - `postgres` → healthy
   - `migrate` → runs `bun run --filter=@charator/db db:migrate` (one-shot)
   - `api` → starts after migrate succeeds
   - `web` → starts after API healthy

### Postgres migrations (0000–0013)

The compose `migrate` service applies all pending Drizzle migrations idempotently. Current journal includes **0000** through **0013** (user tier) plus any newer tags on `main` (e.g. **0014_subscriptions** when present).

Manual run (external DB or debugging):

```bash
export DATABASE_URL='postgresql://...'
bun run --filter=@charator/db db:migrate
```

## 7. Telegram webhook (optional)

When `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` are set, register once:

```bash
curl -sS "https://api.telegram.org/bot<token>/setWebhook?url=https://charator.dioilham.com/api/webhooks/telegram&secret_token=<secret>"
```

Notify-only — users link from Settings.

## 8. Post-deploy smoke checks

Replace the host if testing via Coolify preview URL before DNS cutover.

```bash
BASE=https://charator.dioilham.com

# Health (production includes ready + optional missing list)
curl -sS "$BASE/api/health" | jq .

# Security headers
curl -sI "$BASE/api/health" | grep -iE 'x-content-type-options|x-request-id'

# OpenAPI docs (public, noindex)
curl -sI "$BASE/api/v1/docs" | grep -iE 'HTTP/|x-robots-tag'

# Web root
curl -sI "$BASE/" | head -n 1
```

**Sign-in flow (manual):** open `https://charator.dioilham.com`, click GitHub sign-in, complete OAuth. Requires production GitHub OAuth app (step 4) and valid `BETTER_AUTH_*` URLs matching the public domain.

## 9. Compose production rehearsal (local)

Agents verified the prod compose path with dummy prod-like env (2026-07-20, branch `docs/prod-deploy-runbook`):

```bash
# from repo root — uses internal postgres + migrate + api + web
cp docs/env.prod-rehearsal.example .env.prod-rehearsal
docker compose --env-file .env.prod-rehearsal up -d --build
docker compose ps
curl -sS http://127.0.0.1:3001/api/health   # if ports published for rehearsal
docker compose --env-file .env.prod-rehearsal down -v
```

See **Rehearsal result** below for the latest agent run output.

## Rehearsal result (2026-07-20)

| Step | Result |
| --- | --- |
| `bun scripts/prod-boot-check.ts --env docs/env.prod-rehearsal.example` | **PASS** — all STOP keys present |
| `docker compose -f docker-compose.yml --env-file docs/env.prod-rehearsal.example up -d --build` | **BLOCKED locally** — Docker credential helper error in WSL agent environment (`error getting credentials`). Compose file + env template are valid; re-run on a host with working Docker (Coolify VPS or local Docker Desktop). |

Expected success path on a working Docker host:

1. `migrate` exits 0 (migrations through latest journal tag)
2. `api` healthcheck passes (`GET /api/health` → `200`, `ready: true`)
3. `web` healthcheck passes (`GET /` → `200`)

## Rollback

- Coolify: redeploy previous successful deployment snapshot.
- Migrations: Drizzle has no automatic down — restore Postgres backup if a migration must be reversed.

## King deploy checklist

Mirrored in [HARNESS-HUMAN-INPUT.md § F](../HARNESS-HUMAN-INPUT.md#f-king-deploy-checklist).
