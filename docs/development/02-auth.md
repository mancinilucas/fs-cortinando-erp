# DEVELOPMENT SPEC 02 — Autenticação e Sessão

**Status:** AUTH-01 concluída em 2026-10-18; AUTH-02 pendente  
**Objetivo:** proteger toda a aplicação com autenticação de conta única, sessão server-side e cookie seguro, antes de implementar dados reais do negócio.

---

## 1. Contexto

O schema persistente já contém `User` e `Session` (ver `01-prisma-foundation.md`), e o `PrismaService` já conecta o NestJS ao PostgreSQL. A seed administrativa foi adiada de `01-prisma-foundation.md` (PRISMA-09) para esta spec porque depende do algoritmo de hash de senha.

Esta spec começa pelas decisões técnicas de autenticação e só depois implementa login, sessão, guard, logout e `/auth/me`.

---

## 2. Fontes de verdade

1. `docs/PROJECT_SPEC.md` §13 e §14.3 — comportamento de acesso e segurança.
2. `docs/ARCHITECTURE.md` §13 e §22 — sessão server-side, cookie, baseline de segurança e decisões adiadas.
3. Esta development spec — decisões e tasks da autenticação.
4. `docs/IMPLEMENTATION_PLAN.md` Fase 2 — sequência global.

Em caso de conflito, prevalece a ordem acima. Não inventar regra de negócio.

---

## 3. Regras já aprovadas

- Existe uma única conta administrativa; não há signup público, RBAC, gestão de usuários nem recuperação pública de senha.
- A autenticação usa sessão server-side, não access/refresh JWT.
- A senha é persistida somente como hash forte.
- O token de sessão é gerado por CSPRNG com alta entropia e apenas sua representação segura é persistida.
- O identificador de sessão trafega em cookie `HttpOnly`, `Secure`, `SameSite` e `Path=/`.
- Sessão expira, é substituída após login e é invalidada no logout.
- Requisições mutáveis têm proteção CSRF.
- Login tem rate limiting/backoff e mensagens que não facilitam enumeração de conta.
- Falhas de autenticação são registradas sem credenciais.

---

## 4. Fora do escopo desta spec

- signup público, RBAC, gestão de usuários e recuperação de senha;
- JWT access/refresh;
- MFA/TOTP (melhoria recomendada, não requisito do MVP);
- telas de login/logout no frontend (tratadas na etapa de frontend);
- regras de negócio de clientes e orçamentos.

---

## 5. Tasks atômicas

### AUTH-01 — Auditar fundação de autenticação

**Goal**  
Confirmar schema `User`/`Session`, dependências existentes e estrutura Nest atual.

**Scope**  
Leitura apenas.

**Done when**  
Relatório curto com estado atual, arquivos envolvidos e lacunas; nenhuma alteração de código.

**Deliverable**  
`docs/development/02-auth-audit.md`.

---

### AUTH-02 — Fechar decisões técnicas de autenticação

**Goal**  
Materializar as decisões já aprovadas antes de codificar.

**Scope**  
Fechar explicitamente:

- Argon2id vs bcrypt;
- tamanho/entropia do token de sessão;
- hash usado para armazenar token;
- duração da sessão;
- nome e flags do cookie;
- estratégia CSRF;
- comportamento de logout;
- tratamento de sessão expirada.

**Done when**  
Decisões registradas em `02-auth.md`.

**Deliverable**  
Seção 6 deste documento.

---

## 6. Decisões técnicas

Pendente — AUTH-02.

---

## 7. Próximas tasks

As tasks de implementação (seed administrativo, hash de senha, login, sessão, guard, logout, `/auth/me`, rate limiting e CSRF) serão adicionadas a esta spec depois de AUTH-02, seguindo a Fase 2 de `docs/IMPLEMENTATION_PLAN.md`.
