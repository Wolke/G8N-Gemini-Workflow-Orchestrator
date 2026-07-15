# G8N 2.0 — Gemini Workspace Workflow Orchestrator

G8N 是以 Gemini、Google Workspace MCP、Firebase 與 Apps Script 為核心的視覺化 AI 工作流平台。本 repository 同時支援兩個獨立成果：Agent 工程平台與 Workspace AI 自動化模板庫。

## Repository

```text
apps/web                 React Flow workflow designer
apps/runtime             Firebase Functions agent runtime
packages/workflow-schema Versioned workflow and template contracts
packages/workflow-engine Resumable, approval-aware execution engine
packages/tool-providers  Workspace MCP and extension provider interfaces
templates                Project, Marketing and Education Ops templates
docs/ironman             Two independent 30-day article tracks
```

## Quick start

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm test
npm run build
```

The editor includes an Automation Gallery. Import a template, inspect its approval boundaries, configure credentials, and switch to Run mode.

## Runtime deployment

1. Create a Firebase project and enable Authentication, Firestore, Functions and Hosting.
2. Copy `.firebaserc.example` to `.firebaserc` and set the project ID.
3. Store the model credential with `firebase functions:secrets:set GEMINI_API_KEY`.
4. Set `GEMINI_MODEL` through the Functions parameter prompt; the default is `gemini-3.5-flash`.
5. Deploy Firestore rules, Functions and Hosting with the Firebase CLI.

Workspace MCP OAuth credentials and refresh tokens must remain server-side. Never place a client secret in the web app or Zustand state.

## Safety defaults

- Explicit graph edges only; no implicit node fallback in the G8N 2.0 engine.
- Write, send, delete, share and grade actions require approval.
- A resumed run records completed node IDs to prevent duplicate writes.
- Every runtime execution produces a versioned trace in the authenticated user's Firestore path.
- GAS remains the Sheets and trigger extension; Gmail, Drive, Calendar, Chat and People use Workspace MCP when available.

See [architecture](docs/ARCHITECTURE.md), [engineering series](docs/ironman/engineering-series.md), and [automation series](docs/ironman/automation-series.md).
