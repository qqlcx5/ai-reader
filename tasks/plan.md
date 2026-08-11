# Implementation Plan: Skill Manager

## Overview

Build an independent TypeScript Skill management tool with a shared core, CLI commands, and a local Vue Web interface. It scans configured local `SKILL.md` directories and `skills-lock.json`, stores original Markdown in `data/content/`, maintains reviewed metadata in `data/skills.json`, uses an OpenAI-compatible API to generate Chinese metadata drafts, and exports enabled records to `data/enabled-skills.json`.

The first implementation should be runnable without an AI key for scan, sync, search, edit, and export workflows. AI enrichment is an optional command with explicit failure states.

## Architecture Decisions

- Use TypeScript for the CLI and shared domain logic.
- Use Vue for the local Web UI, matching the existing `ai-reader` ecosystem while keeping this project independently runnable.
- Keep JSON and Markdown files as the persistence layer; do not introduce a database in v1.
- Put parsing, identity, merge, hash, validation, search, and export logic in a framework-independent core.
- Treat local `SKILL.md` content as the raw source and `skills-lock.json` as supplemental source/version data.
- Separate generated metadata from reviewed metadata through explicit status fields and merge rules.
- Preserve reviewed metadata during normal sync; raw-content changes set `needs-review`.
- Keep provider credentials in environment variables and never write them to catalog or export files.
- Make every CLI command idempotent and safe to rerun.

## Dependency Graph

```text
Types and JSON validation
        |
        +--> SKILL.md parser and local discovery
        |          |
        |          +--> lock-file merge and stable identity
        |                         |
        |                         +--> raw-content sync and change status
        |                                        |
        |                                        +--> repository read/write
        |                                                       |
        |                  +------------------------------------+------------------+
        |                  |                                    |                  |
        |                  v                                    v                  v
        |             CLI search                         AI enrichment       JSON export
        |                                                                         |
        +-------------------------------------------------------------------------+
                                      |
                                      v
                              Local Web management UI
```

## Task List

### Phase 1: Project Foundation

## Task 1: Scaffold standalone project and commands

**Description:** Create the independent project package, TypeScript configuration, test setup, source configuration, environment example, and a command entry point with typed command dispatch.

**Acceptance criteria:**
- [ ] Project starts with documented install and development commands.
- [ ] `scan`, `sync`, `enrich`, `export`, and `search` commands are registered, even if later commands initially report an intentional not-ready state.
- [ ] Configuration supports local Skill directories and a lock-file path.
- [ ] Secrets are loaded from environment variables only.

**Verification:**
- [ ] TypeScript compilation passes.
- [ ] CLI help lists all commands.
- [ ] A test verifies configuration defaults and missing optional AI configuration.

**Dependencies:** None

**Files likely touched:** `package.json`, `tsconfig.json`, `src/cli/*`, `src/core/config.ts`, `.env.example`, `tests/*`

**Estimated scope:** Medium

## Task 2: Define domain types and catalog validation

**Description:** Implement the catalog types, metadata status, preferences, sync status, source information, export shape, and runtime validation for `skills.json`.

**Acceptance criteria:**
- [ ] Valid catalog data round-trips through JSON validation.
- [ ] Invalid required fields are rejected with actionable errors.
- [ ] Schema version is explicit and unsupported versions are rejected.
- [ ] The model distinguishes generated metadata from reviewed metadata.

**Verification:**
- [ ] Unit tests cover valid, invalid, missing, and legacy-shaped records.
- [ ] TypeScript compilation passes.

**Dependencies:** Task 1

**Files likely touched:** `src/core/types.ts`, `src/core/schema.ts`, `tests/core/schema.test.ts`

**Estimated scope:** Small

### Phase 2: Discovery and Synchronization

## Task 3: Parse and discover local Skills

**Description:** Recursively discover `SKILL.md` files in configured directories and parse frontmatter or leading metadata needed for identity and the English description.

**Acceptance criteria:**
- [ ] Nested Skill directories are discovered.
- [ ] Malformed or unreadable files produce per-file diagnostics without aborting unrelated discovery.
- [ ] Skill IDs remain stable across repeated scans.
- [ ] Duplicate IDs are reported deterministically.

**Verification:**
- [ ] Fixture tests cover nested paths, malformed files, and duplicate IDs.
- [ ] `scan` reports discovered count and diagnostics.

**Dependencies:** Task 2

**Files likely touched:** `src/core/skill-parser.ts`, `src/core/skill-discovery.ts`, `src/cli/scan.ts`, `tests/fixtures/*`, `tests/core/discovery.test.ts`

**Estimated scope:** Medium

## Task 4: Merge lock-file source metadata

**Description:** Parse `skills-lock.json` and merge repository, path, source type, version/ref, and computed hash information into discovered local records without duplicating Skills.

**Acceptance criteria:**
- [ ] Matching local and lock-file records merge into one record.
- [ ] Unknown lock-file entries and unknown local entries are reported separately and handled without data loss.
- [ ] Source metadata remains optional for local-only Skills.
- [ ] Hashes are treated as source metadata, not as stable identity.

**Verification:**
- [ ] Fixture tests cover matching, unmatched, duplicate, and malformed lock-file records.
- [ ] Repeated merge produces identical record identities.

**Dependencies:** Task 3

**Files likely touched:** `src/core/lockfile.ts`, `src/core/skill-identity.ts`, `tests/core/lockfile.test.ts`

**Estimated scope:** Medium

## Task 5: Implement raw-content sync and repository persistence

**Description:** Copy raw Markdown into `data/content/<skill-id>.md`, read and write the catalog atomically, compute content hashes, preserve preferences and reviewed metadata, and mark changed content as `needs-review`.

**Acceptance criteria:**
- [ ] First sync creates one catalog record and one raw-content file per discovered Skill.
- [ ] Repeated sync does not duplicate records or reset preferences.
- [ ] Changed raw content updates the cache and marks the record for review.
- [ ] Reviewed metadata is not overwritten by normal sync.
- [ ] Interrupted writes cannot leave a partially written catalog file.

**Verification:**
- [ ] Integration tests run sync against temporary directories.
- [ ] Tests verify idempotency, hash changes, preference preservation, and reviewed metadata preservation.
- [ ] `sync` produces a summary of added, changed, unchanged, and problematic records.

**Dependencies:** Tasks 2-4

**Files likely touched:** `src/core/skill-sync.ts`, `src/core/skill-repository.ts`, `src/core/hash.ts`, `src/cli/sync.ts`, `tests/core/sync.test.ts`

**Estimated scope:** Large; keep filesystem and merge logic in separate modules.

### Checkpoint: Core Catalog

- [ ] Scan and sync work against the current repository's `.agents/skills` and `skills-lock.json`.
- [ ] Repeated sync is idempotent.
- [ ] Catalog validation, focused tests, and TypeScript checks pass.
- [ ] Review the generated fixture output before starting AI and UI work.

### Phase 3: Catalog Workflows

## Task 6: Add search, filters, and enabled export

**Description:** Implement pure search/filter operations and export the enabled subset to `data/enabled-skills.json`.

**Acceptance criteria:**
- [ ] Search covers Chinese and English names, summaries, categories, use cases, usage, and triggers.
- [ ] Category, enabled, and favorite filters compose correctly.
- [ ] Export includes only enabled Skills and produces deterministic valid JSON.
- [ ] Empty and invalid query behavior is defined and tested.

**Verification:**
- [ ] Unit tests cover each searchable field and filter combination.
- [ ] CLI tests cover `search` and `export`.

**Dependencies:** Task 5

**Files likely touched:** `src/core/skill-search.ts`, `src/core/skill-export.ts`, `src/cli/search.ts`, `src/cli/export.ts`, `tests/core/search.test.ts`, `tests/core/export.test.ts`

**Estimated scope:** Medium

## Task 7: Add AI metadata enrichment

**Description:** Call a configurable OpenAI-compatible endpoint with the raw Skill content and a strict JSON output contract, storing drafts separately from reviewed metadata and retaining current values on failure.

**Acceptance criteria:**
- [ ] Base URL, API key, and model are configurable.
- [ ] The prompt requests only the supported metadata fields and categories.
- [ ] Valid responses are schema-validated before persistence.
- [ ] Invalid responses, timeouts, and API errors leave existing catalog data intact and create a retryable error state.
- [ ] Reviewed records require an explicit regenerate/review action before replacing reviewed values.

**Verification:**
- [ ] Mock-server tests cover valid response, malformed JSON, schema failure, HTTP failure, and timeout.
- [ ] A test verifies secrets never appear in serialized catalog output.
- [ ] CLI tests cover single Skill and all-Skill enrichment.

**Dependencies:** Tasks 2 and 5

**Files likely touched:** `src/core/skill-enricher.ts`, `src/core/ai-client.ts`, `src/cli/enrich.ts`, `tests/core/enricher.test.ts`, `.env.example`

**Estimated scope:** Medium

### Phase 4: Local Web Interface

## Task 8: Build catalog list and detail views

**Description:** Add the Vue local Web shell, load the catalog through a local file/API adapter, and implement list, search, filter, detail, raw Markdown, source, version, and status views.

**Acceptance criteria:**
- [ ] The list renders loading, empty, error, and populated states.
- [ ] Search and filters update results without losing current selection.
- [ ] Detail view shows Chinese metadata and original Markdown separately.
- [ ] Source, version/hash, last sync, and review status are visible.

**Verification:**
- [ ] Component tests cover list, filters, detail, and error states.
- [ ] Local development build succeeds.
- [ ] Manual smoke test loads the catalog generated at the core checkpoint.

**Dependencies:** Tasks 1, 5, and 6

**Files likely touched:** `src/web/*`, `src/web/components/*`, `src/web/services/catalog.ts`, `tests/web/*`

**Estimated scope:** Large; split list and detail implementation if either exceeds five files.

## Task 9: Build metadata editor and preference actions

**Description:** Add edit, save, favorite, enable/disable, regenerate draft, and mark-reviewed interactions with unsaved, saving, validation, and failure states.

**Acceptance criteria:**
- [ ] User can edit all supported Chinese metadata fields.
- [ ] Save persists only valid catalog data.
- [ ] Favorite and enabled states persist across reloads.
- [ ] Regeneration never silently discards reviewed edits.
- [ ] Export action uses the current enabled state.

**Verification:**
- [ ] Component tests cover editing, validation, save failure, preference changes, and review flow.
- [ ] End-to-end local smoke test edits a Skill, reloads, and verifies `enabled-skills.json`.

**Dependencies:** Tasks 6-8

**Files likely touched:** `src/web/components/SkillEditor.vue`, `src/web/components/SkillDetail.vue`, `src/web/services/catalog.ts`, `tests/web/editor.test.ts`

**Estimated scope:** Large; separate persistence adapter from components.

### Checkpoint: Complete v1

- [ ] Full scan -> sync -> enrich -> review -> enable -> export workflow works.
- [ ] CLI tests, Web component tests, TypeScript checks, and production build pass.
- [ ] No secrets are present in tracked data files.
- [ ] README documents setup, configuration, commands, data ownership, and integration expectations for `ai-reader`.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Local Skill layout differs across Agent tools | High | Make source directories configurable and keep local-only records valid. |
| Lock-file shape changes | Medium | Validate defensively, report diagnostics, and isolate lock parsing. |
| AI returns prose instead of JSON | High | Use strict output instructions, validate responses, and never persist invalid drafts. |
| Sync overwrites human translations | High | Track reviewed state and protect reviewed metadata in merge logic. |
| Web writes conflict with CLI writes | Medium | Use atomic writes, reload before save, and report stale catalog changes. |
| Catalog grows large because Skills contain full Markdown | Medium | Keep full content in separate files and store only path/hash in JSON. |

## Open Questions

None for the first implementation. Provider-specific prompt tuning and later `ai-reader` integration are intentionally deferred.
