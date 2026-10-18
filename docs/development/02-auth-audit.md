# 02 — Auditoria da fundação de autenticação

**Status:** AUTH-01 concluída em 2026-10-18  
**Task de origem:** `docs/development/02-auth.md` → AUTH-01  
**Fontes de verdade:** `docs/PROJECT_SPEC.md` §13 e §14.3, `docs/ARCHITECTURE.md` §13 e §22, `docs/IMPLEMENTATION_PLAN.md` Fase 2

Escopo deste documento: registrar o estado atual da persistência, dependências e estrutura NestJS relacionadas à autenticação, além das lacunas a fechar antes de implementar.

**Nenhum arquivo de código, schema ou migration foi alterado.** Apenas este relatório e a development spec foram criados.

---

## 1. Verificação executada

| Comando | Resultado |
|---|---|
| `pnpm exec prisma validate` | ✅ schema válido |
| `pnpm lint` | ✅ sem erros |
| `pnpm test` | ✅ 1 arquivo / 1 teste |
| `pnpm build` | ✅ exit 0 |
| `git status --short` | árvore limpa antes da criação dos documentos |
| consulta `users` / `sessions` no banco de desenvolvimento | `users = 0`, `sessions = 0` |

---

## 2. Estado atual

### 2.1 Persistência

O schema Prisma já contém os dois models necessários, criados na migration `20261018024309_init`:

| Tabela | Colunas | Constraints |
|---|---|---|
| `users` | `id` UUID PK, `email` TEXT, `password_hash` TEXT NOT NULL, `created_at`, `updated_at` | `UNIQUE(email)` |
| `sessions` | `id` UUID PK, `token_hash` TEXT, `user_id` UUID, `expires_at` TIMESTAMPTZ(3), `created_at` | `UNIQUE(token_hash)`, `INDEX(user_id)`, FK `user_id → users(id)` com `ON DELETE CASCADE` |

O schema suporta o modelo aprovado em `ARCHITECTURE.md` §13.1: apenas o hash do token é persistido, a sessão tem expiração e o vínculo com o usuário é explícito. Não há `last_seen_at` nem metadados de rotação — o modelo atual comporta somente expiração absoluta.

O banco de desenvolvimento está vazio: não existe usuário administrativo, confirmando que a seed adiada em PRISMA-09 ainda precisa ser implementada nesta spec.

### 2.2 Estrutura NestJS

```text
backend/src/
├── main.ts                     bootstrap; carrega dotenv; sem prefixo global, pipes, CORS ou guards
├── app.module.ts               importa PrismaModule
├── app.controller.ts           única rota GET /
├── app.service.ts
├── shared/database/
│   ├── prisma.module.ts        providers/exports: PrismaService
│   └── prisma.service.ts       driver adapter + validação de conexão no startup
└── generated/prisma/           client gerado, não versionado
```

Não existe módulo `auth/`, controller de login, guard, decorator de usuário autenticado, cookie parser, pipe global de validação nem filtro de exceções específico.

### 2.3 Dependências instaladas

- `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` 12;
- `@prisma/client`, `@prisma/adapter-pg`, `pg`, `dotenv`;
- `rxjs`, `reflect-metadata`;
- dev: `vitest`, `supertest`, `@nestjs/testing`, TypeScript 6, oxlint.

**Não instaladas:** Argon2/bcrypt, `cookie-parser`, `class-validator`/`class-transformer`, `@nestjs/throttler`, `@nestjs/config`, Helmet.

### 2.4 Configuração e ambiente

`backend/.env` (gitignored) contém `DATABASE_URL`, `NODE_ENV` e `APP_ORIGIN`. O exemplo versionado `backend/.env.example` documenta as variáveis esperadas. Não há validação de variáveis de ambiente no startup. O `main.ts` lê `PORT` diretamente.

### 2.5 Testes

- Vitest para unidade (`src/app.controller.spec.ts`) e E2E (`test/app.e2e-spec.ts`).
- O E2E sobe `AppModule` e portanto exige banco acessível, mas não há banco de teste isolado, fixtures nem limpeza de dados.
- Não existe teste de sessão, guard, cookie ou login.

### 2.6 Documentação relevante

- `PROJECT_SPEC.md` §13: conta única, login/logout, sem signup/RBAC/gestão de usuários.
- `ARCHITECTURE.md` §13: sessão server-side, cookie seguro, baseline de segurança.
- `ARCHITECTURE.md` §22: implementação concreta de CSRF explicitamente adiada.
- `IMPLEMENTATION_PLAN.md` Fase 2: login, sessão, cookie, guard, logout, `/auth/me`, rate limiting e CSRF.
- `01-prisma-foundation.md` PRISMA-09: seed administrativa adiada para esta spec por depender da decisão D20.

---

## 3. Arquivos envolvidos nas próximas tasks

| Área | Caminho esperado |
|---|---|
| Módulo auth | `backend/src/modules/auth/` (`application/`, `infrastructure/`, `presentation/`, `auth.module.ts`) |
| Bootstrap e módulo raiz | `backend/src/main.ts`, `backend/src/app.module.ts` |
| Persistência | `backend/src/shared/database/`, `backend/prisma/schema.prisma` (somente se alguma decisão exigir) |
| Seed administrativo | script de seed do Prisma e configuração em `backend/prisma7.config.ts` |
| Dependências | `backend/package.json`, `backend/pnpm-workspace.yaml` |
| Configuração | `backend/.env` (não versionado; configuração pelo responsável) |
| Testes | `backend/src/modules/auth/**/*.spec.ts`, `backend/test/` |

---

## 4. Lacunas

1. **Decisões técnicas:** hash de senha (D20), entropia e hash do token, duração da sessão, cookie, CSRF, logout e sessão expirada estavam em aberto na auditoria e foram fechadas por D26–D33 em `02-auth.md`.
2. **Seed administrativa ausente:** nenhum usuário existe no banco; sem ela não há como autenticar.
3. **Nenhuma camada de autenticação:** faltam hash de senha, login, criação/validação de sessão, guard, logout e `/auth/me`.
4. **Sem parsing de cookie:** `cookie-parser` (ou leitura manual) ainda não está configurado.
5. **Sem validação de DTO:** não há `ValidationPipe` global nem `class-validator`; o login precisa validar entrada.
6. **Sem rate limiting:** exigido por `ARCHITECTURE.md` §13.3; decisão registrada em D35, implementação pendente.
7. **Sem proteção CSRF:** ainda não implementada; conforme D31, será feita por `SameSite=Strict` + validação de `Origin`, sem biblioteca específica de CSRF.
8. **Sem configuração centralizada:** `APP_ORIGIN` já existe em `.env`, mas não há leitura/validação dessa variável nem dos parâmetros de cookie no código.
9. **Normalização de e-mail:** decisão registrada em D34 (trim + NFC + lowercase, mesma função na seed e no login); implementação pendente. Não exige mudança de schema.
10. **Limpeza de sessões expiradas:** o schema não tem índice em `expires_at`; a estratégia de remoção precisa considerar isso (remoção preguiçosa não exige índice).
11. **Testes de autenticação ausentes:** não há banco de teste isolado nem fixtures para sessão.
12. **HTTPS:** não há terminação TLS no repositório; é responsabilidade do deployment (`ARCHITECTURE.md` §13.3).

---

## 5. Conclusão

O schema e o `PrismaService` existentes são suficientes para iniciar a implementação; não é esperada mudança de schema. As lacunas são de decisão técnica (AUTH-02), dependências, configuração e código de aplicação. Nenhuma regra funcional nova foi introduzida nesta auditoria.
