# DEVELOPMENT SPEC 02 — Autenticação e Sessão

**Status:** AUTH-01 a AUTH-05 concluídas em 2026-10-18; próxima task: AUTH-06  
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

## 7. Tasks de implementação

### AUTH-03 — Configurar infraestrutura básica do módulo Auth

**Goal**  
Criar a estrutura mínima do módulo de autenticação sem implementar login, sessão ou regras de segurança ainda.

**Dependencies**
- AUTH-01
- AUTH-02

**Scope**
- `src/modules/auth/auth.module.ts`
- estrutura mínima de:
  - `application/`
  - `infrastructure/`
  - `presentation/`
- importação do `AuthModule` no `AppModule`
- dependências estritamente necessárias para as próximas tasks

**Acceptance criteria**
- `AuthModule` existe e é carregado pela aplicação;
- estrutura segue `ARCHITECTURE.md`;
- nenhuma implementação de JWT é adicionada;
- nenhuma regra de autenticação é colocada em controller;
- nenhuma abstração genérica é criada sem necessidade.

**Verification**
- `pnpm lint`
- `pnpm test`
- `pnpm build`

**Review**
- verificar ausência de mudanças fora do módulo Auth e bootstrap;
- verificar que Prisma continua restrito à infraestrutura;
- verificar que nenhuma feature de login foi antecipada.

**Commit sugerido**
`chore(AUTH-03): scaffold auth module`

---

### AUTH-04 — Implementar normalização de e-mail

**Goal**  
Garantir que seed, login e lookup de usuário utilizem a mesma representação normalizada de e-mail.

**Dependencies**
- AUTH-03
- D34

**Scope**
Implementar função ou serviço simples responsável por:

```text
trim
→ normalize("NFC")
→ toLowerCase
```

**Acceptance criteria**
- a mesma rotina pode ser reutilizada pela seed e pelo login;
- e-mails equivalentes por caixa ou espaços resultam no mesmo valor normalizado;
- nenhum acesso ao banco é feito nesta task.

**Tests**
Cobrir pelo menos:
- espaços antes/depois;
- letras maiúsculas;
- combinação de espaços + caixa;
- entrada já normalizada.

**Verification**
- testes unitários;
- `pnpm lint`
- `pnpm build`

**Review**
- não adicionar validação de domínio além da normalização;
- não duplicar a função em múltiplos módulos.

**Commit sugerido**
`feat(AUTH-04): add email normalization`

---

### AUTH-05 — Implementar PasswordHasher com Argon2id

**Goal**  
Centralizar hash e verificação de senha utilizando a decisão D26.

**Dependencies**
- AUTH-03
- D26

**Scope**
- instalar `@node-rs/argon2`;
- criar contrato de hashing de senha;
- criar implementação Argon2id;
- implementar:
  - `hash(password)`
  - `verify(hash, password)`

Configuração aprovada:
- memory: 19456 KiB;
- iterations: 2;
- parallelism: 1;
- hash: 32 bytes;
- salt: 16 bytes.

**Acceptance criteria**
- senha nunca é persistida ou logada em texto puro;
- hashes utilizam Argon2id;
- verificação correta para senha válida;
- verificação falha para senha incorreta;
- detalhes da biblioteca ficam isolados da camada de aplicação.

**Tests**
- gera hash diferente do plaintext;
- senha correta valida;
- senha incorreta falha;
- hashes possuem formato esperado pela biblioteca.

**Verification**
- testes unitários;
- `pnpm lint`
- `pnpm build`

**Review**
- aplicação não depende diretamente de `@node-rs/argon2`;
- nenhuma configuração secreta hardcoded;
- nenhuma implementação duplicada de hash.

**Commit sugerido**
`feat(AUTH-05): add Argon2id password hashing`

---

### AUTH-06 — Implementar seed da conta administrativa

**Goal**  
Permitir criação controlada da única conta administrativa do MVP.

**Dependencies**
- AUTH-04
- AUTH-05

**Scope**
- criar script de seed;
- utilizar normalização de e-mail;
- utilizar `PasswordHasher`;
- configurar execução do seed;
- utilizar credenciais vindas de ambiente.

**Configuração esperada**
Exemplo em `.env.example`:

```env
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

**Acceptance criteria**
- nenhuma credencial administrativa fica no repositório;
- senha passa pelo mesmo `PasswordHasher` usado pela aplicação;
- e-mail é normalizado antes da persistência;
- execução repetida não cria usuários duplicados;
- o seed não implementa gestão de usuários.

**Verification**
- executar seed em banco de desenvolvimento;
- confirmar exatamente um usuário;
- confirmar que `password_hash` não contém plaintext;
- `pnpm lint`
- `pnpm build`

**Review**
- nenhuma senha aparece em logs;
- nenhuma credencial default é criada automaticamente;
- operação é idempotente.

**Commit sugerido**
`feat(AUTH-06): add administrative user seed`

---

### AUTH-07 — Implementar SessionTokenService

**Goal**  
Isolar geração e transformação segura do token de sessão.

**Dependencies**
- AUTH-03
- D27
- D28

**Scope**
Implementar operações:

```text
generate()
hash(token)
```

Regras:
- token bruto: 32 bytes de CSPRNG;
- representação: base64url;
- persistência: SHA-256 hexadecimal.

**Acceptance criteria**
- token gerado possui 256 bits de entropia;
- tokens sucessivos são diferentes;
- hash é determinístico;
- token bruto nunca é persistido;
- serviço não acessa banco ou HTTP.

**Tests**
- formato base64url;
- comprimento esperado;
- unicidade entre gerações;
- SHA-256 determinístico;
- tokens diferentes geram hashes diferentes.

**Verification**
- testes unitários;
- `pnpm lint`
- `pnpm build`

**Commit sugerido**
`feat(AUTH-07): add session token service`

---

### AUTH-08 — Implementar persistência e validação de sessão

**Goal**  
Criar infraestrutura para armazenar, recuperar, validar e remover sessões server-side.

**Dependencies**
- AUTH-07
- Prisma Foundation concluída
- D29
- D33

**Scope**
Operações mínimas:
- criar sessão;
- encontrar por `tokenHash`;
- remover sessão;
- remover sessão expirada.

**Acceptance criteria**
- somente `tokenHash` é persistido;
- `expiresAt` é calculado para 12 horas;
- sessão expirada nunca é considerada válida;
- sessão expirada encontrada pode ser removida de forma preguiçosa;
- nenhuma renovação deslizante é implementada.

**Tests**
- cria sessão corretamente;
- encontra sessão válida;
- sessão inexistente retorna ausência;
- sessão expirada é rejeitada;
- remoção funciona.

**Verification**
- testes de integração com Prisma;
- `pnpm lint`
- `pnpm build`

**Review**
- nenhum token bruto persistido;
- nenhuma regra HTTP na infraestrutura;
- nenhuma renovação automática introduzida.

**Commit sugerido**
`feat(AUTH-08): add server-side session persistence`

---

### AUTH-09 — Implementar POST /auth/login

**Goal**  
Autenticar a conta administrativa e criar uma nova sessão.

**Dependencies**
- AUTH-04
- AUTH-05
- AUTH-08

**Scope**
Fluxo:

```text
receber email/senha
→ validar DTO
→ normalizar email
→ localizar usuário
→ verificar senha
→ gerar sessão
→ persistir tokenHash
→ emitir cookie
```

**Acceptance criteria**
- credenciais válidas retornam sucesso;
- cookie de sessão é emitido;
- token bruto existe apenas no cookie;
- credenciais inválidas retornam resposta genérica;
- não há enumeração explícita entre e-mail inexistente e senha incorreta;
- nenhuma senha é logada.

**Cookie**
Seguir D30.

**Verification**
- testes de aplicação;
- teste HTTP de login;
- `pnpm lint`
- `pnpm build`

**Review**
- controller fino;
- regra de autenticação fora do controller;
- nenhuma dependência JWT;
- nenhuma informação sensível na resposta.

**Commit sugerido**
`feat(AUTH-09): implement login endpoint`

---

### AUTH-10 — Implementar AuthGuard

**Goal**  
Proteger rotas privadas utilizando sessão server-side.

**Dependencies**
- AUTH-08
- AUTH-09

**Scope**
Fluxo:

```text
ler cookie
→ validar formato
→ hash(token)
→ buscar sessão
→ verificar expiração
→ resolver usuário
→ permitir ou rejeitar request
```

**Acceptance criteria**
- ausência de cookie → `401`;
- token inválido → `401`;
- sessão expirada → `401`;
- sessão válida disponibiliza identidade autenticada para a request;
- mensagens de erro permanecem genéricas.

**Tests**
- sem cookie;
- token inválido;
- sessão expirada;
- sessão válida.

**Verification**
- testes unitários/integrados;
- `pnpm lint`
- `pnpm build`

**Review**
- guard não contém regra de domínio de negócio;
- nenhuma query Prisma direta no controller.

**Commit sugerido**
`feat(AUTH-10): add session authentication guard`

---

### AUTH-11 — Implementar GET /auth/me

**Goal**  
Fornecer uma rota simples para validar a sessão autenticada.

**Dependencies**
- AUTH-10

**Scope**
Endpoint:

```http
GET /auth/me
```

Resposta mínima:

```json
{
  "id": "...",
  "email": "..."
}
```

**Acceptance criteria**
- sessão válida retorna usuário autenticado;
- sessão ausente/inválida retorna `401`;
- nenhum dado desnecessário é exposto;
- `passwordHash` nunca aparece.

**Verification**
- teste HTTP autenticado;
- teste HTTP sem sessão;
- `pnpm lint`
- `pnpm build`

**Commit sugerido**
`feat(AUTH-11): add current user endpoint`

---

### AUTH-12 — Implementar POST /auth/logout

**Goal**  
Invalidar a sessão atual e remover o cookie.

**Dependencies**
- AUTH-08
- AUTH-10
- D32

**Scope**
Endpoint:

```http
POST /auth/logout
```

**Acceptance criteria**
- remove sessão encontrada por `tokenHash`;
- limpa cookie;
- responde `204`;
- chamada repetida também responde `204`;
- token antigo não autentica após logout.

**Verification**
- teste de logout válido;
- logout sem sessão;
- tentativa de reutilização do cookie;
- `pnpm lint`
- `pnpm build`

**Commit sugerido**
`feat(AUTH-12): implement logout endpoint`

---

### AUTH-13 — Implementar proteção CSRF

**Goal**  
Bloquear requisições mutáveis originadas de origem não autorizada.

**Dependencies**
- AUTH-03
- D31
- configuração `APP_ORIGIN`

**Scope**
Aplicar em:

```text
POST
PUT
PATCH
DELETE
```

Algoritmo:
1. ler `Origin`;
2. se ausente, tentar `Referer`;
3. comparar origem normalizada com allowlist;
4. ausência ou divergência → `403`.

**Acceptance criteria**
- origem válida passa;
- origem divergente recebe `403`;
- ausência de ambos os headers em operação mutável recebe `403`;
- métodos de leitura não são bloqueados por essa regra;
- CORS não usa wildcard com credentials.

**Tests**
- `Origin` válido;
- `Origin` inválido;
- fallback por `Referer`;
- ausência de ambos;
- GET sem headers.

**Verification**
- testes;
- `pnpm lint`
- `pnpm build`

**Review**
- nenhuma biblioteca CSRF adicionada sem necessidade;
- regra usa configuração, não URL hardcoded.

**Commit sugerido**
`feat(AUTH-13): add origin-based CSRF protection`

---

### AUTH-14 — Implementar rate limiting do login

**Goal**  
Reduzir tentativas automatizadas de descoberta ou força bruta.

**Dependencies**
- AUTH-04
- AUTH-09
- D35

**Scope**
- instalar/configurar `@nestjs/throttler`;
- aplicar política específica ao login;
- utilizar IP e e-mail normalizado conforme decisão aprovada.

**Acceptance criteria**
- login possui limite mais restritivo que rotas comuns;
- excesso de tentativas recebe `429`;
- mensagens não revelam existência do usuário;
- não há bloqueio permanente da conta;
- não introduzir Redis no MVP.

**Verification**
- teste de múltiplas tentativas;
- confirmar `429`;
- confirmar recuperação após janela;
- `pnpm lint`
- `pnpm build`

**Review**
- solução proporcional ao MVP;
- nenhuma infraestrutura distribuída desnecessária.

**Commit sugerido**
`feat(AUTH-14): add login rate limiting`

---

### AUTH-15 — Padronizar erros e logs de autenticação

**Goal**  
Evitar vazamento de informação sensível e manter comportamento previsível.

**Dependencies**
- AUTH-09
- AUTH-10
- AUTH-12

**Scope**
Padronizar:
- credenciais inválidas;
- sessão inválida;
- sessão expirada;
- tentativas bloqueadas;
- logs de falha.

**Acceptance criteria**
- senha nunca aparece em logs;
- token ou tokenHash nunca aparecem em logs;
- respostas não revelam se o e-mail existe;
- erros de autenticação retornam status apropriado;
- logs contêm somente contexto técnico seguro.

**Verification**
- testes relevantes;
- inspeção dos logs;
- `pnpm lint`
- `pnpm build`

**Commit sugerido**
`refactor(AUTH-15): standardize authentication errors`

---

### AUTH-16 — Testes de integração da autenticação

**Goal**  
Validar componentes de autenticação contra PostgreSQL real de teste/desenvolvimento controlado.

**Dependencies**
- AUTH-05 até AUTH-15

**Cobertura mínima**
- hash de senha;
- lookup de usuário;
- criação de sessão;
- recuperação por tokenHash;
- sessão expirada;
- exclusão de sessão;
- normalização de e-mail;
- seed idempotente.

**Acceptance criteria**
- testes não dependem de ordem de execução;
- dados criados são isolados ou limpos;
- nenhum teste utiliza credenciais reais.

**Verification**
- suíte completa de integração;
- `pnpm lint`
- `pnpm build`

**Commit sugerido**
`test(AUTH-16): add authentication integration tests`

---

### AUTH-17 — E2E do fluxo completo

**Goal**  
Validar autenticação como o cliente HTTP realmente a utilizará.

**Dependencies**
- AUTH-16

**Fluxo principal**

```text
seed/test user
→ login
→ receber cookie
→ GET /auth/me
→ logout
→ reutilizar cookie
→ 401
```

**Casos adicionais**
- senha inválida;
- e-mail inexistente;
- sessão expirada;
- CSRF inválido;
- rate limit.

**Acceptance criteria**
- fluxo completo funciona;
- testes usam cookies reais;
- logout realmente invalida acesso.

**Verification**
- suíte E2E;
- `pnpm lint`
- `pnpm test`
- `pnpm build`

**Commit sugerido**
`test(AUTH-17): cover authentication e2e flow`

---

### AUTH-18 — Revisão semântica da fase

**Goal**  
Revisar toda a implementação sem modificar arquivos inicialmente.

**Review against**
- `PROJECT_SPEC.md`;
- `ARCHITECTURE.md`;
- `02-auth.md`;
- `AGENTS.md`.

**Checklist**
- [ ] nenhum JWT introduzido;
- [ ] nenhuma funcionalidade de signup;
- [ ] nenhum RBAC;
- [ ] token bruto nunca persistido;
- [ ] senha nunca logada;
- [ ] controllers permanecem finos;
- [ ] Prisma não vazou para application/domain;
- [ ] cookie segue D30;
- [ ] CSRF segue D31;
- [ ] logout é idempotente;
- [ ] sessão expirada retorna `401`;
- [ ] rate limiting não permite enumeração;
- [ ] nenhuma abstração especulativa;
- [ ] nenhum arquivo fora do escopo alterado.

**Deliverable**
Relatório de revisão com:
- achados;
- severidade;
- arquivos afetados;
- reparos necessários.

**Commit**
Nenhum, salvo se a revisão produzir apenas atualização documental.

---

### AUTH-19 — Repair, re-verificação e fechamento

**Goal**  
Corrigir achados da AUTH-18 e encerrar a fase somente após nova validação.

**Dependencies**
- AUTH-18

**Flow**

```text
REPAIR
→ TEST
→ LINT
→ BUILD
→ E2E
→ REVIEW AGAIN
→ DONE
```

**Acceptance criteria**
- nenhum achado bloqueante permanece;
- testes unitários passam;
- testes de integração passam;
- E2E passa;
- lint passa;
- build passa;
- documentação reflete decisões implementadas;
- `IMPLEMENTATION_PLAN.md` pode marcar Auth como concluída.

**Commit sugerido**
`docs(AUTH-19): close authentication stage`
