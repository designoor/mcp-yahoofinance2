import { describe, it, expect } from "vitest";
import { computeWindow, type HistoricalQuote } from "./windows.js";

function mkQuotes(): HistoricalQuote[] {
  const arr: HistoricalQuote[] = [];
  const start = Date.UTC(2024, 0, 1);
  const day = 86_400_000;
  for (let i = 0; i < 400; i++) {
    arr.push({
      date: new Date(start + i * day),
      close: 100 + i,
    });
  }
  return arr;
}

describe("computeWindow", () => {
  const quotes = mkQuotes();
  const now = new Date(Date.UTC(2025, 1, 4));

  it("returns null when history does not reach the cutoff", () => {
    const short: HistoricalQuote[] = [
      { date: new Date(Date.UTC(2025, 1, 3)), close: 500 },
    ];
    expect(computeWindow(short, 510, "1y", now)).toBeNull();
  });

  it("computes 1w change from the close one week back", () => {
    const price = 500;
    const result = computeWindow(quotes, price, "1w", now);
    expect(result).not.toBeNull();
    const cutoff = new Date(now);
    cutoff.setUTCDate(cutoff.getUTCDate() - 7);
    const expectedPast = quotes.findLast((q) => q.date <= cutoff)!;
    expect(result!.fromPrice).toBe(expectedPast.close);
    expect(result!.changeAbs).toBeCloseTo(price - expectedPast.close!);
    expect(result!.changePct).toBeCloseTo(
      ((price - expectedPast.close!) / expectedPast.close!) * 100,
    );
  });

  it("computes 1y change using same-calendar-day-last-year", () => {
    const result = computeWindow(quotes, 500, "1y", now);
    expect(result).not.toBeNull();
    expect(result!.fromDate.startsWith("2024-02-0")).toBe(true);
  });

  it("computes ytd from the first trading day of the current year", () => {
    const result = computeWindow(quotes, 500, "ytd", now);
    expect(result).not.toBeNull();
    expect(result!.fromDate).toBe("2025-01-01");
    const firstOfYear = quotes.find(
      (q) => q.date >= new Date(Date.UTC(2025, 0, 1)),
    )!;
    expect(result!.fromPrice).toBe(firstOfYear.close);
  });

  it("pads over missing days (falls back to last close <= cutoff)", () => {
    const sparse: HistoricalQuote[] = [
      { date: new Date(Date.UTC(2025, 0, 20)), close: 200 },
      { date: new Date(Date.UTC(2025, 0, 27)), close: 220 },
      { date: new Date(Date.UTC(2025, 1, 3)), close: 240 },
    ];
    const r = computeWindow(sparse, 250, "1w", new Date(Date.UTC(2025, 1, 4)));
    expect(r).not.toBeNull();
    expect(r!.fromPrice).toBe(220);
  });

  it("ignores null closes when walking back", () => {
    const withNulls: HistoricalQuote[] = [
      { date: new Date(Date.UTC(2025, 0, 20)), close: 200 },
      { date: new Date(Date.UTC(2025, 0, 27)), close: null },
      { date: new Date(Date.UTC(2025, 1, 3)), close: 240 },
    ];
    const r = computeWindow(withNulls, 250, "1w", new Date(Date.UTC(2025, 1, 4)));
    expect(r).not.toBeNull();
    expect(r!.fromPrice).toBe(200);
  });
});
