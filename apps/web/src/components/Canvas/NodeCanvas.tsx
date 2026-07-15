// Node Canvas Component - Main workflow canvas

import { useCallback } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    BackgroundVariant,
    NodeTypes,
    EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useWorkflowStore } from '../../stores';
import { StartNode, AgentNode, ToolNode, ConditionNode, OutputNode, MemoryNode, ApprovalNode } from '../Nodes';
import { CustomEdge } from './CustomEdge';
import './NodeCanvas.css';

const nodeTypes: NodeTypes = {
    start: StartNode,
    agent: AgentNode,
    tool: ToolNode,
    condition: ConditionNode,
    output: OutputNode,
    memory: MemoryNode,
    approval: ApprovalNode,
};

const edgeTypes: EdgeTypes = {
    default: CustomEdge,
};

export function NodeCanvas() {
    const {
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        onConnect,
        selectNode,
        execution,
        appMode
    } = useWorkflowStore();

    const isRunMode = appMode === 'run';

    const styledNodes = nodes.map(node => ({
        ...node,
        data: {
            ...node.data,
            isExecuting: execution.currentNodeId === node.id
        }
    }));

    const onNodeClick = useCallback((_: React.MouseEvent, node: { id: string }) => {
        selectNode(node.id);
    }, [selectNode]);

    const onPaneClick = useCallback(() => {
        selectNode(null);
    }, [selectNode]);

    return (
        <div className="canvas-container">
            <ReactFlow
                nodes={styledNodes}
                edges={edges}
                onNodesChange={isRunMode ? undefined : onNodesChange}
                onEdgesChange={isRunMode ? undefined : onEdgesChange}
                onConnect={isRunMode ? undefined : onConnect}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                nodesDraggable={!isRunMode}
                nodesConnectable={!isRunMode}
                elementsSelectable={!isRunMode}
                edgesReconnectable={!isRunMode}
                deleteKeyCode={isRunMode ? null : ['Backspace', 'Delete']}
                isValidConnection={(connection) => {
                    // Restrict connections to the "Tools" handle
                    if (connection.targetHandle === 'tools') {
                        return connection.sourceHandle === 'tool-output';
                    }
                    if (connection.sourceHandle === 'tool-output') {
                        return connection.targetHandle === 'tools';
                    }
                    // Restrict connections to the "Memory" handle
                    if (connection.targetHandle === 'memory') {
                        return connection.sourceHandle === 'memory-output';
                    }
                    if (connection.sourceHandle === 'memory-output') {
                        return connection.targetHandle === 'memory';
                    }
                    return true;
                }}
                fitView
                proOptions={{ hideAttribution: true }}
                defaultEdgeOptions={{
                    style: { stroke: '#5865f2', strokeWidth: 2 },
                    type: 'default',
                }}
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={20}
                    size={1}
                    color="#3d3d5c"
                />
                <Controls className="canvas-controls" />
                <MiniMap
                    className="canvas-minimap"
                    nodeColor={(node) => {
                        switch (node.type) {
                            case 'start': return '#43b581';
                            case 'agent': return '#5865f2';
                            case 'tool': return '#faa61a';
                            case 'memory': return '#9b59b6';
                            case 'condition': return '#f04747';
                            case 'approval': return '#00b0f4';
                            case 'output': return '#808090';
                            default: return '#808090';
                        }
                    }}
                    maskColor="rgba(0, 0, 0, 0.8)"
                />
            </ReactFlow>
        </div>
    );
}
