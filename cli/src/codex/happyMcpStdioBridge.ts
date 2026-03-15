/**
 * HAPI MCP STDIO Bridge
 *
 * STDIO MCP server that mirrors HAPI tools for Codex.
 * On invocation it forwards the tool call to an existing HAPI HTTP MCP server
 * using the StreamableHTTPClientTransport.
 *
 * Configure the target HTTP MCP URL via env var `HAPI_HTTP_MCP_URL` or
 * via CLI flag `--url <http://127.0.0.1:PORT>`.
 * Note: This process must not print to stdout as it would break MCP STDIO.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { z } from 'zod';

function shouldExposeChangeTitleTool(): boolean {
  return process.env.HAPI_SESSION_TRIGGER_TYPE !== 'scheduled-task';
}

function parseArgs(argv: string[]): { url: string | null } {
  let url: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url' && i + 1 < argv.length) {
      url = argv[i + 1];
      i++;
    }
  }
  return { url };
}

const scheduleAgentSchema = z.enum(['claude', 'codex']);
const scheduleTypeSchema = z.enum(['once', 'cron']);
const scheduleModelSchema = z.enum(['opus', 'sonnet', 'gpt-5.4']);

const allToolDefinitions = [
  {
    name: 'change_title',
    description: 'Change the title of the current chat session',
    title: 'Change Chat Title',
    inputSchema: z.object({
      title: z.string().describe('The new title for the chat session'),
    })
  },
  {
    name: 'schedule_create',
    description: 'Create a scheduled task managed by the HAPI runner. Permissions are fixed to highest mode automatically.',
    title: 'Create Scheduled Task',
    inputSchema: z.object({
      title: z.string().min(1).describe('A short title describing the scheduled task'),
      prompt: z.string().min(1).describe('The prompt to send when the schedule triggers'),
      agentFlavor: scheduleAgentSchema.describe('Target agent type'),
      model: scheduleModelSchema.optional().describe('Allowed values: claude => opus/sonnet, codex => gpt-5.4'),
      scheduleType: scheduleTypeSchema.optional(),
      runAt: z.union([z.number(), z.string()]).optional().describe('For once tasks: epoch milliseconds or ISO datetime string'),
      cron: z.string().optional().describe('For cron tasks: cron expression, e.g. */5 * * * *'),
      targetDirectory: z.string().min(1).describe('Working directory for the spawned session'),
      timezone: z.string().optional(),
      paused: z.boolean().optional()
    })
  },
  {
    name: 'schedule_update',
    description: 'Update an existing scheduled task managed by the HAPI runner. Agent/model mismatch is rejected.',
    title: 'Update Scheduled Task',
    inputSchema: z.object({
      taskId: z.string().min(1),
      title: z.string().min(1).optional(),
      prompt: z.string().min(1).optional(),
      agentFlavor: scheduleAgentSchema.optional(),
      model: z.string().optional().describe('Admin override: supports custom model id in updates'),
      scheduleType: scheduleTypeSchema.optional(),
      runAt: z.union([z.number(), z.string()]).optional(),
      cron: z.string().optional(),
      targetDirectory: z.string().min(1).optional(),
      timezone: z.string().optional(),
      paused: z.boolean().optional()
    })
  },
  {
    name: 'schedule_pause',
    description: 'Pause a scheduled task',
    title: 'Pause Scheduled Task',
    inputSchema: z.object({ taskId: z.string().min(1) })
  },
  {
    name: 'schedule_resume',
    description: 'Resume a scheduled task',
    title: 'Resume Scheduled Task',
    inputSchema: z.object({ taskId: z.string().min(1) })
  },
  {
    name: 'schedule_list',
    description: 'List scheduled tasks managed by the local HAPI runner',
    title: 'List Scheduled Tasks',
    inputSchema: z.object({ includeRuns: z.boolean().optional() })
  },
  {
    name: 'schedule_cancel',
    description: 'Cancel a scheduled task by id',
    title: 'Cancel Scheduled Task',
    inputSchema: z.object({ taskId: z.string().min(1) })
  },
  {
    name: 'schedule_delete',
    description: 'Delete a scheduled task by id',
    title: 'Delete Scheduled Task',
    inputSchema: z.object({ taskId: z.string().min(1) })
  }
];

const toolDefinitions = allToolDefinitions.filter((tool) => tool.name !== 'change_title' || shouldExposeChangeTitleTool());

export async function runHappyMcpStdioBridge(argv: string[]): Promise<void> {
  try {
    const { url: urlFromArgs } = parseArgs(argv);
    const baseUrl = urlFromArgs || process.env.HAPI_HTTP_MCP_URL || '';

    if (!baseUrl) {
      process.stderr.write(
        '[hapi-mcp] Missing target URL. Set HAPI_HTTP_MCP_URL or pass --url <http://127.0.0.1:PORT>\n'
      );
      process.exit(2);
    }

    let httpClient: Client | null = null;

    async function ensureHttpClient(): Promise<Client> {
      if (httpClient) return httpClient;
      const client = new Client(
        { name: 'hapi-stdio-bridge', version: '1.0.0' },
        { capabilities: {} }
      );

      const transport = new StreamableHTTPClientTransport(new URL(baseUrl));
      await client.connect(transport);
      httpClient = client;
      return client;
    }

    const server = new McpServer({
      name: 'HAPI MCP Bridge',
      version: '1.0.0',
    });

    for (const tool of toolDefinitions) {
      server.registerTool<any, any>(
        tool.name,
        {
          description: tool.description,
          title: tool.title,
          inputSchema: tool.inputSchema,
        },
        async (args: Record<string, unknown>) => {
          try {
            const client = await ensureHttpClient();
            const response = await client.callTool({ name: tool.name, arguments: args });
            return response as any;
          } catch (error) {
            const action = tool.name === 'change_title'
              ? 'change chat title'
              : tool.name + ' via HAPI MCP';
            return {
              content: [
                { type: 'text' as const, text: 'Failed to ' + action + ': ' + (error instanceof Error ? error.message : String(error)) },
              ],
              isError: true,
            };
          }
        }
      );
    }

    const stdio = new StdioServerTransport();
    await server.connect(stdio);
  } catch (err) {
    try {
      process.stderr.write('[hapi-mcp] Fatal: ' + (err instanceof Error ? err.message : String(err)) + '\n');
    } finally {
      process.exit(1);
    }
  }
}
