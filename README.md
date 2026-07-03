# AuraMind

> **AI-powered web clipper, reader, and spaced-repetition review tool.**
> Local-first · Privacy-respecting · Cross-device sync

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-blue)](https://chrome.google.com/webstore)
[![Built with WXT](https://img.shields.io/badge/Built%20with-WXT-1f2937)](https://wxt.dev)

AuraMind turns the web into a personal, AI-curated knowledge base you can actually review and remember. Clip any page, get an AI summary, highlight what matters, and let the SM-2 algorithm schedule it for daily review.

---

## ✨ Features

- **✂️ One-click clipping** — clean Markdown extraction, works on every site
- **🤖 AI summaries** — side-panel chat that runs asynchronously while you browse
- **🖍️ Highlights & floating toolbar** — save the parts that matter
- **🔁 SM-2 spaced repetition** — read it once, remember it forever
- **📡 RSS reader** — auto-discovery, scheduled refresh, content-hash dedup
- **🔄 Cross-device sync** — WebDAV (Nextcloud, 坚果云) or S3 (Cloudflare R2, AWS S3, MinIO)
- **🔒 Local-first** — everything in IndexedDB, no servers, no tracking

## 🧠 Built For

- Researchers drowning in PDFs and blog posts
- Developers who save docs "to read later" (and never do)
- Language learners reviewing highlights
- Knowledge workers building a second brain

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| Framework | [WXT](https://wxt.dev) (Manifest V3) |
| UI | Vue 3 + UnoCSS + Reka UI |
| State | Pinia + persistedstate |
| Storage | IndexedDB (via Dexie) |
| Search | MiniSearch |
| Markdown | Marked |
| Sync | WebDAV · aws4fetch (S3) |
| Test | Vitest + Testing Library |

## 🚀 Development

```bash
pnpm install
pnpm dev          # start WXT dev server
pnpm compile      # type-check
pnpm build        # production build
pnpm zip          # build + zip for Chrome Web Store
```

## 📦 Project Structure

```
.
├── components/         # Vue components
│   ├── auramind/       # main workspace components
│   ├── common/         # shared atoms
│   ├── ui/             # design system primitives
│   ├── views/          # full-page views
│   └── workspace/      # workspace sub-components
├── composables/        # Vue composables
├── db/                 # Dexie schema & repositories
├── entrypoints/        # WXT entry points (background, content, sidepanel)
├── public/             # static assets (icons)
├── services/           # business logic (capture, ai, sync, etc.)
├── stores/             # Pinia stores
├── store/              # Chrome Web Store listing assets
│   ├── listing/        # en.md, zh-CN.md
│   └── privacy/        # privacy-policy.html
├── types/              # TypeScript types
└── utils/              # helpers
```

## 📝 Chrome Web Store

The full launch checklist, listing copy, and privacy policy live in [`store/`](./store/).

## 🤝 Contributing

PRs welcome. For major changes, please open an issue first to discuss what you'd like to change.

## 📄 License

[MIT](./LICENSE)
