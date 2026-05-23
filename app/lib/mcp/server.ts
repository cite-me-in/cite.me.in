import {
  McpServer,
  type ToolCallback,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AnySchema } from "@modelcontextprotocol/sdk/server/zod-compat";
import createSite from "./tools/create-site";
import getAiLegibilityReports from "./tools/get-ai-legibility-reports";
import getSite from "./tools/get-site";
import getSiteCitations from "./tools/get-site-citations";
import listSites from "./tools/list-sites";

const tools: {
  name: string;
  title?: string;
  description: string;
  inputSchema: AnySchema;
  outputSchema?: AnySchema;
  handler: ToolCallback<AnySchema>;
}[] = [
  listSites,
  createSite,
  getSite,
  getSiteCitations,
  getAiLegibilityReports,
];

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "cite.me.in",
    version: "1.0.0",
  });

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
      },
      tool.handler,
    );
  }

  return server;
}
