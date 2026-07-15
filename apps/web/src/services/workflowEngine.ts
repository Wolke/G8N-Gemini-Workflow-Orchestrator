// Workflow Execution Engine - Orchestrates node execution

import { useWorkflowStore } from '../stores/workflowStore';
import { generateContent, initializeGemini } from './geminiService';
import { getGcpFunctionDeclarations, executeGcpFunction } from './gcpApiExecutor';
import { gasToolExecutor, getGasNativeFunctionDeclarations, isGasNativeFunction } from './gasToolExecutor';
import { GCP_API_TOOLS, GAS_NATIVE_TOOLS } from '../types/nodes';
import type {
    WorkflowNode,
    ExecutionStep,
    NodeType,
    AgentNodeData,
    ConditionNodeData,
    ToolNodeData,
    OutputNodeData,
    MemoryNodeData,
    ApprovalNodeData,
    GcpApiTool,
    GasNativeTool
} from '../types';

export class WorkflowEngine {
    private static isRunning = false;

    /**
     * Runs the current workflow stored in useWorkflowStore
     * @param userInput - The initial user input to pass through the workflow
     * @returns The final output from the workflow
     */
    static async run(userInput: string = ''): Promise<any> {
        if (this.isRunning) return null;

        const store = useWorkflowStore.getState();
        const { nodes, edges, settings } = store;

        // Validation
        if (!settings.geminiApiKey) {
            console.error('Gemini API Key missing');
            store.setExecutionStatus('error');
            return;
        }

        const startNode = nodes.find(n => n.type === 'start');
        if (!startNode) {
            console.error('Start node not found');
            store.setExecutionStatus('error');
            return;
        }

        this.isRunning = true;

        try {
            // Initialization
            initializeGemini(settings.geminiApiKey);
            store.resetExecution();
            store.setExecutionStatus('running');

            let currentNode: WorkflowNode | undefined = startNode;
            const variables: Record<string, unknown> = {
                user_input: userInput,
                last_output: userInput,
            };
            let finalOutput: any = null;

            while (currentNode) {
                const startTime = Date.now();
                const nodeType = currentNode.type as NodeType;

                // 1. Execute current node logic
                const result = await this.executeNode(currentNode, variables, edges, nodes);

                // 2. Record execution step
                const step: ExecutionStep = {
                    nodeId: currentNode.id,
                    nodeType: nodeType,
                    input: { ...variables },
                    output: result,
                    startTime,
                    endTime: Date.now(),
                };
                store.addExecutionStep(step);

                // 3. Update execution context variables
                if (result !== undefined && result !== null) {
                    variables[`${currentNode.id}_output`] = result;
                    // For text-based nodes, update the 'last_output' for convenience
                    if (typeof result === 'string') {
                        variables['last_output'] = result;
                    } else if (typeof result === 'object' && 'text' in (result as any)) {
                        variables['last_output'] = (result as any).text;
                    }
                    // Capture output node result as final output
                    if (currentNode.type === 'output') {
                        finalOutput = variables['last_output'] || result;
                    }
                }

                // 4. Determine next node based on edges and result
                currentNode = this.getNextNode(currentNode, edges, nodes, result);

                // Small delay for visual perception of flow
                await new Promise(resolve => setTimeout(resolve, 600));
            }

            store.setExecutionStatus('completed');
            return finalOutput;
        } catch (error: any) {
            console.error('Workflow execution failed:', error);
            store.setExecutionStatus('error');

            // Extract meaningful error message
            let errorMessage = 'Workflow execution failed.';
            if (error?.message) {
                if (error.message.includes('429') || error.message.includes('quota')) {
                    errorMessage = '⏳ API quota exceeded. Please try again later (approx. 1 min) or change API Key.';
                } else if (error.message.includes('401') || error.message.includes('API key')) {
                    errorMessage = '🔑 Invalid API Key. Please check settings.';
                } else {
                    errorMessage = `❌ ${error.message.slice(0, 200)}`;
                }
            }

            return { error: true, message: errorMessage };
        } finally {
            this.isRunning = false;
        }
    }

    private static async executeNode(
        node: WorkflowNode,
        variables: Record<string, unknown>,
        edges: any[],
        allNodes: WorkflowNode[]
    ): Promise<any> {
        const data = node.data;

        switch (node.type) {
            case 'start': {
                // Pass through user input
                return variables['user_input'] || 'Workflow started';
            }

            case 'agent': {
                const agentData = data as AgentNodeData;
                // Use last_output as the prompt if available, otherwise use a default
                const userMessage = (variables['last_output'] as string) || "Hello, how can you help me today?";

                // Resolve connected tools
                // We use allNodes to look up the node data for connected edges
                const toolEdges = edges.filter(e => e.target === node.id && e.targetHandle === 'tools');
                const connectedTools = toolEdges.map(e => allNodes.find(n => n.id === e.source)).filter(n => n?.type === 'tool');

                const toolsConfig = {
                    codeExecution: false,
                    googleSearch: false,
                    googleMaps: false,
                    functionDeclarations: [] as any[],
                };

                // Collect GCP tools for function calling
                const gcpTools: GcpApiTool[] = [];
                // Collect GAS Native tools for function calling
                const gasNativeTools: GasNativeTool[] = [];

                // Helper to merge tool config
                connectedTools.forEach(toolNode => {
                    const tData = toolNode?.data as ToolNodeData;
                    if (!tData) return;

                    // Gemini built-in tools
                    if (tData.toolType === 'code_execution') toolsConfig.codeExecution = true;
                    if (tData.toolType === 'google_search') toolsConfig.googleSearch = true;
                    if (tData.toolType === 'google_maps') toolsConfig.googleMaps = true;

                    // Check if it's a GCP API tool
                    if (GCP_API_TOOLS.includes(tData.toolType as GcpApiTool)) {
                        gcpTools.push(tData.toolType as GcpApiTool);
                    }

                    // Check if it's a GAS Native tool
                    if (GAS_NATIVE_TOOLS.includes(tData.toolType as GasNativeTool)) {
                        gasNativeTools.push(tData.toolType as GasNativeTool);
                    }
                });

                // Add GCP function declarations to toolsConfig
                if (gcpTools.length > 0) {
                    const gcpFunctions = getGcpFunctionDeclarations(gcpTools);
                    toolsConfig.functionDeclarations.push(...gcpFunctions);
                }

                // Add GAS Native function declarations to toolsConfig
                if (gasNativeTools.length > 0) {
                    const gasFunctions = getGasNativeFunctionDeclarations(gasNativeTools);
                    toolsConfig.functionDeclarations.push(...gasFunctions);
                    console.log('[WorkflowEngine] Added GAS Native function declarations:', gasFunctions.map(f => f.name));
                }

                // Fallback to legacy checkbox property if no connections
                if (connectedTools.length === 0 && agentData.enabledTools) {
                    if (agentData.enabledTools.includes('code_execution')) toolsConfig.codeExecution = true;
                    if (agentData.enabledTools.includes('google_search')) toolsConfig.googleSearch = true;
                    if (agentData.enabledTools.includes('google_maps')) toolsConfig.googleMaps = true;
                }

                // Resolve connected memory node
                const memoryEdges = edges.filter(e => e.target === node.id && e.targetHandle === 'memory');
                const connectedMemoryNode = memoryEdges.map(e => allNodes.find(n => n.id === e.source)).find(n => n?.type === 'memory');

                let conversationHistory: { role: string; content: string }[] = [];
                let storageKey = 'chat_history';
                let maxMessages = 10;

                if (connectedMemoryNode) {
                    const memData = connectedMemoryNode.data as MemoryNodeData;
                    storageKey = memData.storageKey || 'chat_history';
                    maxMessages = memData.maxMessages || 10;

                    try {
                        const stored = localStorage.getItem(storageKey);
                        if (stored) {
                            conversationHistory = JSON.parse(stored);
                        }
                    } catch (e) {
                        console.warn('[WorkflowEngine] Failed to parse memory:', e);
                    }
                }

                // Build prompt with conversation history
                let prompt = userMessage;
                if (conversationHistory.length > 0) {
                    const historyText = conversationHistory
                        .slice(-maxMessages)
                        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
                        .join('\n\n');
                    prompt = `Previous conversation:\n${historyText}\n\nUser: ${userMessage}`;
                }

                let result = await generateContent(prompt, agentData.systemPrompt, toolsConfig);

                // Handle function calls if present (both GCP and GAS Native)
                if (result.functionCalls && result.functionCalls.length > 0) {
                    const functionResults: string[] = [];
                    const { gasConfig } = useWorkflowStore.getState();

                    for (const fc of result.functionCalls) {
                        console.log(`[WorkflowEngine] Function call requested: ${fc.name}`, fc.args);

                        let fcResult: unknown;

                        // Check if it's a GAS Native function
                        if (isGasNativeFunction(fc.name)) {
                            console.log(`[WorkflowEngine] Executing GAS Native function: ${fc.name}`);
                            const gasCallConfig = {
                                webAppUrl: gasConfig.webAppUrl || '',
                                apiToken: gasConfig.apiToken || undefined,
                            };

                            if (!gasCallConfig.webAppUrl) {
                                fcResult = {
                                    error: true,
                                    message: 'GAS Web App URL not configured. Please deploy your project first.'
                                };
                            } else {
                                try {
                                    fcResult = await gasToolExecutor.executeByFunctionName(fc.name, fc.args, gasCallConfig);
                                } catch (error: any) {
                                    fcResult = { error: true, message: error.message };
                                }
                            }
                        } else {
                            // It's a GCP function
                            console.log(`[WorkflowEngine] Executing GCP function: ${fc.name}`);
                            fcResult = await executeGcpFunction(fc.name, fc.args);
                        }

                        functionResults.push(`Function ${fc.name} result:\n${JSON.stringify(fcResult, null, 2)}`);
                    }

                    // Generate a follow-up response with function results
                    const functionContext = functionResults.join('\n\n');
                    const followUpPrompt = `${prompt}\n\n[System] API call executed, results start:\n${functionContext}\n\nPlease answer the user's question based on the API results above.`;

                    result = await generateContent(followUpPrompt, agentData.systemPrompt, {
                        codeExecution: false,
                        googleSearch: false,
                        googleMaps: false,
                        functionDeclarations: [],
                    });
                }

                // Save to memory if connected
                if (connectedMemoryNode) {
                    conversationHistory.push({ role: 'user', content: userMessage });
                    conversationHistory.push({ role: 'assistant', content: result.text || '' });
                    // Keep only last N messages
                    const trimmed = conversationHistory.slice(-(maxMessages * 2));
                    try {
                        localStorage.setItem(storageKey, JSON.stringify(trimmed));
                    } catch (e) {
                        console.warn('[WorkflowEngine] Failed to save memory:', e);
                    }
                }

                return result;
            }

            case 'approval': {
                const approval = data as ApprovalNodeData;
                const accepted = window.confirm(
                    `${approval.label}\n\n${approval.summary}\n\nRisk: ${(approval.risks || []).join(', ')}\n\nApprove these actions?`
                );
                if (!accepted) throw new Error('Workflow cancelled by reviewer');
                return { approved: true, reviewedAt: new Date().toISOString(), content: variables['last_output'] };
            }

            case 'condition': {
                const condData = data as ConditionNodeData;
                const input = String(variables[condData.inputVariable || 'last_output'] || "");

                // Construct prompt for classification
                let prompt = `You are a text classifier. Classify the following input into one of these categories: ${condData.categories?.join(', ')}.\n`;
                prompt += `Return ONLY the exact category name. Do not explain. If it doesn't fit any, return "Unclassified".\n\n`;

                if (condData.examples && condData.examples.length > 0) {
                    prompt += "Examples:\n";
                    condData.examples.forEach(ex => {
                        prompt += `Input: "${ex.text}"\nCategory: ${ex.category}\n`;
                    });
                    prompt += "\n";
                }

                prompt += `Input: "${input}"\nCategory:`;

                try {
                    const result = await generateContent(
                        prompt,
                        undefined,
                        undefined,
                        condData.model || 'gemini-2.5-flash'
                    );

                    const classifiedCategory = result.text?.trim() || "Unclassified";

                    // Verify if the result matches one of our categories (case insensitive check, but return exact match)
                    const matchedCategory = condData.categories?.find(c => c.toLowerCase() === classifiedCategory.toLowerCase());

                    return matchedCategory || "Unclassified";

                } catch (e) {
                    console.error('Classification failed', e);
                    return "Error";
                }
            }

            case 'tool': {
                const toolData = data as ToolNodeData;

                // Check if it's a GAS Native tool
                if (GAS_NATIVE_TOOLS.includes(toolData.toolType as GasNativeTool)) {
                    const { gasConfig } = useWorkflowStore.getState();
                    const gasCallConfig = {
                        webAppUrl: gasConfig.webAppUrl || '',
                        apiToken: gasConfig.apiToken || undefined,
                    };

                    try {
                        const result = await gasToolExecutor.execute(
                            toolData.toolType as GasNativeTool,
                            { ...toolData.config, input: variables['last_output'] },
                            gasCallConfig
                        );
                        return result;
                    } catch (error: any) {
                        return { error: true, message: error.message };
                    }
                }

                // For tools like Google Maps or Search, they are often executed AS PART of an Agent node.
                // However, if this is a standalone Tool node meant to output to an Agent...
                // Currently our flow is Agent -> (internal tools) -> Output.
                // If we have standalone tool nodes, they might need to be passed to the NEXT agent as context.
                // For now, we'll return the configuration so the *next* Agent node can potentially use it 
                // (if we implement a "Use Previous Tool Output" logic).

                // BUT, if this is merely defining a tool config that an Agent connects to:
                // The current architecture seems to define tools IN the Agent Node properties (enabledTools).
                // Standalone Tool Nodes might be for specific actions.

                if (toolData.toolType === 'google_maps') {
                    return {
                        tool: 'google_maps',
                        status: 'configured',
                        description: 'Google Maps Grounding enabled'
                    };
                }

                if (toolData.toolType === 'mcp') {
                    return {
                        tool: 'mcp',
                        status: 'configured',
                        server: toolData.config?.mcpServerUrl
                    };
                }

                return { status: 'success', tool: toolData.toolType, message: `Executed ${toolData.label}` };
            }

            case 'output': {
                const outputData = data as OutputNodeData;
                return {
                    format: outputData.outputFormat,
                    content: variables['last_output'] || "No content generated"
                };
            }

            default:
                return null;
        }
    }

    private static getNextNode(
        current: WorkflowNode,
        edges: any[],
        nodes: WorkflowNode[],
        result: any
    ): WorkflowNode | undefined {
        // Special handling for condition (Classify) nodes branching
        if (current.type === 'condition') {
            const handleId = result; // The result IS the category name which matches the sourceHandle id
            const edge = edges.find(e => e.source === current.id && e.sourceHandle === handleId);
            if (!edge) {
                console.log(`[Flow] No edge for category: ${handleId}`);
                return undefined;
            }
            return nodes.find(n => n.id === edge.target);
        }

        // Default: find any outgoing edge
        const edge = edges.find(e => e.source === current.id);
        if (edge) {
            return nodes.find(n => n.id === edge.target);
        }

        // Fallback: If no edges, try to find next node in a logical sequence
        // Order: start -> agent -> tool -> condition -> output
        const nodeOrder = ['start', 'agent', 'condition', 'approval', 'tool', 'output'];
        const currentIndex = nodeOrder.indexOf(current.type as string);

        if (currentIndex >= 0 && currentIndex < nodeOrder.length - 1) {
            // Find next node type in sequence that exists
            for (let i = currentIndex + 1; i < nodeOrder.length; i++) {
                const nextType = nodeOrder[i];
                const nextNode = nodes.find(n => n.type === nextType);
                if (nextNode) {
                    console.log(`[Fallback] No edge from ${current.type}, using ${nextType} node`);
                    return nextNode;
                }
            }
        }

        return undefined;
    }
}
