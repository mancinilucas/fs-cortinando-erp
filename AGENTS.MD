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
1. Read the relevant development spec.
2. Read the corresponding sections of PROJECT_SPEC and ARCHITECTURE.
3. Identify affected modules.
4. Implement only the requested scope.
5. Run tests/lint relevant to the change.
6. Report any unresolved ambiguity instead of inventing behavior.

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