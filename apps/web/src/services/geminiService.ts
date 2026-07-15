// Gemini Service - API integration for Gemini AI

import { GoogleGenerativeAI, GenerativeModel, Part, Tool, FunctionDeclaration as SdkFunctionDeclaration } from '@google/generative-ai';
import { FunctionDeclaration, GenerationResult } from '../types';

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

export function initializeGemini(apiKey: string, modelName: string = 'gemini-2.5-flash'): boolean {
    try {
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ model: modelName });
        return true;
    } catch (error) {
        console.error('Failed to initialize Gemini:', error);
        return false;
    }
}

export function isInitialized(): boolean {
    return model !== null;
}

export async function generateContent(
    prompt: string,
    systemPrompt?: string,
    tools?: {
        functionDeclarations?: FunctionDeclaration[];
        codeExecution?: boolean;
        googleSearch?: boolean;
        googleMaps?: boolean;
    },
    modelName?: string
): Promise<GenerationResult> {
    if (!model && !genAI) {
        throw new Error('Gemini not initialized. Call initializeGemini first.');
    }

    try {
        // Build tools array
        const geminiTools: Tool[] = [];

        if (tools?.functionDeclarations && tools.functionDeclarations.length > 0) {
            geminiTools.push({
                functionDeclarations: tools.functionDeclarations.map(fd => ({
                    name: fd.name,
                    description: fd.description,
                    parameters: fd.parameters,
                })) as SdkFunctionDeclaration[],
            });
        }

        if (tools?.codeExecution) {
            geminiTools.push({ codeExecution: {} });
        }

        if (tools?.googleSearch) {
            // Google Search grounding
            geminiTools.push({
                googleSearch: {}
            } as Tool);
        }

        if (tools?.googleMaps) {
            // Google Maps grounding
            console.log('[GeminiService] Google Maps tool enabled');
            geminiTools.push({
                googleMaps: {}
            } as any); // Type assertion needed until SDK types update
        }

        console.log('[GeminiService] Constructing request with tools:', JSON.stringify(geminiTools, null, 2));

        // Determine which model to use
        // If specific modelName provided, get that model
        // Else if systemPrompt provided, get model with system instruction (using default model name)
        // Else use default model

        let generationModel: GenerativeModel;

        if (modelName) {
            generationModel = genAI!.getGenerativeModel({
                model: modelName,
                systemInstruction: systemPrompt
            });
        } else if (systemPrompt) {
            generationModel = genAI!.getGenerativeModel({
                model: model!.model,
                systemInstruction: systemPrompt,
            });
        } else {
            generationModel = model!;
        }

        console.log('[GeminiService] Using model:', generationModel.model);
        console.log('[GeminiService] Prompt:', prompt);

        const result = await generationModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            tools: geminiTools.length > 0 ? geminiTools : undefined,
        });

        const response = result.response;
        console.log('[GeminiService] Raw API Response:', JSON.stringify(response, null, 2));

        const candidate = response.candidates?.[0];

        if (!candidate) {
            throw new Error('No response candidate received');
        }

        const output: GenerationResult = {};

        // Extract text parts
        const textParts = candidate.content.parts.filter(
            (p): p is Part & { text: string } => 'text' in p
        );
        if (textParts.length > 0) {
            output.text = textParts.map(p => p.text).join('\n');
        }

        // Extract function calls
        const functionCallParts = candidate.content.parts.filter(
            (p): p is Part & { functionCall: { name: string; args: Record<string, unknown> } } =>
                'functionCall' in p
        );
        if (functionCallParts.length > 0) {
            output.functionCalls = functionCallParts.map(p => ({
                name: p.functionCall.name,
                args: p.functionCall.args,
            }));
        }

        // Check for grounding metadata
        const groundingMeta = response.candidates?.[0]?.groundingMetadata;
        if (groundingMeta) {
            console.log('[GeminiService] Grounding Metadata found:', groundingMeta);
            output.groundingMetadata = {
                searchEntryPoint: groundingMeta.searchEntryPoint as { renderedContent: string } | undefined,
                groundingChunks: groundingMeta.groundingChunks as Array<{ web?: { uri: string; title: string } }> | undefined,
            };
        } else {
            console.log('[GeminiService] No Grounding Metadata found in response');
        }

        return output;
    } catch (error) {
        console.error('Generation error:', error);
        throw error;
    }
}

// Chat session for multi-turn conversations
export function createChatSession(
    systemPrompt?: string,
    tools?: {
        functionDeclarations?: FunctionDeclaration[];
        codeExecution?: boolean;
        googleSearch?: boolean;
        googleMaps?: boolean;
    }
) {
    if (!genAI || !model) {
        throw new Error('Gemini not initialized');
    }

    const geminiTools: Tool[] = [];

    if (tools?.functionDeclarations && tools.functionDeclarations.length > 0) {
        geminiTools.push({
            functionDeclarations: tools.functionDeclarations.map(fd => ({
                name: fd.name,
                description: fd.description,
                parameters: fd.parameters,
            })) as SdkFunctionDeclaration[],
        });
    }

    if (tools?.codeExecution) {
        geminiTools.push({ codeExecution: {} });
    }

    if (tools?.googleSearch) {
        geminiTools.push({ googleSearch: {} } as Tool);
    }

    if (tools?.googleMaps) {
        geminiTools.push({ googleMaps: {} } as any);
    }

    const chatModel = systemPrompt
        ? genAI.getGenerativeModel({
            model: model.model,
            systemInstruction: systemPrompt,
        })
        : model;

    return chatModel.startChat({
        tools: geminiTools.length > 0 ? geminiTools : undefined,
        history: [],
    });
}

export async function sendFunctionResponse(
    chat: ReturnType<typeof createChatSession>,
    functionName: string,
    response: Record<string, unknown>
): Promise<GenerationResult> {
    const result = await chat.sendMessage([
        {
            functionResponse: {
                name: functionName,
                response,
            },
        },
    ]);

    const candidate = result.response.candidates?.[0];
    if (!candidate) {
        throw new Error('No response candidate');
    }

    const output: GenerationResult = {};
    const textParts = candidate.content.parts.filter(
        (p): p is Part & { text: string } => 'text' in p
    );
    if (textParts.length > 0) {
        output.text = textParts.map(p => p.text).join('\n');
    }

    return output;
}
