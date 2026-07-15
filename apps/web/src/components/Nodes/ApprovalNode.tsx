import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ApprovalNodeData } from '../../types';
import './nodes.css';

export function ApprovalNode({ data, selected }: NodeProps) {
  const nodeData = data as ApprovalNodeData & { isExecuting?: boolean };
  return (
    <div className={`custom-node approval-node ${selected ? 'selected' : ''} ${nodeData.isExecuting ? 'executing' : ''}`}>
      <Handle type="target" position={Position.Left} className="handle target-handle" />
      <div className="node-header"><span className="node-icon">✓</span><span className="node-title">{nodeData.label}</span></div>
      <div className="node-content">
        <div>{nodeData.summary}</div>
        <div className="approval-risks">確認：{nodeData.risks?.join('、') || 'write'}</div>
      </div>
      <Handle type="source" position={Position.Right} className="handle source-handle" />
    </div>
  );
}
