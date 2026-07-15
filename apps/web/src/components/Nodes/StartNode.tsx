import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { StartNodeData } from '../../types';
import './nodes.css';

export function StartNode({ data, selected }: NodeProps) {
    const nodeData = data as StartNodeData & { isExecuting?: boolean };

    return (
        <div className={`custom-node start-node ${selected ? 'selected' : ''} ${nodeData.isExecuting ? 'executing' : ''}`}>
            <div className="node-header">
                <span className="node-icon">▶</span>
                <span className="node-title">{nodeData.label}</span>
            </div>
            <div className="node-content">
                <div className="node-info">
                    {nodeData.inputVariables?.length || 0} input variable(s)
                </div>
            </div>
            <Handle type="source" position={Position.Right} className="handle source-handle" />
        </div>
    );
}
