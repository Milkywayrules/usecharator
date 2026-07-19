# @charator/cli

Bun CLI for the Charator REST API (`/api/v1`). Wraps themes, spec render/validate, characters, generations, gallery, and provider keys.

## Install & run

From the monorepo root:

```bash
bun install
bun run --cwd apps/cli dev -- themes
```

Link the `charator` binary globally:

```bash
cd apps/cli && bun link
charator --help
```

Build:

```bash
bunx turbo build --filter=@charator/cli
bun run --cwd apps/cli start -- themes
```

## Auth setup

1. Mint a bearer token in the web app (Settings → API tokens). Format: `ct_live_...`.
2. Save it locally:

```bash
charator auth login --token ct_live_your_token_here
# or interactive:
charator auth login
```

Config file: `~/.config/charator/config.json` (mode `600`).

Precedence for `--api-url` / token:

1. CLI flags (`--api-url`, `--token`)
2. Environment (`CHARATOR_API_URL`, `CHARATOR_API_TOKEN`)
3. Config file

Verify:

```bash
charator auth status
charator auth logout
```

## Command reference

| Command | Description |
| --- | --- |
| `charator auth login [--token]` | Save API token to config |
| `charator auth status` | Verify token via `GET /characters` |
| `charator auth logout` | Remove token from config |
| `charator themes` | List render themes |
| `charator spec catalog [--section X]` | Browse spec field catalog |
| `charator spec validate <file.json>` | Validate spec locally |
| `charator spec render <file.json> [--theme X]` | Render prompt via API |
| `charator characters list` | List your characters |
| `charator characters get <id>` | Get character by id |
| `charator characters create --name N --spec file.json [--theme X] [--visibility public\|private]` | Create character |
| `charator characters update <id> [--name] [--spec] [--theme] [--visibility]` | Update character |
| `charator characters delete <id>` | Delete character |
| `charator characters remix <id>` | Remix character |
| `charator generate --character <id> \| --spec file.json [--theme X] --provider P [--model M] [--key-id ID \| --api-key KEY] [--wait] [--output dir]` | Queue generation |
| `charator jobs get <jobId> [--wait] [--output dir]` | Inspect or wait on job |
| `charator gallery list [--theme X]` | List public gallery |
| `charator gallery get <id>` | Gallery character detail |
| `charator keys list` | List saved provider keys |
| `charator keys add --provider P --key K [--label L] [--base-url U]` | Add provider key |
| `charator keys remove <id>` | Delete provider key |

Global flags: `--api-url`, `--token`, `--json`.

## Example workflow

```bash
export CHARATOR_API_URL=http://localhost:3001

# Public endpoints (no auth)
charator themes
charator spec render ./my-character.json --theme anime

# Authenticated
charator auth login --token ct_live_...
charator characters create --name "My Hero" --spec ./my-character.json --theme anime
charator characters list

# Generate and download (inline provider key)
charator generate \
  --character <uuid-from-list> \
  --provider fal \
  --api-key "$FAL_KEY" \
  --wait \
  --output ./charator-output
```

## Development

```bash
bunx turbo build lint typecheck test --filter=@charator/cli
```
