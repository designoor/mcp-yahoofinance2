import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSearchSymbols } from "./tools/searchSymbols.js";
import { registerGetQuotes } from "./tools/getQuotes.js";
import { registerGetPriceChanges } from "./tools/getPriceChanges.js";
import { registerGetHistoricalQuotes } from "./tools/getHistoricalQuotes.js";

const INSTRUCTIONS = [
  "Prefer get_quotes when the user only needs current price or 1-day change — it is a single batched request.",
  "Use get_price_changes when summary deltas over standard windows (1w/1mo/3mo/6mo/1y/ytd) are needed; it issues one request per symbol on top of the batched quote.",
  "Use get_historical_quotes when the user needs the raw OHLCV series across a date range, a price on a specific date, or any custom historical analysis.",
  "Call search_symbols first when the user references a company name instead of a ticker.",
].join(" ");

export function createServer(): McpServer {
  const server = new McpServer(
    { name: "mcp-yahoofinance", version: "0.1.0" },
    { instructions: INSTRUCTIONS },
  );

  registerSearchSymbols(server);
  registerGetQuotes(server);
  registerGetPriceChanges(server);
  registerGetHistoricalQuotes(server);

  return server;
}
