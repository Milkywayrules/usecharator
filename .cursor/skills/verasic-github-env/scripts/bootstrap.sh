#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

parse_gh_repo_from_remote() {
  local url="${1%.git}"
  if [[ "$url" =~ github\.com[:/]([^/]+/[^/]+)$ ]]; then
    printf '%s' "${BASH_REMATCH[1]}"
  fi
}

if ! origin_url="$(git remote get-url origin 2>/dev/null)"; then
  echo "bootstrap: no git origin — set GH_REPO manually in .env.local" >&2
  GH_REPO="${GH_REPO:-owner/repo}"
else
  GH_REPO="$(parse_gh_repo_from_remote "$origin_url")"
  if [[ -z "$GH_REPO" ]]; then
    echo "bootstrap: could not parse owner/repo from origin — set GH_REPO manually in .env.local" >&2
    GH_REPO="owner/repo"
  fi
fi

if [[ ! -f .envrc ]]; then
  cp "$SKILL_ROOT/templates/.envrc" .envrc
  echo "bootstrap: wrote .envrc"
else
  echo "bootstrap: .envrc already exists — skipped"
fi

ENV_SNIPPET="# GitHub CLI — local agent harness only (fine-grained PAT scoped to this repo)
# Create at: https://github.com/settings/tokens?type=beta
# Copy to .env.local and set GH_TOKEN — never commit .env.local
# CI uses GitHub Actions secrets; production uses your secrets manager (Doppler, etc.)
GH_TOKEN=
GH_REPO=${GH_REPO}"

if [[ -f .env.example ]]; then
  if grep -q '^GH_TOKEN=' .env.example 2>/dev/null; then
    echo "bootstrap: .env.example already documents GH_TOKEN — skipped"
  else
    printf '\n%s\n' "$ENV_SNIPPET" >> .env.example
    echo "bootstrap: appended GitHub block to .env.example"
  fi
else
  printf '%s\n' "$ENV_SNIPPET" > .env.example
  echo "bootstrap: created .env.example with GitHub block"
fi

if [[ -f .gitignore ]]; then
  if grep -qE '^\.env\.local$' .gitignore 2>/dev/null; then
    echo "bootstrap: .gitignore already ignores .env.local"
  else
    printf '\n# agent harness secrets\n.env.local\n' >> .gitignore
    echo "bootstrap: appended .env.local to .gitignore"
  fi
else
  printf '%s\n' '.env.local' > .gitignore
  echo "bootstrap: created .gitignore with .env.local"
fi

cat <<EOF

Next steps:
  1. Create fine-grained PAT scoped to: ${GH_REPO}
  2. cp .env.example .env.local  # if needed — set GH_TOKEN only
  3. direnv allow               # once, if using direnv
  4. bash .cursor/skills/verasic-github-env/scripts/check-gh.sh

Full spec: .cursor/skills/verasic-github-env/references/setup-protocol.md
EOF
