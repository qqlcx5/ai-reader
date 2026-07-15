---
name: tech-stack
description: Project runtime, framework, and build tooling.
metadata:
  type: project
---

- Vue 3 + TypeScript + WXT extension scaffold.
- Pinia for stores, Dexie for IndexedDB, vue-sonner for toasts.
- Build/typecheck: `wxt`, `vue-tsc`.
- Package manager appears to be pnpm (lockfile/layout under `node_modules/.pnpm`).
- UI libs used in codebase include `@lucide/vue`, `reka-ui`, and UnoCSS.
- See `mem:core` for module map.