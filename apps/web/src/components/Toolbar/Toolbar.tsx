// Toolbar Component - Node palette and workflow controls

import { useState } from 'react';
import { useWorkflowStore } from '../../stores';
import { NodeType, GeminiModel, GEMINI_MODELS } from '../../types';
import { requiresOAuth } from '../../types/gcp';
import './Toolbar.css';

interface NodeItem {
    type: NodeType;
    label: string;
    icon: string;
    color: string;
}

const nodeItems: NodeItem[] = [
    { type: 'start', label: 'Start', icon: '▶', color: '#43b581' },
    { type: 'agent', label: 'Agent', icon: '🤖', color: '#5865f2' },
    { type: 'tool', label: 'Tool', icon: '🔧', color: '#faa61a' },
    { type: 'memory', label: 'Memory', icon: '🧠', color: '#9b59b6' },
    { type: 'condition', label: 'Classify', icon: '◇', color: '#f04747' },
    { type: 'approval', label: 'Approval', icon: '✓', color: '#00b0f4' },
    { type: 'output', label: 'Output', icon: '⬛', color: '#808090' },
];

import { WorkflowEngine, generateWorkflow, applyGeneratedWorkflow } from '../../services';

export function Toolbar() {
    const {
        addNode,
        saveWorkflow,
        newWorkflow,
        workflowName,
        settings,
        updateSettings,
        execution,
        resetExecution,
        nodes,
    } = useWorkflowStore();

    // AI Workflow Generator state
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generateError, setGenerateError] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState<GeminiModel>('gemini-2.5-flash');

    const handleAddNode = (type: NodeType) => {
        // Calculate position that doesn't overlap with existing nodes
        const NODE_WIDTH = 200;
        const PADDING = 30;

        if (nodes.length === 0) {
            // First node - place at center-ish location
            addNode(type, { x: 100, y: 150 });
            return;
        }

        // Find the rightmost node
        const rightmostNode = nodes.reduce((max, node) =>
            node.position.x > max.position.x ? node : max
            , nodes[0]);

        // Place new node to the right of the rightmost node
        const newX = rightmostNode.position.x + NODE_WIDTH + PADDING;
        const newY = rightmostNode.position.y;

        addNode(type, { x: newX, y: newY });
    };

    const [oauthWarning, setOauthWarning] = useState<string | null>(null);

    const handleGenerateWorkflow = async () => {
        if (!aiPrompt.trim()) {
            setGenerateError('Please describe what you want to build.');
            return;
        }

        if (!settings.geminiApiKey) {
            setGenerateError('Please add your Gemini API key in Settings first.');
            return;
        }

        setIsGenerating(true);
        setGenerateError(null);
        setOauthWarning(null);

        try {
            const workflow = await generateWorkflow(aiPrompt, selectedModel);
            applyGeneratedWorkflow(workflow);
            setAiPrompt(''); // Clear input on success

            // Check for tools requiring OAuth
            const oauthTools = workflow.nodes
                .filter(n => n.type === 'tool' && requiresOAuth((n.data as any).toolType))
                .map(n => (n.data as any).label);

            if (oauthTools.length > 0) {
                setOauthWarning(`⚠️ Note: This workflow uses tools that require OAuth login: ${oauthTools.join(', ')}. Please click the nodes to authorize.`);
            }

        } catch (error) {
            setGenerateError(error instanceof Error ? error.message : 'Generation failed');
        } finally {
            setIsGenerating(false);
        }
    };

    const isRunning = execution.status === 'running';

    return (
        <div className="toolbar">
            {/* AI Workflow Generator - Hero Feature */}
            <div className="toolbar-section ai-generator">
                <h3 className="toolbar-title">✨ AI Generate</h3>
                <div className="model-selector">
                    <label>Model:</label>
                    <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value as GeminiModel)}
                        disabled={isGenerating}
                    >
                        {GEMINI_MODELS.map((model) => (
                            <option key={model} value={model}>
                                {model}
                            </option>
                        ))}
                    </select>
                </div>
                <textarea
                    className="ai-prompt-input"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Describe your workflow in natural language...&#10;&#10;Examples:&#10;• Search Google for AI news and summarize&#10;• Check my calendar and send email reminders&#10;• Analyze a YouTube video"
                    rows={4}
                    disabled={isGenerating}
                />
                {generateError && (
                    <div className="ai-error">{generateError}</div>
                )}
                {oauthWarning && (
                    <div className="ai-warning">{oauthWarning}</div>
                )}
                <button
                    className={`action-button generate ${isGenerating ? 'generating' : ''}`}
                    onClick={handleGenerateWorkflow}
                    disabled={isGenerating}
                >
                    {isGenerating ? '⏳ Generating...' : '⚡ Generate Workflow'}
                </button>
            </div>

            <div className="toolbar-section">
                <h3 className="toolbar-title">Nodes</h3>
                <div className="node-palette">
                    {nodeItems.map((item) => (
                        <button
                            key={item.type}
                            className="node-button"
                            onClick={() => handleAddNode(item.type)}
                            style={{ '--node-color': item.color } as React.CSSProperties}
                            title={`Add ${item.label} Node`}
                        >
                            <span className="node-button-icon">{item.icon}</span>
                            <span className="node-button-label">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="toolbar-section">
                <h3 className="toolbar-title">Workflow</h3>
                <div className="workflow-info">
                    <input
                        type="text"
                        className="workflow-name-input"
                        value={workflowName}
                        onChange={(e) => useWorkflowStore.setState({ workflowName: e.target.value })}
                        placeholder="Workflow name..."
                    />
                </div>
                <div className="toolbar-actions" style={{ flexWrap: 'wrap' }}>
                    <button
                        className={`action-button run ${isRunning ? 'running' : ''}`}
                        onClick={() => WorkflowEngine.run()}
                        disabled={isRunning}
                    >
                        {isRunning ? '⏳ ...' : '▶ Run'}
                    </button>
                    {execution.history.length > 0 && (
                        <button className="action-button reset" onClick={resetExecution}>
                            🧹
                        </button>
                    )}
                    <button className="action-button save" onClick={saveWorkflow}>
                        💾
                    </button>
                    <button className="action-button new" onClick={newWorkflow}>
                        ✨
                    </button>
                </div>
            </div>

            <div className="toolbar-section">
                <h3 className="toolbar-title">Settings</h3>
                <div className="settings-group">
                    <label className="settings-label">Gemini API Key</label>
                    <div className="api-key-row">
                        <input
                            type="password"
                            className="settings-input"
                            value={settings.geminiApiKey}
                            onChange={(e) => updateSettings({ geminiApiKey: e.target.value })}
                            placeholder="Enter your API key..."
                        />
                        <button
                            className="save-key-btn"
                            onClick={() => {
                                // Force save to localStorage
                                localStorage.setItem('gemini-agent-builder-storage', JSON.stringify({
                                    state: {
                                        savedWorkflows: useWorkflowStore.getState().savedWorkflows,
                                        settings: useWorkflowStore.getState().settings,
                                    }
                                }));
                                alert('API Key saved!');
                            }}
                            title="Save API Key"
                        >
                            💾
                        </button>
                    </div>
                </div>
                <div className="settings-group">
                    <label className="settings-label">GCP Client ID</label>
                    <input
                        type="text"
                        className="settings-input"
                        value={settings.gcpClientId || ''}
                        onChange={(e) => updateSettings({ gcpClientId: e.target.value })}
                        placeholder="OAuth Client ID for GCP APIs..."
                    />
                    <small style={{ color: '#888', fontSize: '10px' }}>Required for YouTube, Calendar, Gmail, Drive APIs</small>
                </div>
                <div className="settings-group">
                    <label className="settings-label">GCP API Key</label>
                    <input
                        type="password"
                        className="settings-input"
                        value={settings.gcpApiKey || ''}
                        onChange={(e) => updateSettings({ gcpApiKey: e.target.value })}
                        placeholder="API Key for GCP services..."
                    />
                    <small style={{ color: '#888', fontSize: '10px' }}>For Places API and other API Key-based services</small>
                </div>
            </div>
        </div>
    );
}
