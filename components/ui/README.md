# UI Components

This folder contains the app's reusable UI primitives and layout shells.

## Core primitives
- `UButton` — button with variant/size support
- `UInput` — single-line input
- `UTextarea` — multi-line input
- `Select` — dropdown selector
- `Switch` — toggle control
- `Slider` — range slider

## Layout / shells
- `UCard` — generic card container
- `USection` — section wrapper with header/footer slots
- `UPageHeader` — page header with title and actions
- `UToolbar` — horizontal action/filter bar
- `UActionBar` — compact action row
- `UDataPanel` — data-driven panel with item rendering

## States / helpers
- `UEmptyState` — empty-state container
- `UFormField` — label, hint, and error wrapper
- `UBadge` — status/tag badge
- `UStatCard` — metric tile

## Usage notes
- Prefer data-driven props first.
- Use slots only to override the default rendering you need to customize.
- Keep business logic in the feature component; UI primitives should stay generic.
