// Workflow Generator Service - Uses Gemini 3 to generate workflows from natural language

import { generateContent, initializeGemini } from './geminiService';
import { useWorkflowStore } from '../stores/workflowStore';
import type { WorkflowNode, WorkflowEdge } from '../types';

// System prompt for workflow generation
const SYSTEM_PROMPT = `You are a workflow generator AI. Your job is to convert natural language descriptions into workflow graphs.

## Available Node Types:
- "start": Entry point. Has inputVariables array.
- "agent": Core LLM processing. Has model (GeminiModel), systemPrompt (string), temperature (number).
- "tool": External tool execution. Has toolType and config.
- "condition": Classification/branching. Has categories array, model, examples array.
- "output": Final output. Has outputFormat ("text" | "json" | "markdown").
- "memory": Conversation history. Has storageKey, maxMessages.

## Available Tool Types:
### Gemini Built-in (no auth required):
- "google_search": Search the web
- "code_execution": Execute Python code
- "url_context": Read content from URLs
- "google_maps": Location and maps data

### GCP APIs (require OAuth):
- "youtube_data": YouTube video search and data
- "google_calendar": Calendar events
- "gmail": Email access
- "google_drive": Drive file access
- "places_api": Places/Business info

## GeminiModel options:
"gemini-2.5-flash", "gemini-2.5-pro", "gemini-3-flash-preview", "gemini-3-pro-preview"

## CRITICAL: Node Handle IDs for Edges
Each node has specific connection points (handles). You MUST use the correct sourceHandle and targetHandle in edges:

### Start Node:
- Source: right side (no id needed, omit sourceHandle)

### Agent Node:
- Target "main-input": left side (for main flow from start/other agents)
- Target "tools": top (for tool connections)
- Target "memory": bottom (for memory connections)
- Source "main-output": right side (for output to next node)

### Tool Node:
- Target: left side (no id needed, omit targetHandle)
- Source "tool-output": bottom (connects to agent's "tools" handle) ← USE THIS FOR TOOL→AGENT
- Source "flow-output": right side (for sequential flow)

### Output Node:
- Target: left side (no id needed, omit targetHandle)

### Memory Node:
- Target "main-input": left side
- Source "memory-output": top (connects to agent's "memory" handle)

## Output Format:
Return ONLY valid JSON (no markdown, no explanation):
{
  "nodes": [
    {
      "id": "node_1",
      "type": "start" | "agent" | "tool" | "condition" | "output" | "memory",
      "position": { "x": number, "y": number },
      "data": { ... node specific data ... }
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "source": "source_node_id",
      "target": "target_node_id",
      "sourceHandle": "handle_id_or_omit",
      "targetHandle": "handle_id_or_omit"
    }
  ]
}

## Position Guidelines:
- Start node at x: 100, y: 150
- Agent node at x: 350, y: 150
- Tool nodes ABOVE agent at x: 350, y: 0 (for tools handle on top)
- Memory nodes BELOW agent at x: 350, y: 300 (for memory handle on bottom)
- Output node at x: 600, y: 150

## Example: "Search Google for AI news and summarize"
{
  "nodes": [
    { "id": "start_1", "type": "start", "position": { "x": 100, "y": 150 }, "data": { "label": "Start", "inputVariables": [{ "name": "query", "type": "string", "defaultValue": "AI news" }] }},
    { "id": "agent_1", "type": "agent", "position": { "x": 350, "y": 150 }, "data": { "label": "Search & Summarize", "model": "gemini-2.5-flash", "systemPrompt": "Search the web for the given query and provide a comprehensive summary.", "temperature": 0.7 }},
    { "id": "tool_1", "type": "tool", "position": { "x": 350, "y": 0 }, "data": { "label": "Google Search", "toolType": "google_search", "config": {} }},
    { "id": "output_1", "type": "output", "position": { "x": 600, "y": 150 }, "data": { "label": "Output", "outputFormat": "markdown" }}
  ],
  "edges": [
    { "id": "e1", "source": "start_1", "target": "agent_1", "targetHandle": "main-input" },
    { "id": "e2", "source": "tool_1", "sourceHandle": "tool-output", "target": "agent_1", "targetHandle": "tools" },
    { "id": "e3", "source": "agent_1", "sourceHandle": "main-output", "target": "output_1" }
  ]
}`;

export interface GeneratedWorkflow {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
}

export interface GenerationError {
    message: string;
    details?: string;
}

/**
 * Generate a workflow from natural language description using Gemini 3
 */
export async function generateWorkflow(description: string, modelName: string = 'gemini-2.5-flash'): Promise<GeneratedWorkflow> {
    const { settings } = useWorkflowStore.getState();

    if (!settings.geminiApiKey) {
        throw new Error('Gemini API key not configured. Please add it in Settings.');
    }

    // Initialize Gemini with the API key
    initializeGemini(settings.geminiApiKey, modelName);

    const prompt = `Generate a workflow for: "${description}"

Remember: Return ONLY valid JSON, no markdown code blocks, no explanations.`;

    try {
        const result = await generateContent(
            prompt,
            SYSTEM_PROMPT,
            undefined,
            modelName
        );

        if (!result.text) {
            throw new Error('No response from Gemini');
        }

        // Clean the response - remove markdown code blocks if present
        let jsonText = result.text.trim();
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }

        // Parse the JSON response
        const workflow = JSON.parse(jsonText) as GeneratedWorkflow;

        // Validate the structure
        if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
            throw new Error('Invalid workflow: missing nodes array');
        }
        if (!workflow.edges || !Array.isArray(workflow.edges)) {
            throw new Error('Invalid workflow: missing edges array');
        }

        // Ensure all nodes have required fields
        workflow.nodes = workflow.nodes.map((node, index) => ({
            ...node,
            id: node.id || `generated_${index}`,
            position: node.position || { x: 100 + index * 230, y: 150 },
            data: {
                ...node.data,
                label: node.data?.label || `Node ${index + 1}`,
            },
        }));

        // Create a map for quick node type lookup
        const nodeTypeMap = new Map<string, string>();
        workflow.nodes.forEach(node => {
            nodeTypeMap.set(node.id, node.type as string);
        });

        // Fix edge handles based on source and target node types
        workflow.edges = workflow.edges.map((edge, index) => {
            const sourceType = nodeTypeMap.get(edge.source);
            const targetType = nodeTypeMap.get(edge.target);

            let sourceHandle = edge.sourceHandle;
            let targetHandle = edge.targetHandle;

            // Rule 1: Tool → Agent should use tool-output → tools
            if (sourceType === 'tool' && targetType === 'agent') {
                sourceHandle = 'tool-output';
                targetHandle = 'tools';
            }
            // Rule 2: Start → Agent should use (none) → main-input
            else if (sourceType === 'start' && targetType === 'agent') {
                sourceHandle = undefined;
                targetHandle = 'main-input';
            }
            // Rule 3: Agent → Output/Condition should use main-output → (none)
            else if (sourceType === 'agent' && (targetType === 'output' || targetType === 'condition')) {
                sourceHandle = 'main-output';
                targetHandle = undefined;
            }
            // Rule 4: Agent → Agent should use main-output → main-input
            else if (sourceType === 'agent' && targetType === 'agent') {
                sourceHandle = 'main-output';
                targetHandle = 'main-input';
            }
            // Rule 5: Memory → Agent should use memory-output → memory
            else if (sourceType === 'memory' && targetType === 'agent') {
                sourceHandle = 'memory-output';
                targetHandle = 'memory';
            }
            // Rule 6: Start → anything else should use (none) → (none) or main-input
            else if (sourceType === 'start') {
                sourceHandle = undefined;
                targetHandle = targetType === 'memory' ? 'main-input' : undefined;
            }

            return {
                ...edge,
                id: edge.id || `edge_${index}`,
                sourceHandle,
                targetHandle,
            };
        });

        console.log('[WorkflowGenerator] Generated workflow:', workflow);
        return workflow;

    } catch (error) {
        console.error('[WorkflowGenerator] Generation failed:', error);

        if (error instanceof SyntaxError) {
            throw new Error('Failed to parse AI response. Please try again with a clearer description.');
        }

        throw error;
    }
}

/**
 * Apply a generated workflow to the current canvas
 */
export function applyGeneratedWorkflow(workflow: GeneratedWorkflow): void {
    // Clear existing nodes and edges, then add new ones
    useWorkflowStore.setState({
        nodes: workflow.nodes,
        edges: workflow.edges,
        selectedNodeId: null,
    });

    console.log('[WorkflowGenerator] Applied workflow with', workflow.nodes.length, 'nodes and', workflow.edges.length, 'edges');
}

/**
 * Suggest improvements to an existing workflow
 */
export async function suggestWorkflowImprovements(description: string): Promise<string> {
    const { settings, nodes, edges } = useWorkflowStore.getState();

    if (!settings.geminiApiKey) {
        throw new Error('Gemini API key not configured.');
    }

    initializeGemini(settings.geminiApiKey, 'gemini-3.0-flash');

    const currentWorkflow = JSON.stringify({ nodes, edges }, null, 2);

    const prompt = `Current workflow:
${currentWorkflow}

User wants: "${description}"

Suggest how to improve or modify this workflow. Be specific about which nodes to add, remove, or modify.`;

    const result = await generateContent(prompt, undefined, undefined, 'gemini-3.0-flash');
    return result.text || 'No suggestions available.';
}
