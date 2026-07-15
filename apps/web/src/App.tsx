// Main App Component

import { ReactFlowProvider } from '@xyflow/react';
import { NodeCanvas, Toolbar, PropertiesPanel, GasProjectManager, TemplateGallery } from './components';
import { ChatPanel } from './components/ChatPanel';
import { useWorkflowStore } from './stores';
import './App.css';

function App() {
  const { appMode, setAppMode, clearChatMessages, resetExecution } = useWorkflowStore();

  const handleModeChange = (mode: 'edit' | 'run') => {
    if (mode === 'edit' && appMode === 'run') {
      // Switching from run to edit - clear execution state
      resetExecution();
    }
    if (mode === 'run' && appMode === 'edit') {
      // Switching from edit to run - clear chat
      clearChatMessages();
      resetExecution();
    }
    setAppMode(mode);
  };

  return (
    <ReactFlowProvider>
      <div className="app">
        <header className="app-header">
          <div className="app-logo">
            <span className="logo-icon">✨</span>
            <h1>G8N: Gemini Workflow Orchestrator</h1>
          </div>
          <div className="mode-toggle">
            <button
              className={`mode-btn ${appMode === 'edit' ? 'active' : ''}`}
              onClick={() => handleModeChange('edit')}
            >
              ✏️ Edit
            </button>
            <button
              className={`mode-btn ${appMode === 'run' ? 'active' : ''}`}
              onClick={() => handleModeChange('run')}
            >
              ▶ Run
            </button>
          </div>
        </header>
        <main className="app-main">
          {appMode === 'edit' && (
            <div className="left-panel">
              <TemplateGallery />
              <Toolbar />
              <GasProjectManager />
            </div>
          )}
          <NodeCanvas />
          {appMode === 'edit' ? <PropertiesPanel /> : <ChatPanel />}
        </main>
      </div>
    </ReactFlowProvider>
  );
}

export default App;
