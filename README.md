# AI Reader

AI-powered browser extension for reading, analyzing, and managing web content with multi-model chat, advanced workflows, and RSS pipeline.

## Quick Start

```bash
pnpm install
pnpm dev     # Chrome with auto-reload
pnpm build   # Production build → .output/chrome-mv3/
pnpm test    # 198+ unit tests
```

## Features

- **Context Extraction** — Readability → Defuddle → innerText three-level fallback
- **Multi-Model Chat** — 1–4 LLM providers concurrently, streaming, with per-model metrics
- **Advanced Workflows** — Roundtable (multi-role debate) and Relay Chain (serial pipeline)
- **RSS Pipeline** — Scheduled fetching, dedup, AI summaries, badge unread count
- **Export & Sync** — Obsidian URI, WebDAV, Zip export, auto-backup via alarms
- **Side Panel / Popup / Options** — Three Chrome extension surfaces with cross-entry state sync

## Documentation

| Document | Audience | Content |
|----------|----------|---------|
| [User Guide](doc/USER-GUIDE.md) | Users | Installation, quick start, feature walkthrough, keyboard shortcuts |
| [Provider Setup](doc/PROVIDER-SETUP.md) | Users | How to configure OpenAI, Anthropic, Gemini, Custom providers |
| [Workflow Templates](doc/WORKFLOW-TEMPLATES.md) | Users | Creating and running Roundtable / Relay Chain templates |
| [Troubleshooting](doc/TROUBLESHOOTING.md) | Users | Common issues and solutions |
| [Architecture](doc/ARCHITECTURE.md) | Developers | Module system, data flow, tech decisions, extension points |
| [Design: M1 Entry](doc/design-01-entry-layout.md) | Developers | Entry points, shortcuts, component tree |
| [Design: M2 Extraction](doc/design-02-extraction.md) | Developers | 3-level extraction, chunked transfer, content script |
| [Design: M3 Provider](doc/design-03-provider-client.md) | Developers | Provider abstraction, SSE, retry, metrics |
| [Design: M4 Workspace](doc/design-04-workspace.md) | Developers | Chat scheduling, streaming render, branch prompts |
| [Design: M5 Workflows](doc/design-05-workflows.md) | Developers | Roundtable/Relay orchestration, template management |
| [Design: M6 Export](doc/design-06-export-sync.md) | Developers | Obsidian, WebDAV, Zip, auto-backup |
| [Design: M7 Storage](doc/design-07-storage-data.md) | Developers | Dexie schema, Pinia sync, search worker |
| [Design: M8 RSS](doc/design-08-rss-pipeline.md) | Developers | Fetcher, dedup, summarizer, scheduler |

## Tech Stack

- **Framework**: WXT + Vue 3 + TypeScript
- **State**: Pinia + pinia-plugin-persistedstate + chrome.storage.local
- **Database**: Dexie.js (IndexedDB)
- **Extraction**: @mozilla/readability, defuddle, turndown
- **LLM**: OpenAI, Anthropic, Gemini, Custom (eventsource-parser for SSE)
- **Export**: jszip (Web Worker), webdav
- **Build**: Vite, output ~1.17MB
- **Tests**: Vitest, 198 tests across 23 files

## Project Structure

```
src/
├── entrypoints/           # WXT entries (popup, sidepanel, options, background, content)
├── components/
│   ├── layout/            # M1: ThemeProvider, SidePanelLayout, PopupLayout, OptionsLayout
│   ├── workspace/         # M4: ChatWorkspace, MessageList, ModelCard, StreamingText
│   ├── workflow/          # M5: WorkflowTemplateEditor, WorkflowResults, NodeEditor
│   ├── settings/          # ProviderConfigForm, PromptManager, RssConfigPanel
│   └── shared/            # IconButton, LoadingDots, EmptyState
├── stores/                # Pinia: ui, context, settings, conversation, workflow
├── modules/
│   ├── extraction/        # M2: extractPage, Readability/Defuddle/innerText, transfer
│   ├── provider/          # M3: BaseProvider, OpenAI/Anthropic/Gemini/Custom, retry, metrics
│   └── storage/           # M7: Dexie DB, repositories, search worker, chunk cache
├── lib/
│   ├── workspace/         # M4: scheduler, types
│   ├── workflow/          # M5: roundtable, relay, topological-sort, types
│   ├── export/            # M6: obsidian, webdav, zip worker, scheduler
│   └── rss/               # M8: fetcher, dedup, summarizer, pipeline, badge
├── utils/                 # browser.ts, command-bus.ts
├── styles/                # theme.css, variables
```

## License

MIT
