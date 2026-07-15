import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { ToolNodeData, ToolType, ToolCategory } from '../../types';
import { GEMINI_BUILTIN_TOOLS, GCP_API_TOOLS, GAS_NATIVE_TOOLS } from '../../types';
import './nodes.css';

const toolIcons: Record<ToolType, string> = {
    // Gemini Built-in
    google_search: '🔍',
    code_execution: '💻',
    file_search: '📄',
    url_context: '🌐',
    google_maps: '🗺️',
    // GCP APIs
    youtube_data: '📺',
    google_calendar: '📅',
    gmail: '✉️',
    google_drive: '📁',
    places_api: '📍',
    // Custom MCP
    mcp: '🔌',
    function_calling: '⚡',
    // GAS Native
    gas_gmail: '📧',
    gas_calendar: '📆',
    gas_sheets: '📊',
    gas_drive: '💾',
};

const toolLabels: Record<ToolType, string> = {
    // Gemini Built-in
    google_search: 'Google Search',
    code_execution: 'Code Execution',
    file_search: 'File Search',
    url_context: 'URL Context',
    google_maps: 'Maps Grounding',
    // GCP APIs
    youtube_data: 'YouTube API',
    google_calendar: 'Calendar',
    gmail: 'Gmail',
    google_drive: 'Drive',
    places_api: 'Places API',
    // Custom MCP
    mcp: 'MCP Server',
    function_calling: 'Function Call',
    // GAS Native
    gas_gmail: 'GAS Gmail',
    gas_calendar: 'GAS Calendar',
    gas_sheets: 'GAS Sheets',
    gas_drive: 'GAS Drive',
};

const getToolCategory = (toolType: ToolType): ToolCategory => {
    if (GEMINI_BUILTIN_TOOLS.includes(toolType as any)) return 'gemini_builtin';
    if (GCP_API_TOOLS.includes(toolType as any)) return 'gcp_api';
    if (GAS_NATIVE_TOOLS.includes(toolType as any)) return 'gas_native';
    return 'custom_mcp';
};

const categoryStyles: Record<ToolCategory, { bg: string; label: string }> = {
    gemini_builtin: { bg: 'rgba(88, 101, 242, 0.15)', label: '✨ Gemini' },
    gcp_api: { bg: 'rgba(66, 133, 244, 0.15)', label: '☁️ GCP' },
    custom_mcp: { bg: 'rgba(250, 166, 26, 0.15)', label: '🔌 Custom' },
    gas_native: { bg: 'rgba(52, 168, 83, 0.15)', label: '⚙️ GAS' },
};

export function ToolNode({ data, selected }: NodeProps) {
    const nodeData = data as ToolNodeData & { isExecuting?: boolean };
    const category = getToolCategory(nodeData.toolType);
    const catStyle = categoryStyles[category];

    return (
        <div className={`custom-node tool-node ${selected ? 'selected' : ''} ${nodeData.isExecuting ? 'executing' : ''}`}>
            <Handle type="target" position={Position.Left} className="handle target-handle" />
            <div className="node-header">
                <span className="node-icon">{toolIcons[nodeData.toolType] || '🔧'}</span>
                <span className="node-title">{nodeData.label}</span>
            </div>
            <div className="node-content">
                <div
                    className="node-category-badge"
                    style={{
                        background: catStyle.bg,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '9px',
                        marginBottom: '4px',
                        display: 'inline-block'
                    }}
                >
                    {catStyle.label}
                </div>
                <div className="node-tool-type">
                    {toolLabels[nodeData.toolType] || nodeData.toolType}
                </div>
                {nodeData.config?.functionName && (
                    <div className="node-function-name">
                        fn: {nodeData.config.functionName}
                    </div>
                )}
                {nodeData.config?.targetUrl && (
                    <div className="node-url" title={nodeData.config.targetUrl}>
                        {nodeData.config.targetUrl.slice(0, 30)}...
                    </div>
                )}
            </div>
            <Handle
                type="source"
                position={Position.Right}
                id="flow-output"
                className="handle source-handle"
            />
            <Handle
                type="source"
                position={Position.Bottom}
                id="tool-output"
                className="handle tool-handle-source"
                style={{ left: '50%', background: '#faa61a', borderColor: '#faa61a' }}
            />
        </div>
    );
}

