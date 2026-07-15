import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import type { Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { workflowTemplates } from '@g8n/templates';
import { ToolProviderRegistry } from '@g8n/tool-providers';
import { WorkflowEngine } from '@g8n/workflow-engine';
import { validateWorkflow, type WorkflowDefinition, type WorkflowNode } from '@g8n/workflow-schema';

if (!getApps().length) initializeApp();
const db = getFirestore();
const geminiApiKey = defineSecret('GEMINI_API_KEY');
const geminiModel = defineString('GEMINI_MODEL', { default: 'gemini-3.5-flash' });

async function authenticate(header?: string): Promise<string> {
  if (!header?.startsWith('Bearer ')) throw new Error('AUTH_REQUIRED');
  return (await getAuth().verifyIdToken(header.slice(7))).uid;
}

const json = (response: Response, status: number, body: unknown): void => { response.status(status).json(body); };

export const health: ReturnType<typeof onRequest> = onRequest({ cors: true }, (_request, response) => json(response, 200, { service: 'g8n-runtime', version: '2.0.0-alpha.1', status: 'ok' }));

export const listTemplates: ReturnType<typeof onRequest> = onRequest({ cors: true }, async (request, response) => {
  try {
    await authenticate(request.headers.authorization);
    return void json(response, 200, workflowTemplates);
  } catch { return void json(response, 401, { error: 'Authentication required' }); }
});

export const validateWorkflowApi: ReturnType<typeof onRequest> = onRequest({ cors: true }, async (request, response) => {
  try {
    await authenticate(request.headers.authorization);
    const errors = validateWorkflow(request.body as WorkflowDefinition);
    return void json(response, errors.length ? 422 : 200, { valid: errors.length === 0, errors });
  } catch { return void json(response, 401, { error: 'Authentication required' }); }
});

export const startRun: ReturnType<typeof onRequest> = onRequest({ cors: true, secrets: [geminiApiKey], timeoutSeconds: 180 }, async (request, response) => {
  try {
    const userId = await authenticate(request.headers.authorization);
    const { workflow, input = {} } = request.body as { workflow: WorkflowDefinition; input?: Record<string, unknown> };
    const engine = buildEngine();
    const trace = await engine.run(workflow, { userId, input, variables: {}, tools: new ToolProviderRegistry() }, {
      onTrace: async (nextTrace) => {
        await db.doc(`users/${userId}/runs/${nextTrace.runId}`).set({ ...nextTrace, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      },
    });
    return void json(response, trace.status === 'failed' ? 422 : 200, trace);
  } catch (error) {
    if (error instanceof Error && error.message === 'AUTH_REQUIRED') return void json(response, 401, { error: 'Authentication required' });
    return void json(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

function buildEngine(): WorkflowEngine {
  const pass = { execute: async (_node: WorkflowNode, context: { variables: Record<string, unknown>; input: Record<string, unknown> }) => ({ output: context.variables.lastOutput ?? context.input }) };
  return new WorkflowEngine()
    .register('trigger.manual', pass)
    .register('source.workspace', pass)
    .register('transform', pass)
    .register('condition', pass)
    .register('tool', pass)
    .register('output', pass)
    .register('approval', {
      execute: async (node, context) => ({ approval: {
        title: node.data.label,
        summary: String(node.data.summary ?? 'Review the proposed Workspace actions.'),
        proposedActions: [{ tool: 'workspace.pending_actions', risk: 'write', input: context.variables.lastOutput }],
      } }),
    })
    .register('agent.gemini', {
      execute: async (node, context) => {
        const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
        const result = await ai.models.generateContent({
          model: geminiModel.value(),
          contents: JSON.stringify(context.variables.lastOutput ?? context.input),
          config: { systemInstruction: String(node.data.systemPrompt ?? `You are executing workflow step: ${node.data.label}`), responseMimeType: 'application/json' },
        });
        const text = result.text ?? '{}';
        try { return { output: JSON.parse(text) }; } catch { return { output: { text } }; }
      },
    });
}
