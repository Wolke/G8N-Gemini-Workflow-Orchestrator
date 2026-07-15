// Gemini API Types

export interface GeminiConfig {
    apiKey: string;
    model: string;
}

export interface ChatMessage {
    role: 'user' | 'model';
    parts: MessagePart[];
}

export type MessagePart = TextPart | FunctionCallPart | FunctionResponsePart;

export interface TextPart {
    text: string;
}

export interface FunctionCallPart {
    functionCall: {
        name: string;
        args: Record<string, unknown>;
    };
}

export interface FunctionResponsePart {
    functionResponse: {
        name: string;
        response: Record<string, unknown>;
    };
}

// Function Declaration for Function Calling
export interface FunctionDeclaration {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, ParameterSchema>;
        required?: string[];
    };
}

export interface ParameterSchema {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description?: string;
    enum?: string[];
    items?: ParameterSchema;
}

// Tool Configuration
export interface GeminiToolConfig {
    functionDeclarations?: FunctionDeclaration[];
    codeExecution?: { enabled: boolean };
    googleSearch?: { enabled: boolean };
    urlContext?: { targetUrl: string };
}

// Generation Response
export interface GenerationResult {
    text?: string;
    functionCalls?: Array<{
        name: string;
        args: Record<string, unknown>;
    }>;
    codeExecutionResult?: {
        outcome: 'success' | 'error';
        output?: string;
        error?: string;
    };
    groundingMetadata?: {
        searchEntryPoint?: { renderedContent: string };
        groundingChunks?: Array<{
            web?: { uri: string; title: string };
        }>;
    };
}

// App Settings stored in localStorage
export interface AppSettings {
    geminiApiKey: string;
    gcpClientId: string;  // GCP OAuth Client ID for GCP API tools
    gcpApiKey: string;    // API Key for GCP services (Places API, etc.)
    defaultModel: string;
    theme: 'dark' | 'light';
    // GAS Native Tools
    gasWebAppUrl?: string;  // Web App URL for local GAS tool testing
    gasApiToken?: string;   // Optional API token for GAS authentication
}
