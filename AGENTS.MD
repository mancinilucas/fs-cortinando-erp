# Agent Instructions

## Sources of truth

Product requirements:
docs/PROJECT_SPEC.md

Architecture:
docs/ARCHITECTURE.md

Implementation plan:
docs/DEVELOPMENT_SPEC.md

## General rules

- Never invent business rules.
- If PROJECT_SPEC is ambiguous, stop and report the ambiguity.
- Follow architecture defined in ARCHITECTURE.md.
- Do not introduce dependencies without justification.
- Prefer the simplest implementation satisfying the requirement.
- Do not create abstractions for hypothetical future requirements.
- Run tests before considering a task complete.
- Never modify unrelated files.

## Backend

- NestJS + TypeScript
- PostgreSQL + Prisma
- Domain rules must not depend on NestJS or Prisma.
- Controllers must not contain business rules.
- Prisma models must not define domain behavior.
  ...

## Frontend

- React + Vite + TypeScript
  ...
