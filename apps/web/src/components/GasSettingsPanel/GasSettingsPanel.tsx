// GAS Settings Panel Component

import { useState } from 'react';
import { useWorkflowStore } from '../../stores';
import { gasService } from '../../services/gasService';
import { gasDeployService } from '../../services/gasDeployService';
import { GcpAuthService } from '../../services/gcpAuthService';
import './GasSettingsPanel.css';

interface GasSettingsPanelProps {
    isCompact?: boolean;
}

export function GasSettingsPanel({ isCompact = false }: GasSettingsPanelProps) {
    const { gasConfig, updateGasConfig, exportWorkflow, settings } = useWorkflowStore();
    const [isTesting, setIsTesting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isDeploying, setIsDeploying] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleTestConnection = async () => {
        if (!gasConfig.webAppUrl) {
            setStatusMessage({ type: 'error', text: 'Please enter Web App URL first' });
            return;
        }

        setIsTesting(true);
        setStatusMessage(null);

        const success = await gasService.ping(gasConfig);

        setIsTesting(false);
        if (success) {
            setStatusMessage({ type: 'success', text: 'Connection successful!' });
            updateGasConfig({ syncStatus: 'out_of_sync' });
        } else {
            setStatusMessage({ type: 'error', text: 'Connection failed. Check URL and permissions.' });
            updateGasConfig({ syncStatus: 'error' });
        }
    };

    const handleSync = async () => {
        if (!gasConfig.webAppUrl) {
            setStatusMessage({ type: 'error', text: 'Please configure GAS first' });
            return;
        }

        setIsSyncing(true);
        updateGasConfig({ syncStatus: 'syncing' });
        setStatusMessage(null);

        try {
            const workflow = exportWorkflow();
            const result = await gasService.syncWorkflow(workflow, gasConfig);

            updateGasConfig({
                syncStatus: 'synced',
                lastSyncAt: new Date().toISOString(),
            });
            setStatusMessage({ type: 'success', text: `Synced to GAS (${result.storage})` });
        } catch (error) {
            updateGasConfig({ syncStatus: 'error' });
            setStatusMessage({ type: 'error', text: error instanceof Error ? error.message : 'Sync failed' });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleDeploy = async () => {
        if (!settings.gcpClientId) {
            setStatusMessage({ type: 'error', text: 'Please configure GCP Client ID in settings first' });
            return;
        }

        setIsDeploying(true);
        setStatusMessage(null);

        try {
            // Get OAuth token using static method
            const token = await GcpAuthService.requestAccess([
                'https://www.googleapis.com/auth/script.projects',
                'https://www.googleapis.com/auth/script.deployments',
            ], settings.gcpClientId);

            if (!token) {
                throw new Error('Failed to get authentication token');
            }

            // Deploy
            const result = await gasDeployService.fullDeploy(
                'G8N Workflow Backend',
                token,
                gasConfig.projectId || undefined
            );

            updateGasConfig({
                webAppUrl: result.deployment.webAppUrl,
                projectId: result.project.scriptId,
                syncStatus: 'synced',
                lastSyncAt: new Date().toISOString(),
            });

            setStatusMessage({ type: 'success', text: 'Deployed successfully!' });
        } catch (error) {
            setStatusMessage({ type: 'error', text: error instanceof Error ? error.message : 'Deploy failed' });
        } finally {
            setIsDeploying(false);
        }
    };

    const getSyncStatusBadge = () => {
        switch (gasConfig.syncStatus) {
            case 'synced': return <span className="status-badge synced">✓ Synced</span>;
            case 'syncing': return <span className="status-badge syncing">↻ Syncing...</span>;
            case 'out_of_sync': return <span className="status-badge out-of-sync">⚠ Out of sync</span>;
            case 'error': return <span className="status-badge error">✗ Error</span>;
            default: return <span className="status-badge not-configured">○ Not configured</span>;
        }
    };

    if (isCompact) {
        return (
            <div className="gas-settings-compact">
                {getSyncStatusBadge()}
                <button
                    className="gas-btn-small"
                    onClick={handleSync}
                    disabled={isSyncing || !gasConfig.webAppUrl}
                    title="Sync to GAS"
                >
                    {isSyncing ? '↻' : '🔄'}
                </button>
                <button
                    className="gas-btn-small"
                    onClick={handleDeploy}
                    disabled={isDeploying}
                    title="Deploy to GAS"
                >
                    {isDeploying ? '↻' : '🚀'}
                </button>
            </div>
        );
    }

    return (
        <div className="gas-settings-panel">
            <h3>☁️ Google Apps Script</h3>

            <div className="gas-status-row">
                <span>Status:</span>
                {getSyncStatusBadge()}
            </div>

            {gasConfig.lastSyncAt && (
                <div className="gas-last-sync">
                    Last sync: {new Date(gasConfig.lastSyncAt).toLocaleString()}
                </div>
            )}

            <div className="gas-form-group">
                <label>Web App URL</label>
                <input
                    type="url"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={gasConfig.webAppUrl || ''}
                    onChange={(e) => updateGasConfig({ webAppUrl: e.target.value, syncStatus: 'out_of_sync' })}
                />
            </div>

            <div className="gas-form-group">
                <label>API Token (optional)</label>
                <input
                    type="password"
                    placeholder="Your API token"
                    value={gasConfig.apiToken || ''}
                    onChange={(e) => updateGasConfig({ apiToken: e.target.value })}
                />
            </div>

            <div className="gas-actions">
                <button
                    className="gas-btn test"
                    onClick={handleTestConnection}
                    disabled={isTesting || !gasConfig.webAppUrl}
                >
                    {isTesting ? 'Testing...' : '🔗 Test Connection'}
                </button>

                <button
                    className="gas-btn sync"
                    onClick={handleSync}
                    disabled={isSyncing || !gasConfig.webAppUrl}
                >
                    {isSyncing ? 'Syncing...' : '🔄 Sync Workflow'}
                </button>

                <button
                    className="gas-btn deploy"
                    onClick={handleDeploy}
                    disabled={isDeploying}
                >
                    {isDeploying ? 'Deploying...' : '🚀 Deploy to GAS'}
                </button>
            </div>

            {statusMessage && (
                <div className={`gas-message ${statusMessage.type}`}>
                    {statusMessage.text}
                </div>
            )}

            {gasConfig.projectId && (
                <div className="gas-project-info">
                    <small>Project ID: {gasConfig.projectId}</small>
                </div>
            )}
        </div>
    );
}
