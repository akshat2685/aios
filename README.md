# AIOS — Personal Artificial Intelligence Operating System

AIOS is a local-first, privacy-first Personal AI Operating System designed to run on a laptop and act as a personal assistant, software engineer, research assistant, knowledge manager, and project planner.

It belongs entirely to the user and runs local models offline while supporting remote model APIs through a secure, encrypted credentials keychain.

---

## Architecture & System Features

### 1. Transparent Acrylic Shell (Phase 1 & 2)
- **Frameless UI**: Elegant translucent Electron app window styled with HSL balanced colors and Glassmorphism details.
- **Ambient Particles & HUD**: Floating command palette (Ctrl+K style) and JARVIS-inspired performance HUD metrics.
- **Local Stream Chat**: Dynamic SSE streaming connection directly with local Ollama instances (e.g. `qwen2.5:8b`).

### 2. Multi-Provider LLM Router (Phase 3)
- **Unified Provider Clients**: Lightweight REST streaming integrations for **OpenAI**, **Anthropic Claude**, **Google Gemini** (using balanced bracket matching JSON stream parsing), **OpenRouter**, **NVIDIA NIM**, and **Custom APIs**.
- **Resilient Request Retries**: 3-attempt request loop with exponential backoff on network failures.
- **Local Fallback Policies**: Instantly routes to local Ollama on remote network failures.
- **Keychain Secret Storage**: Derived machine-specific keys to decrypt and securely store credentials inside the native OS Keychain (using `keytar`).
- **Cost & Token Tracker**: Calculates tokens and estimated costs per request and persists cumulative stats in `~/.aios/usage.json`.

### 3. Smart RAG & Memory Database (Phase 4 & 5)
- **Document Parsers**: Integrated extraction support for **PDF** (`pdf-parse`) and **DOCX** (`mammoth`), alongside markdown, CSV, JSON, log, and YAML text structures.
- **Binary Pollution Filtering**: Extension whitelists that skip image/audio/zip files.
- **Incremental watch syncs**: watches directory paths dynamically and replaces stale vector entries when files are modified.
- **Resilient Booting**: Graceful startup catches Qdrant offline failures without crashing Electron.

### 4. File Intelligence & sandboxed Coding Agent (Phase 6 & 7)
- **ReAct Reasoning Executor**: Implements a multi-step Thought → XML Action → Observation cycle parsing `<tool_call>` tags recursively.
- **File Tools Suite**: Read, write, list directories, grep patterns, and run shell execution commands.
- **Boundary Path Security**: Strict `checkPathSafety` assertions ensuring agents can only access files within the active workspace.

### 5. Multi-Source Research Agent (Phase 8)
- **Search Fallbacks**: Queries **DuckDuckGo Lite** (using form POST fields to bypass scraper blocks) and falls back to **Wikipedia OpenSearch API**.
- **Article Text Scraper**: Strips nav links, advertisements, and scripts to fetch clean semantic paragraph text blocks.
- **Synthesis compile**: Full automated search -> scrape -> LLM synthesis pipeline.

### 6. Project Planner Agent (Phase 9)
- **Task Decomposition**: Breaks high-level goals into task trees with dependency hierarchies.
- **Task Tracker**: Creates, lists, and updates task statuses (`pending`, `in_progress`, `completed`, `failed`) persisted in `~/.aios/plans.json`.

### 7. Core OS Operations (Phases 10 to 14)
- **Security Approval Dialogs**: Intercepts high-risk operations (e.g. `shell:run`) and requires user confirmation.
- **Automation triggers**: Hook watch events directly to launch workflow actions.
- **Cross-Agent delegation**: Exposes `agent:delegate` tool allowing agents to delegate sub-tasks to each other.
- **Plugin Manager**: Scans and loads custom JS tools dynamically from `~/.aios/plugins/`.

### 8. Dynamic Agent Skills System (Vercel Agent Skills compatible)
- **`SkillManager`**: Automatically scans and parses `SKILL.md` files (loaded via `npx skills add`) inside `.agents/skills/` using `gray-matter`.
- **Dynamic Prompts & Tools**: Injects skill descriptions into agent system prompts and exposes `skill:read` for agents to dynamically download instructions.
- **`agent-reach` Integration**: Fully integrated the `agent-reach` CLI tool (giving access to YouTube, Reddit, Twitter, and 12 other platforms) to the TS `ResearchAgent` and all 7 Python ADK agents (`planner`, `research`, `coding`, `website`, `testing`, `security`, `docs`) via a native `run_agent_reach_command` tool.
- **Background Auto-Start**: Installed a hidden VBScript runner in the Windows Startup folder to launch AIOS on boot, and placed a desktop shortcut pointing to it.


---

## Repository Structure

```
AIOS/
├── apps/
│   └── daemon/               # Electron main & renderer process
├── packages/
│   ├── agents/               # ReAct agents and tool registries
│   ├── automation/           # Cron and event triggers engine
│   ├── config/               # Zod validated configurations manager
│   ├── connectors/           # Folder watching connectors
│   ├── core/                 # Core logs and MemoryService
│   ├── devtools/             # Git and Workspace Tree Intelligence
│   ├── llm/                  # Providers and Router pipeline
│   ├── memory/               # Qdrant client and chunking
│   ├── plugins/              # Dynamic plugin loader
│   ├── security/             # GuardRail approval loops
│   ├── types/                # Core system TS types
│   ├── ui/                   # Shared UI definitions
│   └── utils/                # General helpers
└── packages/tests/           # Automation test sandboxes
```

---

## Getting Started

### Prerequisites
- Node.js >= 20.0.0
- Docker (for running Qdrant Vector database)
- Ollama (for offline local models)

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run monorepo build:
   ```bash
   npm run build
   ```
4. Build the Electron renderer & main processes:
   ```bash
   cd apps/daemon
   npm run build:renderer
   npm run build:main
   ```
5. Start the AIOS application:
   ```bash
   npm start
   ```

### Windows Startup & Shortcut Configurations
- **Auto-Boot**: The installer sets up `C:\Users\ijain\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\aios.vbs` to silently launch AIOS on startup.
- **Desktop Shortcut**: Double-click `C:\Users\ijain\Desktop\AIOS.lnk` to manually launch the AIOS daemon and window anytime. You can also drag this to your taskbar!


---

## License
Private / Proprietary to User.
