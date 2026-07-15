// GAS Tool Executor - Dual-mode execution for GAS native tools
// Local: HTTP call to GAS Web App
// GAS: Direct call to Engine.executeTool (handled by WorkflowRunner.js)

import { gasService } from './gasService';
import type { GasNativeTool, ToolConfig } from '../types/nodes';

// Simplified config for GAS tool execution (subset of full GasConfig)
export interface GasToolCallConfig {
    webAppUrl: string;
    apiToken?: string;
}

export interface GasToolExecutorResult {
    success: boolean;
    data?: unknown;
    error?: string;
}

// Function declarations for Gemini function calling (GAS Native Tools)
export const GAS_NATIVE_FUNCTION_DECLARATIONS: Record<GasNativeTool, {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: Record<string, { type: string; description: string }>;
        required: string[];
    };
}> = {
    gas_gmail: {
        name: 'send_email_via_gas',
        description: 'Send an email using Google Apps Script MailApp. Use this to send emails to users.',
        parameters: {
            type: 'object',
            properties: {
                to: {
                    type: 'string',
                    description: 'Recipient email address',
                },
                subject: {
                    type: 'string',
                    description: 'Email subject line',
                },
                body: {
                    type: 'string',
                    description: 'Email body content (plain text)',
                },
            },
            required: ['to', 'subject', 'body'],
        },
    },
    gas_calendar: {
        name: 'manage_calendar_via_gas',
        description: 'Manage Google Calendar events using Google Apps Script CalendarApp. Can create, list, or delete events.',
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    description: 'Action to perform: create_event, list_events, or delete_event',
                },
                title: {
                    type: 'string',
                    description: 'Event title (for create_event)',
                },
                startTime: {
                    type: 'string',
                    description: 'Event start time in ISO 8601 format (for create_event)',
                },
                endTime: {
                    type: 'string',
                    description: 'Event end time in ISO 8601 format (for create_event)',
                },
                description: {
                    type: 'string',
                    description: 'Event description (optional)',
                },
                daysAhead: {
                    type: 'number',
                    description: 'Number of days ahead to list events (for list_events, default: 7)',
                },
            },
            required: ['action'],
        },
    },
    gas_sheets: {
        name: 'manage_spreadsheet_via_gas',
        description: 'Read or write data to Google Sheets using Google Apps Script SpreadsheetApp.',
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    description: 'Action to perform: read, write, or append',
                },
                spreadsheetId: {
                    type: 'string',
                    description: 'The ID of the Google Spreadsheet',
                },
                sheetName: {
                    type: 'string',
                    description: 'Name of the sheet tab (optional, defaults to first sheet)',
                },
                range: {
                    type: 'string',
                    description: 'Cell range in A1 notation (e.g., A1:D10)',
                },
                values: {
                    type: 'string',
                    description: 'JSON array of values to write (for write/append actions)',
                },
            },
            required: ['action', 'spreadsheetId'],
        },
    },
    gas_drive: {
        name: 'manage_drive_via_gas',
        description: 'Manage files in Google Drive using Google Apps Script DriveApp. Can search, create, or list files.',
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    description: 'Action to perform: search, create, or list',
                },
                query: {
                    type: 'string',
                    description: 'Search query for finding files',
                },
                fileName: {
                    type: 'string',
                    description: 'Name for the new file (for create action)',
                },
                content: {
                    type: 'string',
                    description: 'Content for the new file (for create action)',
                },
                folderId: {
                    type: 'string',
                    description: 'Folder ID to create file in (optional)',
                },
            },
            required: ['action'],
        },
    },
};

// Map from function name to tool type (for reverse lookup when handling function calls)
export const GAS_FUNCTION_NAME_TO_TOOL_TYPE: Record<string, GasNativeTool> = {
    'send_email_via_gas': 'gas_gmail',
    'manage_calendar_via_gas': 'gas_calendar',
    'manage_spreadsheet_via_gas': 'gas_sheets',
    'manage_drive_via_gas': 'gas_drive',
};

/**
 * Get function declarations for connected GAS Native tools
 */
export function getGasNativeFunctionDeclarations(toolTypes: GasNativeTool[]): any[] {
    return toolTypes
        .filter(t => GAS_NATIVE_FUNCTION_DECLARATIONS[t])
        .map(t => GAS_NATIVE_FUNCTION_DECLARATIONS[t]);
}

/**
 * Check if a function name is a GAS Native function
 */
export function isGasNativeFunction(functionName: string): boolean {
    return functionName in GAS_FUNCTION_NAME_TO_TOOL_TYPE;
}

export const gasToolExecutor = {
    /**
     * Execute a GAS native tool
     * In browser: calls GAS Web App via HTTP
     * In GAS: would call Engine.executeTool directly (handled by WorkflowRunner.js)
     */
    async execute(
        toolType: GasNativeTool,
        config: ToolConfig & { action?: string;[key: string]: unknown },
        gasConfig: GasToolCallConfig
    ): Promise<unknown> {
        if (!gasConfig.webAppUrl) {
            throw new Error(
                'GAS Web App URL not configured. Please deploy your project first to test GAS native tools locally.'
            );
        }

        // Map tool type to action if not specified
        const action = config.action || this.getDefaultAction(toolType);
        const finalConfig = { ...config, action };

        // Call GAS Web App via HTTP
        try {
            console.log(`[GasToolExecutor] Executing ${toolType} with action: ${action}`, finalConfig);
            const result = await gasService.call('tool.execute', { toolType, config: finalConfig }, {
                webAppUrl: gasConfig.webAppUrl,
                apiToken: gasConfig.apiToken || null,
                projectId: null,
                syncStatus: 'synced',
                lastSyncAt: null,
            });
            console.log(`[GasToolExecutor] Result:`, result);
            return result;
        } catch (error) {
            console.error('[GasToolExecutor] Execution failed:', error);
            throw error;
        }
    },

    /**
     * Execute a GAS function by function name (called from workflowEngine when handling function calls)
     */
    async executeByFunctionName(
        functionName: string,
        args: Record<string, unknown>,
        gasConfig: GasToolCallConfig
    ): Promise<unknown> {
        const toolType = GAS_FUNCTION_NAME_TO_TOOL_TYPE[functionName];
        if (!toolType) {
            throw new Error(`Unknown GAS function: ${functionName}`);
        }

        // Map function-specific args to tool config
        const config = this.mapArgsToConfig(toolType, args);
        return this.execute(toolType, config, gasConfig);
    },

    /**
     * Map function call args to tool config
     */
    mapArgsToConfig(toolType: GasNativeTool, args: Record<string, unknown>): ToolConfig & { action?: string;[key: string]: unknown } {
        switch (toolType) {
            case 'gas_gmail':
                return {
                    action: 'send',
                    to: args.to as string,
                    subject: args.subject as string,
                    body: args.body as string,
                };
            case 'gas_calendar':
                return {
                    action: args.action as string,
                    title: args.title as string,
                    startTime: args.startTime as string,
                    endTime: args.endTime as string,
                    description: args.description as string,
                    daysAhead: args.daysAhead as number,
                };
            case 'gas_sheets':
                return {
                    action: args.action as string,
                    spreadsheetId: args.spreadsheetId as string,
                    sheetName: args.sheetName as string,
                    range: args.range as string,
                    values: args.values ? JSON.parse(args.values as string) : undefined,
                };
            case 'gas_drive':
                return {
                    action: args.action as string,
                    query: args.query as string,
                    fileName: args.fileName as string,
                    content: args.content as string,
                    folderId: args.folderId as string,
                };
            default:
                return args as ToolConfig & { action?: string;[key: string]: unknown };
        }
    },

    /**
     * Get default action for a tool type
     */
    getDefaultAction(toolType: GasNativeTool): string {
        const defaults: Record<GasNativeTool, string> = {
            gas_gmail: 'send',
            gas_calendar: 'list_events',
            gas_sheets: 'read',
            gas_drive: 'list',
        };
        return defaults[toolType] || 'execute';
    },

    /**
     * Check if GAS native tools can be tested locally
     */
    canTestLocally(webAppUrl?: string): boolean {
        return !!webAppUrl;
    },

    /**
     * Get a human-readable description of the tool
     */
    getToolDescription(toolType: GasNativeTool): string {
        const descriptions: Record<GasNativeTool, string> = {
            gas_gmail: 'Send emails using GAS MailApp/GmailApp',
            gas_calendar: 'Manage calendar events using GAS CalendarApp',
            gas_sheets: 'Read/write spreadsheet data using GAS SpreadsheetApp',
            gas_drive: 'Manage files using GAS DriveApp',
        };
        return descriptions[toolType] || 'GAS native tool';
    },
};
