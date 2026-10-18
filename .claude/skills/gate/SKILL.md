---
name: gate
description: Executa o Gate 1 do projeto (build, lint, testes e validação Prisma) e resume os resultados. Use após qualquer alteração de código.
---

# gate

Executa os checks mecânicos aplicáveis e reporta um resumo. Não altera arquivos.

## 1. Detectar mudanças

```bash
git status --short
git diff --stat
```

Use o resultado para decidir quais checks rodar. Não execute checks de partes não afetadas.

## 2. Backend (se houver mudanças em `backend/`)

```bash
cd backend
pnpm build
pnpm lint
pnpm test
```

Se arquivos Prisma mudaram:

```bash
npx prisma validate
npx prisma generate   # quando a task exigir
```

Não rode `test:e2e` sem necessidade explícita.

## 3. Frontend (se houver mudanças em `frontend/`)

```bash
cd frontend
npm run lint
npm run build
```

## 4. Reportar

Apresente uma tabela:

| Check | Comando | Resultado |
|---|---|---|

Se algum check falhar:

- mostre o trecho relevante do erro;
- não declare o gate como aprovado;
- proponha a correção mínima.

Encerre com `GATE 1: APROVADO` ou `GATE 1: REPROVADO`.
