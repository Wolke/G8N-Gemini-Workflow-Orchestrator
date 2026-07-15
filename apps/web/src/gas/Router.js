/**
 * G8N - GAS Router
 * Dispatches actions to appropriate handlers
 */

const Router = {
    dispatch(request) {
        const { action, payload, token } = request;

        // Token validation
        const storedToken = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
        if (storedToken && token !== storedToken) {
            throw new Error('Unauthorized: Invalid API Token');
        }

        switch (action) {
            case 'ping':
                return 'pong';

            // Workflow actions
            case 'workflow.run':
                return WorkflowRunner.run(
                    payload.input,
                    payload.triggerType || 'manual',
                    payload.triggerMeta || {}
                );

            case 'system.sync_workflow':
                return Engine.syncWorkflow(payload.workflow);

            case 'system.get_workflow':
                return Engine.getWorkflow();

            // API Key management
            case 'system.set_api_key':
                PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', payload.apiKey);
                return { success: true };

            case 'system.get_settings':
                const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
                return {
                    hasApiKey: !!apiKey,
                    keyPreview: apiKey ? apiKey.substring(0, 8) + '...' : null
                };

            case 'tool.execute':
                return Engine.executeTool(payload.toolType, payload.config);

            // Tool-specific shortcuts
            case 'calendar':
                return Engine.executeTool('calendar', payload);

            case 'sheets':
                return Engine.executeTool('sheets', payload);

            case 'gmail':
                return Engine.executeTool('gmail', payload);

            case 'drive':
                return Engine.executeTool('drive', payload);

            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }
};
