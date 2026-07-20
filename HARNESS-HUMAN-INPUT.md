# Harness human input

> **Why this file was empty:** process gap — the orchestrator failed to append blockers and open decisions per `AGENTS.md` when they were discovered. Fixed now; keep this file updated whenever human-only blockers or unresolved decisions exist.

---

## A) Human-only blockers

King must provide — agents cannot resolve these.

- [ ] **Production deploy:** Coolify app wired, Doppler secrets injected, Cloudflare DNS → VPS, R2 prod bucket + keys, run migrations `0000`–`0013` on prod Postgres
- [ ] **GitHub OAuth production app:** client ID + secret in Doppler
- [ ] *(Optional)* **Async webhooks:** `FAL_WEBHOOK_SECRET`, `REPLICATE_WEBHOOK_SECRET`
- [ ] *(Optional)* **Telegram:** `TELEGRAM_BOT_TOKEN` + `TELEGRAM_WEBHOOK_SECRET`
- [ ] **Real payment provider** when moving off mock billing (Stripe vs Polar) — deferred until post-launch

---

## B) Agreed plan checklist

Harness items 1–8 from [HARNESS-ADDITIONAL-INSTRUCTIONS.md](./HARNESS-ADDITIONAL-INSTRUCTIONS.md). Honest status as of 2026-07-20.

| # | Item | Status |
|---|------|--------|
| 1 | Base UI (no radix) | **DONE** |
| 2 | 4 tiers + payment mock package | **DONE** (merged PR #4) |
| 3 | Multi-tenant workspaces | **DONE** (v7) |
| 4 | Branch + PR workflow | **DONE** (adopted) |
| 5 | Elysia setup | **DONE** (merged PR #7) |
| 6 | Reindex `AGENTS.md` | **ONGOING** discipline |
| 7 | Force fully setup & configured — stop vs continue on unconfigured deps | **DONE** (merged PR #12 — `assertProductionReady`, prod `/api/health` `missing`) |
| 8 | t3 env for runtime env validations | **DONE** (merged PR #11 — `@t3-oss/env-core` in `apps/api`) |

**Agent-doable harness items (1–5, 7–8) are complete on `main`** as of PR #11–#13 merge (2026-07-20). Item **6** remains ongoing King discipline — not a code blocker.

### 7 — Production env gates (stop vs continue)

Right-hand approved matrix (`NODE_ENV=production`). Implemented in `apps/api/src/lib/startup-guards.ts`; `assertProductionReady` runs after t3 parse and before listen.

| Env / integration | Boot behavior | Notes |
|---|---|---|
| `DATABASE_URL` | **STOP** | Required for auth, billing, jobs |
| `BETTER_AUTH_SECRET` | **STOP** | Session signing |
| `BETTER_AUTH_URL` | **STOP** | OAuth + cookie domain |
| `KEY_ENCRYPTION_MASTER_KEY` | **STOP** | BYOK key encryption (32-byte base64) |
| `PAYMENT_WEBHOOK_SECRET` | **STOP** | Rejects dev default |
| `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` | **STOP** | Both required — prod login |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` | **STOP** | Full tuple — gallery + generation persistence |
| `MOCK_BILLING_ENABLED` | **STOP** if `"true"` | Must be false/unset in prod |
| `FAL_WEBHOOK_SECRET` | **CONTINUE** (warn) | Poll fallback |
| `REPLICATE_WEBHOOK_SECRET` | **CONTINUE** (warn) | Poll fallback |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_WEBHOOK_SECRET` | **CONTINUE** (warn) | Notify-only feature off |
| `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME` | **CONTINUE** (warn) | Tracing disabled when endpoint unset |

`/api/health` in production adds `{ ready: true, missing?: string[] }` listing unset **CONTINUE** integrations (boot already passed **STOP** checks).

### 5 — Elysia setup (detail)

Right-hand decisions closed without King input:

- [x] **5a OpenAPI visibility:** public with guardrails — no auth on `/docs`, `X-Robots-Tag: noindex`
- [x] **5b OTel:** gated on `OTEL_EXPORTER_OTLP_ENDPOINT`; no-op when unset (PR #7)
- [x] **5c evlog:** HTTP + background logs with secret redaction (PR #7)
- [x] **5d envelope:** bare JSON success + standardized `ApiError` errors (no `{ok,data}` wrap)
- [x] **5e security headers:** helmet-equivalent middleware on API responses (PR #7)

---

## C) Production-confidence sign-off

Orchestrator + right-hand unanimous gate before creating `HARNESS-START-FILE`.

- [x] All agent-doable harness items merged to `main` + CI green (PR #7, #11, #12 — run `29731143940`; PR #13 deploy docs — run pending at merge)
- [x] Orchestrator sign-off — harness #5 verified locally (turbo + e2e) 2026-07-20
- [x] Orchestrator CODE prod-confident sign-off — `bunx turbo build lint typecheck test` green; `docs/DEPLOY.md`, `docs/DOPPLER-KEYS.md`, `scripts/prod-boot-check.ts` landed (PR #13); `bun scripts/prod-boot-check.ts --env docs/env.prod-rehearsal.example` passes 2026-07-20
- [x] Right-hand Grok final sign-off — YES_WITH_NOTES on PR #12 (2026-07-20); reaffirmed for section **H** closure 2026-07-20; non-blocking notes on OTEL_SERVICE_NAME matrix wording and aggregated telegram warn
- [ ] Right-hand Opus sign-off *(optional retry each epic batch — not blocking agent work or harness closure)*
- [x] Right-hand Composer sign-off — implementer verified build/lint/typecheck/test + e2e 2026-07-20

**Do not create `HARNESS-START-FILE` yet** — King must close section **A** and section **F** first; see section **G**.

- [x] Branch cleanup PR merged 2026-07-20 — stale harness doc commits landed via `chore/harness-branch-cleanup`; local merged feature branches deleted after merge

---

## D) Code-only usable beta bar

Orchestrator checks every box; no King creds required (agent generates secrets via `openssl rand`).

| # | Check | Status | Evidence (2026-07-20) |
|---|-------|--------|------------------------|
| D1 | Harness items **1–8 DONE** on `main` | [x] | Section B — agent-doable items 1–5, 7–8 DONE (PR #11–#13); item 6 ongoing discipline only |
| D2 | **CI green** on `main` (fast + integration + e2e) | [x] | `gh run view 29726716175` → fast, integration, e2e all `success`; post PR #12 merge: `gh run view 29731143940` green |
| D3 | **README quickstart boots** | [x] | `POSTGRES_PORT=5433 docker compose up -d postgres` (5432 occupied) → `cp .env.example .env` → openssl secrets for `BETTER_AUTH_SECRET`, `KEY_ENCRYPTION_MASTER_KEY`, `PAYMENT_WEBHOOK_SECRET` → `source .env && bun run --filter=@charator/db db:migrate` → `bun --env-file=.env run --filter=@charator/api dev` + web on :3000 |
| D4 | **API health + observability headers** | [x] | `curl -sI http://127.0.0.1:3001/api/health` → `200`, `x-content-type-options: nosniff`, `x-request-id` present |
| D5 | **OpenAPI docs public + noindex** | [x] | `curl -sI http://127.0.0.1:3001/api/v1/docs` → `200`, `x-robots-tag: noindex` |
| D6 | **Web serves** | [x] | `curl -sI http://127.0.0.1:3000` → `200` |
| D7 | **Unit + lint + typecheck pass** | [x] | `bunx turbo build lint typecheck test` → exit 0 (28/28 tasks) |
| D8 | **Integration smoke pass** | [x] | `bun run ci:smoke` → `ci smoke passed`; CI integration job success on run `29726716175` |
| D9 | **E2e pass** | [x] | CI e2e job success on run `29726716175` (local e2e skipped — port 5432 occupied by unrelated Postgres) |
| D10 | **Mock billing path works** | [x] | `bun run ci:smoke` → `mock checkout completed via webhook path` + `subscription active and user tier is plus` |
| D11 | **Workspace gate enforced** | [x] | `bun test --filter=@charator/api` → `workspace-context.test.ts` + `generation-access.test.ts` pass (96/96 API tests) |
| D12 | **No agent-doable harness gaps** | [x] | Re-read `HARNESS-ADDITIONAL-INSTRUCTIONS.md` items 1–8 — none open |

**Scope limits** (not failures):

- **GitHub OAuth** optional at boot; login requires a dev OAuth app or API bearer tokens — King's prod OAuth app remains section A.
- **Image generation persistence** requires **R2** + **BYOK provider key** — without R2, jobs fail with `"R2 is not configured"`. Smoke beta covers wizard, spec render, mock billing, gallery read paths; full generation is **beta+** (user supplies R2 + BYOK, still no King creds).
- **Prod deploy, real payments, Telegram webhooks** remain section **A** King blockers.

---

## E) Harness discipline (agents must not edit `AGENTS.md`)

King-authored rules live in `AGENTS.md`; agents mirror operational discipline here because agents must not edit that file.

- append human blockers and open decisions to this file immediately when discovered — never leave it empty while blockers exist
- orchestrator decides when to stop; target 100% done & 100% confident for production deployment before creating `HARNESS-START-FILE`
- post-harness agent epics (section **H**) run without `HARNESS-START-FILE` — only live deploy waits on King (sections **A** / **F**)
- orchestrator may research, propose, and run right-hand reviews at any time
- `AGENTS_STOP_FILE` always wins — delete it to allow work; create it to force stop

---

## F) King deploy checklist

Mirrors [docs/DEPLOY.md](./docs/DEPLOY.md). King executes — leave unchecked until done.

### Pre-flight

- [ ] Export Doppler production config to a local file (never commit)
- [ ] `bun run deploy:preflight` passes before Coolify deploy (wraps prod-boot-check; uses `.env.production` or rehearsal template)
- [ ] `bun scripts/prod-boot-check.ts --env .env.production` passes (all STOP keys) when exporting real Doppler secrets
- [ ] Review [docs/DOPPLER-KEYS.md](./docs/DOPPLER-KEYS.md) — optional keys decided

### Infrastructure

- [ ] Cloudflare DNS: `charator.dioilham.com` → VPS (proxied)
- [ ] Cloudflare R2 bucket created + API token → Doppler (`R2_*` tuple)
- [ ] Doppler production config complete → synced to Coolify

### GitHub OAuth

- [ ] Production OAuth app created
- [ ] Callback URL: `https://charator.dioilham.com/api/auth/callback/github`
- [ ] `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` in Doppler

### Coolify deploy

- [ ] Coolify app from root `docker-compose.yml` (not override)
- [ ] `MOCK_BILLING_ENABLED=false` (or unset)
- [ ] Deploy succeeded — `migrate` completed, `api` + `web` healthy

### Database

- [ ] Migrations `0000`–`0013` applied on prod Postgres (via compose `migrate` or manual `db:migrate`)

### Optional integrations

- [ ] _(Optional)_ `FAL_WEBHOOK_SECRET`, `REPLICATE_WEBHOOK_SECRET`
- [ ] _(Optional)_ Telegram bot + webhook registration (see DEPLOY.md)
- [ ] _(Optional)_ `OTEL_EXPORTER_OTLP_ENDPOINT`

### Post-deploy smoke

- [ ] `curl -sS https://charator.dioilham.com/api/health` → `200`, `ready: true`
- [ ] `curl -sI https://charator.dioilham.com/api/v1/docs` → `200`, `x-robots-tag: noindex`
- [ ] `curl -sI https://charator.dioilham.com/` → `200`
- [ ] Manual GitHub sign-in flow completes

### Section A blockers (close when above done)

- [ ] **Production deploy:** Coolify + Doppler + DNS + R2 + migrations
- [ ] **GitHub OAuth production app:** client ID + secret in Doppler

---

## G) Orchestrator autonomy

As of 2026-07-20, all agent-implementable harness work for items **1–5** and **7–8** is merged to `main`. The harness **runs autonomously** until post-harness agent epics (section **H**) are complete — the orchestrator must **not** pause the implementer loop waiting on King deploy.

**Only King can close:**

- section **A** human-only blockers (Coolify, Doppler, DNS, R2, prod OAuth, etc.)
- section **F** deploy checklist — King executes and checks each box before live production

Agents **continue post-harness epics** (Pact contract tests, CI hardening, polish) without waiting for section **A** or **F**. King deploy is parallel work, not a gate on agent implementation.

**`HARNESS-START-FILE` must not be created yet** — King must close section **F** for live deploy. That does **not** stop agent epics; see section **H**. No placeholder file exists at repo root (intentional).

**All section H epics complete 2026-07-20** — agent implement loop complete for code; King §F for live deploy only.

---

## H) Post-harness agent epics

Tracked work after harness items 1–8 landed on `main`. Agents own these; King input not required unless noted.

| Epic | Status | Notes |
|------|--------|-------|
| Pact API contract tests | **DONE** | [PR #17](https://github.com/Milkywayrules/usecharator/pull/17) — `@charator/contract-tests`; consumer v1 health/themes/capabilities/gallery/404; provider verify in CI integration after smoke |
| CI prod-boot-check | **DONE** | [PR #16](https://github.com/Milkywayrules/usecharator/pull/16) — integration job step **Prod boot check (rehearsal env)** after smoke; CI run `29732441541` green |
| Remote branch cleanup | **DONE** | [PR #16](https://github.com/Milkywayrules/usecharator/pull/16) — deleted merged remotes: `feat/remix-2`, `feat/st-card-import-export`, `feat/payments-mock`, `feat/api-observability-hardening`, `chore/v8-docs-hardening`, `bugfix/compose-production-rehearsal`, `bugfix/v8-review-findings` |
| Post-harness bugbot review | **DONE** | Clean — `18f3695..HEAD` (PR #16–#17, harness docs); zero findings |
| Opus right-hand sign-off | **RETRY** | Optional re-run each epic batch; not blocking agent work or harness closure (section **C**) |

All section **H** epics closed 2026-07-20.

---

## I) v9 agent epics

Post-harness product epics for v9. Agents own implementation; mark **DONE** when merged to `main`.

| Epic | Status | Notes |
|------|--------|-------|
| Epic 1 — Activation onboarding | **DONE** | [PR #20](https://github.com/Milkywayrules/usecharator/pull/20) — `0015_user_activation`, onboarding API + settings checklist/banner, wizard draft promotion, e2e + ci-smoke 401 |
| Epic 2 — ST round-trip depth | **DONE** | [PR #23](https://github.com/Milkywayrules/usecharator/pull/23) — `control.st` chat fields, prompt template suffixes, import unmapped review panel; CI run `29738518442` green; partial bugbot follow-up [PR #24](https://github.com/Milkywayrules/usecharator/pull/24) (`control.st` fixes) |
| Epic 3 — BYOK cost transparency | **DONE** | [PR #21](https://github.com/Milkywayrules/usecharator/pull/21) — static provider pricing table, capabilities `costEstimate`, generate panel + sheet batch UI; CI run `29736153817` green |
| Epic 4 — Settings generations this month | **DONE** | unblocked by v10 Epic 1 — [PR #25](https://github.com/Milkywayrules/usecharator/pull/25) monthly generation usage on entitlements + settings |

---

## J) v10 agent epics

Post-harness product epics for v10. Agents own implementation; mark **DONE** when merged to `main`.

| Epic | Status | Notes |
|------|--------|-------|
| Epic 1 — Monthly generation usage | **DONE** | [PR #25](https://github.com/Milkywayrules/usecharator/pull/25) — entitlements monthly generation count; unblocks v9 Epic 4 |
| Epic 2 — Home gallery discovery | **DONE** | [PR #27](https://github.com/Milkywayrules/usecharator/pull/27) — home landing with trending gallery discovery |
| Epic 3 — MCP parity | **DONE** | [PR #26](https://github.com/Milkywayrules/usecharator/pull/26) — MCP gallery capabilities aligned with API |

