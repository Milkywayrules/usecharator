#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

if [[ -z "${GH_TOKEN:-}" && -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

: "${GH_TOKEN:?GH_TOKEN is unset — create .env.local with a fine-grained PAT (see verasic-github-env README)}"

parse_gh_repo_from_remote() {
  local url="${1%.git}"
  if [[ "$url" =~ github\.com[:/]([^/]+/[^/]+)$ ]]; then
    printf '%s' "${BASH_REMATCH[1]}"
  fi
}

if [[ -z "${GH_REPO:-}" ]]; then
  if origin_url="$(git remote get-url origin 2>/dev/null)"; then
    GH_REPO="$(parse_gh_repo_from_remote "$origin_url")"
  fi
fi

: "${GH_REPO:?GH_REPO is unset — add GH_REPO=owner/repo to .env.local or fix origin remote}"

if ! command -v gh >/dev/null 2>&1; then
  echo "check-gh: gh CLI not found — install from https://cli.github.com" >&2
  exit 1
fi

gh auth status >/dev/null
gh repo view "$GH_REPO" --json nameWithOwner -q .nameWithOwner >/dev/null

echo "check-gh: ok — authenticated for $GH_REPO"
