#!/usr/bin/env bash
# Local deploy pre-flight — prod-boot-check only; no remote curls.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE=".env.production"
if [[ ! -f "$ENV_FILE" ]]; then
  ENV_FILE="docs/env.prod-rehearsal.example"
  echo "note: .env.production not found — using rehearsal template (${ENV_FILE})"
  echo "      export Doppler secrets to .env.production for a real pre-deploy check."
  echo ""
fi

echo "==> production boot check (${ENV_FILE})"
if bun scripts/prod-boot-check.ts --env "$ENV_FILE" --warn; then
  echo ""
  echo "pre-flight passed."
  echo ""
  cat <<'EOF'
Next: complete King's deploy checklist (HARNESS-HUMAN-INPUT.md § F):
  - Doppler → Coolify env sync
  - Cloudflare DNS + R2
  - GitHub OAuth production app
  - Coolify deploy + post-deploy smoke

Full runbook: docs/DEPLOY.md
EOF
  exit 0
fi

echo "" >&2
cat >&2 <<'EOF'
pre-flight failed — fix STOP env keys before Coolify deploy.
See HARNESS-HUMAN-INPUT.md § F and docs/DOPPLER-KEYS.md.
EOF
exit 1
