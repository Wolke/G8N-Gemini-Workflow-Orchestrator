import { describe, expect, it } from 'vitest';
import { validateWorkflow } from '@g8n/workflow-schema';
import { evaluationDatasets, workflowTemplates } from './index';

describe('official workflow templates', () => {
  it.each(workflowTemplates)('$title is valid and measurable', (template) => {
    expect(validateWorkflow(template.workflow)).toEqual([]);
    expect(template.requiredConnections.length).toBeGreaterThan(1);
    expect(template.sampleData.length).toBeGreaterThan(0);
    expect(template.metrics.length).toBeGreaterThanOrEqual(3);
  });
});

describe('evaluation datasets', () => {
  it.each(Object.entries(evaluationDatasets))('%s has 20 fixed cases', (_category, cases) => {
    expect(cases).toHaveLength(20);
    expect(new Set(cases.map((item) => item.id)).size).toBe(20);
  });
});
