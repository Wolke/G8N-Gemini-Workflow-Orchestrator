# G8N: Gemini Workflow Orchestrator

## General Info
* **Project name:** G8N: Gemini Workflow Orchestrator
* **Elevator pitch:** Build and deploy Gemini-powered agents to Google Workspace in minutes using a visual node-based canvas and native Apps Script integration.

---

## Project Story

### Inspiration
The idea for **G8N** was born from a simple observation: while LLMs like Gemini are incredibly powerful, integrating them into daily workflows (like Google Sheets, Calendar, or Drive) often requires writing repetitive glue code or complex authentication logic. We wanted to bridge the gap between "Generative AI" and "Actionable Automation."

Imagine a world where anyone can "draw" an AI agent that doesn't just talk, but actually *acts* within their workspace. We envisioned a tool where complex agentic logic could be orchestrated visually, then deployed as a serverless backend with a single click.

### What it does
**G8N** is a visual workflow builder that allows users to:
1. **Orchestrate AI Logic:** Use a node-based canvas to define how Gemini should process information, use memory, and interact with tools.
2. **Native Tool Integration:** Directly connect to Google Apps Script (GAS) to perform tasks like sending emails, updating spreadsheets, or managing calendar events.
3. **One-Click Deployment:** Automatically compile the visual workflow into a GAS project and deploy it as a Web App, instantly ready for production use.
4. **Hybrid Execution:** Test logic locally in an interactive "Run Mode" before committing to a cloud deployment.

### How we built it
We built the core experience using **React** and **Vite** for a performant, modern frontend. 
* **Visual Logic:** Powered by `@xyflow/react` to handle the complex state management of nodes and edges.
* **AI Engine:** Integrated Google's `Generative-AI` SDK, focusing on **Function Calling** to enable the agent to interact with external services.
* **Cloud Infrastructure:** We leveraged the **Google Apps Script API** to programmatically create and update scripts in the user's Drive, treating GAS as a serverless runtime for our agents.
* **State Management:** Used `Zustand` for a unified store that handles both the UI state and the persistent workflow data.

### Challenges we faced
The biggest challenge was **Syncing State across environments.** Bridging the gap between a local web browser and the Google Apps Script cloud environment required careful management of OAuth 2.0 scopes and handling the 9KB storage limit of GAS `PropertiesService` for long-term memory. 

We also had to design a robust **Function Dispatcher** that could translate visual node configurations into valid JSON schemas for Gemini's function calling, while ensuring the execution was secure and predictable.

### Accomplishments that we're proud of
We successfully implemented a **Zero-Config Deployment** flow. Seeing a complex node-based workflow transformed into a functional Google Apps Script project—complete with OAuth handling and an active Web App URL—was a major "Aha!" moment for the team.

### What we learned
We learned that the true power of Agentic AI isn't just in the model's reasoning, but in its **Connectivity.** Designing for "tool-use" first completely changed how we approached UX: it's not a chatbot; it's a visual programming language for AI.

### What's next for G8N
We plan to add more native "G8N blocks," including specialized nodes for RAG (Retrieval-Augmented Generation) using Google Drive files and a marketplace where users can share their custom workflow templates.

---

## Built with
* **Languages:** TypeScript, JavaScript, HTML/CSS
* **Frameworks:** React 19, Vite
* **APIs & Services:** Google Gemini API, Google Apps Script API, Google Drive API, Google OAuth 2.0
* **Libraries:** @xyflow/react, Zustand, Google Generative AI SDK

---

## Try it out
* **GitHub Repo:** [https://github.com/Wolke/G8N-Gemini-Workflow-Orchestrator](https://github.com/Wolke/G8N-Gemini-Workflow-Orchestrator)
* **Demo Site:** [https://Wolke.github.io/G8N-Gemini-Workflow-Orchestrator/](https://Wolke.github.io/G8N-Gemini-Workflow-Orchestrator/)
