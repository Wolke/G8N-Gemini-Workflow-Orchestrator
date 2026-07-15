import type { WorkflowTemplate } from '@g8n/workflow-schema';
import { edge, node, safePolicy } from '../shared';

export const projectOpsTemplate: WorkflowTemplate = {
  id: 'project-ops-meeting-to-action', version: '1.0.0', category: 'project_ops',
  title: 'AI 專案參謀', description: '將 Drive 會議紀錄轉為決策、待辦、風險與可核准的 Workspace 行動。',
  workflow: {
    id: 'project-ops-meeting-to-action', version: 1, name: 'AI 專案參謀', policy: safePolicy,
    nodes: [
      node('trigger', 'trigger.manual', '選擇會議紀錄', 0),
      node('source', 'source.workspace', '讀取 Drive 與專案脈絡', 230, { tools: ['drive.read_file_content', 'gmail.search_threads', 'calendar.list_events'] }),
      node('analyze', 'agent.gemini', '萃取決策、待辦與風險', 500, { outputSchema: 'ProjectDigest' }),
      node('approve', 'approval', '確認後續行動', 770, { risks: ['write', 'send'] }),
      node('actions', 'tool', '建立草稿、行程與任務', 1040, { tools: ['gmail.create_draft', 'calendar.create_event', 'chat.send_message', 'gas.sheets_append'] }),
      node('output', 'output', '專案行動報告', 1310),
    ],
    edges: [edge('trigger', 'source'), edge('source', 'analyze'), edge('analyze', 'approve'), edge('approve', 'actions'), edge('actions', 'output')],
  },
  requiredConnections: [
    { provider: 'workspace_mcp', service: 'Drive', scopes: ['drive.readonly'] },
    { provider: 'workspace_mcp', service: 'Gmail', scopes: ['gmail.readonly', 'gmail.compose'] },
    { provider: 'workspace_mcp', service: 'Calendar', scopes: ['calendar.events.readonly', 'calendar.events'] },
    { provider: 'workspace_mcp', service: 'Chat', scopes: ['chat.messages.create'] },
    { provider: 'gas', service: 'Sheets', scopes: ['spreadsheets'] },
  ],
  sampleData: [{ title: '產品週會', description: '包含三項決策、四項待辦與一項延期風險。', input: { driveFileName: 'G8N 產品週會 2026-07-14' } }],
  metrics: [
    { id: 'action_recall', label: '待辦擷取召回率', unit: 'percent', target: 90, direction: 'higher' },
    { id: 'owner_due_accuracy', label: '負責人與期限正確率', unit: 'percent', target: 90, direction: 'higher' },
    { id: 'minutes_saved', label: '每場會議節省時間', unit: 'minutes', target: 20, direction: 'higher' },
  ],
};
