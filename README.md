---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: d270bcd3df6a2cd27c2792fa9a0b45ef_5e060c45719111f1b2f55254006c9bbf
    ReservedCode1: Q1QQ/AWG2z/L26DwVsCOGjRO844ThKbGKK9PK3o1UE1gLh6en5hR38YRIgKuKVNt+n9d1W6G7YjQR3/ZstZKk/NgFCfxA9boPsmB+4ntELzyPnGT9GsATgJGr5HY7Mdu1mv1iWkGNbOh1USn9+7XS9rcQ3dyWL22JUTa5xwHOTOdb5X1vnq3k8bU0Ro=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: d270bcd3df6a2cd27c2792fa9a0b45ef_5e060c45719111f1b2f55254006c9bbf
    ReservedCode2: Q1QQ/AWG2z/L26DwVsCOGjRO844ThKbGKK9PK3o1UE1gLh6en5hR38YRIgKuKVNt+n9d1W6G7YjQR3/ZstZKk/NgFCfxA9boPsmB+4ntELzyPnGT9GsATgJGr5HY7Mdu1mv1iWkGNbOh1USn9+7XS9rcQ3dyWL22JUTa5xwHOTOdb5X1vnq3k8bU0Ro=
---

# SuperBrain

**Local-First AI Web Clipper** — capture, organize, and chat with web articles.

Built with WXT + Vue 3 + Pinia + Dexie + TypeScript.

## Architecture (8 Modules)

```
┌─────────────────────────────────────────────────────────────┐
│  SuperBrain Browser Extension                                │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │foundation│  │perception│  │  models  │  │chat-with-doc│ │
│  │ DB/schema│  │ capture  │  │ registry │  │  workflows  │ │
│  │ stores   │  │ extract  │  │ encrypt  │  │  streaming  │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────────┘ │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │test-infra│  │export    │  │ polish   │  │  UI Views   │ │
│  │ vitest   │  │ obsidian │  │ a11y/i18n│  │  Capture    │ │
│  │ fixtures │  │ mindmap  │  │ content  │  │  Library    │ │
│  └──────────┘  └──────────┘  │ guard    │  │  Reader     │ │
│                               └──────────┘  │  Chat       │ │
│                                              │  Settings   │ │
│                                              └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

| # | Module | Description | Status |
|---|--------|-------------|--------|
| 1 | **Foundation** | IndexedDB schema (Dexie), Pinia stores, shared domain types | ✅ |
| 2 | **Perception** | Web content capture (defuddle), content script, background SW | ✅ |
| 3 | **Model Management** | LLM provider registry, API key encryption (AES-GCM), connection tester | ✅ |
| 4 | **Chat with Doc** | 4 AI workflows (TL;DR, Knowledge Extractor, Action Items, Tags), SSE streaming | ✅ |
| 5 | **Test Infrastructure** | Vitest config, mock fixtures, global stubs, 262 tests | ✅ |
| 6 | **Export & Sync** | Obsidian Markdown (.md), MDX/JSON mindmap, 3 variants, I18n | ✅ |
| 7 | **Polish** | Accessibility (aria-labels), I18n (zh-CN / en), dedup guard, debounce, config | ✅ |
| 8 | **UI Views** | Capture, Library, Reader, Chat, Settings, Export, Extraction Pipeline | ✅ |

## Tech Stack

- **Framework**: [WXT](https://wxt.dev) 0.20 + Vue 3.5
- **State**: Pinia 3
- **Database**: IndexedDB via Dexie 4
- **Content Extraction**: defuddle 0.19
- **Markdown Rendering**: marked 15 + DOMPurify
- **Styling**: UnoCSS + custom design tokens
- **Icons**: Lucide Vue
- **Testing**: Vitest 4 + jsdom + @vue/test-utils

## Quick Start

```bash
# Install dependencies
pnpm install

# Development (Chrome)
pnpm run dev

# Development (Firefox)
pnpm run dev:firefox

# Build for production
pnpm run build

# Run all tests
pnpm run test

# Type check
pnpm run compile
```

## Development Commands

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start dev server (Chrome) |
| `pnpm run dev:firefox` | Start dev server (Firefox) |
| `pnpm run build` | Production build |
| `pnpm run test` | Run all 262 tests |
| `pnpm run test:watch` | Watch mode |
| `pnpm run compile` | TypeScript type check |
| `pnpm run zip` | Package extension zip |

## Project Structure

```
SuperBrain/
├── core/                    # Business logic modules
│   ├── chat/                # AI chat workflows & prompts
│   ├── export/              # Export engines (Obsidian, MDX, JSON)
│   ├── models/              # LLM provider registry
│   └── reliability/         # Content guard & dedup
├── db/                      # IndexedDB schema & repositories
│   ├── schema.ts            # Dexie schema (5 tables)
│   ├── model-config.repository.ts
│   └── settings.repository.ts
├── stores/                  # Pinia stores
│   ├── popup.ts             # View navigation
│   ├── library.ts           # Saved articles
│   ├── capture.ts           # Extraction state machine
│   └── settings.ts          # User preferences
├── shared/                  # Shared types
│   └── domain/              # Domain types & interfaces
├── i18n/                    # Internationalization
│   ├── index.ts             # Global t() / useI18n()
│   └── locales/             # zh-CN.json / en.json
├── entrypoints/             # WXT entrypoints
│   ├── background.ts        # Service Worker
│   ├── content.ts           # Content Script (lightweight)
│   ├── sidepanel/           # Side Panel UI (Vue SPA)
│   └── options/             # Options page (Model config)
├── components/              # Shared components
│   └── views/               # View components
└── doc/                     # Documentation
    ├── progress.md
    └── 3d-mural.md
```

## Features

- **One-Click Capture**: Extract full article content with readability (defuddle) + Turndown
- **AI Chat with Documents**: 4 built-in workflows — TL;DR, Knowledge Extractor, Action Items, Auto-Tagging
- **Multi-Provider LLM**: DeepSeek, OpenAI-compatible, custom providers with AES-GCM key encryption
- **Offline-First**: IndexedDB local storage, no cloud dependency
- **Export**: Obsidian-compatible Markdown, MDX mindmaps, JSON graphs; 3 variants (default/developer/business)
- **Accessibility**: Full aria-label/role keyboard navigation support
- **I18n**: zh-CN / en locale support

## Contributing

See [Contributing.md](./Contributing.md) and [Manifesto.md](./Manifesto.md).

## License

MIT
*（内容由AI生成，仅供参考）*
