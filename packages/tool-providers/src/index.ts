import type { ToolDefinition, ToolRisk } from '@g8n/workflow-schema';

export interface ToolContext {
  runId: string;
  userId: string;
  accessToken?: string;
  signal?: AbortSignal;
}

export interface ToolResult<T = unknown> {
  data: T;
  provider: ToolDefinition['provider'];
  durationMs: number;
}

export interface ToolProvider {
  readonly id: ToolDefinition['provider'];
  listTools(context: ToolContext): Promise<ToolDefinition[]>;
  callTool(name: string, input: unknown, context: ToolContext): Promise<ToolResult>;
}

export class ToolProviderRegistry {
  private readonly providers = new Map<string, ToolProvider>();

  register(provider: ToolProvider): void { this.providers.set(provider.id, provider); }
  get(id: string): ToolProvider {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Tool provider not registered: ${id}`);
    return provider;
  }
  async listTools(context: ToolContext): Promise<ToolDefinition[]> {
    return (await Promise.all([...this.providers.values()].map((provider) => provider.listTools(context)))).flat();
  }
}

export class WorkspaceMcpProvider implements ToolProvider {
  readonly id = 'workspace_mcp' as const;
  constructor(private readonly endpoints: Record<string, string>, private readonly fetcher: typeof fetch = fetch) {}

  async listTools(context: ToolContext): Promise<ToolDefinition[]> {
    const groups = await Promise.all(Object.entries(this.endpoints).map(async ([service, endpoint]) => {
      const response = await this.rpc(endpoint, 'tools/list', {}, context);
      return ((response as { tools?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown>; annotations?: { destructiveHint?: boolean; readOnlyHint?: boolean } }> }).tools ?? [])
        .map((tool) => ({
          name: `${service}.${tool.name}`,
          description: tool.description ?? `${service} MCP tool`,
          provider: this.id,
          risk: inferRisk(tool.name, tool.annotations),
          inputSchema: tool.inputSchema ?? { type: 'object' },
        } satisfies ToolDefinition));
    }));
    return groups.flat();
  }

  async callTool(name: string, input: unknown, context: ToolContext): Promise<ToolResult> {
    const [service, ...parts] = name.split('.');
    const endpoint = this.endpoints[service];
    if (!endpoint) throw new Error(`Unknown Workspace MCP service: ${service}`);
    const started = Date.now();
    const data = await this.rpc(endpoint, 'tools/call', { name: parts.join('.'), arguments: input }, context);
    return { data, provider: this.id, durationMs: Date.now() - started };
  }

  private async rpc(endpoint: string, method: string, params: unknown, context: ToolContext): Promise<unknown> {
    if (!context.accessToken) throw new Error('Workspace MCP requires an OAuth access token');
    const response = await this.fetcher(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${context.accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
      signal: context.signal,
    });
    if (!response.ok) throw new Error(`Workspace MCP ${method} failed (${response.status})`);
    const payload = await response.json() as { result?: unknown; error?: { message: string } };
    if (payload.error) throw new Error(payload.error.message);
    return payload.result;
  }
}

export function inferRisk(name: string, annotations?: { destructiveHint?: boolean; readOnlyHint?: boolean }): ToolRisk {
  if (annotations?.readOnlyHint) return 'read';
  if (annotations?.destructiveHint || /delete|remove|trash/i.test(name)) return 'delete';
  if (/send|publish/i.test(name)) return 'send';
  if (/share|permission/i.test(name)) return 'share';
  if (/draft/i.test(name)) return 'draft';
  if (/create|update|write|append|label|respond/i.test(name)) return 'write';
  return 'read';
}
