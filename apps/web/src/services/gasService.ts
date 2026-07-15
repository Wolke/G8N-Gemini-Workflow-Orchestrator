// GAS Service - HTTP client for GAS Web App communication

import type {
    GasConfig,
    GasResponse,
    GasPayload,
    GasToolConfig,
    GasToolType,
    CalendarEvent
} from '../types/gas';
import type { Workflow } from '../types/nodes';

/**
 * GAS Bridge Service
 * Handles all communication with the GAS Web App backend
 */
export const gasService = {
    /**
     * Universal fetch wrapper for GAS
     */
    async call<T = unknown>(
        action: string,
        payload: unknown,
        config: GasConfig
    ): Promise<T> {
        if (!config.webAppUrl) {
            throw new Error('GAS Web App URL not configured');
        }

        const body: GasPayload = {
            token: config.apiToken || '',
            action,
            payload,
        };

        try {
            const response = await fetch(config.webAppUrl, {
                method: 'POST',
                headers: {
                    // Use plain text to avoid CORS preflight
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            const result: GasResponse<T> = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Unknown GAS error');
            }

            return result.data as T;
        } catch (error) {
            console.error('GAS Service Error:', error);
            throw error;
        }
    },

    /**
     * Test connection to GAS Web App
     */
    async ping(config: GasConfig): Promise<boolean> {
        try {
            const data = await this.call('ping', {}, config);
            return data === 'pong';
        } catch {
            return false;
        }
    },

    /**
     * Sync workflow to GAS
     */
    async syncWorkflow(
        workflow: Workflow,
        config: GasConfig
    ): Promise<{ storage: string; id: string }> {
        return this.call('system.sync_workflow', { workflow }, config);
    },

    /**
     * Get current workflow from GAS
     */
    async getWorkflow(config: GasConfig): Promise<Workflow | null> {
        return this.call('system.get_workflow', {}, config);
    },

    /**
     * Execute a GAS tool
     */
    async executeTool<T = unknown>(
        toolType: GasToolType,
        toolConfig: GasToolConfig,
        gasConfig: GasConfig
    ): Promise<T> {
        return this.call('tool.execute', { toolType, config: toolConfig }, gasConfig);
    },

    // ============================================
    // Calendar-specific helpers
    // ============================================

    /**
     * Create a calendar event
     */
    async createCalendarEvent(
        title: string,
        startTime: string,
        endTime: string,
        description: string | undefined,
        config: GasConfig
    ): Promise<CalendarEvent> {
        return this.call('calendar', {
            action: 'create_event',
            title,
            startTime,
            endTime,
            description,
        }, config);
    },

    /**
     * List upcoming calendar events
     */
    async listCalendarEvents(
        daysAhead: number,
        config: GasConfig
    ): Promise<CalendarEvent[]> {
        return this.call('calendar', {
            action: 'list_events',
            daysAhead,
        }, config);
    },

    /**
     * Delete a calendar event
     */
    async deleteCalendarEvent(
        eventId: string,
        config: GasConfig
    ): Promise<{ success: boolean; message: string }> {
        return this.call('calendar', {
            action: 'delete_event',
            eventId,
        }, config);
    },

    // ============================================
    // Utility
    // ============================================

    /**
     * Generate CURL command for testing
     */
    generateCurlCommand(
        action: string,
        payload: unknown,
        config: GasConfig
    ): string {
        if (!config.webAppUrl) return 'Missing GAS configuration';

        const body: GasPayload = {
            token: config.apiToken || '',
            action,
            payload,
        };

        return `curl -L -X POST '${config.webAppUrl}' \\
-H 'Content-Type: text/plain;charset=utf-8' \\
-d '${JSON.stringify(body)}'`;
    },
};
