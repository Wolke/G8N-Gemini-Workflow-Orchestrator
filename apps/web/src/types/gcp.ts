// GCP OAuth Types and Constants

import type { GcpApiTool } from './nodes';

export interface GcpAuthState {
    isAuthenticated: boolean;
    accessToken: string | null;
    expiresAt: number | null;
    grantedScopes: string[];
    userEmail?: string;
}

export interface GcpOAuthConfig {
    clientId: string;
    scopes: string[];
}

// GCP API Scope mappings
export const GCP_API_SCOPES: Record<GcpApiTool, string[]> = {
    youtube_data: [
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/youtube.upload',
    ],
    google_calendar: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events',
    ],
    gmail: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
    ],
    google_drive: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.file',
    ],
    places_api: [], // Uses API key, not OAuth
};

// Helper to get required scopes for a tool
export function getRequiredScopes(tool: GcpApiTool): string[] {
    return GCP_API_SCOPES[tool] || [];
}

// Helper to check if a tool requires OAuth
export function requiresOAuth(tool: GcpApiTool): boolean {
    return GCP_API_SCOPES[tool]?.length > 0;
}
