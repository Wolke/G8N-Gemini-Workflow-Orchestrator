// GAS Deploy Service - Google Apps Script API integration for automatic deployment

import type { AppsScriptProject, AppsScriptFile, AppsScriptDeployment, GasProject } from '../types/gas';
import type { Workflow } from '../types/nodes';

// GAS file contents (will be bundled from src/gas/)
import CodeJs from '../gas/Code.js?raw';
import RouterJs from '../gas/Router.js?raw';
import EngineJs from '../gas/Engine.js?raw';
import WorkflowRunnerJs from '../gas/WorkflowRunner.js?raw';
import TestDialogHtml from '../gas/TestDialog.html?raw';

const APPS_SCRIPT_API_BASE = 'https://script.googleapis.com/v1';

// Generate appsscript.json content dynamically to avoid import issues
const APPSSCRIPT_MANIFEST = JSON.stringify({
    timeZone: 'Asia/Taipei',
    dependencies: {},
    exceptionLogging: 'STACKDRIVER',
    runtimeVersion: 'V8',
    oauthScopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/script.external_request'
    ],
    webapp: {
        executeAs: 'USER_DEPLOYING',
        access: 'ANYONE_ANONYMOUS'
    }
}, null, 2);

/**
 * GAS Deploy Service
 * Handles project creation and deployment via Apps Script API
 */
export const gasDeployService = {
    /**
     * Get the GAS files to deploy
     */
    getGasFiles(): AppsScriptFile[] {
        return [
            { name: 'Code', type: 'SERVER_JS', source: CodeJs },
            { name: 'Router', type: 'SERVER_JS', source: RouterJs },
            { name: 'Engine', type: 'SERVER_JS', source: EngineJs },
            { name: 'WorkflowRunner', type: 'SERVER_JS', source: WorkflowRunnerJs },
            { name: 'TestDialog', type: 'HTML', source: TestDialogHtml },
            { name: 'appsscript', type: 'JSON', source: APPSSCRIPT_MANIFEST },
        ];
    },

    /**
     * Create a new Apps Script project
     */
    async createProject(
        title: string,
        accessToken: string
    ): Promise<AppsScriptProject> {
        const response = await fetch(`${APPS_SCRIPT_API_BASE}/projects`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to create project');
        }

        const data = await response.json();
        return {
            scriptId: data.scriptId,
            title: data.title,
        };
    },

    /**
     * Update project content (push files)
     */
    async pushFiles(
        scriptId: string,
        files: AppsScriptFile[],
        accessToken: string
    ): Promise<void> {
        const payload = {
            files: files.map(f => ({
                name: f.name,
                type: f.type,
                source: f.source,
            })),
        };

        console.log('[GasDeployService] Pushing files:', payload.files.map(f => ({ name: f.name, type: f.type, sourceLength: f.source.length })));

        const response = await fetch(
            `${APPS_SCRIPT_API_BASE}/projects/${scriptId}/content`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            }
        );

        if (!response.ok) {
            const error = await response.json();
            console.error('[GasDeployService] pushFiles error:', error);
            throw new Error(error.error?.message || JSON.stringify(error) || 'Failed to push files');
        }
    },

    /**
     * Create a new version
     */
    async createVersion(
        scriptId: string,
        description: string,
        accessToken: string
    ): Promise<number> {
        const response = await fetch(
            `${APPS_SCRIPT_API_BASE}/projects/${scriptId}/versions`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ description }),
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to create version');
        }

        const data = await response.json();
        return data.versionNumber;
    },

    /**
     * Create or update Web App deployment
     */
    async deployWebApp(
        scriptId: string,
        versionNumber: number,
        accessToken: string,
        existingDeploymentId?: string
    ): Promise<AppsScriptDeployment> {
        let response: Response;

        if (existingDeploymentId) {
            // Update existing deployment
            response = await fetch(
                `${APPS_SCRIPT_API_BASE}/projects/${scriptId}/deployments/${existingDeploymentId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        deploymentConfig: {
                            versionNumber,
                            manifestFileName: 'appsscript',
                            description: `G8N Deployment v${versionNumber}`,
                        },
                    }),
                }
            );
        } else {
            // Create new deployment - different payload structure
            response = await fetch(
                `${APPS_SCRIPT_API_BASE}/projects/${scriptId}/deployments`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        versionNumber,
                        manifestFileName: 'appsscript',
                        description: `G8N Deployment v${versionNumber}`,
                    }),
                }
            );
        }

        if (!response.ok) {
            const error = await response.json();
            console.error('[GasDeployService] deployWebApp error:', error);
            throw new Error(error.error?.message || 'Failed to deploy');
        }

        const data = await response.json();
        return {
            deploymentId: data.deploymentId,
            version: versionNumber,
            webAppUrl: data.entryPoints?.find((e: { entryPointType: string }) =>
                e.entryPointType === 'WEB_APP'
            )?.webApp?.url || '',
        };
    },

    /**
     * Full deployment flow: create project, push files, deploy
     */
    async fullDeploy(
        projectTitle: string,
        accessToken: string,
        existingScriptId?: string
    ): Promise<{
        project: AppsScriptProject;
        deployment: AppsScriptDeployment;
    }> {
        let scriptId = existingScriptId;
        let project: AppsScriptProject;

        // Step 1: Create or use existing project
        if (!scriptId) {
            project = await this.createProject(projectTitle, accessToken);
            scriptId = project.scriptId;
        } else {
            project = { scriptId, title: projectTitle };
        }

        // Step 2: Push files
        const files = this.getGasFiles();
        await this.pushFiles(scriptId, files, accessToken);

        // Step 3: Create version
        const versionNumber = await this.createVersion(
            scriptId,
            `Deployed from Gemini Agent Builder at ${new Date().toISOString()}`,
            accessToken
        );

        // Step 4: Deploy as Web App
        const deployment = await this.deployWebApp(
            scriptId,
            versionNumber,
            accessToken
        );

        return { project, deployment };
    },

    /**
     * Get list of existing deployments
     */
    async listDeployments(
        scriptId: string,
        accessToken: string
    ): Promise<AppsScriptDeployment[]> {
        const response = await fetch(
            `${APPS_SCRIPT_API_BASE}/projects/${scriptId}/deployments`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to list deployments');
        }

        const data = await response.json();
        return (data.deployments || []).map((d: {
            deploymentId: string;
            deploymentConfig?: { versionNumber?: number };
            entryPoints?: Array<{ entryPointType: string; webApp?: { url: string } }>;
        }) => ({
            deploymentId: d.deploymentId,
            version: d.deploymentConfig?.versionNumber || 0,
            webAppUrl: d.entryPoints?.find(e => e.entryPointType === 'WEB_APP')?.webApp?.url || '',
        }));
    },

    // ============================================
    // G8N Project Management
    // ============================================

    /**
     * List all user's Apps Script projects (requires Drive API)
     * Filter by G8N- prefix
     */
    async listG8nProjects(accessToken: string): Promise<GasProject[]> {
        // Use Drive API to list Apps Script files
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.script' and name contains 'G8N-' and trashed=false&fields=files(id,name,createdTime,modifiedTime)`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to list projects');
        }

        const data = await response.json();
        return (data.files || []).map((f: {
            id: string;
            name: string;
            createdTime?: string;
            modifiedTime?: string;
        }) => ({
            scriptId: f.id,
            title: f.name,
            createTime: f.createdTime,
            updateTime: f.modifiedTime,
        }));
    },

    /**
     * Get project content (all files)
     */
    async getProjectContent(
        scriptId: string,
        accessToken: string
    ): Promise<AppsScriptFile[]> {
        const response = await fetch(
            `${APPS_SCRIPT_API_BASE}/projects/${scriptId}/content`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to get project content');
        }

        const data = await response.json();
        return (data.files || []).map((f: { name: string; type: string; source: string }) => ({
            name: f.name,
            type: f.type as 'SERVER_JS' | 'JSON',
            source: f.source,
        }));
    },

    /**
     * Get workflow from a G8N project
     * Reads G8nWorkflow.gs or WorkflowData.gs and extracts workflow data
     */
    async getWorkflowFromProject(
        scriptId: string,
        accessToken: string
    ): Promise<Workflow | null> {
        const files = await this.getProjectContent(scriptId, accessToken);

        // Try both file names (G8nWorkflow is the new format, WorkflowData is legacy)
        const workflowFile = files.find(f => f.name === 'G8nWorkflow')
            || files.find(f => f.name === 'WorkflowData');

        if (!workflowFile) {
            console.log('[GasDeployService] No workflow file found. Files:', files.map(f => f.name));
            return null;
        }

        console.log('[GasDeployService] Found workflow file:', workflowFile.name);

        // Try to extract JSON from either format
        // Format 1: const WORKFLOW_DATA = {...};
        // Format 2: var G8N_WORKFLOW = {...};
        const patterns = [
            /const\s+WORKFLOW_DATA\s*=\s*(\{[\s\S]*\});/,
            /var\s+G8N_WORKFLOW\s*=\s*(\{[\s\S]*\});/,
        ];

        for (const pattern of patterns) {
            const match = workflowFile.source.match(pattern);
            if (match) {
                try {
                    const workflow = JSON.parse(match[1]) as Workflow;
                    console.log('[GasDeployService] Parsed workflow:', workflow.name);
                    return workflow;
                } catch (e) {
                    console.error('[GasDeployService] Failed to parse workflow data:', e);
                }
            }
        }

        console.log('[GasDeployService] No matching pattern found in workflow file');
        return null;
    },

    /**
     * Generate G8nWorkflow.gs content (follows G8N naming convention)
     */
    generateWorkflowDataFile(workflow: Workflow): string {
        const json = JSON.stringify(workflow, null, 2);
        return `// G8N Workflow Data - Auto-generated, do not edit manually
// Generated by Gemini Agent Builder
// Updated: ${new Date().toISOString()}
var G8N_WORKFLOW = ${json};

function getWorkflow() {
    return G8N_WORKFLOW;
}
`;
    },

    /**
     * Save workflow to an existing G8N project
     */
    async saveWorkflowToProject(
        scriptId: string,
        workflow: Workflow,
        accessToken: string
    ): Promise<void> {
        // Get existing files
        const existingFiles = await this.getProjectContent(scriptId, accessToken);

        // Replace or add G8nWorkflow.gs (remove legacy WorkflowData if exists)
        const workflowDataContent = this.generateWorkflowDataFile(workflow);
        const workflowDataFile: AppsScriptFile = {
            name: 'G8nWorkflow',
            type: 'SERVER_JS',
            source: workflowDataContent,
        };

        const filesWithoutWorkflow = existingFiles.filter(
            f => f.name !== 'WorkflowData' && f.name !== 'G8nWorkflow'
        );
        const newFiles = [...filesWithoutWorkflow, workflowDataFile];

        await this.pushFiles(scriptId, newFiles, accessToken);
    },

    /**
     * Create a new G8N project with workflow
     */
    async createG8nProject(
        name: string,
        workflow: Workflow,
        accessToken: string
    ): Promise<GasProject> {
        // Ensure G8N- prefix
        const projectName = name.startsWith('G8N-') ? name : `G8N-${name}`;

        // Create project
        const project = await this.createProject(projectName, accessToken);

        // Get default GAS files and add WorkflowData
        const gasFiles = this.getGasFiles();
        const workflowDataFile: AppsScriptFile = {
            name: 'WorkflowData',
            type: 'SERVER_JS',
            source: this.generateWorkflowDataFile(workflow),
        };

        await this.pushFiles(project.scriptId, [...gasFiles, workflowDataFile], accessToken);

        return {
            scriptId: project.scriptId,
            title: projectName,
            createTime: new Date().toISOString(),
            updateTime: new Date().toISOString(),
        };
    },

    /**
     * Delete a GAS project (move to trash via Drive API)
     */
    async deleteProject(
        scriptId: string,
        accessToken: string
    ): Promise<void> {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${scriptId}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            }
        );

        if (!response.ok && response.status !== 204) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to delete project');
        }
    },

    // ============================================
    // Sync & Deploy
    // ============================================

    /**
     * Sync only backend code (Code.js + Router.js + Engine.js)
     */
    async syncBackendCode(
        scriptId: string,
        accessToken: string
    ): Promise<void> {
        const existingFiles = await this.getProjectContent(scriptId, accessToken);

        // Keep workflow file if exists
        const workflowFile = existingFiles.find(f => f.name === 'WorkflowData' || f.name === 'G8nWorkflow');

        // Build new file list with backend code
        const files = this.getGasFiles();
        if (workflowFile) {
            files.push(workflowFile);
        }

        await this.pushFiles(scriptId, files, accessToken);
    },

    /**
     * Sync all: backend code + workflow
     */
    async syncAll(
        scriptId: string,
        workflow: Workflow,
        accessToken: string
    ): Promise<void> {
        // Build file list with backend code + workflow
        const files = this.getGasFiles();
        files.push({
            name: 'G8nWorkflow',
            type: 'SERVER_JS',
            source: this.generateWorkflowDataFile(workflow),
        });

        await this.pushFiles(scriptId, files, accessToken);
    },

    /**
     * Deploy project as Web App
     * Creates a new version and deployment
     */
    async deployProject(
        scriptId: string,
        accessToken: string
    ): Promise<AppsScriptDeployment> {
        // Step 1: Create a new version
        const versionNumber = await this.createVersion(
            scriptId,
            `G8N Deploy ${new Date().toISOString()}`,
            accessToken
        );

        // Step 2: Always create a NEW deployment (don't try to update existing)
        // This avoids "Read-only deployments may not be modified" errors
        const deployment = await this.deployWebApp(
            scriptId,
            versionNumber,
            accessToken
            // Don't pass existingDeploymentId - always create new
        );

        return deployment;
    },

    /**
     * Sync Gemini API key to GAS project via Router action
     * This stores the key in GAS Script Properties
     */
    async syncApiKey(
        webAppUrl: string,
        apiKey: string,
        apiToken?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Use text/plain to avoid CORS preflight (OPTIONS) which GAS doesn't support
            const response = await fetch(webAppUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify({
                    action: 'system.set_api_key',
                    payload: { apiKey },
                    token: apiToken
                }),
            });

            const data = await response.json();
            return data;
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to sync API key'
            };
        }
    },
};
