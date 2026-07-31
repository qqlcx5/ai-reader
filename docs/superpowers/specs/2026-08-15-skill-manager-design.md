# Skill Manager Design

**Date:** 2026-07-30
**Status:** Approved for implementation planning

## Goal

Build an independent Skill management project that can scan local Agent Skills, enrich them with Chinese metadata, provide CLI and local Web management workflows, and maintain JSON exports that can later be integrated into `ai-reader`.

## Scope

### In scope

- Scan local `SKILL.md` files.
- Read `skills-lock.json` to supplement source, repository, path, version, and hash information.
- Keep each original Skill document as a separate Markdown cache file.
- Maintain structured Skill metadata in `data/skills.json`.
- Generate Chinese metadata drafts through a configurable OpenAI-compatible API.
- Edit and review metadata in a local Vue Web interface.
- Search and filter Skills by text, category, enabled state, and favorite state.
- Enable or disable Skills and export `data/enabled-skills.json`.
- Track synchronization and metadata review status.

### Out of scope for the first version

- Multi-user accounts, remote collaboration, and server-side database storage.
- Automatically modifying or deleting Agent Skill files.
- Automatically copying enabled Skills into another Agent directory.
- A conversational chatbot dedicated to explaining Skills. Searchable Chinese metadata is the first natural-language discovery mechanism.
- Support for arbitrary remote repositories beyond the configured lock-file and local-directory inputs.

## Recommended Architecture

Use a TypeScript CLI and a Vue local Web application sharing a small, framework-independent core package.

- **Core:** types, parsing, synchronization, hashing, metadata merge rules, repository access, and validation.
- **CLI:** scan, sync, enrich, export, and search commands.
- **Web:** local list, filters, detail view, metadata editor, review actions, and export action.
- **Storage:** JSON files and Markdown files on disk. No database in v1.
- **AI:** OpenAI-compatible HTTP API configured through environment variables or local configuration. API keys must never be written to managed JSON.

Suggested layout:

```text
skill-manager/
  src/
    cli/
      scan.ts
      sync.ts
      enrich.ts
      export.ts
    core/
      skill-parser.ts
      skill-sync.ts
      skill-enricher.ts
      skill-repository.ts
      types.ts
    web/
      ...
  data/
    skills.json
    enabled-skills.json
    content/
      <skill-id>.md
  config/
    sources.json
  .env.example
  package.json
  README.md
```

## Inputs

The first version accepts:

1. One or more configured local Skill directories, such as `.agents/skills`.
2. A `skills-lock.json` file.

The local file is the source of raw content. The lock file supplements source and version data where a matching Skill ID exists. A configurable source definition should make the scanner reusable for another project during later integration.

## Data Model

`data/skills.json` is the structured, human-maintained catalog:

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-01-01T00:00:00.000Z",
  "skills": [
    {
      "id": "research",
      "slug": "research",
      "source": {
        "type": "github",
        "repository": "owner/repository",
        "path": "skills/research/SKILL.md",
        "localPath": ".agents/skills/research/SKILL.md",
        "version": "main",
        "hash": "..."
      },
      "rawContent": {
        "path": "content/research.md",
        "hash": "...",
        "lastSyncedAt": "2026-01-01T00:00:00.000Z"
      },
      "metadata": {
        "name": "研究助手",
        "summary": "基于可靠来源进行系统化调研，并将结果整理为 Markdown。",
        "categories": ["研究"],
        "useCases": ["资料调研", "技术事实核查"],
        "usage": "当问题需要查阅外部资料或官方文档时使用。",
        "triggers": ["研究", "调研", "research"]
      },
      "metadataStatus": {
        "generatedBy": "ai",
        "reviewed": true,
        "lastGeneratedAt": "2026-01-01T00:00:00.000Z",
        "lastReviewedAt": "2026-01-01T00:00:00.000Z"
      },
      "preferences": {
        "enabled": true,
        "favorite": false
      },
      "sync": {
        "status": "up-to-date",
        "lastCheckedAt": "2026-01-01T00:00:00.000Z"
      }
    }
  ]
}
```

The exact timestamps in implementation are generated at runtime. `enabled-skills.json` contains only enabled records or an intentionally reduced export contract, but must be deterministic and valid JSON.

### Ownership rules

- CLI owns source, raw content, hashes, and synchronization timestamps.
- AI owns only generated metadata drafts.
- Human edits own the reviewed metadata values.
- Preferences are managed by the Web interface and persisted in `skills.json`.
- A normal sync must not overwrite reviewed metadata.
- If raw content changes, set `sync.status` to `needs-review`; preserve reviewed metadata until the user chooses to regenerate or edit it.

## CLI Contract

```bash
skill-manager scan
skill-manager sync
skill-manager enrich --all
skill-manager enrich <skill-id>
skill-manager export
skill-manager search <query>
```

- `scan` discovers local Skills and reports parse or matching problems.
- `sync` copies raw Markdown, merges lock-file source information, computes hashes, and updates synchronization state.
- `enrich` sends the raw Skill content and a fixed output schema to the configured OpenAI-compatible provider. Failed requests preserve existing data and produce a retryable error state.
- `export` writes `data/enabled-skills.json` from records with `preferences.enabled === true`.
- `search` searches names, summaries, categories, use cases, usage, and triggers.

Commands should be safe to rerun and should not duplicate records. Unknown local Skills should remain discoverable with missing source fields rather than being dropped.

## Web Workflows

- List view with text search, category filters, enabled filter, and favorite filter.
- Detail view showing Chinese metadata, original Markdown, source, version, hash, last sync time, and status.
- Editor for Chinese name, summary, categories, use cases, usage, and triggers.
- Actions for favorite, enable/disable, regenerate draft, and mark metadata reviewed.
- Export action that writes `enabled-skills.json`.
- Clear states for loading, empty results, sync errors, AI errors, and unsaved edits.

The interface should explain a Skill through concise metadata rather than requiring a separate chat workflow in v1.

## Configuration

Use a source configuration for local directories and lock-file location. Use environment variables for the OpenAI-compatible provider, for example:

```text
SKILL_MANAGER_AI_BASE_URL=
SKILL_MANAGER_AI_API_KEY=
SKILL_MANAGER_AI_MODEL=
```

Provide `.env.example` documentation. Do not serialize secrets into `skills.json`, `enabled-skills.json`, or Markdown caches.

## Validation and Tests

- Parse valid and malformed `SKILL.md` files.
- Merge local discovery with lock-file records without duplication.
- Preserve stable IDs and preferences across repeated syncs.
- Copy raw content and detect hash changes.
- Preserve reviewed metadata after raw-content changes.
- Generate valid metadata from a mocked OpenAI-compatible response.
- Handle API failure without losing existing metadata.
- Export only enabled Skills.
- Search and filter by each supported field.
- Validate JSON schema and reject invalid catalog writes.
- Cover Web list, editor, enable/favorite actions, and error states with focused component tests.

## Success Criteria

The project is ready for first integration when a fresh checkout can:

1. Scan the current repository's `.agents/skills` and `skills-lock.json`.
2. Produce one stable `data/skills.json` record per discovered Skill.
3. Preserve raw Skill documents in `data/content/`.
4. Generate Chinese metadata drafts through a configured OpenAI-compatible endpoint.
5. Allow a user to review and edit metadata locally.
6. Search and filter the catalog in the Web interface.
7. Export a valid `data/enabled-skills.json` containing only enabled Skills.
8. Run its automated tests and TypeScript checks successfully.
