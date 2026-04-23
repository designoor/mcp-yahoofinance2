import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { yf } from "../yahoo.js";
import { ttlCache } from "../cache.js";
import { SymbolsInput, Window, DEFAULT_WINDOWS } from "../schemas.js";
import { computeWindow, type HistoricalQuote, type WindowChange } from "../windows.js";
import { fetchQuotes } from "./getQuotes.js";

const chartCache = ttlCache<HistoricalQuote[]>(5 * 60 * 1000);

const inputShape = {
  symbols: z
    .array(z.string().trim().min(1).max(30))
    .min(1)
    .max(50)
    .describe("Array of Yahoo Finance tickers (1-50). Larger batches issue more background requests."),
  windows: z
    .array(Window)
    .min(1)
    .optional()
    .describe(
      "Which change windows to compute. Allowed: 1d, 1w, 1mo, 3mo, 6mo, 1y, ytd. Default: all seven.",
    ),
};

interface PerSymbolResult {
  symbol: string;
  name: string;
  price: number | null;
  currency: string | null;
  marketState: string | null;
  windows: Record<string, WindowChange | null>;
}

export function registerGetPriceChanges(server: McpServer): void {
  server.registerTool(
    "get_price_changes",
    {
      title: "Get Price Changes",
      description:
        "Fetch current price plus price change over one or more windows (1d, 1w, 1mo, 3mo, 6mo, 1y, ytd) for a batch of tickers. Internally batches the live quote in a single request and fetches ~1y of daily history per symbol in parallel, then computes all requested windows from that data. Use get_quotes when only the current price / 1-day change is needed — this tool is heavier.",
      inputSchema: inputShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const parsedSymbols = SymbolsInput.safeParse(args.symbols);
      if (!parsedSymbols.success) return errorResult(parsedSymbols.error.message);
      const symbols = parsedSymbols.data;
      const windows = args.windows ?? DEFAULT_WINDOWS;

      try {
        const [quotes, histories] = await Promise.all([
          fetchQuotes(symbols),
          Promise.all(symbols.map((s) => fetchHistory(s).catch(() => null))),
        ]);

        const found: PerSymbolResult[] = [];
        const missing: string[] = [];
        const now = new Date();

        symbols.forEach((sym, i) => {
          const quote = quotes.get(sym);
          const history = histories[i];
          if (!quote) {
            missing.push(sym);
            return;
          }
          const windowMap: Record<string, WindowChange | null> = {};
          for (const w of windows) {
            if (w === "1d") {
              windowMap[w] =
                quote.change1d != null &&
                quote.changePct1d != null &&
                quote.previousClose != null &&
                quote.price != null
                  ? {
                      changeAbs: quote.change1d,
                      changePct: quote.changePct1d,
                      fromPrice: quote.previousClose,
                      fromDate: "previous_close",
                    }
                  : null;
              continue;
            }
            if (!history || quote.price == null) {
              windowMap[w] = null;
              continue;
            }
            windowMap[w] = computeWindow(history, quote.price, w, now);
          }
          found.push({
            symbol: sym,
            name: quote.name,
            price: quote.price,
            currency: quote.currency,
            marketState: quote.marketState,
            windows: windowMap,
          });
        });

        const payload = { found, missing, windows };
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

async function fetchHistory(symbol: string): Promise<HistoricalQuote[]> {
  const hit = chartCache.get(symbol);
  if (hit) return hit;

  const period1 = new Date();
  period1.setUTCDate(period1.getUTCDate() - 400);

  const result = await yf.chart(symbol, {
    period1,
    interval: "1d",
    return: "array",
  });

  const quotes: HistoricalQuote[] = (result.quotes ?? []).map((q: any) => ({
    date: q.date instanceof Date ? q.date : new Date(q.date),
    close: typeof q.close === "number" ? q.close : null,
  }));
  chartCache.set(symbol, quotes);
  return quotes;
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
