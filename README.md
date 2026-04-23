# mcp-yahoofinance

An MCP server exposing Yahoo Finance quotes, multi-window price changes, and symbol search. Wraps [`yahoo-finance2`](https://www.npmjs.com/package/yahoo-finance2) and is designed to minimize upstream requests by using batched `quote()` calls and caching chart history.

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

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "yahoofinance": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/mcp-yahoofinance/dist/index.js"]
    }
  }
}
```

**Important:** use an **absolute path** to the node binary, not bare `"node"`. Claude Desktop walks through every directory in your `PATH` and picks the first `node` it finds, which is often an old nvm default. Find your current version with `which node` and paste that full path. Example:

```json
"command": "/Users/you/.nvm/versions/node/v22.11.0/bin/node"
```

Restart Claude Desktop.

## Use with Claude Code

```sh
claude mcp add yahoofinance -- /absolute/path/to/node /absolute/path/to/mcp-yahoofinance/dist/index.js
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
