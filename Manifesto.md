# SuperBrain Manifesto

## Vision

SuperBrain is a **local-first AI web clipper** that empowers individuals to capture, organize, and deeply understand web content — without depending on cloud services.

## Principles

### 1. Local-First, Privacy-First
All article data lives in **IndexedDB** on your machine. No telemetry, no cloud sync, no third-party analytics. Your reading history is yours alone.

### 2. AI as a Tool, Not a Service
LLM integration is **provider-agnostic**. Bring your own API key (DeepSeek, OpenAI-compatible, or custom). Keys are encrypted with AES-GCM before storage. No vendor lock-in.

### 3. Offline Capable
The extension works without internet access for viewing, searching, and organizing saved articles. AI features require connectivity, but your library never does.

### 4. Minimalist UX
Side panel (not popup), unocss-powered design system, 400px fixed width. Every pixel serves a purpose. No onboarding wizard — just start capturing.

### 5. Export Freedom
Your data should never be trapped. Export to **Obsidian Markdown**, **MDX mindmaps**, or **JSON**. Three variants (standard / developer / business) for different workflows.

### 6. Hackable
Plain TypeScript + Vue 3. No framework magic. The `core/` layer is pure logic, testable without browser APIs. Modular architecture means you can swap any component.

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| **WXT** over Plasmo | Better Vue 3 integration, native UnoCSS support, simpler config |
| **Dexie** over raw IndexedDB | Promise-based API, schema versioning, compound indexes |
| **defuddle** over Mozilla Readability | Better CJK support, maintained, TypeScript-native |
| **Side Panel** over Popup | Persistent UI, 400×660px vs 800×600px max, survives tab switches |
| **SSE streaming** over polling | Lower latency, native `eventsource-parser`, no WebSocket complexity |
| **Vitest** over Jest | Native ESM, faster startup, better WXT compatibility |

## Non-Goals

- ❌ Cloud sync / multi-device sync
- ❌ Social sharing features
- ❌ PDF annotation (use dedicated tools)
- ❌ Full-text search across all tabs (outside scope of a side panel extension)
- ❌ Mobile companion app

## Roadmap

| Phase | Deliverables |
|-------|-------------|
| v0.7 (current) | Core clipper, AI chat, export, i18n, a11y |
| v0.8 | Full-text search (MiniSearch), tag management, batch operations |
| v0.9 | WebSocket real-time collaboration, plugin API |
| v1.0 | Firefox AMO listing, CI/CD pipeline, auto-update |

## Credits

Built with [WXT](https://wxt.dev), [Vue 3](https://vuejs.org), [Pinia](https://pinia.vuejs.org), [Dexie.js](https://dexie.org), and [defuddle](https://github.com/nicedoc/defuddle).
