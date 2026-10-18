# DEVELOPMENT SPEC 02 — Autenticação e Sessão

**Status:** AUTH-01 e AUTH-02 concluídas em 2026-10-18; próximas tasks a definir  
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

A numeração continua a série iniciada em `01-prisma-audit.md` §3.1.

| # | Tema | Decisão |
|---|---|---|
| D26 | Hash de senha (fecha D20) | **Argon2id**, com `memoryCost` 19456 KiB (19 MiB), `timeCost` 2, `parallelism` 1, hash de 32 bytes e salt de 16 bytes. O hash é persistido como string PHC em `users.password_hash`. Biblioteca: `@node-rs/argon2` (binários pré-compilados, sem etapa de build nativa). |
| D27 | Token de sessão | 32 bytes de CSPRNG (`crypto.randomBytes(32)`), codificados em base64url (43 caracteres). O valor bruto só existe no cookie; nunca é persistido nem registrado em log. |
| D28 | Hash do token | SHA-256 do token bruto, em hexadecimal minúsculo, persistido em `sessions.token_hash` (`UNIQUE`). O hash rápido é adequado porque o token já tem 256 bits de entropia e permite lookup indexado; Argon2 é desnecessário aqui. |
| D29 | Duração da sessão | Expiração absoluta de **12 horas** a partir da criação (`expires_at` fixo). Não há renovação deslizante nem refresh token; após expirar, é necessário login novamente. |
| D30 | Cookie | Produção: `__Host-cortinando_session`; desenvolvimento (`NODE_ENV !== "production"`): `cortinando_session`. Flags: `HttpOnly`, `Path=/`, `SameSite=Strict`, `Secure` em produção e `Max-Age=43200` (12 h). Sem `Domain`. O prefixo `__Host-` exige `Secure` e `Path=/`, por isso não é usado sobre HTTP em desenvolvimento. |
| D31 | CSRF | Defesa em profundidade sem token sincronizador: `SameSite=Strict` no cookie + validação de `Origin` (com `Referer` como fallback) em métodos mutáveis (`POST`, `PUT`, `PATCH`, `DELETE`) contra uma allowlist configurada em `APP_ORIGIN`. Origem ausente ou divergente → `403`. CORS com credenciais não aceita origem curinga. Premissa: SPA e API pertencem ao mesmo site. |
| D32 | Logout | `POST /auth/logout` remove a linha de `sessions` pelo `token_hash` e limpa o cookie com os mesmos atributos e `Max-Age=0`. Responde `204` de forma idempotente: sessão ausente, inválida ou expirada também limpa o cookie e não revela estado. |
| D33 | Sessão expirada | Cookie ausente/malformado, token desconhecido ou `expires_at <= now` → `401` genérico. A linha expirada é removida de forma preguiçosa durante a validação. Não há renovação automática; cada login cria uma nova sessão e um novo token. |
| D34 | Normalização de e-mail | Aplicar `trim()`, normalização Unicode NFC e `toLowerCase()` antes de persistir e antes de qualquer lookup por e-mail. Seed e login devem usar exatamente a mesma função. |
| D35 | Rate limiting do login | Aplicar rate limiting específico em `POST /auth/login`, considerando IP + e-mail normalizado. A resposta de falha deve permanecer genérica e não permitir enumeração da conta. |

### 6.1 Configuração exigida

- `APP_ORIGIN` — origem permitida para validação CSRF (ex.: `http://localhost:5173` em desenvolvimento).
- `NODE_ENV` — distingue os atributos do cookie entre desenvolvimento e produção.

`backend/.env` é gitignored e não deve ser editado nem commitado; os valores acima são configurados pelo responsável pelo ambiente.

---

## 7. Próximas tasks

As tasks de implementação (seed administrativo, hash de senha, login, sessão, guard, logout, `/auth/me`, rate limiting e CSRF) serão adicionadas a esta spec depois de AUTH-02, seguindo a Fase 2 de `docs/IMPLEMENTATION_PLAN.md`.
