# DailyTask

[English](./README.md) | [简体中文](./README.zh-CN.md)

A local-first desktop app for daily habit check-ins and todos, built to replace the
"one Excel sheet per habit set" workflow. It runs on Windows with a paper-like
floating widget and a dense, spreadsheet-style task grid.

<a id="overview"></a>
## Overview

DailyTask keeps a history of every task without forcing you to duplicate a
spreadsheet header. Each task owns one or more **active date intervals**; adding,
pausing, or resuming a habit only appends interval data and never rewrites the past.

The product has two windows:

- **Widget** — always-on-top paper card with today's progress and quick check-ins.
- **Main window** — sidebar navigation with Today, Task Grid, Todos, Manage, Stats,
  and Settings.

<a id="status"></a>
## Status

Early development. The data layer and the Today screen are working; the remaining
views are placeholders. There is no released installer yet.

| Area | State |
|---|---|
| SQLite schema, repositories, domain rules | Done |
| Today view, check-ins, progress ring, due todos | Done |
| Theme tokens and light/dark skeleton | Done |
| UI copy dictionary (zh-CN, English planned) | Done |
| Floating widget | Planned (M3) |
| Task grid with date columns | Planned (M4) |
| Todos and task management UI | Planned (M5) |
| Stats, settings, packaging, auto-update | Planned (M6) |

Current limitation: there is no task-creation UI yet, so the Today screen is empty
until tasks exist in the database. Task management arrives in M5.

<a id="features"></a>
## Features

Implemented today:

- **Interval-based tasks** — a task can be paused and resumed; history stays intact.
- **Today view** — voluntary/forced groups, progress ring, overdue and due-today
  todos, and one-click check-ins with optimistic updates.
- **Three check-in states** — done, missed, and "skip today" (excluded from the
  progress denominator).
- **Projected auto-settle** — past blanks render as missed without writing hundreds
  of rows to the database.
- **Local SQLite storage** — no account, no network, no sync.
- **Typed architecture boundaries** — domain, db, stores, and views are enforced by
  ESLint zones.
- **Design tokens** — colors, spacing, radii, and shadows live in CSS variables.

Planned:

- Paper-like always-on-top widget with cross-window sync.
- Virtualized task grid with multi-segment intervals, zoom, keyboard navigation,
  notes, and filters.
- Todo groups, task management, stats, import/export, backups, tray menu, installer,
  and signed auto-updates.

<a id="stack"></a>
## Tech Stack

| Layer | Choice |
|---|---|
| Shell | Tauri 2 |
| UI | React 19 + TypeScript + Vite 7 |
| Styling | Tailwind CSS 4 + CSS variables |
| State | Zustand 5 |
| Storage | SQLite via `tauri-plugin-sql` (sqlx migrations) |
| Dates | date-fns 4 |
| Tests | Vitest 3 + jsdom + Testing Library |
| Lint | ESLint 9 + typescript-eslint + import zones |

<a id="architecture"></a>
## Architecture

```text
src/
  app/           startup sequence and data hydration
  domain/        pure date, applicability, settlement, and stats rules
  db/            SQLite client and repositories (the only SQL layer)
  stores/        Zustand stores + selectors
  shared/        typed cross-window events, i18n dictionary
  ui/            tokens, CheckCell, ProgressRing, theme helpers
  windows/main/  MainLayout and view components
src-tauri/
  migrations/    001_init.sql (versioned, append-only)
  capabilities/  SQL / window permissions
  src/           Tauri entry points
design/          static design reference, not part of the build
docs/            requirements, architecture, progress log
```

Data flow: `view → store → db → SQLite`. Derived values (progress, cell state,
streak) are computed by `domain/` and `stores/selectors/`, never persisted.
`src/domain` is free of React, Tauri, and database imports.

<a id="data-model"></a>
## Data Model

Five tables: `tasks`, `task_intervals`, `checkins`, `todos`, and `settings`.

- A task can have multiple `task_intervals`; `end_date = NULL` means "still active".
- `checkins` has `UNIQUE(task_id, date)`, so one cell maps to one row and writes are
  idempotent.
- Cell projection order: not applicable → stored check-in → today/future pending →
  past blank with auto-settle → missed. Automatic settle is display-only.
- The progress denominator is `applicable tasks − skipped`, so "skip today" does not
  hurt the percentage.

<a id="getting-started"></a>
## Getting Started

Requirements:

- Node.js 22+
- Rust stable (MSVC toolchain on Windows)
- Windows 10/11 with WebView2
- Tauri 2 prerequisites for your platform

```bash
npm install
npm run tauri dev
```

The SQLite file is created on first launch at:

```text
%APPDATA%\com.dailytask.app\dailytask.db
```

<a id="scripts"></a>
## Scripts

```bash
npm run tauri dev      # run the desktop app
npm run dev            # frontend only (Tauri APIs unavailable)
npm run test           # run the Vitest suite
npm run test:watch     # watch mode
npm run lint           # ESLint, including import zones
npm run typecheck      # tsc --noEmit
npm run build          # typecheck + production frontend build
npm run tauri build    # packaged installer (M6, not verified yet)
```

Backend check without launching the app:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

<a id="workflow"></a>
## Development Workflow

This project is built in 40-minute daily slices. `docs/progress.md` is the
checklist: every completed day is ticked with the actual verification result.
A day is done only when lint and tests pass and the change is committed.

Commits follow Conventional Commits, for example:

```text
feat(today): render today view with progress and task groups
fix(db): grant execute permission for SQLite writes
docs(progress): close M2 days D15-D23
```

<a id="i18n"></a>
## Internationalization

UI copy lives in `src/shared/i18n/zh-CN.ts` and is accessed through `t()`. The
`Messages` type makes missing keys a compile error when a new language is added.
The app is currently Chinese-only; English UI strings are planned. This repository
keeps one README per language, with English as the default.

<a id="roadmap"></a>
## Roadmap

| Milestone | Scope | Target |
|---|---|---|
| M1 | Data layer and architecture guardrails | 2026-11-14 |
| M2 | Main window and Today view | 2026-11-26 |
| M3 | Floating widget and cross-window sync | 2026-12-07 |
| M4 | Task grid | 2026-12-25 |
| M5 | Todos and task management | 2027-01-05 |
| M6 | Stats, settings, auto-update, release | 2027-01-22 |

See `docs/progress.md` for the daily plan and `docs/impl.md` for acceptance criteria.

<a id="docs"></a>
## Documentation

- [Requirements](./docs/Requirements.md) — product and interaction design.
- [Implementation](./docs/impl.md) — architecture, data model, risks, milestones.
- [Progress](./docs/progress.md) — daily schedule and checklist.
- [Design preview](./design/preview.html) — open directly in a browser; no build step.
- [Design tokens](./design/tokens.css) — source of `src/ui/tokens.css`.

<a id="license"></a>
## License

[MIT](./LICENSE) © 2026 DailyTask contributors.
