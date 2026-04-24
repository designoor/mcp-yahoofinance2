# mcp-yahoofinance2

A local [MCP](https://modelcontextprotocol.io) server that fetches prices and multi-window price changes for stocks, ETFs, crypto, indices, and FX via the [yahoo-finance2](https://www.npmjs.com/package/yahoo-finance2) library.

```
░█░█░█░█░█▀▀░█▀█░█▀▄░▀█▀░░░█▀█░█░░░█░█░█▀▀░▀█▀░█▀█░█▀▀
░█▀▄░█░█░▀▀█░█▀█░█▀▄░░█░░░░█▀▀░█░░░█░█░█░█░░█░░█░█░▀▀█
░▀░▀░▀▀▀░▀▀▀░▀░▀░▀░▀░▀▀▀░░░▀░░░▀▀▀░▀▀▀░▀▀▀░▀▀▀░▀░▀░▀▀▀
```
Build with [create-mcp@kusari-plugin](https://github.com/designoor/kusari-plugins) skill.

## Requirements

- Node.js 20+ (`yahoo-finance2` recommends 22+)
- No API key — Yahoo Finance is public

## Install

No clone required — the package is published on npm.

Add to your Claude Desktop config:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "yahoofinance": {
      "command": "npx",
      "args": ["-y", "@0x50b/mcp-yahoofinance2"]
    }
  }
}
```

For Claude Code, the same block goes into a project-level `.mcp.json` at the repo root, then set `"enableAllProjectMcpServers": true` in `.claude/settings.local.json`.

Restart Claude Desktop fully (⌘Q, not just close the window) to pick up the config.

## Tools

### `search_symbols`
Resolve a company name or keyword to matching tickers (e.g. `Apple` → `AAPL`). Call this first when the user gives you a name instead of a symbol.
- `query` (string, required) — name, ticker fragment, or keyword
- `limit` (int 1–20, default 10) — max results

Returns an array of `{ symbol, name, exchange, type }`. Results cached 10 min.

### `get_quotes`
Current price and 1-day change for one or more tickers in a **single batched request**. Fast path — use when only a snapshot is needed; for longer windows prefer `get_price_changes`.
- `symbols` (string[], 1–100) — Yahoo tickers, e.g. `AAPL`, `BTC-USD`, `^GSPC`, `EURUSD=X`

Returns `{ found, missing }`:
- `found[]` — `{ symbol, name, price, change1d, changePct1d, previousClose, currency, marketState, preMarketPrice?, postMarketPrice? }`
- `missing[]` — tickers Yahoo silently dropped because they couldn't be resolved.

Per-symbol quote cached 15 s.

### `get_price_changes`
Current price plus change over any combination of windows for a batch of tickers. Internally issues one batched `quote()` plus one `chart()` per symbol in parallel, then computes every requested window client-side from a single ~1-year daily-history response. Heavier than `get_quotes` — use only when you need more than a snapshot.
- `symbols` (string[], 1–50)
- `windows` (array of `1d` | `1w` | `1mo` | `3mo` | `6mo` | `1y` | `ytd`, optional) — default: all seven

Returns `{ found, missing, windows }`:
- `found[]` — `{ symbol, name, price, currency, marketState, windows: { [windowKey]: { changeAbs, changePct, fromPrice, fromDate } | null } }`
- `windows` with `null` values indicate history didn't reach the cutoff (newly listed symbols).
- `1d` is sourced from the live quote (`previousClose`); other windows walk back through the daily-history series to the first close at or before the cutoff, so weekends and holidays are handled automatically.

Per-symbol chart history cached 5 min.

## Performance & batching

- `quote()` is the **only** Yahoo endpoint that accepts multiple symbols in a single HTTP request. `get_quotes` exploits this — any number of symbols up to 100 costs one request.
- `chart()` is single-symbol, so `get_price_changes` makes one chart request per symbol. These run concurrently through `yahoo-finance2`'s built-in request queue (default concurrency 4 — kept at the library default to stay under Yahoo's undocumented rate limits).
- All caches are in-memory for the lifetime of the server process.

## Local development (contributors only)

```bash
git clone https://github.com/designoor/mcp-yahoofinance2.git
cd mcp-yahoofinance2
pnpm install

pnpm test            # vitest run
pnpm build           # compiles to dist/
pnpm dev             # runs via tsx without a build step
node dist/index.js   # manual stdio run
```

To test changes against Claude Desktop locally, point the config at your built `dist/index.js` via its absolute path instead of `npx`.
