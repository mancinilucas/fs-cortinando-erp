# Fase 9 — Auditoria das consultas e do dashboard

**Task:** DASHBOARD-01 — Auditoria do estado atual da Fase 9
**Data:** 2026-10-20
**Natureza:** auditoria somente de leitura; nenhum código, schema, migration, seed, DTO, query ou teste foi alterado.
**Documento de decisões:** `docs/development/09-queries-dashboard.md` (D210–D259).

---

## 1. Objetivo

Verificar, com evidência no código e nas fontes de verdade, o que a Fase 9
(Dashboard e consultas operacionais) já entregou, o que permanecia pendente e
quais decisões precisavam ser fechadas antes da implementação.

A auditoria responde a três perguntas:

1. As consultas básicas da Fase 9 já estão implementadas e não devem ser
   reabertas?
2. Quais dados, índices e padrões de leitura já existem e podem ser
   reutilizados pelo dashboard?
3. Quais lacunas e ambiguidades impedem a implementação do dashboard e das
   listas operacionais de instalação?

Esta task **não** implementa `DashboardQuery`, endpoints, DTOs, índices,
migrations ou testes.

---

## 2. Fontes consultadas

Na ordem de precedência de `AGENTS.MD`:

1. `docs/PROJECT_SPEC.md` — comportamento do produto, em especial §8.2
   (expiração), §9.1–§9.3 (instalação e atraso) e §12.1 (dashboard).
2. `docs/ARCHITECTURE.md` — §7.3 (queries), §14.2 (rotas conceituais),
   §14.3 (DTOs), §17 (testes).
3. `docs/development/04-orcamentos.md` — D104–D107 (instalação, expiração,
   atraso), D111 (soft delete), D112–D113 (read-side), D116 (serialização),
   D122 (índices), D124 (escopo da fase).
4. `docs/development/04-orcamentos-audit.md` e
   `docs/development/04-orcamentos-final-review.md` — estado final do módulo
   de Orçamento.
5. `docs/development/08-documentos.md` — encerramento da Fase 8 e última
   decisão normativa (D209).
6. `docs/IMPLEMENTATION_PLAN.md` — itens pendentes e evidência do estado
   atual da Fase 9.
7. Código do backend: schema Prisma, migrations, queries, ports, domínio,
   controller e testes.

---

## 3. Checks executados

Executados a partir de `backend/`, salvo indicação contrária:

| Comando | Resultado |
| --- | --- |
| `pnpm lint` | Passou, sem erros. |
| `pnpm build` | Passou. O único aviso é o asset de logo ausente já conhecido da Fase 8 (não bloqueante e não relacionado à Fase 9). |
| `pnpm test` | 92 arquivos, 1066 testes, todos passando. |
| `pnpm test:e2e` | 8 arquivos, 80 testes, todos passando. |
| `npx prisma validate` | Schema válido. |
| `npx prisma migrate status` | Banco atualizado; 2 migrations aplicadas. |
| `git diff --check` | Sem problemas de whitespace. |
| `git status --short` | Antes desta rodada: árvore limpa. Depois: apenas os dois documentos novos da Fase 9. |

Nenhuma falha preexistente foi encontrada. Nenhum check foi corrigido ou
alterado nesta rodada.

---

## 4. Estado atual

A Fase 9 está **parcialmente concluída**, exatamente como registra o
`IMPLEMENTATION_PLAN.md`:

- **Concluído (parte de consultas):** `SearchQuotesQuery`, `GetQuoteQuery`,
  `ListCustomerQuotesQuery` e `ListQuoteHistoryQuery`, com as rotas HTTP
  correspondentes. O filtro virtual `EXPIRED` e a separação entre `SENT`
  válido e expirado já existem na busca.
- **Pendente (parte de dashboard):** contadores por situação; próximas
  instalações; instalações da semana; instalações atrasadas.

Evidência de ausência:

- não existe `DashboardQuery`, `DashboardQueryRepository`,
  `PrismaDashboardQuery`, DTO de dashboard, controller de dashboard ou rota
  `GET /dashboard` em `src/` ou `test/`;
- `docs/IMPLEMENTATION_PLAN.md` registra explicitamente: “não existe
  `DashboardQuery` nem endpoint de dashboard/instalações”;
- o controller de orçamentos não possui nenhuma rota de dashboard ou de
  listagem operacional de instalações.

Portanto, a Fase 9 remanescente é **somente leitura**: contadores e três
listas operacionais. Não há requisito pendente de escrita, transição de
estado, histórico ou documento.

---

## 5. Consultas já concluídas

| Query | Arquivo | Retorno | Rota | Leitura |
| --- | --- | --- | --- | --- |
| `SearchQuotesQuery` | `backend/src/modules/orcamentos/application/queries/search-quotes.query.ts` | `QuoteSummaryView[]` | `GET /orcamentos?search=&status=` | Projeção SQL direta; não reconstrói aggregate. |
| `GetQuoteQuery` | `backend/src/modules/orcamentos/application/queries/get-quote.query.ts` | `QuoteDetailView` | `GET /orcamentos/:id` | Carrega o aggregate para derivar `expired` e `lateInstallation`. |
| `ListCustomerQuotesQuery` | `backend/src/modules/orcamentos/application/queries/list-customer-quotes.query.ts` | `QuoteSummaryView[]` ou `null` | `GET /clientes/:customerId/orcamentos` | Projeção SQL direta; `null` vira `QuoteCustomerNotFoundError`. |
| `ListQuoteHistoryQuery` | `backend/src/modules/orcamentos/application/queries/list-quote-history.query.ts` | Eventos cronológicos | `GET /orcamentos/:id/historico` | Read repository próprio. |

Observações relevantes:

- `SearchQuotesQuery` normaliza `search` (`trim`; vazio vira `undefined`) e
  passa `clock.now()` ao port (`search-quotes.query.ts:25-34`).
- O port `QuoteSearchQueryRepository` documenta a ordenação
  `createdAt DESC, id DESC` (D113) e o tipo virtual
  `QuoteSearchStatus = QuoteStatus | 'EXPIRED'`.
- `QuoteSummaryView` contém `id`, `quoteNumber`, `customer: { id, name }`,
  `status`, `expired`, `totalCents`, `createdAt`, `validUntil` e
  `scheduledInstallationAt`.
- `PrismaSearchQuotesQuery` calcula `totalCents` em SQL, com CTEs de somas e
  `LEFT JOIN`, sem N+1. Essa projeção é mais pesada do que uma lista
  operacional de instalação precisa.
- `GetQuoteQuery` usa `isExpired(now)` e `isLateInstallation(now)` do
  aggregate (`get-quote.query.ts:84-85`).
- O padrão é: query de Application → port abstrato → implementação Prisma na
  Infrastructure → mapper de resposta na Presentation. O controller é fino.

---

## 6. Endpoints atuais

Rotas existentes no `OrcamentosController`
(`backend/src/modules/orcamentos/presentation/orcamentos.controller.ts`),
todas sob `@UseGuards(AuthGuard)`:

| Método | Rota |
| --- | --- |
| `POST` | `/clientes/:customerId/orcamentos` |
| `GET` | `/clientes/:customerId/orcamentos` |
| `GET` | `/orcamentos` |
| `GET` | `/orcamentos/:id` |
| `PATCH` | `/orcamentos/:id` |
| `DELETE` | `/orcamentos/:id` |
| `POST` | `/orcamentos/:id/enviar` |
| `POST` | `/orcamentos/:id/confirmar` |
| `POST` | `/orcamentos/:id/reabrir` |
| `POST` | `/orcamentos/:id/renovar` |
| `POST` | `/orcamentos/:id/cancelar` |
| `POST` | `/orcamentos/:id/iniciar-producao` |
| `POST` | `/orcamentos/:id/concluir` |
| `PUT` | `/orcamentos/:id/instalacao` |
| `DELETE` | `/orcamentos/:id/instalacao` |
| `GET` | `/orcamentos/:id/historico` |
| `GET` | `/orcamentos/:id/pdf` |
| `GET` | `/orcamentos/:id/ordem-producao` |

Não existe `GET /dashboard` nem qualquer rota de listagem operacional de
instalações. `docs/ARCHITECTURE.md` §14.2 fixa apenas `GET /dashboard` e
autoriza pequenos refinamentos de nomes.

---

## 7. Regra existente de `EXPIRED`

A regra está implementada em dois lugares, com semântica equivalente:

**Domínio** — `backend/src/modules/orcamentos/domain/entities/quote.ts:464-473`:

```ts
isExpired(now: Date): boolean {
  return (
    this._status === QuoteStatus.SENT &&
    this.validUntil !== null &&
    now.getTime() > this.validUntil.getTime()
  );
}
```

**SQL de busca** — `backend/src/modules/orcamentos/infrastructure/persistence/prisma-search-quotes.query.ts:44-52`:

```sql
-- filtro EXPIRED
(q.status::text = 'SENT' AND q.valid_until IS NOT NULL AND q.valid_until < ${now})

-- filtro SENT válido
(q.status::text = 'SENT' AND (q.valid_until IS NULL OR q.valid_until >= ${now}))
```

**Coluna derivada da projeção** — mesmo arquivo, linha 117:

```sql
(q.status::text = 'SENT' AND q.valid_until IS NOT NULL AND q.valid_until < ${now}) AS "expired"
```

Consequências já fixadas:

- `EXPIRED` não é status persistido; o enum `QuoteStatus` tem apenas
  `DRAFT`, `SENT`, `CONFIRMED`, `IN_PRODUCTION`, `COMPLETED`, `CANCELLED`.
- A comparação é estrita: exatamente em `validUntil` ainda **não** está
  expirado.
- `SENT` com `validUntil = null` é enviado válido.
- A duplicação SQL é dívida técnica autorizada por D113 para evitar N+1 e
  reconstrução de aggregate.
- O detalhe expõe `expired: boolean` (`quote-read-model.ts:82`).

Não existe hoje um helper compartilhado para essa condição. Uma terceira
implementação independente no dashboard aumentaria o risco de divergência.

---

## 8. Regra existente de instalação atrasada

**Domínio** — `backend/src/modules/orcamentos/domain/entities/quote.ts:475-484`.

Fórmula fixada por D107:

```text
lateInstallation =
  scheduledInstallationAt != null
  && scheduledInstallationAt < now
  && status in (CONFIRMED, IN_PRODUCTION)
```

Consequências já fixadas:

- é condição derivada, não status, não persistida e não gera histórico;
- a comparação é estrita: exatamente em `now` ainda **não** está atrasada;
- `COMPLETED` e `CANCELLED` nunca são atrasadas;
- o detalhe expõe `lateInstallation: boolean`
  (`quote-read-model.ts:83`, `get-quote.query.ts:85`);
- o agendamento só é permitido em `CONFIRMED` e `IN_PRODUCTION` (D104);
- a conclusão é bloqueada se `scheduledInstallationAt > now` (D105), portanto
  um orçamento `COMPLETED` não pode carregar instalação futura.

A regra já existe no domínio, mas **não existe ainda uma consulta SQL de
lista** que a reproduza. O dashboard será o primeiro consumidor desse tipo.

---

## 9. Dados disponíveis

`Quote` (`backend/prisma/schema.prisma:100-134`):

- `id` (UUID), `quoteNumber` (único), `customerId`, `status`;
- `validUntil` (`Timestamptz(3)`, nullable);
- `scheduledInstallationAt` (`Timestamptz(3)`, nullable);
- `createdAt`, timestamps de ciclo de vida (`sentAt`, `confirmedAt`,
  `productionStartedAt`, `completedAt`, `cancelledAt`);
- não existe `deletedAt` em `Quote`;
- não existe status de instalação;
- relação `customer` com `onDelete: Restrict`.

`Customer` (`backend/prisma/schema.prisma:76-96`):

- `id`, `name`, `phone`, `deletedAt` (nullable);
- soft delete lógico; a FK `Restrict` impede exclusão física de cliente com
  orçamentos.

Dados derivados que **não** existem no banco:

- `EXPIRED` (calculado por status + `validUntil`);
- `lateInstallation` (calculado por `scheduledInstallationAt` + status);
- contadores de dashboard;
- qualquer tabela, view materializada ou snapshot de dashboard.

`QuoteSummaryView` já traz `scheduledInstallationAt` e `customer.name`, mas
não traz `customer.phone` e carrega `totalCents` calculado por CTEs. Para as
listas operacionais, o conjunto mínimo necessário é diferente e menor.

---

## 10. Índices atuais

Índices confirmados no schema e na migration inicial
(`backend/prisma/migrations/20261018024309_init/migration.sql`):

| Índice | Coluna(s) | Uso atual | Uso potencial no dashboard |
| --- | --- | --- | --- |
| `quotes_customer_id_idx` | `quotes.customer_id` | Histórico do cliente | Não crítico. |
| `quotes_status_idx` | `quotes.status` | Filtros por situação | Contadores por situação e listas por status. |
| `quotes_valid_until_idx` | `quotes.valid_until` | Separação `SENT` válido × expirado | Contador `SENT` válido e `EXPIRED`. |
| `quotes_scheduled_installation_at_idx` | `quotes.scheduled_installation_at` | Justificado por D122 para “próximas instalações, semana e atrasadas” | As três listas operacionais. |
| `quotes_quote_number_key` | `quotes.quote_number` (único) | Busca por número | Desempate de ordenação. |
| `customers_name_idx` | `customers.name` | Busca por nome | Não crítico. |
| `quote_history_quote_id_occurred_at_idx` | `quote_history(quote_id, occurred_at)` | Histórico cronológico | Não usado. |

Não há índices compostos nem parciais. As colunas temporais são
`Timestamptz(3)`. D122 declara os índices suficientes para o MVP e não prevê
migration; essa declaração foi escrita no escopo da Fase 4 e justifica o
índice de instalação pelos casos de uso da Fase 9, mas **não** há uma decisão
específica da Fase 9 sobre índices.

Com o volume inicial do MVP e as três consultas previstas, não há evidência
concreta que exija novo índice. Índices compostos ou parciais só se
justificariam com medição real.

---

## 11. Estrutura de read-side existente

Padrão consolidado:

```text
Controller (Presentation)
  → Query de Application (orquestra Clock e normalização)
    → Port abstrato de leitura (Application)
      → Implementação Prisma (Infrastructure)
        → Projeção fechada (Application)
  → Mapper de resposta (Presentation)
```

Características relevantes:

- A Application depende de ports, não do client Prisma (D112/D119/D123).
- Prisma permanece exclusivamente na Infrastructure.
- Listas e buscas usam projeções SQL diretas; não reconstroem aggregates
  (D112/D113, `ARCHITECTURE.md` §7.3).
- O detalhe pode reconstruir o aggregate porque precisa das regras de
  domínio derivadas.
- `Clock` é o único ponto de leitura do tempo na Application
  (`application/ports/clock.port.ts`); `SystemClock` o implementa na
  Infrastructure. `SearchQuotesQuery` e `GetQuoteQuery` já o utilizam.
- Não há cache, materialized view, job ou scheduler no módulo.
- O controller é fino e delega ao query/use case; a serialização de datas é
  ISO 8601 UTC (D116).

Esse padrão é diretamente reutilizável pelo dashboard, sem introduzir CQRS
formal.

---

## 12. Lacunas reais

1. **Não existe `DashboardQuery`** nem port de leitura do dashboard.
2. **Não existe implementação Prisma** para contadores ou listas
   operacionais.
3. **Não existe contrato de resposta** para contadores e itens de instalação.
4. **Não existe rota `GET /dashboard`** nem DTO correspondente.
5. **Não existe projeção de lista de instalação** com o conjunto mínimo de
   campos.
6. **Não existe convenção de fronteira semanal** (`America/Sao_Paulo`) para
   “instalações da semana”; o único precedente de fuso é o ano comercial da
   numeração (D81), e D106 afirma que expiração compara instantes absolutos.
7. **Não existe limite definido** para “próximas instalações”.
8. **Não existe decisão sobre contadores** exibidos (incluindo
   `COMPLETED`/`CANCELLED`) nem sobre janela temporal.
9. **Não existe decisão sobre telefone** do cliente nas listas operacionais.
10. **Não existe teste** de dashboard, contadores ou listas de instalação.
11. **Não existe decisão específica de índices da Fase 9**, embora os índices
    atuais cubram as colunas de filtro.
12. **Não existe decisão sobre paginação** das listas operacionais; D113
    lista tudo no MVP.

Nenhuma dessas lacunas exige mudança de schema, migration, seed ou nova
dependência.

---

## 13. Inconsistências e ambiguidades

| ID | Descrição | Impacto |
| --- | --- | --- |
| A1 | `PROJECT_SPEC.md` §12.1 lista sete estados/condições relevantes, mas diz que os cards principais **podem** destacar apenas quatro. Não fixa quais contadores existem. | Contrato de resposta e UI indefinidos. |
| A2 | `COMPLETED` e `CANCELLED` aparecem como estados relevantes, mas não como cards principais. Não há regra sobre contá-los. | Pode haver contadores a mais ou a menos. |
| A3 | “Instalações da semana” não define semana civil, janela móvel, fuso ou inclusion de dias passados. | Fronteiras e testes indefinidos. |
| A4 | “Próximas instalações” não define limite, ordem nem se inclui o instante atual. | Tamanho da resposta e ordenação indefinidos. |
| A5 | `PROJECT_SPEC.md` não menciona telefone nas listas; `QuoteSummaryView` também não o expõe. | Projeção e privacidade indefinidas. |
| A6 | `ARCHITECTURE.md` §14.2 fixa apenas `GET /dashboard`, sem contrato de resposta nem rotas para as listas. | Forma do endpoint precisa ser proposta. |
| A7 | Não há decisão sobre incluir orçamentos de clientes soft-deleted nas listas operacionais. A busca e o histórico do cliente já os incluem (D111, D155). | Pode haver filtro implícito indevido. |
| A8 | D113 menciona `DashboardQuery` na tabela de queries, mas ele não foi implementado; o plano confirma a pendência. | Não é contradição, mas exige escopo explícito. |
| A9 | D122 justifica o índice de `scheduled_installation_at` por casos de uso da Fase 9, mas a declaração “nenhum índice novo” é escopada à Fase 4. | Falta decisão formal de índices da Fase 9. |
| A10 | Não há decisão de `Clock` para queries; porém `SearchQuotesQuery` e `GetQuoteQuery` já usam `Clock`. | Deve-se reutilizar, não criar segunda abstração. |
| A11 | Não há decisão de paginação para dashboard; D113 lista tudo no MVP. | Pode gerar resposta grande no futuro. |
| A12 | `QuoteSummaryView` inclui `totalCents` e CTEs de soma, mas as listas operacionais não precisam de valores financeiros. | Reutilizá-la seria desperdício e exposição desnecessária. |

Nenhuma inconsistência foi resolvida nesta auditoria; todas foram
encaminhadas como decisões em `09-queries-dashboard.md`. As decisões abertas
foram posteriormente validadas em 2026-10-20; o estado atual está registrado
na seção 14 e no documento de decisões.

---

## 14. Decisões necessárias

As decisões estão numeradas a partir de **D210** (a última decisão
normativa da Fase 8 é D209) e classificadas como:

- `[F]` determinada pelas fontes;
- `[P]` proposta, sujeita a objeção;
- `[V]` requeria validação humana antes da implementação;
- `[A]` aprovada pelo responsável do produto.

Resumo:

| Grupo | Decisões |
| --- | --- |
| Escopo e fronteiras | D210–D213 |
| Contadores | D214–D218 |
| Listas operacionais | D219–D227 |
| Tempo, `Clock` e fuso | D228–D231 |
| Projeções e privacidade | D232–D237 |
| HTTP | D238–D243 |
| Infraestrutura e performance | D244–D249 |
| Testes | D250–D254 |
| Nomenclatura e arquivos | D255–D259 |

As quatro decisões originalmente `[V]` — D214 (contadores), D219 (semana),
D223 (limite de próximas instalações) e D234 (telefone) — foram aprovadas em
2026-10-20 e promovidas a `[A]`. D225, D226 e D228 também foram promovidas a
`[A]` por serem consequência direta de D219. O detalhamento e o registro da
validação estão em `docs/development/09-queries-dashboard.md`.

---

## 15. Riscos

| Risco | Probabilidade | Impacto | Mitigação proposta |
| --- | --- | --- | --- |
| Terceira implementação divergente da regra de `EXPIRED` | Média | Contadores inconsistentes com a busca e o detalhe | D246: helper SQL compartilhado ou teste de paridade. |
| Erro de fronteira semanal por fuso/DST | Média | Lista da semana com item a mais ou a menos | D228/D230/D253: fuso explícito e testes de fronteira. |
| Testes instáveis dependentes de `new Date()` | Média | Falhas intermitentes | D229/D253: `Clock` fixo e datas relativas com folga. |
| Reutilizar `QuoteSummaryView` nas listas | Média | CTEs de totais desnecessárias e exposição de dados | D233/D240: projeção estreita. |
| Resposta crescer sem paginação | Baixa no MVP | Latência futura | D249: reavaliar com volume real. |
| Exibir telefone sem necessidade | Baixa | Exposição de dado pessoal | D234 aprovada: telefone não incluído; D235: lista mínima. |
| Cliente soft-deleted desaparecer das listas | Baixa | Perda de contexto operacional | D236: join sem filtro de `deleted_at`. |
| Contrato de contadores mudar depois | Média | Retrabalho no frontend | D214 aprovada em 2026-10-20 com cinco contadores. |

---

## 16. Arquivos provavelmente afetados pela implementação futura

Nenhum destes arquivos foi criado ou alterado nesta rodada. A lista serve
apenas para dimensionar a task de implementação.

- `backend/src/modules/orcamentos/application/queries/get-dashboard.query.ts`
- `backend/src/modules/orcamentos/application/ports/dashboard-query.repository.ts`
- `backend/src/modules/orcamentos/infrastructure/persistence/prisma-dashboard.query.ts`
- `backend/src/modules/orcamentos/presentation/dto/dashboard-response.dto.ts`
- `backend/src/modules/orcamentos/presentation/quote-response.mapper.ts` ou
  mapper próprio do dashboard
- `backend/src/modules/orcamentos/presentation/orcamentos.controller.ts`
  (ou controller dedicado, conforme D213/D255)
- `backend/src/modules/orcamentos/orcamentos.module.ts` (providers)
- possível helper de fronteira semanal na Application
- possível helper SQL compartilhado da condição `EXPIRED`
- testes unitários da query e do helper
- teste de integração da implementação Prisma
- `backend/test/dashboard.e2e-spec.ts`

Não são previstos:

- alteração de `backend/prisma/schema.prisma`;
- migration;
- seed;
- dependência nova;
- alteração de frontend.

---

## 17. Conclusão

A Fase 9 já entregou todas as consultas básicas e o filtro virtual
`EXPIRED`. O que resta é estritamente o dashboard operacional e as três
listas de instalação.

Não há bloqueio estrutural: os dados necessários existem, os índices
cobrem as colunas de filtro, o padrão de read-side está consolidado e o
`Clock` já é reutilizável. As lacunas são de **contrato e semântica**, não de
modelo de dados.

Os quatro pontos que exigiam validação humana foram aprovados em 2026-10-20:

- D214 — cinco contadores: `DRAFT`, `SENT` válido, `EXPIRED`, `CONFIRMED`,
  `IN_PRODUCTION`;
- D219 — semana civil em `America/Sao_Paulo`, segunda `00:00` → segunda
  seguinte `00:00`, incluindo dias transcorridos;
- D223 — limite de 5 próximas instalações;
- D234 — sem telefone nas listas operacionais.

D225, D226 e D228 também foram promovidas a `[A]` por serem consequência
direta de D219. O registro completo está em
`docs/development/09-queries-dashboard.md` (seção 13).

Com essas decisões fechadas, a implementação pode ser decomposta em tasks
atômicas sem alterar schema, migrations ou dependências.
