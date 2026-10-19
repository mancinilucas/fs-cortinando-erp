# 02 — Revisão semântica da autenticação

**Status:** AUTH-18 concluída em 2026-10-18; achados fechados na AUTH-19 em 2026-10-18.  
**Task de origem:** `docs/development/02-auth.md` → AUTH-18  
**Fontes de verdade:** `docs/PROJECT_SPEC.md` §13 e §14.3, `docs/ARCHITECTURE.md` §13, §14.2, §21 e §22, `docs/development/02-auth.md` (D26–D40) e `AGENTS.MD`

Esta revisão foi conduzida somente em leitura sobre a implementação de AUTH-01 a AUTH-17. Nenhum arquivo de código, schema ou migration foi alterado; as únicas mudanças são este relatório e a linha de status da development spec.

---

## 1. Verificação executada

| Comando | Resultado |
|---|---|
| `pnpm build` | ✅ exit 0 |
| `pnpm lint` | ✅ sem erros |
| `pnpm test` | ✅ 15 arquivos / 86 testes |
| `pnpm test:e2e` | ✅ 2 arquivos / 7 testes |
| `git status --short` | ✅ árvore limpa antes da revisão |

Verificações pontuais de escopo:

- `grep -rniE "jwt|jsonwebtoken|passport|signup|sign-up|rbac|role|roles"` em `backend/src`, `backend/test`, `backend/prisma` e `package.json` → nenhuma ocorrência.
- `grep -rn "prisma"` em `src/modules/auth/application` e `src/modules/auth/presentation` → nenhuma importação.
- `backend/prisma/schema.prisma` e `backend/prisma/migrations/` não foram alterados nesta fase.

---

## 2. Checklist da AUTH-18

| Item | Resultado | Evidência |
|---|---|---|
| Nenhum JWT introduzido | ✅ | Sessão server-side; nenhuma dependência ou referência a JWT/passport. |
| Nenhuma funcionalidade de signup | ✅ | `AuthController` expõe apenas `POST /auth/login`, `GET /auth/me` e `POST /auth/logout`. Não há rota, DTO ou caso de uso de cadastro. |
| Nenhum RBAC | ✅ | Não há papéis, permissões ou checagem de autorização além da autenticação. |
| Token bruto nunca persistido | ✅ | `LoginUseCase` gera o token e passa apenas `SessionTokenService.hash(token)` ao `SessionStore`; `PrismaSessionStore.create` persiste `tokenHash`. Testes verificam que a sessão criada contém apenas o hash e que o token não aparece no corpo da resposta. |
| Senha nunca logada | ✅ | Os únicos logs de autenticação são `event=login_failed ip=…`, `event=session_missing ip=…`, `event=session_invalid ip=…`, `event=session_expired` e `event=rate_limited …`. Testes com spy de `Logger` confirmam ausência de senha, token, hash e e-mail. |
| Controllers permanecem finos | ✅ | `AuthController` apenas valida entrada por DTO, delega a `LoginUseCase`/`LogoutUseCase`, aplica cookie e traduz falha em `401` genérico. Regras de sessão e credenciais ficam nos casos de uso e guards. |
| Prisma não vazou para application/domain | ✅ | `application/` contém apenas contratos abstratos, casos de uso e utilitários; Prisma aparece somente em `infrastructure/` e na composição do `auth.module.ts`. |
| Cookie segue D30 | ✅ | `__Host-cortinando_session` em produção e `cortinando_session` fora dela; `HttpOnly`, `Path=/`, `SameSite=Strict`, `Secure` em produção, `Max-Age=43200`, sem `Domain`. Confirmado por testes unitários e E2E. |
| CSRF segue D31 | ✅ | `CsrfOriginGuard` global valida `POST`, `PUT`, `PATCH` e `DELETE`; usa `Origin` com fallback para `Referer`, normaliza a origem e compara com `APP_ORIGIN`; ausência ou divergência → `403`. CORS usa allowlist explícita com `credentials: true`, sem wildcard. |
| Logout é idempotente | ✅ | `POST /auth/logout` sempre responde `204`, remove por `tokenHash` quando o cookie é válido e limpa o cookie com `Max-Age=0`; sessão ausente, desconhecida ou já removida também resulta em `204`. |
| Sessão expirada retorna `401` | ✅ | `PrismaSessionStore.findValidByTokenHash` remove a linha expirada de forma preguiçosa e retorna `null`; `AuthGuard` responde `401` com mensagem genérica. Coberto por teste unitário, de integração e E2E. |
| Rate limiting não permite enumeração | ✅ | A chave é derivada do IP e do e-mail normalizado submetido, não da existência da conta; e-mail inexistente e senha incorreta produzem o mesmo status, a mesma mensagem e o mesmo log. O limite de 5/min é aplicado por IP + e-mail. |
| Nenhuma abstração especulativa | ✅ | `UserStore` e `SessionStore` têm implementações e testes concretos; `SessionTokenService` isola geração/hash; não há repositório genérico, unidade de trabalho ou camada sem uso. |
| Nenhum arquivo fora do escopo alterado | ✅ | O diff da fase contém apenas módulo `auth`, helpers HTTP compartilhados, bootstrap/módulo raiz, seed/configuração de Prisma, dependências, testes e documentação. `schema.prisma` e migrations permanecem intactos. |

---

## 3. Achados

### A1 — Média — O login não possui teto de tentativas por IP

**Descrição.** O `ThrottlerModule` registra um único throttler, `default`, com 60 requisições por minuto por IP (`backend/src/app.module.ts:13`). Em `POST /auth/login`, o decorator `@Throttle({ default: { limit: 5, getTracker: loginTracker } })` (`backend/src/modules/auth/presentation/auth.controller.ts:38`) substitui, para esse mesmo throttler, tanto o limite quanto o tracker. O `ThrottlerGuard` resolve metadados de rota antes das opções do throttler (`routeOrClassLimit ?? namedThrottler.limit` e `routeOrClassGetTracker || ...`), portanto o login deixa de ser contabilizado no bucket por IP.

**Consequência.** Cada e-mail normalizado distinto recebe seu próprio bucket de 5/min. Um cliente não autenticado pode variar o e-mail e emitir tentativas ilimitadas por minuto a partir do mesmo IP; cada tentativa executa uma verificação Argon2id real ou o hash dummy de D38 (19 MiB, `t=2`). Isso permite esgotamento de CPU/memória com uma única origem e neutraliza parcialmente o requisito de rate limiting/backoff do login (`ARCHITECTURE.md` §13.3). O limite por IP + e-mail de D35 continua funcionando e não há enumeração de conta: a chave depende do e-mail submetido, não da existência, e as respostas permanecem genéricas.

**Arquivos afetados**

- `backend/src/modules/auth/presentation/auth.controller.ts`
- `backend/src/app.module.ts`
- `backend/src/modules/auth/presentation/auth.controller.throttle.spec.ts`
- `backend/test/auth.e2e-spec.ts` (cobertura adicional)

**Reparo necessário (AUTH-19).** Manter um limite por IP ativo no login e separar o limite por IP + e-mail em um throttler nomeado (por exemplo, `login` com `getTracker: loginTracker` e 5/min), aplicado somente à rota de login; o throttler `default` permanece por IP em todas as rotas. Adicionar teste que comprove que variar o e-mail não contorna o teto por IP, mantendo o teste atual do bucket por e-mail. O reparo complementa D35 e não altera a regra de negócio.

### A2 — Baixa — `trust proxy` não está configurado

**Descrição.** O rastreamento de rate limiting e os logs usam `request.ip` (`backend/src/shared/http/client-ip.ts:5` e `backend/src/modules/auth/presentation/login-tracker.ts:5`). O Express só considera `X-Forwarded-For` quando `trust proxy` está configurado. Se a API rodar atrás do terminador TLS/proxy reverso — cenário provável, já que HTTPS é obrigatório em produção (`ARCHITECTURE.md` §13.3) — todas as requisições aparentarão vir do endereço do proxy.

**Consequência.** A isolamento por cliente no rate limiting é perdido (todos compartilham o IP do proxy) e o campo `ip` dos logs registra o proxy, não o cliente. O limite por e-mail continua distinguindo contas, então não há bypass do controle de força bruta. O impacto é operacional e depende de uma decisão de deployment ainda adiada (`ARCHITECTURE.md` §22).

**Arquivos afetados**

- `backend/src/main.ts`
- `backend/src/shared/http/client-ip.ts`
- `backend/src/modules/auth/presentation/login-tracker.ts`

**Reparo necessário.** Quando o deployment for definido, configurar `app.set('trust proxy', <número de hops>)` com o número exato de proxies confiáveis — nunca `true` cegamente, para não permitir que um cliente falsifique `X-Forwarded-For` e contorne o rate limiting ou injete valores nos logs. Não é um bloqueio para o fechamento local da fase; deve constar como pré-requisito de produção.

---

## 4. Observações sem reparo necessário

1. **`APP_ORIGIN` sem validação de startup.** Ausente ou inválida, a allowlist fica vazia e o `CsrfOriginGuard` falha fechado (`403`) em toda requisição mutável, inclusive login. O comportamento é seguro, mas transforma erro de configuração em indisponibilidade de autenticação em vez de erro de inicialização. A auditoria (AUTH-01) já registrava a ausência de validação de ambiente; uma falha rápida no bootstrap seria uma melhoria opcional.
2. **Seed não rotaciona a senha.** `upsert` com `update: {}` preserva o hash existente quando `ADMIN_PASSWORD` muda. Isso é coerente com a idempotência exigida em AUTH-16; rotação de senha está fora do MVP (não há gestão de usuários).
3. **Duplicação do TTL de 12 h.** `SESSION_COOKIE_MAX_AGE_MS` e `SESSION_TTL_MS` repetem o valor de D29 em camadas diferentes. Os testes fixam ambos; não há divergência hoje. Só vale unificar se surgir necessidade concreta, para não acoplar presentation e infrastructure.
4. **Throttler em memória.** AUTH-14 excluiu Redis do MVP; com múltiplas réplicas, cada processo mantém seus próprios contadores. Revisitar apenas se o deployment adotar escala horizontal.
5. **Sessões expiradas acumulam.** A remoção é preguiçosa por D33; linhas nunca reapresentadas permanecem. É o comportamento aprovado, sem índice em `expires_at`.

---

## 5. Conclusão

Todos os itens do checklist da AUTH-18 foram atendidos. A implementação respeita as fronteiras arquiteturais, não introduz JWT, signup ou RBAC, não persiste token bruto, não registra credenciais e mantém controllers finos. As suítes de unidade/integração (86 testes) e E2E (7 testes) passam.

Há um achado que exige reparo na AUTH-19: **A1 (média)**, ausência de teto por IP no login. **A2 (baixa)** é um pré-requisito de produção dependente da topologia de deployment, que permanece adiada; não há outro achado bloqueante.

---

## 6. Fechamento — AUTH-19

- **A1 corrigido.** O limite global por IP voltou a valer no login; o limite de 5/min por IP + e-mail normalizado foi movido para um throttler nomeado (`login`), executado somente no handler de login. Os testes HTTP cobrem mesma conta, e-mails variados no mesmo IP, IPs distintos, resposta genérica e recuperação após a janela.
- **TTL centralizado.** `SESSION_TTL_SECONDS` é a única fonte do TTL; `expires_at` da sessão e `Max-Age` do cookie derivam dela. Os testes de cookie, de persistência de sessão e do controller usam o mesmo valor.
- **`APP_ORIGIN` validada no bootstrap.** Ausência ou entrada inválida impede a inicialização com erro claro; `.env.example` marca a variável como obrigatória.
- **A2 registrado como `DEPLOY-SEC-01`** em `docs/IMPLEMENTATION_PLAN.md`, Fase 12. `trust proxy` continua não configurado, conforme a decisão.
- **Seed sem alteração funcional**, mantendo `update: {}` e a idempotência aprovada. Reexecuções não rotacionam a senha existente nem atualizam credenciais silenciosamente; gestão e alteração de senha permanecem fora do MVP. Coberto por teste com senha diferente na segunda execução.
- **Re-verificação:** `pnpm build`, `pnpm lint`, `pnpm test` (16 arquivos / 96 testes) e `pnpm test:e2e` (2 arquivos / 7 testes) passam.
- **Resultado:** nenhum achado bloqueante permanece; fase de autenticação encerrada.
