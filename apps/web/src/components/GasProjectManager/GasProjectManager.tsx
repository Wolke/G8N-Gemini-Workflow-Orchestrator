// GAS Project Manager - UI for managing G8N projects in Google Apps Script

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWorkflowStore } from '../../stores';
import { gasDeployService } from '../../services/gasDeployService';
import { GcpAuthService } from '../../services/gcpAuthService';
import type { GasProject } from '../../types/gas';
import type { ToolNodeData } from '../../types/nodes';
import { GAS_NATIVE_TOOLS } from '../../types/nodes';
import './GasProjectManager.css';

// Required OAuth scopes
const GAS_SCOPES = [
    'https://www.googleapis.com/auth/script.projects',
    'https://www.googleapis.com/auth/drive',  // Full drive access for delete
];

export function GasProjectManager() {
    const {
        settings,
        updateGasConfig,
        gasAuth,
        setGasAuth,
        gasLogout,
        exportWorkflow,
        loadWorkflowFromGas,
        workflowName,
        nodes,
    } = useWorkflowStore();

    const [projects, setProjects] = useState<GasProject[]>([]);
    const [selectedProject, setSelectedProject] = useState<GasProject | null>(null);
    const [newProjectName, setNewProjectName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [webAppUrl, setWebAppUrl] = useState<string | null>(null);
    const [authHintDismissed, setAuthHintDismissed] = useState(() => {
        // Check localStorage on init
        return localStorage.getItem('gas-auth-hint-dismissed') === 'true';
    });

    // Check if workflow uses GAS Native tools
    const usesGasNativeTools = useMemo(() => {
        return nodes.some(node => {
            if (node.type === 'tool') {
                const toolData = node.data as ToolNodeData;
                return GAS_NATIVE_TOOLS.includes(toolData.toolType as typeof GAS_NATIVE_TOOLS[number]);
            }
            return false;
        });
    }, [nodes]);

    // Check token expiration
    const isTokenValid = gasAuth.isLoggedIn &&
        gasAuth.expiresAt &&
        Date.now() < gasAuth.expiresAt;

    // Load projects when logged in
    const loadProjects = useCallback(async () => {
        if (!gasAuth.accessToken) return;

        setIsLoading(true);
        setError(null);

        try {
            const g8nProjects = await gasDeployService.listG8nProjects(gasAuth.accessToken);
            setProjects(g8nProjects);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load projects');
        } finally {
            setIsLoading(false);
        }
    }, [gasAuth.accessToken]);

    useEffect(() => {
        if (isTokenValid) {
            loadProjects();
        }
    }, [isTokenValid, loadProjects]);

    // Handle login
    const handleLogin = async () => {
        if (!settings.gcpClientId) {
            setError('Please set GCP Client ID in Settings first');
            return;
        }

        setIsLoggingIn(true);
        setError(null);

        try {
            const token = await GcpAuthService.requestAccess(GAS_SCOPES, settings.gcpClientId);
            setGasAuth({
                isLoggedIn: true,
                accessToken: token,
                expiresAt: Date.now() + 3600 * 1000, // 1 hour
            });
            setSuccessMessage('Login successful!');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setIsLoggingIn(false);
        }
    };

    // Handle logout
    const handleLogout = () => {
        gasLogout();
        setProjects([]);
        setSelectedProject(null);
    };

    // Load workflow from selected project
    const handleLoadWorkflow = async () => {
        if (!selectedProject || !gasAuth.accessToken) return;

        setIsLoading(true);
        setLoadingMessage('Loading workflow...');
        setError(null);

        // Clear canvas first
        loadWorkflowFromGas({
            id: '',
            name: 'Loading...',
            description: '',
            nodes: [],
            edges: [],
            createdAt: '',
            updatedAt: '',
        });

        try {
            const workflow = await gasDeployService.getWorkflowFromProject(
                selectedProject.scriptId,
                gasAuth.accessToken
            );

            if (workflow) {
                loadWorkflowFromGas(workflow);

                // Also fetch Web App URL from deployments
                try {
                    const deployments = await gasDeployService.listDeployments(
                        selectedProject.scriptId,
                        gasAuth.accessToken
                    );
                    // Find the first deployment with a Web App URL
                    const webAppDeployment = deployments.find(d => d.webAppUrl);
                    if (webAppDeployment?.webAppUrl) {
                        setWebAppUrl(webAppDeployment.webAppUrl);
                        updateGasConfig({ webAppUrl: webAppDeployment.webAppUrl });
                        // Reset auth hint dismissed state when loading a new project
                        setAuthHintDismissed(false);
                        localStorage.removeItem('gas-auth-hint-dismissed');
                    } else {
                        setWebAppUrl(null);
                    }
                } catch {
                    // Ignore deployment fetch errors - project may not be deployed
                    setWebAppUrl(null);
                }

                setSuccessMessage(`Loaded: ${workflow.name}`);
                setTimeout(() => setSuccessMessage(null), 3000);
            } else {
                setError('No workflow data found in this project');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load workflow');
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    };

    // Save to selected project
    const handleSaveToProject = async () => {
        if (!selectedProject || !gasAuth.accessToken) return;

        setIsLoading(true);
        setLoadingMessage('Saving workflow...');
        setError(null);

        try {
            const workflow = exportWorkflow();
            // Update workflow name to match project name
            workflow.name = selectedProject.title.replace(/^G8N[-_]?/i, '') || workflow.name;
            await gasDeployService.saveWorkflowToProject(
                selectedProject.scriptId,
                workflow,
                gasAuth.accessToken
            );
            setSuccessMessage('Saved successfully!');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    };

    // Create new project
    const handleCreateProject = async () => {
        if (!newProjectName.trim() || !gasAuth.accessToken) return;

        setIsLoading(true);
        setLoadingMessage('Creating project...');
        setError(null);

        try {
            const workflow = exportWorkflow();
            const project = await gasDeployService.createG8nProject(
                newProjectName.trim(),
                workflow,
                gasAuth.accessToken
            );

            setProjects([project, ...projects]);
            setSelectedProject(project);
            setNewProjectName('');
            setSuccessMessage(`Created: ${project.title}`);
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create project');
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    };

    // Delete project
    const handleDeleteProject = async () => {
        if (!selectedProject || !gasAuth.accessToken) return;

        const confirmed = window.confirm(
            `Are you sure you want to delete project "${selectedProject.title}"?\nThis action cannot be undone!`
        );
        if (!confirmed) return;

        setIsLoading(true);
        setError(null);

        try {
            await gasDeployService.deleteProject(
                selectedProject.scriptId,
                gasAuth.accessToken
            );

            setProjects(projects.filter(p => p.scriptId !== selectedProject.scriptId));
            setSelectedProject(null);
            setSuccessMessage('Project deleted');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete project');
        } finally {
            setIsLoading(false);
        }
    };

    // Sync All (backend code + workflow)
    const handleSyncAll = async () => {
        if (!selectedProject || !gasAuth.accessToken) return;

        setIsLoading(true);
        setLoadingMessage('Syncing code + workflow...');
        setError(null);

        try {
            const workflow = exportWorkflow();
            // Update workflow name to match project name
            workflow.name = selectedProject.title.replace(/^G8N[-_]?/i, '') || workflow.name;

            // 1. Sync files
            await gasDeployService.syncAll(
                selectedProject.scriptId,
                workflow,
                gasAuth.accessToken
            );

            // 2. If Web App exists and we have an API key, sync it
            if (webAppUrl && settings.geminiApiKey) {
                setLoadingMessage('Syncing API Key...');
                const result = await gasDeployService.syncApiKey(
                    webAppUrl,
                    settings.geminiApiKey,
                    gasAuth.accessToken // apiToken
                );

                if (!result.success) {
                    console.warn('API Key sync warning:', result.error);
                }
            }

            setSuccessMessage('Synced code + workflow + API Key!');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Sync failed');
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    };

    // Deploy as Web App
    const handleDeploy = async () => {
        if (!selectedProject || !gasAuth.accessToken) return;

        setIsLoading(true);
        setLoadingMessage('Deploying Web App...');
        setError(null);

        try {
            const deployment = await gasDeployService.deployProject(
                selectedProject.scriptId,
                gasAuth.accessToken
            );
            setWebAppUrl(deployment.webAppUrl);

            // Sync API Key immediately after deploy
            if (settings.geminiApiKey) {
                setLoadingMessage('Syncing API Key...');
                await gasDeployService.syncApiKey(
                    deployment.webAppUrl,
                    settings.geminiApiKey,
                    gasAuth.accessToken // apiToken
                );
            }

            // Save Web App URL to gasConfig (workflow-level, not global)
            updateGasConfig({ webAppUrl: deployment.webAppUrl });

            setSuccessMessage(`Deployed v${deployment.version} & Synced Key!`);
            setTimeout(() => setSuccessMessage(null), 5000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Deploy failed');
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    };

    // Not logged in view
    if (!isTokenValid) {
        return (
            <div className="gas-project-manager">
                <h3>☁️ GAS Project Manager</h3>

                {!settings.gcpClientId && (
                    <div className="gas-warning">
                        ⚠️ Please set <strong>GCP Client ID</strong> in Settings first
                    </div>
                )}

                <button
                    className="gas-login-btn"
                    onClick={handleLogin}
                    disabled={isLoggingIn || !settings.gcpClientId}
                >
                    {isLoggingIn ? '⏳ Logging in...' : '🔓 Login with Google'}
                </button>

                {error && <div className="gas-error">{error}</div>}
            </div>
        );
    }

    // Logged in view
    return (
        <div className="gas-project-manager">
            {/* Loading Overlay */}
            {loadingMessage && (
                <div className="gas-loading-overlay">
                    <div className="gas-loading-spinner"></div>
                    <div className="gas-loading-text">{loadingMessage}</div>
                </div>
            )}

            <div className="gas-header">
                <h3>☁️ GAS Project Manager</h3>
                <button className="gas-logout-btn" onClick={handleLogout}>
                    Logout
                </button>
            </div>

            {error && <div className="gas-error">{error}</div>}
            {successMessage && <div className="gas-success">{successMessage}</div>}

            {/* Project List */}
            <div className="gas-section">
                <div className="gas-section-header">
                    <span>📁 Your G8N Projects</span>
                    <button
                        className="gas-refresh-btn"
                        onClick={loadProjects}
                        disabled={isLoading}
                    >
                        🔄
                    </button>
                </div>

                {isLoading && projects.length === 0 ? (
                    <div className="gas-loading">Loading projects...</div>
                ) : projects.length === 0 ? (
                    <div className="gas-empty">No G8N projects found</div>
                ) : (
                    <div className="gas-project-list">
                        {projects.map(project => (
                            <div
                                key={project.scriptId}
                                className={`gas-project-item ${selectedProject?.scriptId === project.scriptId ? 'selected' : ''}`}
                                onClick={() => setSelectedProject(project)}
                            >
                                <span className="project-name">{project.title}</span>
                                {project.updateTime && (
                                    <span className="project-date">
                                        {new Date(project.updateTime).toLocaleDateString()}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {selectedProject && (
                    <div className="gas-project-actions">
                        <button
                            className="gas-btn load"
                            onClick={handleLoadWorkflow}
                            disabled={isLoading}
                        >
                            📥 Load
                        </button>
                        <button
                            className="gas-btn save"
                            onClick={handleSaveToProject}
                            disabled={isLoading}
                        >
                            💾 Save
                        </button>
                        <button
                            className="gas-btn delete"
                            onClick={handleDeleteProject}
                            disabled={isLoading}
                            title="Delete project"
                        >
                            🗑️
                        </button>
                    </div>
                )}

                {selectedProject && (
                    <div className="gas-project-actions">
                        <button
                            className="gas-btn sync-all"
                            onClick={handleSyncAll}
                            disabled={isLoading}
                            title="Sync backend code + workflow"
                        >
                            🔄 Sync All
                        </button>
                        <button
                            className="gas-btn deploy"
                            onClick={handleDeploy}
                            disabled={isLoading}
                            title="Deploy as Web App"
                        >
                            🚀 Deploy
                        </button>
                    </div>
                )}

                {webAppUrl && (
                    <div className="gas-webapp-url">
                        <span>🌐 Web App:</span>
                        <a href={webAppUrl} target="_blank" rel="noopener noreferrer">
                            {webAppUrl.slice(0, 50)}...
                        </a>
                        {usesGasNativeTools && !authHintDismissed && (
                            <div className="gas-auth-hint">
                                <span>⚠️ This workflow uses GAS Native tools. Click the Web App link above to authorize first.</span>
                                <button
                                    className="gas-auth-dismiss-btn"
                                    onClick={() => {
                                        setAuthHintDismissed(true);
                                        localStorage.setItem('gas-auth-hint-dismissed', 'true');
                                    }}
                                >
                                    Authorized ✓
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Create New Project */}
            <div className="gas-section">
                <div className="gas-section-header">
                    <span>✨ Create New Project</span>
                </div>

                <div className="gas-current-workflow">
                    Current: <strong>{workflowName || 'Untitled'}</strong>
                </div>

                <div className="gas-create-form">
                    <input
                        type="text"
                        placeholder="Project name (G8N- prefix auto-added)"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                    />
                    <button
                        className="gas-btn create"
                        onClick={handleCreateProject}
                        disabled={isLoading || !newProjectName.trim()}
                    >
                        {isLoading ? '⏳' : '➕'} Create
                    </button>
                </div>
            </div>
        </div>
    );
}
