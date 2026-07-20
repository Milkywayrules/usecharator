# @charator/mcp

Stdio MCP server for [Chara Tor](https://charator.dioilham.com) — exposes theme catalog, spec rendering, character library CRUD, image generation jobs, and public gallery browsing to MCP clients (Cursor, Claude Desktop, etc.).

## Configuration

| Environment variable | Required | Default | Description |
| --- | --- | --- | --- |
| `CHARATOR_API_URL` | no | `https://charator.dioilham.com` | Chara Tor API base URL (no trailing slash) |
| `CHARATOR_API_TOKEN` | for auth tools | — | Bearer token from web settings (`ct_live_...`) |

Public tools work without a token. Authenticated tools return a clear error when `CHARATOR_API_TOKEN` is unset.

## Run locally

```bash
bun run apps/mcp/src/index.ts
# or from repo root
bunx turbo dev --filter=@charator/mcp
```

After build:

```bash
bun run --filter=@charator/mcp build
bun run --filter=@charator/mcp start
```

## MCP client setup

Add to Cursor / Claude `mcp.json`:

```json
{
  "mcpServers": {
    "charator": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/usecharator/apps/mcp/src/index.ts"],
      "env": {
        "CHARATOR_API_URL": "https://charator.dioilham.com",
        "CHARATOR_API_TOKEN": "ct_live_your_token_here"
      }
    }
  }
}
```

For production API with a published package:

```json
{
  "mcpServers": {
    "charator": {
      "command": "bunx",
      "args": ["@charator/mcp"],
      "env": {
        "CHARATOR_API_TOKEN": "ct_live_your_token_here"
      }
    }
  }
}
```

## Tools

| Tool | Auth | Input summary |
| --- | --- | --- |
| `list_themes` | public | — |
| `get_spec_catalog` | public | optional `section` filter |
| `render_prompt` | public | `spec`, optional `theme` |
| `validate_spec` | public | `spec` |
| `create_character` | bearer | `name`, `spec`, optional `themeId`, `visibility` |
| `list_characters` | bearer | — |
| `get_character` | bearer | `id` |
| `update_character` | bearer | `id` + partial `name`/`spec`/`themeId`/`visibility` |
| `remix_character` | bearer | public character `id` |
| `generate_image` | bearer | `provider`, `characterId` or `spec`, optional `theme`/`model`/`aspectRatio`, exactly one of `providerKeyId` or `apiKey` |
| `get_generation` | optional | `jobId` |
| `browse_gallery` | public | optional `q`, `sort` (`recent` \| `most_remixed`), `theme`, `offset`, `limit` |
| `get_gallery_character` | public | gallery character `id` (summary + capped spec) |
| `get_provider_capabilities` | public | — (providers, models, presets, `costEstimate`) |

API errors are returned as MCP tool errors with `{ code, message }` detail from the REST API.

## Development

```bash
bunx turbo build lint typecheck test --filter=@charator/mcp
```
