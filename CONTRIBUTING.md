# Contributing to AI Reader

## Development Setup

### Prerequisites
- Node.js >= 18
- pnpm >= 8

### Getting Started
```bash
# Clone the repo
git clone <repo-url>
cd ai-reader

# Install dependencies
pnpm install

# Start dev mode (Chrome with HMR)
pnpm dev

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Type check
pnpm compile

# Build for production
pnpm build
```

## Architecture

### Directory Structure
```
├── entrypoints/          # WXT entrypoints
│   ├── background.ts     # Service worker (LLM streaming, message routing)
│   ├── content.ts        # Content script (page extraction via defuddle)
│   ├── sidepanel/        # Main UI (multi-model comparison)
│   ├── popup/            # Quick actions
│   └── options/          # Settings page
├── components/           # Vue components
├── stores/               # Pinia stores (state management)
├── utils/                # Utilities
│   ├── llm/              # LLM provider abstraction layer
│   │   ├── types.ts      # Core interfaces (LLMProvider, StreamError, etc.)
│   │   ├── sse.ts        # Shared SSE stream parser
│   │   └── *-provider.ts # Provider implementations
│   ├── errors.ts         # Error type constructors and formatting
│   ├── cost.ts           # Token estimation and cost calculation
│   ├── export.ts         # Markdown/PDF/Obsidian/Notion export
│   ├── markdown.ts       # Markdown rendering with DOMPurify
│   ├── prompts.ts        # Default prompt templates
│   ├── network.ts        # Online/offline detection
│   ├── session.ts        # Session persistence (chrome.storage.session)
│   ├── config-io.ts      # Config import/export
│   └── messaging.ts      # Typed Chrome extension messaging
└── reference/            # Reference projects (not built)
```

### Key Patterns

**LLM Provider System**: Each provider implements the `LLMProvider` interface from `utils/llm/types.ts`. To add a new provider:
1. Create `utils/llm/your-provider.ts` implementing `LLMProvider`
2. Register it in `utils/llm/index.ts`
3. Add default config in `stores/settings.ts`

**Streaming**: Background service worker handles all LLM API calls via Chrome ports. Each model's stream is independent — errors in one don't affect others.

**Error Handling**: All errors use the `StreamError` type (`utils/llm/types.ts`). Constructors are in `utils/errors.ts`. User-facing messages are in Chinese.

**State Management**: Pinia stores handle all state. Stores with `persist` in their name save to `chrome.storage.local`.

### Testing
- Unit tests: `utils/__tests__/`, `stores/__tests__/`
- LLM provider tests: `utils/llm/__tests__/` (mock fetch with MSW patterns)
- Framework: Vitest + happy-dom
- Goal: ≥80% coverage on core modules

### Code Style
- Vue 3 Composition API (`<script setup>`)
- TypeScript strict mode
- UnoCSS for styling (Tailwind-compatible)
- Chinese UI labels, English code comments
