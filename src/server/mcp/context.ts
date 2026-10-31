// src/server/mcp/context.ts — MCP päringu kontekst ja tööriistade registreerimine.
// Iga tööriist jookseb võtme omaniku ettevõtte kontekstis (runAsTenant) — ettevõtte filter ja RLS kehtivad.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { z } from 'zod';
import { runAsTenant } from '../db.ts';
import type { ApiKeyUser } from '../apiKeys.ts';
import type { LicenseState } from '../license.ts';
import { ToolInputError } from './format.ts';

export type McpContext = { user: ApiKeyUser; tenantName: string; license: LicenseState };

export const canSeeFinance = (ctx: McpContext): boolean => ctx.user.isAdmin || ctx.user.isFinanceManager;
export const hasTelemetry = (ctx: McpContext): boolean => ctx.license.modules.includes('TELEMETRY');

export type ToolDef = {
  name: string;
  title: string;
  description: string;
  input: z.ZodRawShape;
  when?: (ctx: McpContext) => boolean;
  run: (args: any, ctx: McpContext) => Promise<unknown>;
};

export function defineTool<S extends z.ZodRawShape>(def: {
  name: string;
  title: string;
  description: string;
  input: S;
  when?: (ctx: McpContext) => boolean;
  run: (args: z.infer<z.ZodObject<S>>, ctx: McpContext) => Promise<unknown>;
}): ToolDef {
  return def as ToolDef;
}

const text = (s: string) => [{ type: 'text' as const, text: s }];

export function registerTools(server: McpServer, ctx: McpContext, defs: ToolDef[]): void {
  for (const def of defs) {
    if (def.when && !def.when(ctx)) continue;
    server.registerTool(
      def.name,
      { title: def.title, description: def.description, inputSchema: def.input, annotations: { readOnlyHint: true, openWorldHint: false } },
      async (args: unknown) => {
        try {
          const data = await runAsTenant(ctx.user.tenantId, () => def.run(args, ctx), ctx.user.username);
          return { content: text(JSON.stringify(data)) };
        } catch (err) {
          if (err instanceof ToolInputError) return { isError: true, content: text(err.message) };
          console.error('[mcp]', def.name, err instanceof Error ? err.message : err);
          return { isError: true, content: text('Serveri viga') };
        }
      }
    );
  }
}
