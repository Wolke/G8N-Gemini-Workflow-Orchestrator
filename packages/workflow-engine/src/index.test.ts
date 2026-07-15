import { describe, expect, it } from 'vitest';
import { ToolProviderRegistry } from '@g8n/tool-providers';
import { DEFAULT_POLICY, type WorkflowDefinition } from '@g8n/workflow-schema';
import { WorkflowEngine } from './index';

const workflow: WorkflowDefinition = {
  id: 'flow', version: 1, name: 'Flow', policy: DEFAULT_POLICY,
  nodes: [
    { id: 'start', type: 'trigger.manual', position: { x: 0, y: 0 }, data: { label: 'Start' } },
    { id: 'approval', type: 'approval', position: { x: 1, y: 0 }, data: { label: 'Approve' } },
    { id: 'out', type: 'output', position: { x: 2, y: 0 }, data: { label: 'Output' } },
  ],
  edges: [{ id: 'a', source: 'start', target: 'approval' }, { id: 'b', source: 'approval', target: 'out' }],
};

describe('WorkflowEngine', () => {
  it('pauses, resumes and never repeats completed nodes', async () => {
    let startCalls = 0;
    const engine = new WorkflowEngine()
      .register('trigger.manual', { execute: async () => ({ output: ++startCalls }) })
      .register('approval', { execute: async () => ({ approval: { title: 'Confirm', summary: 'Write data', proposedActions: [{ tool: 'sheets.append', risk: 'write', input: {} }] } }) })
      .register('output', { execute: async (_node, context) => ({ output: context.variables.lastOutput }) });
    const context = { userId: 'u', input: {}, variables: {}, tools: new ToolProviderRegistry() };
    const paused = await engine.run(workflow, context);
    expect(paused.status).toBe('waiting_approval');
    const done = await engine.run(workflow, context, { resume: paused, approvalDecision: 'approved' });
    expect(done.status).toBe('completed');
    expect(startCalls).toBe(1);
  });
});
