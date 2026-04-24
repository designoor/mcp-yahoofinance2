# mcp-yahoofinance2

A local [MCP](https://modelcontextprotocol.io) server for **stock, ETF, crypto, index, and FX** prices and multi-window price changes. Wraps [yahoo-finance2](https://www.npmjs.com/package/yahoo-finance2). No API key required.

```
░█░█░█░█░█▀▀░█▀█░█▀▄░▀█▀░░░█▀█░█░░░█░█░█▀▀░▀█▀░█▀█░█▀▀
░█▀▄░█░█░▀▀█░█▀█░█▀▄░░█░░░░█▀▀░█░░░█░█░█░█░░█░░█░█░▀▀█
░▀░▀░▀▀▀░▀▀▀░▀░▀░▀░▀░▀▀▀░░░▀░░░▀▀▀░▀▀▀░▀▀▀░▀▀▀░▀░▀░▀▀▀
```
Built with the [create-mcp@kusari-plugin](https://github.com/designoor/kusari-plugins) skill.

## Requirements

| | |
|---|---|
| Runtime | Node.js 22+
| API key | None — Yahoo Finance is public |
| Platforms | macOS, Linux, Windows |

## Install

No clone required — the package is on [npm](https://www.npmjs.com/package/@0x50b/mcp-yahoofinance2).

| Client | Config file |
|---|---|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Claude Code | project-local `.mcp.json` (also set `enableAllProjectMcpServers: true` in `.claude/settings.local.json`) |

Add:
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

Restart Claude Desktop fully (⌘Q on macOS, not just close the window).

## Tools

| Tool | Purpose | When to use |
|---|---|---|
| [`search_symbols`](#search_symbols) | Name → ticker lookup | User gives a company name instead of a symbol |
| [`get_quotes`](#get_quotes) | Snapshot: price + 1d change | Only the latest price is needed |
| [`get_price_changes`](#get_price_changes) | Snapshot + multi-window change | Need performance over time (1w, 1mo, 1y, etc.) |

---

### `search_symbols`

Resolve a company name or keyword to matching tickers (e.g. `Apple` → `AAPL`).

| Input | Type | Required | Description |
|---|---|---|---|
| `query` | string | ✓ | Company name, ticker fragment, or keyword |
| `limit` | int 1–20 |  | Max results (default 10) |

Returns an array of `{ symbol, name, exchange, type }`. Cached 10 min.

---

### `get_quotes`

Current price and 1-day change for up to 100 tickers in a **single batched request**.

| Input | Type | Required | Description |
|---|---|---|---|
| `symbols` | string[], 1–100 | ✓ | Yahoo tickers, e.g. `AAPL`, `BTC-USD`, `^GSPC`, `EURUSD=X` |

Returns `{ found, missing }`:

| Field | Type | Notes |
|---|---|---|
| `found[]` | object[] | Resolved symbols — see below |
| `missing[]` | string[] | Symbols Yahoo silently dropped |

Per-symbol shape:

| Field | Type | Description |
|---|---|---|
| `symbol`, `name`, `currency` | string | Identity |
| `price` | number | Latest regular-market price |
| `change1d`, `changePct1d` | number | Change vs. previous close |
| `previousClose` | number | Previous session's close |
| `marketState` | string | `REGULAR` \| `CLOSED` \| `PRE` \| `POST` … |
| `preMarketPrice`, `postMarketPrice` | number? | Present only during extended hours |

Per-symbol quote cached 15 s.

---

### `get_price_changes`

Current price plus change over any combination of windows. Heavier than `get_quotes` — one batched `quote()` plus one `chart()` per symbol, then windows are computed client-side from a single ~1-year daily-history response.

| Input | Type | Required | Description |
|---|---|---|---|
| `symbols` | string[], 1–50 | ✓ | Yahoo tickers |
| `windows` | enum[] |  | Subset of the windows below; default: all |

Supported windows:

| Key | Source | Notes |
|---|---|---|
| `1d` | Live quote `previousClose` | Always accurate to the latest tick |
| `1w`, `1mo`, `3mo`, `6mo`, `1y` | Chart close at/before cutoff | Weekends/holidays padded automatically |
| `ytd` | Chart close on first trading day of calendar year | |

Returns `{ found, missing, windows }`. Per-symbol window entry:

| Field | Type | Notes |
|---|---|---|
| `changeAbs` | number | Current price − past price |
| `changePct` | number | Percent change |
| `fromPrice` | number | The past price used as the baseline |
| `fromDate` | string (ISO date) | The trading day the baseline came from |

`null` windows indicate the symbol's history didn't reach that cutoff (newly listed). Per-symbol chart history cached 5 min.

## Performance & batching

| Endpoint | Batched? | Behaviour |
|---|---|---|
| Yahoo `quote()` | ✓ up to 100 symbols/request | One HTTP call regardless of symbol count |
| Yahoo `chart()` | ✗ single symbol | Parallelized via `yahoo-finance2`'s queue (concurrency 4) |

All caches are in-memory for the server-process lifetime.

## Local development

```sh
git clone https://github.com/designoor/mcp-yahoofinance2.git
cd mcp-yahoofinance2
pnpm install
```

| Command | What |
|---|---|
| `pnpm dev` | Run the server over stdio via tsx — no build step |
| `pnpm test` | `vitest run` |
| `pnpm build` | Compile to `dist/` |
| `node dist/index.js` | Manual stdio run against the built output |

To test changes in Claude Desktop, point the config's `command` at `node` and `args` at your absolute `dist/index.js` instead of `npx`.
