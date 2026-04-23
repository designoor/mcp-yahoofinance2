import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { yf } from "../yahoo.js";
import { ttlCache } from "../cache.js";

const cache = ttlCache<SearchResult[]>(10 * 60 * 1000);

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string | null;
  type: string | null;
}

const inputShape = {
  query: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .describe("Company name, ticker fragment, or keyword to search for."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe("Maximum number of symbols to return. Default 10."),
};

export function registerSearchSymbols(server: McpServer): void {
  server.registerTool(
    "search_symbols",
    {
      title: "Search Symbols",
      description:
        "Resolve a company name or keyword to matching tickers (e.g. 'Apple' -> AAPL). Returns up to `limit` symbols with name, exchange, and instrument type. Use this before get_quotes or get_price_changes when the user provides a name instead of a ticker.",
      inputSchema: inputShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ query, limit }) => {
      const count = limit ?? 10;
      const cacheKey = `${query.toLowerCase()}::${count}`;
      let results = cache.get(cacheKey);

      if (!results) {
        try {
          const raw = await yf.search(query, {
            quotesCount: count,
            newsCount: 0,
            enableFuzzyQuery: true,
          });
          results = (raw.quotes ?? []).slice(0, count).map((q: any) => ({
            symbol: q.symbol ?? "",
            name: q.longname ?? q.shortname ?? q.symbol ?? "",
            exchange: q.exchange ?? null,
            type: q.quoteType ?? q.typeDisp ?? null,
          }));
          cache.set(cacheKey, results);
        } catch (err) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Yahoo Finance search failed: ${errMessage(err)}. Try again in a moment.`,
              },
            ],
          };
        }
      }

      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        structuredContent: { results },
      };
    },
  );
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
