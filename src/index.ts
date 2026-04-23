#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const [major] = process.versions.node.split(".").map(Number);
if (!major || major < 20) {
  console.error(
    `mcp-yahoofinance requires Node >= 20 (yahoo-finance2 recommends >= 22). Detected: ${process.versions.node}. ` +
      `Set the "command" in your MCP client config to an absolute path to a newer node binary.`,
  );
  process.exit(1);
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("mcp-yahoofinance fatal:", err);
  process.exit(1);
});
