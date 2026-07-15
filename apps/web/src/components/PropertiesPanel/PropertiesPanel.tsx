import { useState } from 'react';
import { useWorkflowStore } from '../../stores';
import { GcpAuthService } from '../../services/gcpAuthService';
import { requiresOAuth } from '../../types/gcp';
import type {
    StartNodeData,
    AgentNodeData,
    ToolNodeData,
    ConditionNodeData,
    OutputNodeData,
    MemoryNodeData,
    ApprovalNodeData,
    ToolType,
    ToolCategory,
    GcpApiTool,
    GeminiModel
} from '../../types';
import {
    GEMINI_BUILTIN_TOOLS,
    GCP_API_TOOLS,
    GAS_NATIVE_TOOLS,
} from '../../types';
import type { GasNativeTool } from '../../types';
import './PropertiesPanel.css';

const GEMINI_MODELS_OPTIONS: { value: GeminiModel; label: string }[] = [
    { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro (Preview)' },
    { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
];

const TOOL_CATEGORY_OPTIONS: { value: ToolCategory; label: string; icon: string }[] = [
    { value: 'gemini_builtin', label: 'Gemini Built-in', icon: '✨' },
    { value: 'gcp_api', label: 'GCP API (OAuth)', icon: '☁️' },
    { value: 'custom_mcp', label: 'Custom / MCP', icon: '🔌' },
    { value: 'gas_native', label: 'GAS Native', icon: '⚙️' },
];

const TOOL_TYPE_BY_CATEGORY: Record<ToolCategory, { value: ToolType; label: string }[]> = {
    gemini_builtin: [
        { value: 'google_search', label: '🔍 Google Search' },
        { value: 'code_execution', label: '💻 Code Execution' },
        { value: 'file_search', label: '📄 File Search' },
        { value: 'url_context', label: '🌐 URL Context' },
        { value: 'google_maps', label: '🗺️ Google Maps Grounding' },
    ],
    gcp_api: [
        { value: 'youtube_data', label: '📺 YouTube Data API' },
        { value: 'google_calendar', label: '📅 Google Calendar' },
        { value: 'gmail', label: '✉️ Gmail' },
        { value: 'google_drive', label: '📁 Google Drive' },
        { value: 'places_api', label: '📍 Places API' },
    ],
    custom_mcp: [
        { value: 'mcp', label: '🔌 MCP Server' },
        { value: 'function_calling', label: '⚡ Function Calling' },
    ],
    gas_native: [
        { value: 'gas_gmail', label: '📧 Gmail (MailApp)' },
        { value: 'gas_calendar', label: '📆 Calendar' },
        { value: 'gas_sheets', label: '📊 Sheets' },
        { value: 'gas_drive', label: '💾 Drive' },
    ],
};

export function PropertiesPanel() {
    const { nodes, selectedNodeId, updateNodeData, deleteNode, execution, gasConfig } = useWorkflowStore();

    // State for GCP auth - updating this triggers re-render to refresh auth status
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_gcpAuthVersion, setGcpAuthVersion] = useState(0);
    const [authError, setAuthError] = useState<string | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    const nodeHistory = execution.history.filter(h => h.nodeId === selectedNodeId);

    if (!selectedNode) {
        return (
            <div className="properties-panel empty">
                <div className="empty-state">
                    <span className="empty-icon">👆</span>
                    <p>Select a node to edit its properties</p>
                </div>
            </div>
        );
    }

    const handleUpdate = (data: Partial<typeof selectedNode.data>) => {
        updateNodeData(selectedNode.id, data);
    };

    const renderStartNodeProps = (data: StartNodeData) => (
        <>
            <div className="prop-group">
                <label>Label</label>
                <input
                    type="text"
                    value={data.label}
                    onChange={(e) => handleUpdate({ label: e.target.value })}
                />
            </div>
            <div className="prop-group">
                <label>Input Variables</label>
                <div className="variables-list">
                    {data.inputVariables?.map((v, i) => (
                        <div key={i} className="variable-item">
                            <input
                                type="text"
                                value={v.name}
                                placeholder="Name"
                                onChange={(e) => {
                                    const vars = [...(data.inputVariables || [])];
                                    vars[i] = { ...vars[i], name: e.target.value };
                                    handleUpdate({ inputVariables: vars });
                                }}
                            />
                            <select
                                value={v.type}
                                onChange={(e) => {
                                    const vars = [...(data.inputVariables || [])];
                                    vars[i] = { ...vars[i], type: e.target.value as 'string' | 'number' | 'boolean' | 'object' };
                                    handleUpdate({ inputVariables: vars });
                                }}
                            >
                                <option value="string">String</option>
                                <option value="number">Number</option>
                                <option value="boolean">Boolean</option>
                                <option value="object">Object</option>
                            </select>
                        </div>
                    ))}
                    <button
                        className="add-variable-btn"
                        onClick={() => handleUpdate({
                            inputVariables: [...(data.inputVariables || []), { name: '', type: 'string' }]
                        })}
                    >
                        + Add Variable
                    </button>
                </div>
            </div>
        </>
    );

    const renderAgentNodeProps = (data: AgentNodeData) => (
        <>
            <div className="prop-group">
                <label>Label</label>
                <input
                    type="text"
                    value={data.label}
                    onChange={(e) => handleUpdate({ label: e.target.value })}
                />
            </div>
            <div className="prop-group">
                <label>Model</label>
                <select
                    value={data.model}
                    onChange={(e) => handleUpdate({ model: e.target.value as GeminiModel })}
                >
                    {GEMINI_MODELS_OPTIONS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                </select>
            </div>
            <div className="prop-group">
                <label>System Prompt</label>
                <textarea
                    value={data.systemPrompt}
                    onChange={(e) => handleUpdate({ systemPrompt: e.target.value })}
                    rows={4}
                    placeholder="Enter system instructions..."
                />
            </div>
            <div className="prop-group">
                <label>Temperature: {data.temperature}</label>
                <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={data.temperature}
                    onChange={(e) => handleUpdate({ temperature: parseFloat(e.target.value) })}
                />
            </div>
            <div className="prop-group">
                <label className="checkbox-label" style={{ fontWeight: 'bold' }}>
                    <input
                        type="checkbox"
                        checked={data.deepResearch || false}
                        onChange={(e) => handleUpdate({ deepResearch: e.target.checked })}
                    />
                    Enable Deep Research 🧠
                </label>
            </div>
            <div className="prop-group">
                <label>Tools</label>
                <div style={{ fontSize: '11px', color: '#888', fontStyle: 'italic', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                    Connect <b>Tool Nodes</b> to the <b>Tools</b> input handle on the Agent node to enable capabilities.
                </div>
            </div>
        </>
    );

    const renderToolNodeProps = (data: ToolNodeData) => {
        // Helper to determine current category from toolType
        const getCurrentCategory = (): ToolCategory => {
            if (GEMINI_BUILTIN_TOOLS.includes(data.toolType as any)) return 'gemini_builtin';
            if (GCP_API_TOOLS.includes(data.toolType as any)) return 'gcp_api';
            if (GAS_NATIVE_TOOLS.includes(data.toolType as GasNativeTool)) return 'gas_native';
            return 'custom_mcp';
        };

        const currentCategory = getCurrentCategory();
        const isGcpTool = GCP_API_TOOLS.includes(data.toolType as GcpApiTool);
        const { settings } = useWorkflowStore.getState();

        const handleCategoryChange = (newCategory: ToolCategory) => {
            // When category changes, reset to first tool of that category
            const firstTool = TOOL_TYPE_BY_CATEGORY[newCategory][0];
            handleUpdate({ toolType: firstTool.value, config: {} });
            setAuthError(null);
        };

        const handleGcpLogin = async () => {
            if (!settings.gcpClientId) {
                setAuthError('Please set GCP Client ID in Settings first');
                return;
            }
            setIsAuthenticating(true);
            setAuthError(null);
            try {
                await GcpAuthService.requestAccessForTool(data.toolType as GcpApiTool, settings.gcpClientId);
                // Trigger re-render by updating state
                setGcpAuthVersion(v => v + 1);
            } catch (e: any) {
                setAuthError(`Authorization failed: ${e.message}`);
            } finally {
                setIsAuthenticating(false);
            }
        };

        return (
            <>
                <div className="prop-group">
                    <label>Label</label>
                    <input
                        type="text"
                        value={data.label}
                        onChange={(e) => handleUpdate({ label: e.target.value })}
                    />
                </div>
                <div className="prop-group">
                    <label>Category</label>
                    <select
                        value={currentCategory}
                        onChange={(e) => handleCategoryChange(e.target.value as ToolCategory)}
                    >
                        {TOOL_CATEGORY_OPTIONS.map(c => (
                            <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                        ))}
                    </select>
                </div>
                <div className="prop-group">
                    <label>Tool Type</label>
                    <select
                        value={data.toolType}
                        onChange={(e) => {
                            handleUpdate({ toolType: e.target.value as ToolType, config: {} });
                            setAuthError(null);
                        }}
                    >
                        {TOOL_TYPE_BY_CATEGORY[currentCategory].map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                </div>

                {/* GCP Tool Authorization Status */}
                {isGcpTool && (() => {
                    const needsOAuth = requiresOAuth(data.toolType as GcpApiTool);
                    const hasApiKey = !!settings.gcpApiKey;
                    const isOAuthAuthorized = needsOAuth && GcpAuthService.isToolAuthorized(data.toolType as GcpApiTool);

                    // OAuth-based tools (YouTube, Calendar, Gmail, Drive)
                    if (needsOAuth) {
                        if (isOAuthAuthorized) {
                            return (
                                <div className="prop-group">
                                    <div style={{
                                        padding: '8px',
                                        background: 'rgba(67, 181, 129, 0.1)',
                                        border: '1px solid #43b581',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        color: '#43b581'
                                    }}>
                                        ✅ OAuth Authorized
                                    </div>
                                    <div style={{
                                        marginTop: '8px',
                                        padding: '8px',
                                        background: 'rgba(250, 166, 26, 0.1)',
                                        border: '1px solid #faa61a',
                                        borderRadius: '6px',
                                        fontSize: '11px',
                                        color: '#faa61a'
                                    }}>
                                        ⚠️ This tool only supports local execution and cannot be called on GAS
                                    </div>
                                </div>
                            );
                        }
                        return (
                            <div className="prop-group">
                                <div style={{
                                    padding: '12px',
                                    background: 'rgba(250, 166, 26, 0.1)',
                                    border: '1px solid #faa61a',
                                    borderRadius: '6px',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ color: '#faa61a', marginBottom: '8px', fontSize: '12px' }}>
                                        🔐 This tool requires OAuth authorization
                                    </div>
                                    <button
                                        onClick={handleGcpLogin}
                                        disabled={isAuthenticating}
                                        style={{
                                            background: isAuthenticating ? '#666' : '#4285f4',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            padding: '8px 16px',
                                            cursor: isAuthenticating ? 'wait' : 'pointer',
                                            fontSize: '13px',
                                        }}
                                    >
                                        {isAuthenticating ? '⏳ Authorizing...' : '🔓 Login to Google to Authorize'}
                                    </button>
                                    {authError && (
                                        <div style={{ color: '#f04747', marginTop: '8px', fontSize: '11px' }}>
                                            {authError}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    }

                    // API Key-based tools (Places API)
                    if (hasApiKey) {
                        return (
                            <div className="prop-group">
                                <div style={{
                                    padding: '8px',
                                    background: 'rgba(67, 181, 129, 0.1)',
                                    border: '1px solid #43b581',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    color: '#43b581'
                                }}>
                                    🔑 API Key Set
                                </div>
                            </div>
                        );
                    }
                    return (
                        <div className="prop-group">
                            <div style={{
                                padding: '12px',
                                background: 'rgba(250, 166, 26, 0.1)',
                                border: '1px solid #faa61a',
                                borderRadius: '6px',
                                textAlign: 'center'
                            }}>
                                <div style={{ color: '#faa61a', marginBottom: '4px', fontSize: '12px' }}>
                                    🔑 This tool requires an API Key
                                </div>
                                <div style={{ color: '#888', fontSize: '11px' }}>
                                    Please set GCP API Key in Settings on the left
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Tool-specific configs */}
                {data.toolType === 'function_calling' && (
                    <>
                        <div className="prop-group">
                            <label>Function Name</label>
                            <input
                                type="text"
                                value={data.config?.functionName || ''}
                                onChange={(e) => handleUpdate({ config: { ...data.config, functionName: e.target.value } })}
                                placeholder="my_function"
                            />
                        </div>
                        <div className="prop-group">
                            <label>Description</label>
                            <textarea
                                value={data.config?.functionDescription || ''}
                                onChange={(e) => handleUpdate({ config: { ...data.config, functionDescription: e.target.value } })}
                                rows={2}
                                placeholder="What this function does..."
                            />
                        </div>
                    </>
                )}
                {data.toolType === 'file_search' && (
                    <div className="prop-group">
                        <label>File URIs (One per line)</label>
                        <textarea
                            value={data.config?.fileUris?.join('\n') || ''}
                            onChange={(e) => handleUpdate({
                                config: {
                                    ...data.config,
                                    fileUris: e.target.value.split('\n').filter(u => u.trim() !== '')
                                }
                            })}
                            rows={4}
                            placeholder="gs://... or https://..."
                        />
                        <small style={{ color: '#888' }}>Enter URIs of files uploaded to Google AI Studio</small>
                    </div>
                )}
                {data.toolType === 'mcp' && (
                    <div className="prop-group">
                        <label>MCP Server URL</label>
                        <input
                            type="url"
                            value={data.config?.mcpServerUrl || ''}
                            onChange={(e) => handleUpdate({ config: { ...data.config, mcpServerUrl: e.target.value } })}
                            placeholder="http://localhost:3000/sse"
                        />
                    </div>
                )}
                {data.toolType === 'url_context' && (
                    <div className="prop-group">
                        <label>Target URL</label>
                        <input
                            type="url"
                            value={data.config?.targetUrl || ''}
                            onChange={(e) => handleUpdate({ config: { ...data.config, targetUrl: e.target.value } })}
                            placeholder="https://..."
                        />
                    </div>
                )}

                {/* GAS Native Tool Status */}
                {GAS_NATIVE_TOOLS.includes(data.toolType as GasNativeTool) && (() => {
                    const hasWebAppUrl = !!gasConfig.webAppUrl;

                    if (hasWebAppUrl) {
                        return (
                            <div className="prop-group">
                                <div style={{
                                    padding: '8px',
                                    background: 'rgba(52, 168, 83, 0.1)',
                                    border: '1px solid #34a853',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    color: '#34a853'
                                }}>
                                    ✅ Ready - Will call GAS Web App for local testing
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div className="prop-group">
                            <div style={{
                                padding: '12px',
                                background: 'rgba(250, 166, 26, 0.1)',
                                border: '1px solid #faa61a',
                                borderRadius: '6px',
                                textAlign: 'center'
                            }}>
                                <div style={{ color: '#faa61a', marginBottom: '4px', fontSize: '12px' }}>
                                    ⚠️ Deploy Required for Local Testing
                                </div>
                                <div style={{ color: '#888', fontSize: '11px' }}>
                                    GAS native tools require a deployed Web App to test locally.
                                    Use GAS Project Manager → Deploy first.
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* GAS Native Tool Info */}
                {GAS_NATIVE_TOOLS.includes(data.toolType as GasNativeTool) && (
                    <div className="prop-group">
                        <label>How It Works</label>
                        <div style={{
                            padding: '12px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: '6px',
                            fontSize: '12px',
                            color: '#aaa',
                            lineHeight: '1.5'
                        }}>
                            {data.toolType === 'gas_gmail' && (
                                <>
                                    <strong style={{ color: '#34a853' }}>📧 Gmail Tool</strong>
                                    <p style={{ margin: '8px 0 0 0' }}>
                                        Connect this tool to an Agent node. When you ask the AI to send an email,
                                        it will automatically call this tool with the recipient, subject, and body.
                                    </p>
                                    <p style={{ margin: '8px 0 0 0', fontStyle: 'italic' }}>
                                        Example: "幫我寄一封測試信給 test@example.com"
                                    </p>
                                </>
                            )}
                            {data.toolType === 'gas_calendar' && (
                                <>
                                    <strong style={{ color: '#34a853' }}>📆 Calendar Tool</strong>
                                    <p style={{ margin: '8px 0 0 0' }}>
                                        Connect this tool to an Agent node. The AI can create, list, or delete calendar events.
                                    </p>
                                    <p style={{ margin: '8px 0 0 0', fontStyle: 'italic' }}>
                                        Example: "幫我建立一個明天下午 3 點的會議"
                                    </p>
                                </>
                            )}
                            {data.toolType === 'gas_sheets' && (
                                <>
                                    <strong style={{ color: '#34a853' }}>📊 Sheets Tool</strong>
                                    <p style={{ margin: '8px 0 0 0' }}>
                                        Connect this tool to an Agent node. The AI can read or write data to Google Sheets.
                                    </p>
                                    <p style={{ margin: '8px 0 0 0', fontStyle: 'italic' }}>
                                        Example: "讀取試算表 ID xxx 的 A1:D10 資料"
                                    </p>
                                </>
                            )}
                            {data.toolType === 'gas_drive' && (
                                <>
                                    <strong style={{ color: '#34a853' }}>💾 Drive Tool</strong>
                                    <p style={{ margin: '8px 0 0 0' }}>
                                        Connect this tool to an Agent node. The AI can search, list, or create files in Drive.
                                    </p>
                                    <p style={{ margin: '8px 0 0 0', fontStyle: 'italic' }}>
                                        Example: "搜尋 Drive 中名為 report 的檔案"
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </>
        );
    };

    const renderConditionNodeProps = (data: ConditionNodeData) => (
        <>
            <div className="prop-group">
                <label>Label</label>
                <input
                    type="text"
                    value={data.label}
                    onChange={(e) => handleUpdate({ label: e.target.value })}
                />
            </div>
            <div className="prop-group">
                <label>Model</label>
                <select
                    value={data.model}
                    onChange={(e) => handleUpdate({ model: e.target.value as GeminiModel })}
                >
                    {GEMINI_MODELS_OPTIONS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                </select>
            </div>
            <div className="prop-group">
                <label>Input Variable</label>
                <input
                    type="text"
                    value={data.inputVariable || 'last_output'}
                    onChange={(e) => handleUpdate({ inputVariable: e.target.value })}
                    placeholder="last_output"
                />
            </div>

            <div className="prop-group">
                <label>Categories</label>
                <div className="list-container">
                    {data.categories?.map((cat, i) => (
                        <div key={i} className="list-item">
                            <input
                                type="text"
                                value={cat}
                                onChange={(e) => {
                                    const cats = [...(data.categories || [])];
                                    cats[i] = e.target.value;
                                    handleUpdate({ categories: cats });
                                }}
                            />
                            <button
                                className="remove-btn"
                                onClick={() => handleUpdate({ categories: data.categories.filter((_, idx) => idx !== i) })}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    <button
                        className="add-btn"
                        onClick={() => handleUpdate({ categories: [...(data.categories || []), `Category ${data.categories?.length + 1}`] })}
                    >
                        + Add Category
                    </button>
                </div>
            </div>

            <div className="prop-group">
                <label>Examples (Few-Shot)</label>
                <div className="examples-list">
                    {data.examples?.map((ex, i) => (
                        <div key={ex.id} className="example-item" style={{ border: '1px solid #444', padding: '8px', marginBottom: '8px', borderRadius: '4px' }}>
                            <input
                                type="text"
                                placeholder="Input text..."
                                value={ex.text}
                                onChange={(e) => {
                                    const exs = [...(data.examples || [])];
                                    exs[i] = { ...ex, text: e.target.value };
                                    handleUpdate({ examples: exs });
                                }}
                                style={{ marginBottom: '4px', width: '100%' }}
                            />
                            <select
                                value={ex.category}
                                onChange={(e) => {
                                    const exs = [...(data.examples || [])];
                                    exs[i] = { ...ex, category: e.target.value };
                                    handleUpdate({ examples: exs });
                                }}
                                style={{ width: '100%' }}
                            >
                                <option value="" disabled>Select Category</option>
                                {data.categories?.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                            <button
                                className="remove-btn-small"
                                onClick={() => handleUpdate({ examples: data.examples.filter((_, idx) => idx !== i) })}
                                style={{ marginTop: '4px', fontSize: '0.8em', padding: '2px 6px' }}
                            >
                                Remove Example
                            </button>
                        </div>
                    ))}
                    <button
                        className="add-btn"
                        onClick={() => handleUpdate({
                            examples: [...(data.examples || []), { id: Date.now().toString(), text: '', category: data.categories?.[0] || '' }]
                        })}
                    >
                        + Add Example
                    </button>
                </div>
            </div>
        </>
    );

    const renderOutputNodeProps = (data: OutputNodeData) => (
        <>
            <div className="prop-group">
                <label>Label</label>
                <input
                    type="text"
                    value={data.label}
                    onChange={(e) => handleUpdate({ label: e.target.value })}
                />
            </div>
            <div className="prop-group">
                <label>Output Format</label>
                <select
                    value={data.outputFormat}
                    onChange={(e) => handleUpdate({ outputFormat: e.target.value as OutputNodeData['outputFormat'] })}
                >
                    <option value="text">Text</option>
                    <option value="json">JSON</option>
                    <option value="markdown">Markdown</option>
                </select>
            </div>
        </>
    );

    const renderMemoryNodeProps = (data: MemoryNodeData) => (
        <>
            <div className="prop-group">
                <label>Label</label>
                <input
                    type="text"
                    value={data.label}
                    onChange={(e) => handleUpdate({ label: e.target.value })}
                />
            </div>
            <div className="prop-group">
                <label>Storage Key</label>
                <input
                    type="text"
                    value={data.storageKey || 'chat_history'}
                    onChange={(e) => handleUpdate({ storageKey: e.target.value })}
                    placeholder="chat_history"
                />
                <small style={{ color: '#888' }}>localStorage key for conversation history</small>
                <div style={{
                    marginTop: '8px',
                    padding: '8px',
                    background: 'rgba(250, 166, 26, 0.1)',
                    border: '1px solid #faa61a',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: '#faa61a'
                }}>
                    ⚠️ <b>Note for Deployment:</b><br />
                    When running on Google Apps Script, this data is saved to <b>Script Properties</b> (max 9KB limit).
                </div>
            </div>
            <div className="prop-group">
                <label>Max Messages: {data.maxMessages || 10}</label>
                <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={data.maxMessages || 10}
                    onChange={(e) => handleUpdate({ maxMessages: parseInt(e.target.value) })}
                />
            </div>
            <div className="prop-group">
                <button
                    className="action-button"
                    style={{ background: '#f04747', marginTop: '8px' }}
                    onClick={() => {
                        localStorage.removeItem(data.storageKey || 'chat_history');
                        alert('Memory cleared!');
                    }}
                >
                    🗑 Clear Memory
                </button>
            </div>
        </>
    );

    const renderApprovalNodeProps = (data: ApprovalNodeData) => (
        <>
            <div className="prop-group">
                <label>Approval summary</label>
                <textarea value={data.summary} onChange={(e) => handleUpdate({ summary: e.target.value })} rows={5} />
            </div>
            <div className="prop-group">
                <label>Protected actions</label>
                <input value={(data.risks || []).join(', ')} onChange={(e) => handleUpdate({ risks: e.target.value.split(',').map((risk) => risk.trim()).filter(Boolean) as ApprovalNodeData['risks'] })} />
            </div>
        </>
    );

    return (
        <div className="properties-panel">
            <div className="panel-header">
                <h3>{selectedNode.type?.toUpperCase()} Node</h3>
                <button
                    className="delete-node-btn"
                    onClick={() => deleteNode(selectedNode.id)}
                    title="Delete Node"
                >
                    🗑
                </button>
            </div>
            <div className="panel-content">
                {selectedNode.type === 'start' && renderStartNodeProps(selectedNode.data as StartNodeData)}
                {selectedNode.type === 'agent' && renderAgentNodeProps(selectedNode.data as AgentNodeData)}
                {selectedNode.type === 'tool' && renderToolNodeProps(selectedNode.data as ToolNodeData)}
                {selectedNode.type === 'condition' && renderConditionNodeProps(selectedNode.data as ConditionNodeData)}
                {selectedNode.type === 'approval' && renderApprovalNodeProps(selectedNode.data as ApprovalNodeData)}
                {selectedNode.type === 'output' && renderOutputNodeProps(selectedNode.data as OutputNodeData)}
                {selectedNode.type === 'memory' && renderMemoryNodeProps(selectedNode.data as MemoryNodeData)}

                {nodeHistory.length > 0 && (
                    <div className="prop-group history-section">
                        <label className="history-label">Execution Results</label>
                        <div className="history-list">
                            {nodeHistory.map((h, i) => (
                                <div key={i} className="history-item">
                                    <div className="history-header">
                                        <span className="history-time">{new Date(h.startTime).toLocaleTimeString()}</span>
                                        {h.endTime && <span className="history-duration">{h.endTime - h.startTime}ms</span>}
                                    </div>
                                    <pre className="history-data">
                                        {typeof h.output === 'string'
                                            ? h.output
                                            : typeof h.output === 'object' && h.output !== null && 'text' in h.output
                                                ? (h.output as any).text
                                                : JSON.stringify(h.output, null, 2)}
                                    </pre>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
