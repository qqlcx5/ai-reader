---
name: core
description: Top-level map of the ReadChat Clipper app and its main subsystems.
metadata:
  type: project
---

- WXT Vue 3 extension with sidepanel-first UI.
- Core domains: chat, documents/library, feeds/RSS, analysis, settings, sync, models.
- Main entrypoints: `entrypoints/sidepanel/App.vue`, `entrypoints/sidepanel/main.ts`, `entrypoints/offscreen/main.ts`.
- Shared UI lives under `components/ui/`; AuroraMind domain views under `components/auramind/`.
- Toast stack: `components/Toaster.vue` + `utils/toast.ts` used by store and feed UI.
- Related deep dives: `mem:tech_stack`, `mem:conventions`, `mem:suggested_commands`, `mem:task_completion`.