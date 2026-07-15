import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { OutputNodeData } from '../../types';
import './nodes.css';

export function OutputNode({ data, selected }: NodeProps) {
    const nodeData = data as OutputNodeData & { isExecuting?: boolean };

    return (
        <div className={`custom-node output-node ${selected ? 'selected' : ''} ${nodeData.isExecuting ? 'executing' : ''}`}>
            <Handle type="target" position={Position.Left} className="handle target-handle" />
            <div className="node-header">
                <span className="node-icon">⬛</span>
                <span className="node-title">{nodeData.label}</span>
            </div>
            <div className="node-content">
                <div className="output-format">
                    Format: {nodeData.outputFormat?.toUpperCase()}
                </div>
            </div>
        </div>
    );
}
