import type { WorkflowTemplate } from '@g8n/workflow-schema';
import { edge, node, safePolicy } from '../shared';

export const educationOpsTemplate: WorkflowTemplate = {
  id: 'education-ops-assisted-grading', version: '1.0.0', category: 'education_ops',
  title: 'AI 教師評量助理', description: '依 Drive 評分規準產生初評與回饋；教師核准前不寫入正式成績。',
  workflow: {
    id: 'education-ops-assisted-grading', version: 1, name: 'AI 教師評量助理', policy: { ...safePolicy, requireApprovalFor: [...safePolicy.requireApprovalFor, 'grade'] },
    nodes: [
      node('trigger', 'trigger.manual', '選擇作業與評分規準', 0), node('source', 'source.workspace', '讀取 Drive 文件', 240),
      node('grade', 'agent.gemini', '產生結構化初評與依據', 480, { outputSchema: 'AssistedGrade' }),
      node('approve', 'approval', '教師審核與修正', 720, { risks: ['grade', 'write'] }),
      node('record', 'tool', '寫入 Sheets 與產生回饋草稿', 960), node('output', 'output', '評量報告', 1200),
    ],
    edges: [edge('trigger', 'source'), edge('source', 'grade'), edge('grade', 'approve'), edge('approve', 'record'), edge('record', 'output')],
  },
  requiredConnections: [
    { provider: 'workspace_mcp', service: 'Drive', scopes: ['drive.readonly', 'drive.file'] },
    { provider: 'workspace_mcp', service: 'Gmail', scopes: ['gmail.compose'] },
    { provider: 'gas', service: 'Sheets', scopes: ['spreadsheets'] },
  ],
  sampleData: [{ title: '系統設計作業', description: '依四項 rubric 提供分項建議，教師決定最終分數。', input: { assignment: 'system-design-01.pdf', rubric: 'system-design-rubric.md' } }],
  metrics: [
    { id: 'schema_compliance', label: '輸出格式合規率', unit: 'percent', target: 100, direction: 'higher' },
    { id: 'teacher_edit_rate', label: '教師修改率', unit: 'percent', target: 20, direction: 'lower' },
    { id: 'grading_minutes', label: '每份批改時間', unit: 'minutes', target: 8, direction: 'lower' },
  ],
};
