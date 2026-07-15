import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { ConditionNodeData } from '../../types';
import './nodes.css';



export function ConditionNode({ data, selected }: NodeProps) {
    const nodeData = data as ConditionNodeData & { isExecuting?: boolean };

    return (
        <div className={`custom-node condition-node ${selected ? 'selected' : ''} ${nodeData.isExecuting ? 'executing' : ''}`}>
            <Handle type="target" position={Position.Left} className="handle target-handle" />
            <div className="node-header">
                <span className="node-icon">◇</span>
                <span className="node-title">{nodeData.label}</span>
            </div>
            <div className="node-content">
                <div className="condition-categories">
                    {nodeData.categories?.map((category, index) => (
                        <div key={index} className="category-item" style={{ position: 'relative', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '10px' }}>
                            <span className="category-label">{category}</span>
                            <Handle
                                type="source"
                                position={Position.Right}
                                id={category}
                                className="handle source-handle category-handle"
                                style={{ top: '50%', right: '-8px' }}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
