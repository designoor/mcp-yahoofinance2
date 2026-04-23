import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSearchSymbols } from "./tools/searchSymbols.js";
import { registerGetQuotes } from "./tools/getQuotes.js";
import { registerGetPriceChanges } from "./tools/getPriceChanges.js";

const INSTRUCTIONS = [
  "Prefer get_quotes when the user only needs current price or 1-day change — it is a single batched request.",
  "Use get_price_changes when longer windows (1w/1mo/3mo/6mo/1y/ytd) are needed; it issues one request per symbol on top of the batched quote.",
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

  return server;
}
