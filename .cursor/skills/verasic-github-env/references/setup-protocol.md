# verasic-github-env — setup protocol

Single source of truth for GitHub CLI auth in local AI agent harnesses.

## Secrets tiers (do not mix)

| Tier | Delivery | Used for |
| --- | --- | --- |
| Local agents | `.env.local` + optional `direnv` | `gh` PRs, issues, workflow runs on a dev machine |
| CI | GitHub Actions `GITHUB_TOKEN` or repo Secrets | pipelines |
| Production | Doppler, Vault, Coolify secrets, etc. | running app on VPS/containers |

Never commit tokens. Never put production runtime secrets in `.env.local`.

## Token type

Use a **fine-grained personal access token** per repo:

1. GitHub → Settings → Developer settings → Fine-grained tokens
2. Resource owner: user or org that owns the repo
3. Repository access: **only this repository**
4. Recommended repository permissions:
   - Metadata — Read (required)
   - Contents — Read and write (if agent pushes branches via HTTPS; SSH push uses SSH keys)
   - Pull requests — Read and write
   - Issues — Read and write
   - Actions — Read (Read and write only if agent re-runs CI)
   - Workflows — Read (Read and write only if agent edits workflow files)
5. Set expiration and rotate on a calendar reminder

Store the token in repo-root `.env.local`:

```bash
GH_TOKEN=github_pat_...
GH_REPO=owner/repo
```

## Bootstrap a repo (once)

From the project root, after installing verasic-skills:

```bash
bash .cursor/skills/verasic-github-env/scripts/bootstrap.sh
```

Or in Cursor: `/verasic-setup-github`

This writes `.envrc`, documents `GH_TOKEN`/`GH_REPO` in `.env.example`, and ensures `.env.local` is gitignored.

## direnv (optional, recommended)

```bash
# Ubuntu/Debian
sudo apt install direnv
echo 'eval "$(direnv hook bash)"' >> ~/.bashrc

cd /path/to/repo
direnv allow
```

When active, entering the repo loads `.env.local` into the shell automatically.

## Verify

```bash
bash .cursor/skills/verasic-github-env/scripts/check-gh.sh
```

## Agent usage of `gh`

Before any `gh` command, if `GH_TOKEN` is unset:

```bash
set -a && source .env.local && set +a
```

Rules:

- use `gh` for GitHub API operations — not browser automation for GitHub
- pass `-R "${GH_REPO}"` when repo auto-detection fails
- `git push` over SSH uses SSH keys; `GH_TOKEN` is for `gh` and HTTPS API only
- never log, echo, or commit token values

## Install verasic-skills into a project

```bash
curl -fsSL https://raw.githubusercontent.com/Milkywayrules/verasic-skills/main/setup.sh | bash
```

Skill-only (any agent):

```bash
npx skills add Milkywayrules/verasic-skills
```

Then run bootstrap on each repo that needs GitHub agent access.
