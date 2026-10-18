---
name: spec-task
description: Executa uma task atômica de docs/development com escopo controlado e Gates 1 e 2. Use ao iniciar ou retomar tasks como PRISMA-05, AUTH-03 etc.
argument-hint: <TASK-ID>
---

# spec-task

Executa uma task de `docs/development/` seguindo o workflow definido pelo projeto.

## 1. Identificar a task

- Se `$ARGUMENTS` trouxer um ID (ex.: `PRISMA-05`), localize-o em `docs/development/*.md`.
- Sem argumento, identifique a development spec ativa (a de menor número ainda não concluída) e liste as tasks elegíveis; confirme com o usuário antes de implementar.
- Leia a task inteira: Goal, Scope, Acceptance criteria, Verification, Review, Deliverable e Stop conditions.

## 2. Ler as fontes de verdade

Nesta ordem:

1. `AGENTS.MD` — regras gerais de execução.
2. `docs/PROJECT_SPEC.md` — seções que a task toca.
3. `docs/ARCHITECTURE.md` — fronteiras e decisões envolvidas.
4. Development spec ativa — detalhes de implementação.
5. `docs/IMPLEMENTATION_PLAN.md` — dependências e sequência.

Consulte apenas as seções relevantes; não leia o projeto inteiro. Em caso de conflito, preserve a precedência acima e reporte o conflito em vez de resolvê-lo silenciosamente.

## 3. Confirmar o escopo antes de editar

Enumere antes da primeira edição:

- arquivos que pretende alterar;
- arquivos explicitamente proibidos pela task;
- dependências de tasks anteriores ainda não concluídas;
- ambiguidades encontradas.

Se alguma ambiguidade mudar comportamento, pare e reporte. Nunca invente regra de negócio.

Regras fixas:

- `backend/prisma/schema.prisma` e `backend/prisma/migrations/` só mudam em task Prisma autorizada;
- não crie repositório Git aninhado;
- não introduza dependência, abstração ou tabela especulativa;
- não altere arquivos não relacionados;
- mantenha o estilo e as fronteiras existentes.

## 4. Implementar

Implemente somente o escopo aprovado, respeitando:

- domínio sem imports de NestJS, Prisma ou HTTP;
- Prisma restrito a infrastructure/persistence;
- controllers finos;
- transições de estado via comportamento de domínio/use case.

## 5. Gate 1 — verificação mecânica

Rode apenas os checks aplicáveis, a partir de `backend/`:

```bash
pnpm build
pnpm lint
pnpm test
```

Se a task tocar Prisma:

```bash
npx prisma format
npx prisma validate
npx prisma generate   # quando a task exigir
```

Se houver migration, siga também a skill `prisma-migration`.

No frontend (o projeto usa npm):

```bash
npm run lint
npm run build
```

Registre a saída de cada comando. Não declare sucesso sem evidência. Para uma execução isolada dos checks, use a skill `gate`.

## 6. Gate 2 — revisão semântica

Revise `git diff` + `git status --short` contra:

- critérios de aceite da task;
- `docs/PROJECT_SPEC.md`;
- `docs/ARCHITECTURE.md`;
- development spec;
- escopo declarado.

Procure especificamente:

- regra de negócio inventada;
- alteração fora do escopo;
- modelagem Prisma contaminando o domínio;
- constraint incompatível com o produto;
- entidade/tabela criada sem necessidade;
- campo derivado persistido sem justificativa;
- inconsistência de precisão ou nulabilidade;
- tipo Prisma vazando para `domain/`.

Se houver achado: `REVIEW → REPAIR → RE-VERIFY` (rode o Gate 1 novamente).

## 7. Encerrar

Reporte:

- task executada e status;
- arquivos alterados;
- comandos rodados e resultados;
- achados do Gate 2 e correções aplicadas;
- ambiguidades remanescentes.

Atualize o registro de progresso na development spec somente se ela tiver um campo próprio para isso e a task autorizar. Uma task não está concluída apenas porque compila.
