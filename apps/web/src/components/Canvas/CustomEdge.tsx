// Custom Edge Component with delete button

import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import { useWorkflowStore } from '../../stores';

export function CustomEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    selected,
    style = {},
    markerEnd,
}: EdgeProps) {
    const { setEdges } = useReactFlow();
    const { appMode, execution } = useWorkflowStore();

    const isRunMode = appMode === 'run';
    const isExecuting = execution.status === 'running';

    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const onEdgeDelete = () => {
        setEdges((edges) => edges.filter((edge) => edge.id !== id));
    };

    // Determine edge style based on state
    const edgeStyle = {
        ...style,
        stroke: selected ? '#ffffff' : '#5865f2',
        strokeWidth: selected ? 3 : 2,
    };

    // Animation only during run mode and when executing
    const shouldAnimate = isRunMode && isExecuting;

    return (
        <>
            <BaseEdge
                path={edgePath}
                markerEnd={markerEnd}
                style={edgeStyle}
                className={shouldAnimate ? 'animated-edge' : ''}
            />
            {selected && !isRunMode && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            pointerEvents: 'all',
                        }}
                        className="edge-delete-button"
                    >
                        <button onClick={onEdgeDelete} title="Delete connection">
                            ✕
                        </button>
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}
