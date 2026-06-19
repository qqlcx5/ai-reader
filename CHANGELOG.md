# Changelog

## [1.0.0] - 2026-06-19

### Features
- Multi-model parallel LLM querying (OpenAI, Anthropic, Gemini, Ollama, Custom endpoints)
- Side Panel with responsive columnar layout for model comparison
- Independent stream management with per-model cancellation
- Content extraction via defuddle (3-tier fallback: defuddle async → defuddle sync → innerText)
- Follow-up questions with per-model conversation history
- Cost estimation before sending requests with confirmation dialog
- Token usage display per model card
- Export to Markdown, PDF, Obsidian URI, Notion
- Summary history with persistence
- Custom prompt template management (CRUD)
- Keyboard shortcuts (Alt+S summarize, Alt+Shift+S toggle panel)
- Dark mode with system preference detection
- Offline detection with user-friendly banner
- Session persistence (side panel state survives close/reopen)
- Config import/export (API keys excluded)
- Error boundary for graceful error recovery
- Structured error handling with user-friendly Chinese messages
- Stream timeout protection (120s idle timeout)
- Context window management for follow-up conversations

### Technical
- WXT (Chrome MV3) + Vue 3 + TypeScript + UnoCSS
- Pinia state management with auto-persistence
- Provider abstraction layer with SSE stream parsing
- Comprehensive test suite (Vitest + happy-dom)
- Accessibility: ARIA labels, keyboard navigation, WCAG AA contrast
