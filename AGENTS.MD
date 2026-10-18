# Agent Instructions

## Sources of truth

Functional requirements:
- `docs/PROJECT_SPEC.md`

Architecture:
- `docs/ARCHITECTURE.md`

Implementation roadmap:
- `docs/IMPLEMENTATION_PLAN.md`

Current development specifications:
- `docs/development/`

In case of conflict:
1. PROJECT_SPEC defines product behavior.
2. ARCHITECTURE defines technical boundaries and architectural decisions.
3. The current development spec defines implementation details for the active feature.
4. IMPLEMENTATION_PLAN defines sequence and progress.

Do not silently override a higher-priority source.

## General rules

- Never invent business rules.
- If a requirement is ambiguous or conflicts with another source, report it before changing behavior.
- Prefer the simplest implementation that satisfies the requirement.
- Do not introduce abstractions for hypothetical future needs.
- Do not introduce dependencies without justification.
- Do not modify unrelated files.
- Run relevant tests before considering a task complete.
- Preserve existing architectural boundaries.
- Write all source code, comments, tests, Prisma schema identifiers and commit messages in English; product and development documentation remains in Portuguese (`docs/ARCHITECTURE.md` §1.2).

## Backend

- NestJS + TypeScript.
- PostgreSQL + Prisma.
- Domain rules must not depend on NestJS, Prisma or HTTP.
- Controllers must remain thin.
- Prisma is restricted to infrastructure/persistence.
- Do not create repositories for entities that are not Aggregate Roots.
- Do not introduce generic repositories unless explicitly justified.
- Business state transitions must go through domain behavior/use cases.

## Frontend

- React + Vite + TypeScript.
- Organize code by feature.
- Do not introduce global state management unless there is a concrete need.
- Keep API access isolated from UI components.
- Follow backend contracts rather than duplicating business rules in the frontend.

## Task execution

Before implementing a feature:
1. Read the relevant sections of PROJECT_SPEC and ARCHITECTURE.
2. Read the relevant development spec.
3. Read the relevant sections of IMPLEMENTATION_PLAN for sequence and dependencies.
4. Identify affected modules.
5. Implement only the requested scope.
6. Run tests/lint relevant to the change.
7. Report any unresolved ambiguity instead of inventing behavior.

## Task completion

A task is complete only when:

1. The requested scope has been implemented.
2. Relevant tests pass.
3. Lint/typecheck/build checks applicable to the change pass.
4. The implementation is reviewed against:
   - PROJECT_SPEC.md
   - ARCHITECTURE.md
   - the active development spec
   - the task acceptance criteria
5. No unrelated files were changed.
6. Any review findings have been fixed and the relevant checks rerun.

Do not report a task as complete only because the code compiles.

## Git workflow

- Prefer one atomic commit per completed task.
- Commit only after acceptance criteria and verification checks pass.
- A commit must contain only files related to the current task.
- Do not include unrelated formatting or refactors.
- Use the task ID in the commit message when available.
- Write commit messages in English (see General rules).
- Do not commit if the task is incomplete or verification is failing.