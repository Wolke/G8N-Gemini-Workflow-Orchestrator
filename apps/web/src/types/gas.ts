// GAS Types - Type definitions for Google Apps Script integration

/**
 * GAS connection and sync configuration
 */
export interface GasConfig {
    webAppUrl: string | null;
    apiToken: string | null;
    projectId: string | null;
    syncStatus: GasSyncStatus;
    lastSyncAt: string | null;
}

export type GasSyncStatus =
    | 'not_configured'
    | 'syncing'
    | 'synced'
    | 'out_of_sync'
    | 'error';

/**
 * GAS OAuth Login State
 */
export interface GasAuthState {
    isLoggedIn: boolean;
    accessToken: string | null;
    expiresAt: number | null;
    userEmail?: string;
}

/**
 * GAS Project Info
 */
export interface GasProject {
    scriptId: string;
    title: string;
    createTime?: string;
    updateTime?: string;
}

export const DEFAULT_GAS_AUTH_STATE: GasAuthState = {
    isLoggedIn: false,
    accessToken: null,
    expiresAt: null,
};

/**
 * GAS API response wrapper
 */
export interface GasResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * GAS API request payload
 */
export interface GasPayload {
    token: string;
    action: string;
    payload?: unknown;
}

/**
 * Calendar tool configuration
 */
export interface CalendarToolConfig {
    action: 'create_event' | 'list_events' | 'update_event' | 'delete_event';
    title?: string;
    startTime?: string;
    endTime?: string;
    description?: string;
    calendarId?: string;
    eventId?: string;
    daysAhead?: number;
}

/**
 * Calendar event response
 */
export interface CalendarEvent {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    description?: string;
}

/**
 * Sheets tool configuration
 */
export interface SheetsToolConfig {
    action: 'read' | 'write' | 'append';
    spreadsheetId: string;
    sheetName?: string;
    range?: string;
    values?: unknown[][];
}

/**
 * Gmail tool configuration
 */
export interface GmailToolConfig {
    action: 'send' | 'list_drafts';
    to?: string;
    subject?: string;
    body?: string;
}

/**
 * Drive tool configuration
 */
export interface DriveToolConfig {
    action: 'search' | 'create';
    query?: string;
    fileName?: string;
    content?: string;
    folderId?: string;
}

/**
 * Union type for all GAS tool configs
 */
export type GasToolConfig =
    | CalendarToolConfig
    | SheetsToolConfig
    | GmailToolConfig
    | DriveToolConfig;

/**
 * GAS tool types (executed via GAS backend)
 */
export type GasToolType = 'calendar' | 'sheets' | 'gmail' | 'drive';

/**
 * Apps Script API types for deployment
 */
export interface AppsScriptProject {
    scriptId: string;
    title: string;
}

export interface AppsScriptFile {
    name: string;
    type: 'SERVER_JS' | 'JSON' | 'HTML';
    source: string;
}

export interface AppsScriptDeployment {
    deploymentId: string;
    version: number;
    webAppUrl: string;
}

/**
 * Default GAS config
 */
export const DEFAULT_GAS_CONFIG: GasConfig = {
    webAppUrl: null,
    apiToken: null,
    projectId: null,
    syncStatus: 'not_configured',
    lastSyncAt: null,
};
