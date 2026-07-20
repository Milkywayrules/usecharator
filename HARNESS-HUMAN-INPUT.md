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

Harness items 1–6 from [HARNESS-ADDITIONAL-INSTRUCTIONS.md](./HARNESS-ADDITIONAL-INSTRUCTIONS.md). Honest status as of 2026-07-20.

| # | Item | Status |
|---|------|--------|
| 1 | Base UI (no radix) | **DONE** |
| 2 | 4 tiers + payment mock package | **DONE** (merged PR #4) |
| 3 | Multi-tenant workspaces | **DONE** (v7) |
| 4 | Branch + PR workflow | **DONE** (adopted) |
| 5 | Elysia setup | **DONE** (merged PR #7) |
| 6 | Reindex `AGENTS.md` | **ONGOING** discipline |

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
