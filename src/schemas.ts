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

export const Window = z.enum(["1d", "1w", "1mo", "3mo", "6mo", "1y", "ytd"]);
export type Window = z.infer<typeof Window>;

export const DEFAULT_WINDOWS: Window[] = ["1d", "1w", "1mo", "3mo", "6mo", "1y", "ytd"];
