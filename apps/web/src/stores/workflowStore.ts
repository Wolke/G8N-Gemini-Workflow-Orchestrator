// Zustand store for workflow state management

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    WorkflowNode,
    WorkflowEdge,
    Workflow,
    ExecutionContext,
    AppSettings,
    NodeType,
    StartNodeData,
    AgentNodeData,
    ToolNodeData,
    ConditionNodeData,
    OutputNodeData,
    MemoryNodeData,
    ApprovalNodeData,
    GasConfig,
    DEFAULT_GAS_CONFIG,
    GasAuthState,
    DEFAULT_GAS_AUTH_STATE,
} from '../types';
import {
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
    Connection,
    NodeChange,
    EdgeChange,
} from '@xyflow/react';

// Default node data factories
const createDefaultNodeData = (type: NodeType): WorkflowNode['data'] => {
    switch (type) {
        case 'start':
            return {
                label: 'Start',
                inputVariables: [{ name: 'input', type: 'string', description: 'User input' }],
            } as StartNodeData;
        case 'agent':
            return {
                label: 'Agent',
                model: 'gemini-2.5-flash',
                systemPrompt: 'You are a helpful assistant.',
                temperature: 0.7,
                enabledTools: [],
            } as AgentNodeData;
        case 'tool':
            return {
                label: 'Tool',
                toolType: 'google_search',
                config: {},
            } as ToolNodeData;
        case 'condition':
            return {
                label: 'Classify',
                categories: ['Category 1', 'Category 2'],
                examples: [],
                model: 'gemini-2.5-flash',
            } as ConditionNodeData;
        case 'approval':
            return {
                label: 'Approval',
                summary: 'Review the proposed Workspace actions before continuing.',
                risks: ['write'],
            } as ApprovalNodeData;
        case 'output':
            return {
                label: 'Output',
                outputFormat: 'text',
            } as OutputNodeData;
        case 'memory':
            return {
                label: 'Memory',
                storageKey: 'chat_history',
                maxMessages: 10,
            } as MemoryNodeData;
    }
};

export type AppMode = 'edit' | 'run';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

interface WorkflowState {
    // Current workflow
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    workflowName: string;
    workflowDescription: string;

    // Saved workflows
    savedWorkflows: Workflow[];

    // Selected node for property panel
    selectedNodeId: string | null;

    // Execution state
    execution: ExecutionContext;

    // App settings
    settings: AppSettings;

    // App mode (edit or run)
    appMode: AppMode;

    // Chat messages for run mode
    chatMessages: ChatMessage[];

    // GAS configuration
    gasConfig: GasConfig;

    // GAS auth state
    gasAuth: GasAuthState;

    // Actions
    onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void;
    onEdgesChange: (changes: EdgeChange<WorkflowEdge>[]) => void;
    onConnect: (connection: Connection) => void;
    addNode: (type: NodeType, position: { x: number; y: number }) => void;
    updateNodeData: (nodeId: string, data: Partial<WorkflowNode['data']>) => void;
    deleteNode: (nodeId: string) => void;
    selectNode: (nodeId: string | null) => void;

    // Workflow management
    saveWorkflow: () => void;
    loadWorkflow: (workflowId: string) => void;
    newWorkflow: () => void;
    deleteWorkflow: (workflowId: string) => void;

    // Settings
    updateSettings: (settings: Partial<AppSettings>) => void;

    // Execution
    setExecutionStatus: (status: ExecutionContext['status']) => void;
    addExecutionStep: (step: ExecutionContext['history'][0]) => void;
    resetExecution: () => void;

    // App mode
    setAppMode: (mode: AppMode) => void;

    // Chat
    addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
    clearChatMessages: () => void;

    // GAS actions
    updateGasConfig: (config: Partial<GasConfig>) => void;
    setGasSyncStatus: (status: GasConfig['syncStatus']) => void;
    exportWorkflow: () => Workflow;

    // GAS auth actions
    setGasAuth: (auth: Partial<GasAuthState>) => void;
    gasLogout: () => void;
    loadWorkflowFromGas: (workflow: Workflow) => void;
}

const initialExecution: ExecutionContext = {
    variables: {},
    history: [],
    currentNodeId: null,
    status: 'idle',
};

const initialSettings: AppSettings = {
    geminiApiKey: '',
    gcpClientId: '',
    gcpApiKey: '',
    defaultModel: 'gemini-2.5-flash',
    theme: 'dark',
};

export const useWorkflowStore = create<WorkflowState>()(
    persist(
        (set, get) => ({
            nodes: [],
            edges: [],
            workflowName: 'New Workflow',
            workflowDescription: '',
            savedWorkflows: [],
            selectedNodeId: null,
            execution: initialExecution,
            settings: initialSettings,
            appMode: 'edit' as AppMode,
            chatMessages: [],
            gasConfig: DEFAULT_GAS_CONFIG,
            gasAuth: DEFAULT_GAS_AUTH_STATE,

            onNodesChange: (changes) => {
                set({
                    nodes: applyNodeChanges(changes, get().nodes),
                });
            },

            onEdgesChange: (changes) => {
                set({
                    edges: applyEdgeChanges(changes, get().edges),
                });
            },

            onConnect: (connection) => {
                set({
                    edges: addEdge(connection, get().edges),
                });
            },

            addNode: (type, position) => {
                const newNode: WorkflowNode = {
                    id: `${type}-${Date.now()}`,
                    type,
                    position,
                    data: createDefaultNodeData(type),
                };
                set({
                    nodes: [...get().nodes, newNode],
                });
            },

            updateNodeData: (nodeId, data) => {
                set({
                    nodes: get().nodes.map((node) =>
                        node.id === nodeId
                            ? { ...node, data: { ...node.data, ...data } }
                            : node
                    ),
                });
            },

            deleteNode: (nodeId) => {
                set({
                    nodes: get().nodes.filter((node) => node.id !== nodeId),
                    edges: get().edges.filter(
                        (edge) => edge.source !== nodeId && edge.target !== nodeId
                    ),
                    selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
                });
            },

            selectNode: (nodeId) => {
                set({ selectedNodeId: nodeId });
            },

            saveWorkflow: () => {
                const { nodes, edges, workflowName, workflowDescription, savedWorkflows } = get();
                const now = new Date().toISOString();
                const existingIndex = savedWorkflows.findIndex(
                    (w) => w.name === workflowName
                );

                const workflow: Workflow = {
                    id: existingIndex >= 0 ? savedWorkflows[existingIndex].id : `workflow-${Date.now()}`,
                    name: workflowName,
                    description: workflowDescription,
                    nodes,
                    edges,
                    createdAt: existingIndex >= 0 ? savedWorkflows[existingIndex].createdAt : now,
                    updatedAt: now,
                };

                if (existingIndex >= 0) {
                    const updated = [...savedWorkflows];
                    updated[existingIndex] = workflow;
                    set({ savedWorkflows: updated });
                } else {
                    set({ savedWorkflows: [...savedWorkflows, workflow] });
                }
            },

            loadWorkflow: (workflowId) => {
                const workflow = get().savedWorkflows.find((w) => w.id === workflowId);
                if (workflow) {
                    set({
                        nodes: workflow.nodes,
                        edges: workflow.edges,
                        workflowName: workflow.name,
                        workflowDescription: workflow.description || '',
                        selectedNodeId: null,
                        execution: initialExecution,
                    });
                }
            },

            newWorkflow: () => {
                set({
                    nodes: [],
                    edges: [],
                    workflowName: 'New Workflow',
                    workflowDescription: '',
                    selectedNodeId: null,
                    execution: initialExecution,
                });
            },

            deleteWorkflow: (workflowId) => {
                set({
                    savedWorkflows: get().savedWorkflows.filter((w) => w.id !== workflowId),
                });
            },

            updateSettings: (newSettings) => {
                set({
                    settings: { ...get().settings, ...newSettings },
                });
            },

            setExecutionStatus: (status) => {
                set({
                    execution: { ...get().execution, status },
                });
            },

            addExecutionStep: (step) => {
                set({
                    execution: {
                        ...get().execution,
                        history: [...get().execution.history, step],
                        currentNodeId: step.nodeId,
                    },
                });
            },

            resetExecution: () => {
                set({ execution: initialExecution });
            },

            setAppMode: (mode) => {
                set({ appMode: mode });
            },

            addChatMessage: (message) => {
                const newMessage: ChatMessage = {
                    ...message,
                    id: `msg-${Date.now()}`,
                    timestamp: Date.now(),
                };
                set({ chatMessages: [...get().chatMessages, newMessage] });
            },

            clearChatMessages: () => {
                set({ chatMessages: [] });
            },

            // GAS actions
            updateGasConfig: (config) => {
                set({
                    gasConfig: { ...get().gasConfig, ...config },
                });
            },

            setGasSyncStatus: (status) => {
                set({
                    gasConfig: { ...get().gasConfig, syncStatus: status },
                });
            },

            exportWorkflow: () => {
                const { nodes, edges, workflowName, workflowDescription } = get();
                const now = new Date().toISOString();
                return {
                    id: `workflow-${Date.now()}`,
                    name: workflowName,
                    description: workflowDescription,
                    nodes,
                    edges,
                    createdAt: now,
                    updatedAt: now,
                };
            },

            // GAS auth actions
            setGasAuth: (auth) => {
                set({
                    gasAuth: { ...get().gasAuth, ...auth },
                });
            },

            gasLogout: () => {
                set({
                    gasAuth: DEFAULT_GAS_AUTH_STATE,
                });
            },

            loadWorkflowFromGas: (workflow) => {
                set({
                    nodes: workflow.nodes,
                    edges: workflow.edges,
                    workflowName: workflow.name,
                    workflowDescription: workflow.description || '',
                    selectedNodeId: null,
                    execution: initialExecution,
                });
            },
        }),
        {
            name: 'gemini-agent-builder-storage',
            partialize: (state) => ({
                savedWorkflows: state.savedWorkflows,
                settings: state.settings,
            }),
        }
    )
);
