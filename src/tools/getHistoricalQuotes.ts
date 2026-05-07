import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { yf } from "../yahoo.js";
import { ttlCache } from "../cache.js";
import { HistoricalSymbolsInput, Interval, IsoDate } from "../schemas.js";

interface HistoricalRow {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  adjClose: number | null;
  volume: number | null;
}

interface PerSymbolHistory {
  symbol: string;
  name: string;
  currency: string | null;
  interval: z.infer<typeof Interval>;
  quotes: HistoricalRow[];
  note?: string;
  lastAvailable?: HistoricalRow;
}

const cache = ttlCache<PerSymbolHistory>(30 * 60 * 1000);
const LOOKBACK_DAYS = 14;

const inputShape = {
  symbols: z
    .array(z.string().trim().min(1).max(30))
    .min(1)
    .max(50)
    .describe("Array of Yahoo Finance tickers (1-50). One chart request per symbol."),
  from: IsoDate.describe("Start date (inclusive), ISO format YYYY-MM-DD."),
  to: IsoDate.optional().describe(
    "End date (inclusive), ISO format YYYY-MM-DD. Defaults to today.",
  ),
  interval: Interval.optional().describe(
    "Bar interval. Allowed: 1d, 1wk, 1mo. Default: 1d.",
  ),
};

export function registerGetHistoricalQuotes(server: McpServer): void {
  server.registerTool(
    "get_historical_quotes",
    {
      title: "Get Historical Quotes",
      description:
        "Fetch raw OHLCV time series for one or more tickers across a date range. Returns open/high/low/close/adjClose/volume per bar at daily, weekly, or monthly granularity. Use this when the caller needs the actual price series (charting, single-date lookup, custom analysis). Use get_price_changes when only summary deltas over standard windows are needed, and get_quotes for current snapshots. Issues one chart request per symbol — keep batches modest.",
      inputSchema: inputShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const symbolsParsed = HistoricalSymbolsInput.safeParse(args.symbols);
      if (!symbolsParsed.success) return errorResult(symbolsParsed.error.message);
      const symbols = symbolsParsed.data;

      const fromParsed = IsoDate.safeParse(args.from);
      if (!fromParsed.success) return errorResult(fromParsed.error.message);
      const from = fromParsed.data;

      const todayIso = new Date().toISOString().slice(0, 10);
      let to = todayIso;
      if (args.to !== undefined) {
        const toParsed = IsoDate.safeParse(args.to);
        if (!toParsed.success) return errorResult(toParsed.error.message);
        to = toParsed.data;
      }

      if (to < from) {
        return errorResult(`'to' (${to}) must be on or after 'from' (${from}).`);
      }

      const interval: z.infer<typeof Interval> = args.interval ?? "1d";

      const fromDate = parseIsoUtc(from);
      const toDate = parseIsoUtc(to);
      const period1 = new Date(fromDate);
      period1.setUTCDate(period1.getUTCDate() - LOOKBACK_DAYS);
      const period2 = new Date(toDate);
      period2.setUTCDate(period2.getUTCDate() + 1);

      try {
        const results = await Promise.all(
          symbols.map((sym) =>
            fetchHistory(sym, from, to, interval, period1, period2).catch(() => null),
          ),
        );

        const found: PerSymbolHistory[] = [];
        const missing: string[] = [];
        symbols.forEach((sym, i) => {
          const r = results[i];
          if (!r) {
            missing.push(sym);
            return;
          }
          if (r.quotes.length === 0) {
            r.note = emptyRangeNote(from, to, r.lastAvailable);
          }
          found.push(r);
        });

        const payload = { found, missing, from, to, interval };
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

async function fetchHistory(
  symbol: string,
  from: string,
  to: string,
  interval: z.infer<typeof Interval>,
  period1: Date,
  period2: Date,
): Promise<PerSymbolHistory> {
  const key = `${symbol}|${from}|${to}|${interval}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const result = await yf.chart(symbol, {
    period1,
    period2,
    interval,
    return: "array",
  });

  const meta = (result as any).meta ?? {};
  const allRows: HistoricalRow[] = (result.quotes ?? []).map((q: any) => ({
    date: toIsoDate(q.date),
    open: numOrNull(q.open),
    high: numOrNull(q.high),
    low: numOrNull(q.low),
    close: numOrNull(q.close),
    adjClose: numOrNull(q.adjclose),
    volume: numOrNull(q.volume),
  }));

  const quotes = allRows.filter((r) => r.date >= from && r.date <= to);
  const out: PerSymbolHistory = {
    symbol,
    name: meta.longName ?? meta.shortName ?? meta.symbol ?? symbol,
    currency: meta.currency ?? null,
    interval,
    quotes,
  };
  if (quotes.length === 0) {
    const last = lastBefore(allRows, from);
    if (last) out.lastAvailable = last;
  }
  cache.set(key, out);
  return out;
}

function lastBefore(rows: HistoricalRow[], from: string): HistoricalRow | undefined {
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (r && r.date < from) return r;
  }
  return undefined;
}

function emptyRangeNote(from: string, to: string, lastAvailable?: HistoricalRow): string {
  const reason =
    from === to && isWeekend(from)
      ? "Non-trading day (weekend)"
      : "No trading data for this range (possible market holiday, pre-listing, or delisted)";
  if (lastAvailable) {
    return `${reason}. Last available trading day: ${lastAvailable.date}.`;
  }
  return reason;
}

function isWeekend(iso: string): boolean {
  const day = parseIsoUtc(iso).getUTCDay();
  return day === 0 || day === 6;
}

function parseIsoUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function toIsoDate(v: unknown): string {
  const d = v instanceof Date ? v : new Date(v as string | number);
  return d.toISOString().slice(0, 10);
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
