#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const [major] = process.versions.node.split(".").map(Number);
if (!major || major < 20) {
  console.error(
    `mcp-yahoofinance2 requires Node >= 20 (yahoo-finance2 recommends >= 22). Detected: ${process.versions.node}.`,
  );
  process.exit(1);
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("mcp-yahoofinance2 fatal:", err);
  process.exit(1);
});
