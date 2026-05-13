# classification-analyzer

A web app that looks up a USPSA shooter's full classifier history by member number,
visualizes score progression over time, and shows what's needed in upcoming classifiers
to reach the next class.

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
See [PLAN.md](PLAN.md) for the phased implementation plan.
