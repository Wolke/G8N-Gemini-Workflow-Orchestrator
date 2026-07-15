import { DEFAULT_POLICY, type WorkflowNode, type WorkflowPolicy } from '@g8n/workflow-schema';

export const safePolicy: WorkflowPolicy = { ...DEFAULT_POLICY, allowedTools: ['drive.*', 'gmail.create_draft', 'calendar.create_event', 'chat.send_message', 'gas.sheets_append'] };
export const node = (id: string, type: WorkflowNode['type'], label: string, x: number, data: Record<string, unknown> = {}): WorkflowNode => ({ id, type, position: { x, y: 120 }, data: { label, ...data } });
export const edge = (source: string, target: string, sourceHandle?: string) => ({ id: `${source}-${target}`, source, target, ...(sourceHandle ? { sourceHandle } : {}) });
