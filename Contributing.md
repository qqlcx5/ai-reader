# Contributing to SuperBrain

## Development Setup

```bash
# Prerequisites: Node 20+, pnpm 9+
git clone <repo-url>
cd SuperBrain
pnpm install
pnpm run dev
```

## Project Structure

```
core/       → Business logic (pure TypeScript, no Vue dependency)
db/         → IndexedDB schema + repositories
stores/     → Pinia stores (state management)
shared/     → Domain types & interfaces
i18n/       → Translation bundles + useI18n composable
entrypoints/ → WXT entrypoints (background, content, sidepanel, options)
components/ → Shared Vue components
```

## Conventions

### TypeScript
- Strict mode enabled
- `shared/domain/index.ts` for all domain types
- Barrel exports (`index.ts`) for all modules

### Vue Components
- `<script setup lang="ts">` syntax
- UnoCSS utility classes (no scoped CSS unless necessary)
- Composables in `entrypoints/sidepanel/composables/`
- Props typed with `defineProps<T>()`

### Testing
- Vitest + @vue/test-utils
- Tests co-located (`*.test.ts` next to source)
- Mock `chrome.*` APIs in `vitest.setup.ts`
- `fake-indexeddb` for Dexie tests

### Git
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`
- PRs require passing `pnpm run test` and `pnpm run compile`

## Adding a New Feature

1. **Core logic** → `core/<module>/` with tests
2. **Store** (if needed) → `stores/<name>.ts`
3. **UI** → `entrypoints/sidepanel/views/` or `components/`
4. **I18n** → `i18n/locales/zh-CN.json` + `en.json`
5. **Tests** → `*.test.ts` co-located
6. **Update** `doc/progress.md`

## Build & Test

```bash
pnpm run build      # Production build
pnpm run test       # Run all tests (262 cases)
pnpm run compile    # TypeScript type check
```

## Code Review Checklist

- [ ] TypeScript strict mode passes (`pnpm run compile`)
- [ ] All tests pass (`pnpm run test`)
- [ ] Build succeeds (`pnpm run build`)
- [ ] aria-label on all interactive elements
- [ ] New strings added to both `zh-CN.json` and `en.json`
- [ ] No hardcoded credentials or keys
- [ ] New modules have barrel exports (`index.ts`)
