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
| 7 | Force fully setup & configured — stop vs continue on unconfigured deps | **OPEN** |
| 8 | t3 env for runtime env validations | **DONE** (`@t3-oss/env-core` in `apps/api`) |

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

- [x] All agent-doable harness items merged to `main` + CI green (PR #7)
- [x] Orchestrator sign-off — harness #5 verified locally (turbo + e2e) 2026-07-20
- [ ] Right-hand Grok sign-off
- [ ] Right-hand Opus sign-off *(pending — API limit this session)*
- [x] Right-hand Composer sign-off — implementer verified build/lint/typecheck/test + e2e 2026-07-20

**Do not create `HARNESS-START-FILE` yet** — human deploy blockers remain; Opus sign-off pending.

- [x] Branch cleanup PR merged 2026-07-20 — stale harness doc commits landed via `chore/harness-branch-cleanup`; local merged feature branches deleted after merge
- [ ] Right-hand Grok sign-off *(still open — section D verified by implementer; Grok review not run this session)*

---

## D) Code-only usable beta bar

Orchestrator checks every box; no King creds required (agent generates secrets via `openssl rand`).

| # | Check | Status | Evidence (2026-07-20) |
|---|-------|--------|------------------------|
| D1 | Harness items **1–5 DONE** on `main` | [x] | Section B table — items 1–5 marked DONE |
| D2 | **CI green** on `main` (fast + integration + e2e) | [x] | `gh run view 29726716175` → fast, integration, e2e all `success` |
| D3 | **README quickstart boots** | [x] | `POSTGRES_PORT=5433 docker compose up -d postgres` (5432 occupied) → `cp .env.example .env` → openssl secrets for `BETTER_AUTH_SECRET`, `KEY_ENCRYPTION_MASTER_KEY`, `PAYMENT_WEBHOOK_SECRET` → `source .env && bun run --filter=@charator/db db:migrate` → `bun --env-file=.env run --filter=@charator/api dev` + web on :3000 |
| D4 | **API health + observability headers** | [x] | `curl -sI http://127.0.0.1:3001/api/health` → `200`, `x-content-type-options: nosniff`, `x-request-id` present |
| D5 | **OpenAPI docs public + noindex** | [x] | `curl -sI http://127.0.0.1:3001/api/v1/docs` → `200`, `x-robots-tag: noindex` |
| D6 | **Web serves** | [x] | `curl -sI http://127.0.0.1:3000` → `200` |
| D7 | **Unit + lint + typecheck pass** | [x] | `bunx turbo build lint typecheck test` → exit 0 (28/28 tasks) |
| D8 | **Integration smoke pass** | [x] | `bun run ci:smoke` → `ci smoke passed`; CI integration job success on run `29726716175` |
| D9 | **E2e pass** | [x] | CI e2e job success on run `29726716175` (local e2e skipped — port 5432 occupied by unrelated Postgres) |
| D10 | **Mock billing path works** | [x] | `bun run ci:smoke` → `mock checkout completed via webhook path` + `subscription active and user tier is plus` |
| D11 | **Workspace gate enforced** | [x] | `bun test --filter=@charator/api` → `workspace-context.test.ts` + `generation-access.test.ts` pass (96/96 API tests) |
| D12 | **No agent-doable harness gaps** | [x] | Re-read `HARNESS-ADDITIONAL-INSTRUCTIONS.md` items 1–5 — none open |

**Scope limits** (not failures):

- **GitHub OAuth** optional at boot; login requires a dev OAuth app or API bearer tokens — King's prod OAuth app remains section A.
- **Image generation persistence** requires **R2** + **BYOK provider key** — without R2, jobs fail with `"R2 is not configured"`. Smoke beta covers wizard, spec render, mock billing, gallery read paths; full generation is **beta+** (user supplies R2 + BYOK, still no King creds).
- **Prod deploy, real payments, Telegram webhooks** remain section **A** King blockers.

---

## E) Harness discipline (agents must not edit `AGENTS.md`)

King-authored rules live in `AGENTS.md`; agents mirror operational discipline here because agents must not edit that file.

- append human blockers and open decisions to this file immediately when discovered — never leave it empty while blockers exist
- orchestrator decides when to stop; target 100% done & 100% confident for production deployment before creating `HARNESS-START-FILE`
- do not dispatch implementer subagents for the infinite loop until `HARNESS-START-FILE` exists **and** section B checklist shows all agent-doable items done with evidence
- orchestrator may still research, propose, and run right-hand reviews without `HARNESS-START-FILE`
- `AGENTS_STOP_FILE` always wins — delete it to allow work; create it to force stop
