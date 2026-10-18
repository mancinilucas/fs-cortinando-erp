# Cortinando ERP — Agent Context

@AGENTS.MD

## Repository layout

- `backend/` — NestJS + TypeScript + Prisma 7 + PostgreSQL
- `frontend/` — React + Vite
- `docs/` — sources of truth and development specs

The project uses a single Git repository at the root. `backend/` and `frontend/` are tracked from there; do not initialize nested repositories.

## Documentation precedence

As defined in `AGENTS.MD`:

1. `docs/PROJECT_SPEC.md` — product behavior
2. `docs/ARCHITECTURE.md` — technical boundaries
3. Active spec in `docs/development/` — implementation details
4. `docs/IMPLEMENTATION_PLAN.md` — sequence and progress

Do not silently override a higher-priority source.

## Project-specific facts

- Prisma 7 loads `backend/prisma7.config.ts` (not `prisma.config.ts`); the generator is `prisma-client` and the runtime requires the `@prisma/adapter-pg` driver adapter.
- Backend commands run from `backend/`: `pnpm build`, `pnpm lint`, `pnpm test`, `npx prisma validate`.
- `backend/.env` is gitignored and must never be edited or committed.
- The domain layer must not import NestJS, Prisma, or HTTP concerns.
