# USPSA Classification Analyzer

A web app for USPSA competitors. Enter your member number to instantly see your full classifier history, track your classification percentage over time, and find out exactly what scores you need to reach the next class.

**Live at**: [classification-analyzer.vercel.app](https://classification-analyzer.vercel.app)  
**GitHub**: [github.com/raysma/classification-analyzer](https://github.com/raysma/classification-analyzer)

## Features

- **Automatic lookup** — enter any USPSA member number to fetch your full classifier history
- **Division tabs** — switch between divisions; each tab shows the classifier count
- **Classifier history table** — sortable, with flag descriptions on hover and color-coded Y/F rows
- **Classification summary** — current class letter, percentage, all-time best, and gap to the next class
- **Progress chart** — classification percentage plotted over time with class threshold lines; dark mode aware
- **Class-up insights** — minimum average score required across the next 1–5 classifiers to reach the next class
- **What-if simulator** — add hypothetical scores or exclude existing ones to project your classification percentage
- **Manual paste** — paste your classifier table directly from USPSA.org when automatic lookup is unavailable

## Quick start

```
pnpm install
pnpm dev          # Vite dev server (frontend only)
pnpm dev:api      # Vercel dev for the proxy function (separate terminal)
```

## Commands

| Command | Description |
|---|---|
| `pnpm dev` | Vite dev server |
| `pnpm dev:api` | Vercel dev (proxy function) |
| `pnpm build` | Production build |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright smoke test |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |
| `pnpm typecheck` | TypeScript check |

## Architecture

See [CLAUDE.md](CLAUDE.md) for full architecture, tech stack, and coding conventions.
