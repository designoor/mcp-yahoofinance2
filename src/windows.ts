import type { Window } from "./schemas.js";

export interface HistoricalQuote {
  date: Date;
  close: number | null;
}

export interface WindowChange {
  changeAbs: number;
  changePct: number;
  fromPrice: number;
  fromDate: string;
}

export function cutoffDate(now: Date, window: Window): Date {
  const d = new Date(now);
  switch (window) {
    case "1d":
      d.setUTCDate(d.getUTCDate() - 1);
      return d;
    case "1w":
      d.setUTCDate(d.getUTCDate() - 7);
      return d;
    case "1mo":
      d.setUTCMonth(d.getUTCMonth() - 1);
      return d;
    case "3mo":
      d.setUTCMonth(d.getUTCMonth() - 3);
      return d;
    case "6mo":
      d.setUTCMonth(d.getUTCMonth() - 6);
      return d;
    case "1y":
      d.setUTCFullYear(d.getUTCFullYear() - 1);
      return d;
    case "ytd":
      return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  }
}

function findCloseAtOrBefore(
  quotes: HistoricalQuote[],
  cutoff: Date,
): HistoricalQuote | undefined {
  for (let i = quotes.length - 1; i >= 0; i--) {
    const q = quotes[i];
    if (!q) continue;
    if (q.date <= cutoff && q.close != null) return q;
  }
  return undefined;
}

export function computeWindow(
  quotes: HistoricalQuote[],
  currentPrice: number,
  window: Window,
  now: Date = new Date(),
): WindowChange | null {
  if (window === "ytd") {
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const first = quotes.find((q) => q.date >= yearStart && q.close != null);
    if (!first || first.close == null) return null;
    const changeAbs = currentPrice - first.close;
    return {
      changeAbs,
      changePct: (changeAbs / first.close) * 100,
      fromPrice: first.close,
      fromDate: first.date.toISOString().slice(0, 10),
    };
  }

  const cutoff = cutoffDate(now, window);
  const past = findCloseAtOrBefore(quotes, cutoff);
  if (!past || past.close == null) return null;

  const changeAbs = currentPrice - past.close;
  return {
    changeAbs,
    changePct: (changeAbs / past.close) * 100,
    fromPrice: past.close,
    fromDate: past.date.toISOString().slice(0, 10),
  };
}
