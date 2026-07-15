import { useState } from 'react';
import { workflowTemplates } from '@g8n/templates';
import type { WorkflowTemplate, WorkflowNode as TemplateNode } from '@g8n/workflow-schema';
import type { WorkflowNode, WorkflowEdge, NodeType, ToolNodeData } from '../../types';
import { useWorkflowStore } from '../../stores';
import './TemplateGallery.css';

const typeMap: Record<TemplateNode['type'], NodeType> = {
  'trigger.manual': 'start',
  'source.workspace': 'tool',
  'agent.gemini': 'agent',
  condition: 'condition',
  transform: 'agent',
  approval: 'approval',
  tool: 'tool',
  output: 'output',
};

function toLegacyNode(node: TemplateNode): WorkflowNode {
  const type = typeMap[node.type];
  const base = { ...node.data, label: node.data.label };
  let data: WorkflowNode['data'];
  if (type === 'start') data = { ...base, inputVariables: [{ name: 'input', type: 'string', description: 'Template input' }] } as WorkflowNode['data'];
  else if (type === 'agent') data = { ...base, model: 'gemini-2.5-flash', systemPrompt: String(node.data.systemPrompt || `Execute this step: ${node.data.label}`), temperature: 0.3, enabledTools: [] } as WorkflowNode['data'];
  else if (type === 'tool') data = { ...base, toolType: 'mcp', config: { functionDescription: String(node.data.tools || 'Workspace MCP tools') } } as ToolNodeData;
  else if (type === 'condition') data = { ...base, categories: ['Continue', 'Stop'], examples: [], model: 'gemini-2.5-flash' } as WorkflowNode['data'];
  else if (type === 'approval') data = { ...base, summary: String(node.data.summary || 'Review all proposed Workspace actions.'), risks: node.data.risks || ['write'] } as WorkflowNode['data'];
  else data = { ...base, outputFormat: 'markdown' } as WorkflowNode['data'];
  return { id: node.id, type, position: node.position, data };
}

export function TemplateGallery() {
  const [open, setOpen] = useState(true);

  const importTemplate = (template: WorkflowTemplate) => {
    const confirmed = useWorkflowStore.getState().nodes.length === 0 || window.confirm('目前畫布會被範本取代，確定繼續？');
    if (!confirmed) return;
    useWorkflowStore.setState({
      nodes: template.workflow.nodes.map(toLegacyNode),
      edges: template.workflow.edges as WorkflowEdge[],
      workflowName: template.title,
      workflowDescription: template.description,
      selectedNodeId: null,
    });
  };

  return (
    <section className="template-gallery">
      <button className="template-gallery-toggle" onClick={() => setOpen(!open)}>
        <span>🏆 Workspace Automation Gallery</span><span>{open ? '−' : '+'}</span>
      </button>
      {open && <div className="template-list">
        {workflowTemplates.map((template) => (
          <article className="template-card" key={template.id}>
            <div className="template-category">{template.category.replace('_', ' ')}</div>
            <h4>{template.title}</h4>
            <p>{template.description}</p>
            <div className="template-stats">
              <span>{template.workflow.nodes.length} nodes</span>
              <span>{template.requiredConnections.length} connections</span>
              <span>{template.metrics.length} KPI</span>
            </div>
            <div className="template-target">目標：{template.metrics[0]?.label} {template.metrics[0]?.target}{template.metrics[0]?.unit === 'percent' ? '%' : ''}</div>
            <button onClick={() => importTemplate(template)}>一鍵匯入</button>
          </article>
        ))}
      </div>}
    </section>
  );
}
