import type { WorkflowTemplate } from '@g8n/workflow-schema';
import { edge, node, safePolicy } from '../shared';

export const marketingOpsTemplate: WorkflowTemplate = {
  id: 'marketing-ops-content-review', version: '1.0.0', category: 'marketing_ops',
  title: 'AI 行銷內容工廠', description: '從品牌 Brief 產生多語素材，經策略、文案及品質三階段審核後歸檔。',
  workflow: {
    id: 'marketing-ops-content-review', version: 1, name: 'AI 行銷內容工廠', policy: safePolicy,
    nodes: [
      node('trigger', 'trigger.manual', '選擇品牌 Brief', 0), node('source', 'source.workspace', '讀取 Sheets 與 Drive 素材', 220),
      node('strategy', 'agent.gemini', '產生三個策略角度', 450), node('approve-strategy', 'approval', '策略審核', 680),
      node('draft', 'agent.gemini', '產生多語文案與視覺方向', 910), node('approve-copy', 'approval', '文案審核', 1140),
      node('audit', 'agent.gemini', '品牌與品質稽核', 1370), node('approve-final', 'approval', '最終核准', 1600),
      node('archive', 'tool', '歸檔 Drive／Sheets 與通知', 1830), node('output', 'output', '內容資產包', 2060),
    ],
    edges: [edge('trigger', 'source'), edge('source', 'strategy'), edge('strategy', 'approve-strategy'), edge('approve-strategy', 'draft'), edge('draft', 'approve-copy'), edge('approve-copy', 'audit'), edge('audit', 'approve-final'), edge('approve-final', 'archive'), edge('archive', 'output')],
  },
  requiredConnections: [
    { provider: 'gas', service: 'Sheets', scopes: ['spreadsheets'] },
    { provider: 'workspace_mcp', service: 'Drive', scopes: ['drive.readonly', 'drive.file'] },
    { provider: 'workspace_mcp', service: 'Gmail', scopes: ['gmail.compose'] },
  ],
  sampleData: [{ title: 'G8N 2.0 發表活動', description: '繁中、英文與日文社群貼文。', input: { campaign: 'G8N 2.0 Launch', locales: ['zh-TW', 'en', 'ja'] } }],
  metrics: [
    { id: 'first_draft_minutes', label: '首稿時間', unit: 'minutes', target: 5, direction: 'lower' },
    { id: 'review_rounds', label: '平均審核輪數', unit: 'count', target: 2, direction: 'lower' },
    { id: 'locale_consistency', label: '多語品牌一致性', unit: 'percent', target: 90, direction: 'higher' },
  ],
};
