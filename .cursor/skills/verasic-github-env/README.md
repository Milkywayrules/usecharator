# Verasic GitHub Env

Reproducible GitHub CLI auth for local AI agent harnesses across Verasic
projects. Fine-grained PAT per repo in gitignored `.env.local`, optional
`direnv`, and a verify script — separate from CI and production secrets.

Battle-tested pattern before public launch: local agents, CI, and Doppler
production stay in separate tiers.

## Parts

| File | Role |
| --- | --- |
| `.cursor/skills/verasic-github-env/references/setup-protocol.md` | Spec — tiers, PAT permissions, bootstrap, agent usage |
| `.cursor/skills/verasic-github-env/scripts/bootstrap.sh` | Wire repo once — `.envrc`, `.env.example`, `.gitignore` |
| `.cursor/skills/verasic-github-env/scripts/check-gh.sh` | Verify `GH_TOKEN` + `gh auth status` |
| `.cursor/skills/verasic-github-env/SKILL.md` | Auto-trigger + orchestration |
| `.cursor/rules/verasic-github-env.mdc` | Always-applied digest for `gh` commands |

## Install into a project

```bash
curl -fsSL https://raw.githubusercontent.com/Milkywayrules/verasic-skills/main/setup.sh | bash
```

Skill-only (any agent):

```bash
npx skills add Milkywayrules/verasic-skills
```

## Wire one repo

```bash
bash .cursor/skills/verasic-github-env/scripts/bootstrap.sh
```

Or in Cursor: `/verasic-setup-github`

Then:

1. Create a fine-grained PAT scoped to this repo only (see setup-protocol.md).
2. Put `GH_TOKEN=...` in `.env.local` (keep existing vars if you already have one).
3. `direnv allow` (optional).
4. `bash .cursor/skills/verasic-github-env/scripts/check-gh.sh`

## Secrets tiers

| Tier | Where |
| --- | --- |
| Local agents | `.env.local` + `.envrc` |
| CI | GitHub Actions secrets |
| Production | Doppler / Coolify / vault |

## Usage

- Agents load `.env.local` before `gh` when `GH_TOKEN` is unset — rule applies automatically.
- `/verasic-setup-github` — bootstrap current repo
- Manual verify anytime: `bash .cursor/skills/verasic-github-env/scripts/check-gh.sh`

## Extend per repo

After bootstrap, add a one-liner to the project README deploy section pointing
at the secrets tier table in `setup-protocol.md`. Do not fork token handling
per repo — only `GH_REPO` and the PAT scope change.
