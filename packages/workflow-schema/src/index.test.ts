import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICY, validateWorkflow, type WorkflowDefinition } from './index';

describe('validateWorkflow', () => {
  it('accepts a connected workflow', () => {
    const workflow: WorkflowDefinition = {
      id: 'test', version: 1, name: 'Test', policy: DEFAULT_POLICY,
      nodes: [
        { id: 'start', type: 'trigger.manual', position: { x: 0, y: 0 }, data: { label: 'Start' } },
        { id: 'out', type: 'output', position: { x: 1, y: 0 }, data: { label: 'Output' } },
      ],
      edges: [{ id: 'e', source: 'start', target: 'out' }],
    };
    expect(validateWorkflow(workflow)).toEqual([]);
  });

  it('rejects implicit and dangling flows', () => {
    const workflow: WorkflowDefinition = { id: 'bad', version: 1, name: 'Bad', policy: DEFAULT_POLICY, nodes: [], edges: [{ id: 'e', source: 'x', target: 'y' }] };
    expect(validateWorkflow(workflow)).toContain('A manual trigger is required');
    expect(validateWorkflow(workflow)).toContain('Edge e references a missing node');
  });
});
