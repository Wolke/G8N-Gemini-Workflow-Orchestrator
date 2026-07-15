import { DEFAULT_POLICY, validateWorkflow, type ApprovalRequest, type ExecutionTrace, type StepTrace, type ToolRisk, type WorkflowDefinition, type WorkflowNode } from '@g8n/workflow-schema';
import type { ToolProviderRegistry } from '@g8n/tool-providers';

export interface RunContext {
  userId: string;
  input: Record<string, unknown>;
  variables: Record<string, unknown>;
  tools: ToolProviderRegistry;
  accessToken?: string;
  signal?: AbortSignal;
}

export interface NodeResult {
  output?: unknown;
  nextHandle?: string;
  toolCalls?: StepTrace['toolCalls'];
  approval?: Omit<ApprovalRequest, 'id' | 'runId' | 'nodeId' | 'status'>;
}

export interface NodeExecutor {
  validate?(node: WorkflowNode): string[];
  execute(node: WorkflowNode, context: RunContext): Promise<NodeResult>;
}

export interface RunOptions {
  resume?: ExecutionTrace;
  approvalDecision?: 'approved' | 'rejected';
  onTrace?: (trace: ExecutionTrace) => void | Promise<void>;
}

export class WorkflowEngine {
  private readonly executors = new Map<string, NodeExecutor>();

  register(type: WorkflowNode['type'], executor: NodeExecutor): this {
    this.executors.set(type, executor);
    return this;
  }

  async run(workflow: WorkflowDefinition, context: RunContext, options: RunOptions = {}): Promise<ExecutionTrace> {
    const errors = validateWorkflow({ ...workflow, policy: { ...DEFAULT_POLICY, ...workflow.policy } });
    for (const node of workflow.nodes) errors.push(...(this.executors.get(node.type)?.validate?.(node) ?? []));
    if (errors.length) throw new Error(`Invalid workflow: ${errors.join('; ')}`);

    const trace = options.resume ? structuredClone(options.resume) : createTrace(workflow, context.input);
    if (trace.status === 'waiting_approval') {
      if (!options.approvalDecision) return trace;
      if (options.approvalDecision === 'rejected') {
        trace.status = 'cancelled';
        if (trace.pendingApproval) trace.pendingApproval.status = 'rejected';
        trace.endedAt = new Date().toISOString();
        await options.onTrace?.(trace);
        return trace;
      }
      if (trace.pendingApproval) trace.pendingApproval.status = 'approved';
      trace.pendingApproval = undefined;
      trace.status = 'running';
    }

    const startedAt = Date.parse(trace.startedAt);
    let current = trace.currentNodeId
      ? workflow.nodes.find((node) => node.id === trace.currentNodeId)
      : workflow.nodes.find((node) => node.type === 'trigger.manual');

    while (current) {
      if (context.signal?.aborted) return this.finish(trace, 'cancelled', options);
      if (Date.now() - startedAt > workflow.policy.timeoutMs) return this.fail(trace, current, 'Workflow timed out', options);
      if (trace.steps.length >= workflow.policy.maxSteps) return this.fail(trace, current, 'Maximum step count exceeded', options);

      // An approved approval node is completed on resume without executing twice.
      if (current.type === 'approval' && options.approvalDecision === 'approved' && !trace.completedNodeIds.includes(current.id)) {
        trace.completedNodeIds.push(current.id);
        const waiting = [...trace.steps].reverse().find((step) => step.nodeId === current!.id && step.status === 'waiting_approval');
        if (waiting) { waiting.status = 'completed'; waiting.endedAt = new Date().toISOString(); }
        current = this.next(workflow, current);
        trace.currentNodeId = current?.id;
        options.approvalDecision = undefined;
        continue;
      }

      if (trace.completedNodeIds.includes(current.id)) {
        current = this.next(workflow, current);
        trace.currentNodeId = current?.id;
        continue;
      }

      const executor = this.executors.get(current.type);
      if (!executor) return this.fail(trace, current, `No executor registered for ${current.type}`, options);
      const step: StepTrace = { nodeId: current.id, nodeType: current.type, status: 'running', startedAt: new Date().toISOString(), input: context.variables.lastOutput ?? context.input, toolCalls: [] };
      trace.steps.push(step);
      trace.currentNodeId = current.id;
      await options.onTrace?.(trace);

      try {
        const result = await executor.execute(current, { ...context, variables: trace.variables });
        step.toolCalls = result.toolCalls ?? [];
        if (result.approval) {
          step.status = 'waiting_approval';
          trace.status = 'waiting_approval';
          trace.pendingApproval = { ...result.approval, id: crypto.randomUUID(), runId: trace.runId, nodeId: current.id, status: 'pending' };
          await options.onTrace?.(trace);
          return trace;
        }
        step.status = 'completed';
        step.output = result.output;
        step.endedAt = new Date().toISOString();
        trace.completedNodeIds.push(current.id);
        trace.variables[current.id] = result.output;
        trace.variables.lastOutput = result.output;
        current = this.next(workflow, current, result.nextHandle);
        trace.currentNodeId = current?.id;
        await options.onTrace?.(trace);
      } catch (error) {
        step.status = 'failed';
        step.error = error instanceof Error ? error.message : String(error);
        step.endedAt = new Date().toISOString();
        trace.status = 'failed';
        trace.endedAt = step.endedAt;
        await options.onTrace?.(trace);
        return trace;
      }
    }
    return this.finish(trace, 'completed', options);
  }

  private next(workflow: WorkflowDefinition, node: WorkflowNode, handle?: string): WorkflowNode | undefined {
    const edge = workflow.edges.find((candidate) => candidate.source === node.id && (!handle || candidate.sourceHandle === handle));
    return edge ? workflow.nodes.find((candidate) => candidate.id === edge.target) : undefined;
  }

  private async finish(trace: ExecutionTrace, status: 'completed' | 'cancelled', options: RunOptions) {
    trace.status = status;
    trace.currentNodeId = undefined;
    trace.endedAt = new Date().toISOString();
    await options.onTrace?.(trace);
    return trace;
  }

  private async fail(trace: ExecutionTrace, node: WorkflowNode, message: string, options: RunOptions) {
    trace.steps.push({ nodeId: node.id, nodeType: node.type, status: 'failed', startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), error: message, toolCalls: [] });
    trace.status = 'failed';
    trace.endedAt = new Date().toISOString();
    await options.onTrace?.(trace);
    return trace;
  }
}

export function createTrace(workflow: WorkflowDefinition, input: Record<string, unknown>): ExecutionTrace {
  return { runId: crypto.randomUUID(), workflowId: workflow.id, workflowVersion: workflow.version, status: 'running', startedAt: new Date().toISOString(), steps: [], completedNodeIds: [], variables: { input } };
}

export function requiresApproval(risk: ToolRisk, workflow: WorkflowDefinition): boolean {
  return workflow.policy.requireApprovalFor.includes(risk);
}
