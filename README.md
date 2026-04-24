# mcp-yahoofinance

An MCP server exposing Yahoo Finance quotes, multi-window price changes, and symbol search. Wraps [`yahoo-finance2`](https://www.npmjs.com/package/yahoo-finance2) and is designed to minimize upstream requests by using batched `quote()` calls and caching chart history.

Build with [create-mcp@kusari-plugin](https://github.com/designoor/kusari-plugins) skill.

## Tools

### `search_symbols`
Resolve a company name or keyword to matching tickers.
- `query` (string, required)
- `limit` (1-20, default 10)

### `get_quotes`
Current price and 1-day change for one or more tickers — **single batched request**. Use this when you only need a snapshot.
- `symbols` (string[], 1-100)

Returns `{ found: [...], missing: [...] }`. Tickers Yahoo cannot resolve are listed in `missing`.

### `get_price_changes`
Current price plus change across any combination of windows. Issues one batched `quote()` + one `chart()` per symbol in parallel, computes all windows client-side from a single ~1y daily history.
- `symbols` (string[], 1-50)
- `windows` (subset of `1d`, `1w`, `1mo`, `3mo`, `6mo`, `1y`, `ytd`; default: all seven)

## Install (from source)

```sh
pnpm install
pnpm build
```

## Requirements

- **Node 20 or newer** at runtime — `yahoo-finance2` itself recommends Node 22+. Node 18 and older lack global `fetch` and will crash.

## Use with Claude Desktop

Add to your Claude Desktop config:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "yahoofinance": {
      "command": "<ABSOLUTE_PATH_TO_NODE>",
      "args": ["<ABSOLUTE_PATH_TO_REPO>/dist/index.js"]
    }
  }
}
```

Replace `<ABSOLUTE_PATH_TO_REPO>` with the path where you cloned this repo and `<ABSOLUTE_PATH_TO_NODE>` with the real absolute path to your `node` binary.

### Finding the absolute path to `node`

| Your setup | Command | Notes |
|---|---|---|
| macOS / Linux (Homebrew or nvm) | `which node` | Returns the real binary, e.g. `/opt/homebrew/bin/node` or `~/.nvm/versions/node/v22.11.0/bin/node` |
| Windows | `where node` | Pick the `.exe` path |

If the output starts with `~`, expand it to the full path (e.g. `/Users/yourname/...` on macOS, `/home/yourname/...` on Linux). Claude Desktop does not expand `~`.

A bare `"command": "node"` often resolves to the first `node` on Claude Desktop's `PATH`, which is frequently an old nvm default and will fail with `fetch is not a function` or similar runtime errors. Always use an absolute path.

Restart Claude Desktop.

## Use with Claude Code

```sh
claude mcp add yahoofinance -- <ABSOLUTE_PATH_TO_NODE> <ABSOLUTE_PATH_TO_REPO>/dist/index.js
```

## Caching

| Tool | TTL |
|---|---|
| `search_symbols` | 10 min |
| `get_quotes` (per symbol) | 15 s |
| `get_price_changes` chart history (per symbol) | 5 min |

Cache is in-memory for the lifetime of the server process.

## Development

```sh
pnpm dev           # run with tsx, no build step
pnpm build         # tsc -> dist/
pnpm test          # vitest
pnpm test:watch
```

## Notes

- The `yahoo-finance2` client uses a built-in request queue (default concurrency 4) shared across all calls — we keep the default to stay well under Yahoo's undocumented rate limits.
- `quote()` is the only Yahoo endpoint that natively supports multiple symbols per HTTP request; `chart()` is single-symbol, so `get_price_changes` fires one chart request per symbol (queued).
- Yahoo silently drops unknown symbols from batch `quote()` responses — we detect this and surface them in `missing`.
