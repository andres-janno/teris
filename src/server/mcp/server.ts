// src/server/mcp/server.ts — MCP server ühe päringu jaoks: ainult sellele kasutajale lubatud tööriistad.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools, type McpContext, type ToolDef } from './context.ts';
import { accountTools } from './tools/account.ts';
import { fieldTools } from './tools/fields.ts';
import { workTools } from './tools/works.ts';
import { stockTools } from './tools/stock.ts';

export const ALL_TOOLS: ToolDef[] = [...accountTools, ...fieldTools, ...workTools, ...stockTools];

export function createMcpServer(ctx: McpContext, instructions: string): McpServer {
  const server = new McpServer({ name: 'teris', title: 'Teris', version: '1.0.0' }, { instructions });
  registerTools(server, ctx, ALL_TOOLS);
  return server;
}
