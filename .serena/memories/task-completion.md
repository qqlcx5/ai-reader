---
name: task-completion
description: Default verification steps for code changes in this repo.
metadata:
  type: project
---

- Run `npm run compile` after code changes that affect TypeScript/Vue SFCs.
- For runtime-sensitive work, also run the relevant app flow manually if requested.
- If the compile already fails for unrelated pre-existing issues, report that explicitly and separate it from newly introduced errors.
- If a change touches the toast stack, verify the shell still mounts `components/Toaster.vue` and the store-level `showToast` wiring still routes through `utils/toast.ts`.
- See `mem:core` for where these pieces live.