export type WorkflowNodeType =
  | 'trigger.manual'
  | 'source.workspace'
  | 'agent.gemini'
  | 'condition'
  | 'transform'
  | 'approval'
  | 'tool'
  | 'output';

export type ToolRisk = 'read' | 'draft' | 'write' | 'send' | 'delete' | 'share' | 'grade';
export type RunStatus = 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: Record<string, unknown> & { label: string };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface WorkflowPolicy {
  maxSteps: number;
  timeoutMs: number;
  requireApprovalFor: ToolRisk[];
  allowedTools: string[];
}

export interface WorkflowDefinition {
  id: string;
  version: number;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  policy: WorkflowPolicy;
}

export interface ToolDefinition {
  name: string;
  description: string;
  provider: 'workspace_mcp' | 'gas' | 'gemini_builtin' | 'http';
  risk: ToolRisk;
  inputSchema: Record<string, unknown>;
}

export interface ToolConnectionRequirement {
  provider: ToolDefinition['provider'];
  service: string;
  scopes: string[];
  optional?: boolean;
}

export interface TemplateSampleData {
  title: string;
  description: string;
  input: Record<string, unknown>;
}

export interface AutomationMetricDefinition {
  id: string;
  label: string;
  unit: 'percent' | 'minutes' | 'count' | 'score';
  target: number;
  direction: 'higher' | 'lower';
}

export interface WorkflowTemplate {
  id: string;
  version: string;
  category: 'project_ops' | 'marketing_ops' | 'education_ops';
  title: string;
  description: string;
  workflow: WorkflowDefinition;
  requiredConnections: ToolConnectionRequirement[];
  sampleData: TemplateSampleData[];
  metrics: AutomationMetricDefinition[];
}

export interface ToolCallTrace {
  tool: string;
  risk: ToolRisk;
  input: unknown;
  output?: unknown;
  durationMs?: number;
  error?: string;
}

export interface StepTrace {
  nodeId: string;
  nodeType: WorkflowNodeType;
  status: 'running' | 'completed' | 'failed' | 'skipped' | 'waiting_approval';
  startedAt: string;
  endedAt?: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  toolCalls: ToolCallTrace[];
}

export interface ExecutionTrace {
  runId: string;
  workflowId: string;
  workflowVersion: number;
  status: RunStatus;
  startedAt: string;
  endedAt?: string;
  currentNodeId?: string;
  steps: StepTrace[];
  completedNodeIds: string[];
  variables: Record<string, unknown>;
  pendingApproval?: ApprovalRequest;
}

export interface ApprovalRequest {
  id: string;
  runId: string;
  nodeId: string;
  title: string;
  summary: string;
  proposedActions: Array<{ tool: string; risk: ToolRisk; input: unknown }>;
  status: 'pending' | 'approved' | 'rejected';
}

export const DEFAULT_POLICY: WorkflowPolicy = {
  maxSteps: 50,
  timeoutMs: 120_000,
  requireApprovalFor: ['write', 'send', 'delete', 'share', 'grade'],
  allowedTools: [],
};

export function validateWorkflow(workflow: WorkflowDefinition): string[] {
  const errors: string[] = [];
  const ids = new Set(workflow.nodes.map((node) => node.id));
  if (!workflow.id) errors.push('Workflow id is required');
  if (!workflow.name) errors.push('Workflow name is required');
  if (workflow.version < 1) errors.push('Workflow version must be at least 1');
  if (ids.size !== workflow.nodes.length) errors.push('Node ids must be unique');
  if (!workflow.nodes.some((node) => node.type === 'trigger.manual')) errors.push('A manual trigger is required');
  for (const edge of workflow.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) errors.push(`Edge ${edge.id} references a missing node`);
  }
  if (workflow.policy.maxSteps < 1) errors.push('Policy maxSteps must be positive');
  return errors;
}
