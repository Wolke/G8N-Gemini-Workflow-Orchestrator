import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { AgentNodeData } from '../../types';
import './nodes.css';

export function AgentNode({ data, selected }: NodeProps) {
    const nodeData = data as AgentNodeData & { isExecuting?: boolean };

    return (
        <div className={`custom-node agent-node ${selected ? 'selected' : ''} ${nodeData.isExecuting ? 'executing' : ''}`}>
            <Handle
                type="target"
                position={Position.Top}
                id="tools"
                className="handle tool-handle-target"
                style={{ left: '50%', background: '#faa61a', borderColor: '#faa61a' }}
            />
            <div className="tool-handle-label" style={{ position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)', fontSize: '10px', color: '#faa61a', fontWeight: 'bold' }}>Tools</div>
            <Handle
                type="target"
                position={Position.Left}
                id="main-input"
                className="handle target-handle"
            />
            <div className="node-header">
                <span className="node-icon">🤖</span>
                <span className="node-title">{nodeData.label}</span>
            </div>
            <div className="node-content">
                <div className="node-model">{nodeData.model}</div>
                <div className="node-prompt" title={nodeData.systemPrompt}>
                    {nodeData.systemPrompt?.slice(0, 50)}
                    {(nodeData.systemPrompt?.length ?? 0) > 50 ? '...' : ''}
                </div>
            </div>
            <Handle type="source" position={Position.Right} id="main-output" className="handle source-handle" />
            <Handle
                type="target"
                position={Position.Bottom}
                id="memory"
                className="handle memory-handle-target"
                style={{ left: '50%', background: '#9b59b6', borderColor: '#9b59b6' }}
            />
            <div className="memory-handle-label" style={{ position: 'absolute', bottom: '-20px', left: '50%', transform: 'translateX(-50%)', fontSize: '10px', color: '#9b59b6', fontWeight: 'bold' }}>Memory</div>
        </div>
    );
}
