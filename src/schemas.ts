import { z } from "zod";

const Symbol = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .transform((s) => s.toUpperCase());

export const SymbolsInput = z
  .array(Symbol)
  .min(1)
  .max(100)
  .transform((arr) => Array.from(new Set(arr)));

export const HistoricalSymbolsInput = z
  .array(Symbol)
  .min(1)
  .max(50)
  .transform((arr) => Array.from(new Set(arr)));

export const Window = z.enum(["1d", "1w", "1mo", "3mo", "6mo", "1y", "ytd"]);
export type Window = z.infer<typeof Window>;

export const DEFAULT_WINDOWS: Window[] = ["1d", "1w", "1mo", "3mo", "6mo", "1y", "ytd"];

export const Interval = z.enum(["1d", "1wk", "1mo"]);
export type Interval = z.infer<typeof Interval>;

export const IsoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be ISO format YYYY-MM-DD");
