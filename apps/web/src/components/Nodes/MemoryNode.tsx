import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { MemoryNodeData } from '../../types';
import './nodes.css';

export function MemoryNode({ data, selected }: NodeProps) {
    const nodeData = data as MemoryNodeData & { isExecuting?: boolean };

    return (
        <div className={`custom-node memory-node ${selected ? 'selected' : ''} ${nodeData.isExecuting ? 'executing' : ''}`}>
            <Handle type="target" position={Position.Left} id="main-input" className="handle target-handle" />
            <div className="node-header">
                <span className="node-icon">🧠</span>
                <span className="node-title">{nodeData.label}</span>
            </div>
            <div className="node-content">
                <div className="memory-key">Key: {nodeData.storageKey || 'chat_history'}</div>
                <div className="memory-limit">Max: {nodeData.maxMessages || 10} messages</div>
            </div>
            <Handle
                type="source"
                position={Position.Top}
                id="memory-output"
                className="handle memory-handle-source"
                style={{ left: '50%', background: '#9b59b6', borderColor: '#9b59b6' }}
            />
        </div>
    );
}
