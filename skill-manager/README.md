# Skill Manager

Standalone CLI and local Web application for cataloging Agent Skills.

## Development

From the repository root:

```bash
pnpm --dir skill-manager build
pnpm --dir skill-manager build:web
pnpm --dir skill-manager test
```

Run the CLI from `skill-manager/` so `config/sources.json` resolves the current repository's Skill directory and lock file:

```bash
cd skill-manager
pnpm exec tsx src/cli/index.ts --help
pnpm exec tsx src/cli/index.ts scan
pnpm exec tsx src/cli/index.ts sync
pnpm exec tsx src/cli/index.ts search research
pnpm exec tsx src/cli/index.ts export
```

Build and serve the local Web management interface from the repository root:

```bash
pnpm --dir skill-manager build:web
pnpm run serve:web
```

If port `4173` is occupied, choose another port:

```bash
PORT=4174 pnpm run serve:web
```

The Web interface supports searching, category and state filters, favorites, enable/disable, Chinese metadata editing, raw Markdown inspection, and `enabled-skills.json` export.

## Data

- `data/skills.json` is the maintained catalog.
- `data/content/<skill-id>.md` stores the original Skill content.
- `data/enabled-skills.json` contains only enabled Skills.
- `config/sources.json` controls local Skill directories, lock-file path, and data output directory.

## AI configuration

Copy `.env.example` to `.env` only when using AI enrichment. API credentials are read from the environment and are never written to catalog files.

```bash
export SKILL_MANAGER_AI_BASE_URL=https://api.example.com/v1
export SKILL_MANAGER_AI_API_KEY=your-key
export SKILL_MANAGER_AI_MODEL=your-model
pnpm exec tsx src/cli/index.ts enrich
```
