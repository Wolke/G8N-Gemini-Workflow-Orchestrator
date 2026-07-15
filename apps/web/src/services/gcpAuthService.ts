// GCP OAuth Service - Handles Google Cloud Platform authentication

import type { GcpAuthState } from '../types/gcp';
import { GCP_API_SCOPES } from '../types/gcp';
import type { GcpApiTool } from '../types/nodes';

// Storage key for persisting auth state
const STORAGE_KEY = 'gcp-oauth-state';

// Google Identity Services script URL
const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let isGisLoaded = false;

// Declare google namespace for TypeScript
declare global {
    interface Window {
        google?: typeof google;
    }
    namespace google {
        namespace accounts {
            namespace oauth2 {
                interface TokenClient {
                    requestAccessToken(overrideConfig?: { prompt?: string }): void;
                }
                interface TokenResponse {
                    access_token: string;
                    expires_in: number;
                    scope: string;
                    token_type: string;
                    error?: string;
                    error_description?: string;
                }
                function initTokenClient(config: {
                    client_id: string;
                    scope: string;
                    callback: (response: TokenResponse) => void;
                    error_callback?: (error: { type: string; message: string }) => void;
                }): TokenClient;
            }
        }
    }
}

export class GcpAuthService {
    private static authState: GcpAuthState = {
        isAuthenticated: false,
        accessToken: null,
        expiresAt: null,
        grantedScopes: [],
    };

    /**
     * Load Google Identity Services script
     */
    private static loadGisScript(): Promise<void> {
        if (isGisLoaded) return Promise.resolve();

        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${GIS_SCRIPT_URL}"]`)) {
                isGisLoaded = true;
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = GIS_SCRIPT_URL;
            script.async = true;
            script.defer = true;
            script.onload = () => {
                isGisLoaded = true;
                resolve();
            };
            script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
            document.head.appendChild(script);
        });
    }

    /**
     * Initialize the OAuth service with client ID
     */
    static async initialize(clientId: string): Promise<void> {
        if (!clientId) {
            console.warn('[GcpAuthService] No client ID provided');
            return;
        }

        await this.loadGisScript();

        // Load persisted state
        this.loadState();
    }

    /**
     * Request access token for specific scopes
     */
    static async requestAccess(scopes: string[], clientId: string): Promise<string> {
        if (!clientId) {
            throw new Error('GCP Client ID not configured. Please add it in Settings.');
        }

        await this.loadGisScript();

        return new Promise((resolve, reject) => {
            tokenClient = window.google!.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: scopes.join(' '),
                callback: (response) => {
                    if (response.error) {
                        reject(new Error(response.error_description || response.error));
                        return;
                    }

                    const expiresAt = Date.now() + (response.expires_in * 1000);
                    const grantedScopes = response.scope.split(' ');

                    this.authState = {
                        isAuthenticated: true,
                        accessToken: response.access_token,
                        expiresAt,
                        grantedScopes,
                    };

                    this.saveState();
                    resolve(response.access_token);
                },
                error_callback: (error) => {
                    reject(new Error(error.message || 'OAuth error'));
                },
            });

            tokenClient.requestAccessToken({ prompt: '' });
        });
    }

    /**
     * Request access for a specific GCP API tool
     */
    static async requestAccessForTool(tool: GcpApiTool, clientId: string): Promise<string> {
        const scopes = GCP_API_SCOPES[tool];
        if (!scopes || scopes.length === 0) {
            throw new Error(`Tool ${tool} does not require OAuth`);
        }
        return this.requestAccess(scopes, clientId);
    }

    /**
     * Get current access token (if valid)
     */
    static getAccessToken(): string | null {
        if (!this.authState.accessToken) return null;
        if (this.authState.expiresAt && Date.now() >= this.authState.expiresAt) {
            // Token expired
            this.logout();
            return null;
        }
        return this.authState.accessToken;
    }

    /**
     * Check if user is authenticated
     */
    static isAuthenticated(): boolean {
        return this.getAccessToken() !== null;
    }

    /**
     * Check if specific scopes are granted
     */
    static hasScopes(scopes: string[]): boolean {
        if (!this.isAuthenticated()) return false;
        return scopes.every(scope => this.authState.grantedScopes.includes(scope));
    }

    /**
     * Check if a specific tool is authorized
     */
    static isToolAuthorized(tool: GcpApiTool): boolean {
        const requiredScopes = GCP_API_SCOPES[tool];
        if (!requiredScopes || requiredScopes.length === 0) return true;
        return this.hasScopes(requiredScopes);
    }

    /**
     * Get current auth state
     */
    static getAuthState(): GcpAuthState {
        return { ...this.authState };
    }

    /**
     * Logout and clear auth state
     */
    static logout(): void {
        this.authState = {
            isAuthenticated: false,
            accessToken: null,
            expiresAt: null,
            grantedScopes: [],
        };
        localStorage.removeItem(STORAGE_KEY);
    }

    /**
     * Save auth state to localStorage
     */
    private static saveState(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.authState));
        } catch (e) {
            console.warn('[GcpAuthService] Failed to save state:', e);
        }
    }

    /**
     * Load auth state from localStorage
     */
    private static loadState(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const state = JSON.parse(stored) as GcpAuthState;
                // Check if token is still valid
                if (state.expiresAt && Date.now() < state.expiresAt) {
                    this.authState = state;
                } else {
                    // Token expired, clear it
                    this.logout();
                }
            }
        } catch (e) {
            console.warn('[GcpAuthService] Failed to load state:', e);
        }
    }
}
