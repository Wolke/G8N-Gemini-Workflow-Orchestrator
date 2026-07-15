/**
 * G8N - Workflow Runner
 * Decoupled execution logic that can be triggered from multiple sources:
 * - Manual (chat dialog)
 * - Webhook (doPost)
 * - Time-driven trigger (cron)
 * - Event-driven trigger (Sheets onEdit, Form submit, etc.)
 */

// GAS Native Function Declarations for Gemini Function Calling
const GAS_NATIVE_FUNCTION_DECLARATIONS = {
    gas_gmail: {
        name: 'send_email_via_gas',
        description: 'Send an email using Google Apps Script MailApp. Use this to send emails to users.',
        parameters: {
            type: 'object',
            properties: {
                to: { type: 'string', description: 'Recipient email address' },
                subject: { type: 'string', description: 'Email subject line' },
                body: { type: 'string', description: 'Email body content (plain text)' }
            },
            required: ['to', 'subject', 'body']
        }
    },
    gas_calendar: {
        name: 'manage_calendar_via_gas',
        description: 'Manage Google Calendar events using Google Apps Script CalendarApp.',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', description: 'Action: create_event, list_events, or delete_event' },
                title: { type: 'string', description: 'Event title' },
                startTime: { type: 'string', description: 'Start time in ISO 8601 format' },
                endTime: { type: 'string', description: 'End time in ISO 8601 format' },
                description: { type: 'string', description: 'Event description' },
                daysAhead: { type: 'number', description: 'Days ahead for list_events' }
            },
            required: ['action']
        }
    },
    gas_sheets: {
        name: 'manage_spreadsheet_via_gas',
        description: 'Read or write data to Google Sheets.',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', description: 'Action: read, write, or append' },
                spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
                sheetName: { type: 'string', description: 'Sheet name' },
                range: { type: 'string', description: 'Cell range (A1 notation)' },
                values: { type: 'string', description: 'JSON array of values for write/append' }
            },
            required: ['action', 'spreadsheetId']
        }
    },
    gas_drive: {
        name: 'manage_drive_via_gas',
        description: 'Manage files in Google Drive.',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', description: 'Action: search, create, or list' },
                query: { type: 'string', description: 'Search query' },
                fileName: { type: 'string', description: 'File name for create' },
                content: { type: 'string', description: 'File content for create' },
                folderId: { type: 'string', description: 'Folder ID' }
            },
            required: ['action']
        }
    }
};

// Map function names back to tool types
const GAS_FUNCTION_NAME_TO_TOOL = {
    'send_email_via_gas': 'gas_gmail',
    'manage_calendar_via_gas': 'gas_calendar',
    'manage_spreadsheet_via_gas': 'gas_sheets',
    'manage_drive_via_gas': 'gas_drive'
};

// List of GAS Native tool types
const GAS_NATIVE_TOOLS = ['gas_gmail', 'gas_calendar', 'gas_sheets', 'gas_drive'];

const WorkflowRunner = {
    /**
     * Main entry point - called from any trigger source
     * @param {string} input - User input or trigger data
     * @param {string} triggerType - 'manual' | 'webhook' | 'cron' | 'sheets_edit' | 'sheets_submit' | etc.
     * @param {object} triggerMeta - Additional trigger-specific metadata
     * @returns {object} { success: boolean, output?: string, error?: string }
     */
    run(input, triggerType, triggerMeta) {
        console.log(`[WorkflowRunner] Running with trigger: ${triggerType}`);
        console.log(`[WorkflowRunner] Input: ${input}`);
        console.log(`[WorkflowRunner] Meta: ${JSON.stringify(triggerMeta)}`);

        try {
            // Get the workflow from storage
            const workflow = this.getWorkflow();
            if (!workflow) {
                return { success: false, error: 'No workflow configured' };
            }

            // Find start node
            const startNode = workflow.nodes.find(n => n.type === 'start');
            if (!startNode) {
                return { success: false, error: 'Workflow has no start node' };
            }

            // Build execution context
            const context = {
                input: input,
                triggerType: triggerType,
                triggerMeta: triggerMeta,
                conversationHistory: [],
                variables: {},
                currentOutput: input,
                logs: [] // Capture execution logs
            };

            // Helper to log to both console and context
            context.logger = (message) => {
                console.log(message);
                context.logs.push(`[${new Date().toISOString().split('T')[1].slice(0, -1)}] ${message}`);
            };

            context.logger(`[WorkflowRunner] Starting execution with trigger: ${triggerType}`);
            context.logger(`[WorkflowRunner] Input: ${input}`);

            // Execute from start node
            const result = this.executeFromNode(workflow, startNode.id, context);

            return {
                success: true,
                output: result.output,
                executedNodes: result.executedNodes,
                logs: context.logs
            };

        } catch (error) {
            console.error('[WorkflowRunner] Error:', error);
            return { success: false, error: error.toString() };
        }
    },

    /**
     * Get workflow from storage
     */
    getWorkflow() {
        // Try G8nWorkflow.gs first (as a function)
        if (typeof getWorkflow === 'function') {
            return getWorkflow();
        }
        // Fall back to Engine storage
        return Engine.getWorkflow();
    },

    /**
     * Execute workflow starting from a specific node
     */
    executeFromNode(workflow, nodeId, context) {
        const executedNodes = [];
        const maxIterations = 100; // Safety limit
        let iterations = 0;
        let currentNodeId = nodeId;

        while (currentNodeId && iterations < maxIterations) {
            iterations++;
            const node = workflow.nodes.find(n => n.id === currentNodeId);

            if (!node) {
                context.logger(`[WorkflowRunner] Node not found: ${currentNodeId}`);
                break;
            }

            context.logger(`[WorkflowRunner] Executing node: ${node.data.label || node.type} (${node.type})`);
            executedNodes.push(node.id);

            // Execute node based on type
            const result = this.executeNode(node, context, workflow);

            if (result.output !== undefined && typeof result.output !== 'object') {
                context.logger(`[WorkflowRunner] Node Output: ${String(result.output).substring(0, 100)}${String(result.output).length > 100 ? '...' : ''}`);
            }

            // Update context with output
            context.currentOutput = result.output;

            // Get next node
            if (result.nextNodeId) {
                currentNodeId = result.nextNodeId;
            } else {
                // Find connected edge
                const edge = workflow.edges.find(e => e.source === node.id);
                currentNodeId = edge ? edge.target : null;
            }

            // Terminal node
            if (node.type === 'output') {
                break;
            }
        }

        return {
            output: context.currentOutput,
            executedNodes: executedNodes
        };
    },

    /**
     * Execute a single node
     */
    executeNode(node, context, workflow) {
        switch (node.type) {
            case 'start':
                return { output: context.input };

            case 'agent':
                return this.executeAgentNode(node, context, workflow);

            case 'tool':
                return this.executeToolNode(node, context);

            case 'condition':
                return this.executeConditionNode(node, context, workflow);

            case 'output':
                return { output: context.currentOutput };

            default:
                return { output: context.currentOutput };
        }
    },

    /**
     * Execute Agent node - calls Gemini API with function calling support
     */
    executeAgentNode(node, context, workflow) {
        const systemPrompt = node.data.systemPrompt || '';
        const prompt = context.currentOutput;
        const model = node.data.model || 'gemini-2.5-flash';

        // Build conversation context
        let fullPrompt = prompt;
        if (context.conversationHistory.length > 0) {
            const history = context.conversationHistory
                .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
                .join('\n');
            fullPrompt = `${history}\nUser: ${prompt}`;
        }

        // Collect connected GAS Native tools
        const toolEdges = workflow.edges.filter(e => e.target === node.id && e.targetHandle === 'tools');
        const connectedToolNodes = toolEdges
            .map(e => workflow.nodes.find(n => n.id === e.source))
            .filter(n => n && n.type === 'tool');

        const functionDeclarations = [];
        connectedToolNodes.forEach(toolNode => {
            const toolType = toolNode.data.toolType;
            if (GAS_NATIVE_TOOLS.includes(toolType) && GAS_NATIVE_FUNCTION_DECLARATIONS[toolType]) {
                functionDeclarations.push(GAS_NATIVE_FUNCTION_DECLARATIONS[toolType]);
            }
        });

        if (functionDeclarations.length > 0) {
            context.logger(`[Agent] Has ${functionDeclarations.length} GAS tools available: ${functionDeclarations.map(f => f.name).join(', ')}`);
        }

        // Call Gemini with function declarations
        let result = this.callGeminiWithTools(fullPrompt, systemPrompt, model, functionDeclarations, context);

        // Handle function calls if present
        if (result.functionCalls && result.functionCalls.length > 0) {
            const functionResults = [];

            for (const fc of result.functionCalls) {
                context.logger(`[Agent] Executing function: ${fc.name}`);
                const toolType = GAS_FUNCTION_NAME_TO_TOOL[fc.name];

                if (toolType) {
                    try {
                        // Map args to tool config
                        const config = this.mapFunctionArgsToConfig(toolType, fc.args);
                        const toolResult = Engine.executeTool(toolType, config);
                        functionResults.push(`Function ${fc.name} result:\n${JSON.stringify(toolResult, null, 2)}`);
                        context.logger(`[Agent] Function ${fc.name} succeeded`);
                    } catch (error) {
                        functionResults.push(`Function ${fc.name} error: ${error.toString()}`);
                        context.logger(`[Agent] Function ${fc.name} failed: ${error.toString()}`);
                    }
                } else {
                    functionResults.push(`Unknown function: ${fc.name}`);
                }
            }

            // Generate follow-up response with function results
            const functionContext = functionResults.join('\n\n');
            const followUpPrompt = `${fullPrompt}\n\n[System] Function executed, results:\n${functionContext}\n\nPlease respond to the user based on the results above.`;

            result = this.callGemini(followUpPrompt, systemPrompt, model);
        } else {
            // No function calls, use the text response directly
            result = result.text || result;
        }

        // Update conversation history
        context.conversationHistory.push(
            { role: 'user', content: String(prompt) },
            { role: 'model', content: String(result) }
        );

        return { output: result };
    },

    /**
     * Map function call args to tool config
     */
    mapFunctionArgsToConfig(toolType, args) {
        switch (toolType) {
            case 'gas_gmail':
                return { action: 'send', to: args.to, subject: args.subject, body: args.body };
            case 'gas_calendar':
                return { action: args.action, title: args.title, startTime: args.startTime, endTime: args.endTime, description: args.description, daysAhead: args.daysAhead };
            case 'gas_sheets':
                return { action: args.action, spreadsheetId: args.spreadsheetId, sheetName: args.sheetName, range: args.range, values: args.values ? JSON.parse(args.values) : undefined };
            case 'gas_drive':
                return { action: args.action, query: args.query, fileName: args.fileName, content: args.content, folderId: args.folderId };
            default:
                return args;
        }
    },

    /**
     * Execute Tool node
     */
    executeToolNode(node, context) {
        const toolType = node.data.toolType || 'unknown';
        const config = node.data.config || {};

        // Add current context to config
        config.input = context.currentOutput;

        try {
            const result = Engine.executeTool(toolType, config);
            return { output: typeof result === 'string' ? result : JSON.stringify(result) };
        } catch (error) {
            return { output: `Tool error: ${error.toString()}` };
        }
    },

    /**
     * Execute Condition node
     */
    executeConditionNode(node, context, workflow) {
        // For now, just go to first category
        // TODO: Implement LLM-based classification
        const edges = workflow.edges.filter(e => e.source === node.id);

        if (edges.length > 0) {
            return {
                output: context.currentOutput,
                nextNodeId: edges[0].target
            };
        }

        return { output: context.currentOutput };
    },

    /**
     * Call Gemini API
     */
    callGemini(prompt, systemPrompt, model) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error('Gemini API Key not configured. Please sync from Gemini Agent Builder.');
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        };

        if (systemPrompt) {
            payload.systemInstruction = { parts: [{ text: systemPrompt }] };
        }

        const options = {
            method: 'post',
            contentType: 'application/json',
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
        };

        const response = UrlFetchApp.fetch(url, options);
        const data = JSON.parse(response.getContentText());

        if (data.error) {
            throw new Error(data.error.message || 'Gemini API error');
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            throw new Error('No response from Gemini');
        }

        return text;
    },

    /**
     * Call Gemini API with function declarations (for function calling)
     */
    callGeminiWithTools(prompt, systemPrompt, model, functionDeclarations, context) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error('Gemini API Key not configured. Please sync from Gemini Agent Builder.');
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        };

        if (systemPrompt) {
            payload.systemInstruction = { parts: [{ text: systemPrompt }] };
        }

        // Add function declarations if provided
        if (functionDeclarations && functionDeclarations.length > 0) {
            payload.tools = [{
                functionDeclarations: functionDeclarations
            }];
            context.logger(`[Gemini] Sending request with ${functionDeclarations.length} function declarations`);
        }

        const options = {
            method: 'post',
            contentType: 'application/json',
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
        };

        const response = UrlFetchApp.fetch(url, options);
        const data = JSON.parse(response.getContentText());

        if (data.error) {
            throw new Error(data.error.message || 'Gemini API error');
        }

        const candidate = data.candidates?.[0];
        if (!candidate) {
            throw new Error('No candidates in Gemini response');
        }

        // Check for function calls
        const parts = candidate.content?.parts || [];
        const functionCalls = [];
        let textResponse = '';

        for (const part of parts) {
            if (part.functionCall) {
                functionCalls.push({
                    name: part.functionCall.name,
                    args: part.functionCall.args || {}
                });
            }
            if (part.text) {
                textResponse += part.text;
            }
        }

        if (functionCalls.length > 0) {
            context.logger(`[Gemini] Received ${functionCalls.length} function call(s): ${functionCalls.map(f => f.name).join(', ')}`);
            return { functionCalls, text: textResponse };
        }

        return { text: textResponse, functionCalls: [] };
    },

    /**
     * Get Gemini API Key from properties
     */
    getApiKey() {
        return PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    }
};

// ============================================
// Global Functions (called from HTML/triggers)
// ============================================

/**
 * Run workflow - called from TestDialog.html
 */
function runWorkflow(input, triggerType, triggerMeta) {
    return WorkflowRunner.run(input, triggerType, triggerMeta || {});
}

/**
 * Check settings - called from TestDialog.html
 */
function checkSettings() {
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    return {
        hasKey: !!apiKey,
        keyPreview: apiKey ? apiKey.substring(0, 8) + '...' : null
    };
}

/**
 * Set Gemini API Key - called from frontend sync
 */
function setGeminiApiKey(apiKey) {
    PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', apiKey);
    return { success: true };
}

/**
 * Get workflow info - called from TestDialog.html
 */
function getWorkflowInfo() {
    const workflow = WorkflowRunner.getWorkflow();
    if (workflow) {
        return {
            name: workflow.name || 'Untitled Workflow',
            description: workflow.description || ''
        };
    }
    return { name: 'G8N Workflow Test', description: '' };
}
