---
name: suggested-commands
description: Commands commonly used in this repo and their Windows-friendly notes.
metadata:
  type: project
---

- `npm run dev` — start the extension dev server.
- `npm run build` — production build.
- `npm run compile` — run `vue-tsc --noEmit` typecheck.
- `npm run zip` — package extension.
- `git status --short` / `git diff` / `git log` — standard git usage works in bash here.
- When checking files manually on Windows shell, prefer `python - <<'PY' ...` or repo tools over PowerShell-only syntax.
- See `mem:task_completion` for the usual verification sequence.