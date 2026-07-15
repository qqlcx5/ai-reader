---
name: conventions
description: Durable code style and implementation conventions observed in the repo.
metadata:
  type: project
---

- Vue SFCs use `<script lang="ts" setup>` and concise composables.
- Keep edits surgical; match nearby style and comment density.
- Toast pattern: import from `@/utils/toast`, render once via `components/Toaster.vue` in the app shell.
- Stores often expose small action methods instead of larger service layers.
- Avoid speculative abstractions; prefer direct helpers for single-use flows.
- Use `mem:core` for subsystem location and `mem:task_completion` for verification steps.