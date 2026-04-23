import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { yf } from "../yahoo.js";
import { ttlCache } from "../cache.js";
import { SymbolsInput } from "../schemas.js";

interface QuoteOut {
  symbol: string;
  name: string;
  price: number | null;
  change1d: number | null;
  changePct1d: number | null;
  previousClose: number | null;
  currency: string | null;
  marketState: string | null;
  preMarketPrice?: number;
  postMarketPrice?: number;
}

const cache = ttlCache<QuoteOut>(15 * 1000);

const inputShape = {
  symbols: z
    .array(z.string().trim().min(1).max(30))
    .min(1)
    .max(100)
    .describe(
      "Array of Yahoo Finance tickers (1-100). Examples: 'AAPL', 'MSFT', 'BTC-USD', '^GSPC', 'EURUSD=X'.",
    ),
};

export function registerGetQuotes(server: McpServer): void {
  server.registerTool(
    "get_quotes",
    {
      title: "Get Quotes",
      description:
        "Fetch current price and 1-day change for one or more tickers in a single batched request. Fast path — use this when only a snapshot is needed. For multi-window change (1w/1mo/1y/etc.), use get_price_changes instead. Symbols Yahoo cannot resolve are returned in `missing`.",
      inputSchema: inputShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const parsed = SymbolsInput.safeParse(args.symbols);
      if (!parsed.success) {
        return errorResult(parsed.error.message);
      }
      const symbols = parsed.data;

      try {
        const quotes = await fetchQuotes(symbols);
        const found: QuoteOut[] = [];
        const missing: string[] = [];
        for (const sym of symbols) {
          const q = quotes.get(sym);
          if (q) found.push(q);
          else missing.push(sym);
        }
        const payload = { found, missing };
        return {
          content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
          structuredContent: payload,
        };
      } catch (err) {
        return errorResult(`Yahoo Finance unavailable: ${errMessage(err)}.`);
      }
    },
  );
}

export async function fetchQuotes(symbols: string[]): Promise<Map<string, QuoteOut>> {
  const out = new Map<string, QuoteOut>();
  const toFetch: string[] = [];
  for (const sym of symbols) {
    const hit = cache.get(sym);
    if (hit) out.set(sym, hit);
    else toFetch.push(sym);
  }

  if (toFetch.length === 0) return out;

  const raw = await yf.quote(toFetch, { return: "array" });
  for (const q of raw as any[]) {
    const sym = q.symbol as string | undefined;
    if (!sym) continue;
    const mapped: QuoteOut = {
      symbol: sym,
      name: q.longName ?? q.shortName ?? q.displayName ?? sym,
      price: numOrNull(q.regularMarketPrice),
      change1d: numOrNull(q.regularMarketChange),
      changePct1d: numOrNull(q.regularMarketChangePercent),
      previousClose: numOrNull(q.regularMarketPreviousClose),
      currency: q.currency ?? null,
      marketState: q.marketState ?? null,
    };
    if (typeof q.preMarketPrice === "number") mapped.preMarketPrice = q.preMarketPrice;
    if (typeof q.postMarketPrice === "number") mapped.postMarketPrice = q.postMarketPrice;
    cache.set(sym, mapped);
    out.set(sym, mapped);
  }
  return out;
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function errorResult(text: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text }],
  };
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
