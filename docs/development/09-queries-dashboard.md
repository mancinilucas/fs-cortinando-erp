# Fase 9 — Consultas operacionais e dashboard

**Task de origem:** DASHBOARD-02 — Fechar decisões técnicas e de contrato da
parte pendente da Fase 9
**Decomposição:** DASHBOARD-03 a DASHBOARD-11
**Data:** 2026-10-20
**Auditoria:** `docs/development/09-queries-dashboard-audit.md`
**Natureza:** decisões de contrato e implementação.
**Estado:** CONCLUÍDA em 2026-10-20 (DASHBOARD-03 a DASHBOARD-11;
fechamento na seção 19).

Esta spec cobre **somente** a parte pendente da Fase 9:

- contadores por situação;
- próximas instalações;
- instalações da semana;
- instalações atrasadas.

As consultas básicas (`SearchQuotesQuery`, `GetQuoteQuery`,
`ListCustomerQuotesQuery`, `ListQuoteHistoryQuery`) já foram entregues em
`04-orcamentos.md` (D113) e não são reabertas (D211).

---

## 1. Marcadores

- `[F]` — determinado pelas fontes (`PROJECT_SPEC.md`, `ARCHITECTURE.md`,
  specs ativas ou código existente).
- `[P]` — proposta desta spec; pode ser implementada salvo objeção.
- `[V]` — requer validação humana antes da implementação.
- `[A]` — aprovada pelo responsável do produto.

Em 2026-10-20, as quatro decisões originalmente `[V]` foram aprovadas:
D214, D219, D223 e D234. Como consequência direta e necessária dessas
escolhas, também foram promovidas a `[A]` as decisões D225, D226 e D228.
O registro completo está na seção 13.

### 1.1 Sumário das decisões

| Classificação | Quantidade | Decisões |
| --- | --- | --- |
| `[A]` | 7 | D214, D219, D223, D225, D226, D228, D234 |
| `[F]` | 24 | D210, D211, D212, D215, D216, D218, D221, D222, D227, D231, D232, D235, D236, D237, D241, D242, D245, D247, D248, D251, D252, D253, D257, D258 |
| `[P]` | 19 | D213, D217, D220, D224, D229, D230, D233, D238, D239, D240, D243, D244, D246, D249, D250, D254, D255, D256, D259 |
| `[V]` | 0 | — |

---

## 2. Escopo e fronteiras

### D210 — Escopo remanescente da Fase 9 `[F]`

**Decisão:** a Fase 9 remanescente compreende exclusivamente:

1. contadores de orçamentos por situação;
2. lista de próximas instalações;
3. lista de instalações da semana;
4. lista de instalações atrasadas.

**Justificativa:** `docs/PROJECT_SPEC.md` §12.1; `docs/IMPLEMENTATION_PLAN.md`
(linhas 80, 87 e 304–324); `04-orcamentos.md` D113 e D124. Não há outro item
pendente de leitura.

**Impacto:** nenhum endpoint de escrita, transição, histórico, documento ou
frontend é criado nesta fase.

### D211 — Consultas já concluídas não são reabertas `[F]`

**Decisão:** `SearchQuotesQuery`, `GetQuoteQuery`, `ListCustomerQuotesQuery`
e `ListQuoteHistoryQuery`, com suas rotas, permanecem como estão. O dashboard
reutiliza os contratos existentes, não os substitui.

**Justificativa:** código atual; `04-orcamentos-final-review.md`; D113;
`IMPLEMENTATION_PLAN.md` linha 320 (“não devem ser reabertos como trabalho da
Fase 9”).

### D212 — Dashboard é projeção de leitura, não conceito de domínio `[F]`

**Decisão:** não criar agregado, entidade, value object, repository de
domínio, tabela, view materializada, status persistido, evento ou job de
dashboard. O dashboard é uma projeção calculada na leitura.

**Justificativa:** `ARCHITECTURE.md` §7.3 (“não é necessário reconstruir
aggregates completos”; “não constitui CQRS formal”); D106 e D107 (condições
derivadas nunca persistidas); D113.

**Impacto:** nenhuma alteração de `schema.prisma`, migration, seed ou
histórico.

### D213 — Localização no módulo `orcamentos` `[P]`

**Decisão:** implementar o read-side do dashboard em
`backend/src/modules/orcamentos/`, seguindo a estrutura já existente:

- query em `application/queries/`;
- port em `application/ports/`;
- implementação Prisma em `infrastructure/persistence/`;
- DTO e rota em `presentation/`.

**Alternativas:**

- **A (recomendada):** manter no módulo de Orçamento, que é o dono dos dados
  e das regras de situação/instalação.
- **B:** criar um módulo `dashboard/`. Rejeitada: um único consumidor, sem
  domínio próprio, exigiria dependência cruzada e duplicaria a leitura de
  `Quote`.
- **C:** criar um módulo compartilhado de relatórios. Rejeitada: abstração
  para necessidade hipotética.

**Impacto:** nenhuma mudança de módulos do NestJS além dos providers do
`OrcamentosModule`.

---

## 3. Contadores por situação

### D214 — Contadores exibidos no dashboard `[A]`

**Decisão aprovada (2026-10-20):** usar somente cinco contadores
operacionais — `DRAFT`, `SENT` válido, `EXPIRED`, `CONFIRMED` e
`IN_PRODUCTION`.

**Alternativas consideradas:**

- **A (aprovada):** cinco contadores operacionais —
  `DRAFT`, `SENT` válido, `EXPIRED`, `CONFIRMED`, `IN_PRODUCTION`.
- **B:** os cinco anteriores mais `COMPLETED` e `CANCELLED` (sete).
- **C:** os cinco anteriores mais `COMPLETED`, sem `CANCELLED` (seis).

**Motivo:** `PROJECT_SPEC.md` §12.1 diz que os cards principais **podem**
destacar `RASCUNHO`, `ENVIADO`, `CONFIRMADO` e `EM_PRODUCAO`, e exige
`EXPIRADO` separado de `ENVIADO`. `COMPLETED` e `CANCELLED` são estados
terminais, não operacionais; não há requisito de contá-los. A alternativa A
cobre o funil acionável sem inventar regra.

**Impacto:** define as chaves de `statusCounts` (D239) e os testes de
contagem. B e C ficam descartadas.

### D215 — `EXPIRED` é sempre separado de `SENT` `[F]`

**Decisão:** o contador `expired` usa:

```text
status = SENT AND validUntil IS NOT NULL AND validUntil < now
```

O contador `sent` (enviado válido) usa:

```text
status = SENT AND (validUntil IS NULL OR validUntil >= now)
```

Um orçamento expirado **nunca** é somado a `sent`.

**Justificativa:** `PROJECT_SPEC.md` §8.2 e §12.1; D106; implementação já
existente em `PrismaSearchQuotesQuery`.

### D216 — `SENT` sem validade é enviado válido `[F]`

**Decisão:** `validUntil = null` não expira. O orçamento conta em `sent`,
não em `expired`.

**Justificativa:** D106; SQL atual de `SENT` válido; `Quote.isExpired`.

### D217 — Contadores sem janela temporal no MVP `[P]`

**Decisão:** os contadores abrangem toda a base de orçamentos, sem filtro de
período. Não há `from`/`to`, mês corrente ou “últimos 30 dias”.

**Alternativas:**

- **A (recomendada):** toda a base, coerente com “visão do funil” do
  `PROJECT_SPEC.md` §12.1.
- **B:** janela móvel de 30 dias. Rejeitada: o spec não pede período e isso
  introduziria um parâmetro de contrato sem necessidade.

**Impacto:** nenhum parâmetro de query (D243); contadores crescem com a base,
aceitável no MVP.

### D218 — Contagem por orçamento, sem duplicação `[F]`

**Decisão:** cada orçamento contribui com no máximo uma unidade para um
contador. A contagem não é multiplicada por cortinas, componentes, adicionais
ou eventos de histórico.

**Justificativa:** o funil é “baseado nos próprios orçamentos”
(`PROJECT_SPEC.md` §12.1); as tabelas filhas não representam unidades do
funil.

**Impacto:** a implementação deve contar linhas de `quotes`, não linhas de
joins.

---

## 4. Listas operacionais de instalação

### D219 — Definição de “instalações da semana” `[A]`

**Decisão aprovada (2026-10-20):** semana civil em `America/Sao_Paulo`,
de segunda-feira `00:00` até a segunda-feira seguinte `00:00`, com limite
inferior inclusivo e superior exclusivo, incluindo os dias já transcorridos
da semana.

**Alternativas consideradas:**

- **A (aprovada):** semana civil corrente, de segunda-feira `00:00` a
  segunda-feira seguinte `00:00`, no fuso `America/Sao_Paulo`. Inclui os dias
  já passados da semana corrente e os dias futuros.
- **B:** janela móvel de 7 dias a partir de `now`.
- **C:** semana civil corrente, mas somente do instante atual até a próxima
  segunda-feira.

**Motivo:** “instalações da semana” é uma visão operacional de calendário;
segunda-feira é o início de semana comercial no Brasil. Incluir os dias já
passados mostra o que estava agendado nesta semana, enquanto “próximas”
cobre o futuro e “atrasadas” cobre o passado não concluído. B não é uma
semana; C esvazia a visão de calendário e se sobrepõe a “próximas”.

**Impacto:** exige um helper de fronteira semanal (D230) e testes de
fronteira (D253). B e C ficam descartadas.

### D220 — Definição de “próximas instalações” `[P]`

**Decisão:** são orçamentos com `scheduledInstallationAt >= now`, nos
status `CONFIRMED` ou `IN_PRODUCTION`, ordenados por
`scheduledInstallationAt ASC, quoteNumber ASC`, limitados por D223.

O instante exatamente igual a `now` é considerado próximo (D225).

**Justificativa:** `PROJECT_SPEC.md` §12.1; D104 (agendamento só nesses
status); D107 (atraso é estritamente `< now`).

### D221 — Definição de “instalações atrasadas” `[F]`

**Decisão:** reutilizar exatamente a condição de D107:

```text
scheduledInstallationAt != null
&& scheduledInstallationAt < now
&& status in (CONFIRMED, IN_PRODUCTION)
```

Não é status persistido, não gera histórico e não inclui `COMPLETED` ou
`CANCELLED`.

**Justificativa:** `PROJECT_SPEC.md` §9.3; D107; `Quote.isLateInstallation`.

### D222 — Status elegíveis das três listas `[F]`

**Decisão:** as três listas consideram somente `CONFIRMED` e
`IN_PRODUCTION`.

**Justificativa:**

- o agendamento só é permitido nesses dois status (D104);
- `COMPLETED` é terminal e não pode carregar instalação futura (D105); uma
  data passada remanescente não é mais operacional;
- `CANCELLED` não tem instalação operacional;
- `DRAFT`, `SENT` e expirados não podem ter instalação.

**Impacto:** nenhuma lista precisa de filtro adicional de status além desses
dois.

### D223 — Limite de “próximas instalações” `[A]`

**Decisão aprovada (2026-10-20):** limitar a 5 itens.

**Alternativas consideradas:**

- **A (aprovada):** 5.
- **B:** 10.
- **C:** todos.

**Motivo:** o dashboard destaca, não substitui uma listagem completa. Cinco
itens cabem em um card e mantêm a resposta pequena. Não há paginação no MVP
(D249). Se a operação precisar de mais, o limite pode ser revisto sem quebrar
o contrato.

**Impacto:** define o `limit` aplicado na consulta e os testes de limite. As
alternativas B e C ficam descartadas.

### D224 — Ordenação determinística das listas `[P]`

**Decisão:** as três listas usam:

```text
scheduledInstallationAt ASC, quoteNumber ASC
```

“Atrasadas” também são ascendentes por data: a mais antiga primeiro, que é a
mais urgente. `quoteNumber` é único e serve como desempate estável.

**Alternativas:** `createdAt DESC` (rejeitada: não reflete urgência
operacional); apenas `scheduledInstallationAt` (rejeitada: empate não
determinístico).

### D225 — Fronteiras inclusivas e exclusivas `[A]`

**Decisão aprovada (2026-10-20):** consequência direta de D219; manter as
fronteiras abaixo.

- próximas: `scheduledInstallationAt >= now`;
- semana: `scheduledInstallationAt >= weekStart AND scheduledInstallationAt < weekEnd`
  (início inclusivo, fim exclusivo);
- atrasadas: `scheduledInstallationAt < now`.

Consequências:

- exatamente em `now`: entra em “próximas”, não entra em “atrasadas”;
- exatamente em `weekStart`: entra na semana;
- exatamente em `weekEnd`: não entra na semana.

**Justificativa:** D107 usa `< now`; a convenção `[início, fim)` evita
contagem dupla entre semanas consecutivas.

### D226 — Dias já passados da semana corrente `[A]`

**Decisão aprovada (2026-10-20):** consequência direta de D219; a lista da
semana inclui instalações agendadas para os dias já passados da semana
corrente, desde que ainda estejam em `CONFIRMED` ou `IN_PRODUCTION`.
Instalações já concluídas ou canceladas não aparecem.

**Alternativa descartada:** mostrar somente `scheduledInstallationAt >= now`
dentro da semana. Transformaria a lista em um subconjunto de “próximas” e
perderia a visão do que estava agendado nesta semana.

**Impacto:** um orçamento atrasado desta semana aparece tanto em “atrasadas”
quanto em “semana”. Isso é intencional: são visões diferentes da mesma
operação, não contadores mutuamente exclusivos.

### D227 — Resultado vazio `[F]`

**Decisão:** qualquer lista sem resultados retorna `[]`; não há `404` nem
erro de negócio.

**Justificativa:** leitura de coleção; `ARCHITECTURE.md` §15 reserva erros
para entradas inválidas ou recursos por id.

---

## 5. Tempo, `Clock` e fuso

### D228 — Fuso das fronteiras de calendário `[A]`

**Decisão aprovada (2026-10-20):** consequência direta de D219; fronteiras
de dia/semana usam `America/Sao_Paulo`. Os instantes persistidos continuam
absolutos e não são convertidos no banco.

**Alternativas consideradas:**

- **A (aprovada):** `America/Sao_Paulo`, coerente com o ano comercial da
  numeração (D81) e com a formatação de documentos.
- **B:** UTC. Descartada: uma instalação às 21h de domingo em São Paulo
  apareceria na semana seguinte.
- **C:** fuso do servidor. Descartada: depende do ambiente e não é
  determinístico.

**Impacto:** somente a derivação de fronteiras usa o fuso; comparações de
expiração e atraso continuam entre instantes absolutos (D106/D107).

### D229 — Reutilização do `Clock` `[P]`

**Decisão:** a Application obtém `now` de `Clock`
(`application/ports/clock.port.ts`). O controller não chama `new Date()`, e a
query não cria uma segunda abstração temporal.

**Justificativa:** `Clock` já é usado por `SearchQuotesQuery` e
`GetQuoteQuery`; a spec de `04-orcamentos.md` exige fonte de tempo testável.

### D230 — Cálculo das fronteiras da semana `[P]`

**Decisão:** calcular `weekStart` e `weekEnd` na Application, a partir de
`Clock.now()` e do fuso `America/Sao_Paulo`, e passar os dois instantes ao
port de leitura. O SQL apenas compara `scheduled_installation_at` com esses
instantes.

**Alternativas:**

- **A (recomendada):** helper puro na Application, testável sem banco.
- **B:** `date_trunc('week', ... AT TIME ZONE 'America/Sao_Paulo')` no SQL.
  Rejeitada: esconde a regra de negócio na Infrastructure e dificulta o teste
  unitário de fronteira.
- **C:** configuração global de timezone do PostgreSQL. Rejeitada: efeito
  colateral em todo o banco.

**Impacto:** um helper pequeno, sem dependência nova. Deve ser testado nos
limites de segunda-feira e na virada de semana.

### D231 — Instantes absolutos preservados `[F]`

**Decisão:** `validUntil` e `scheduledInstallationAt` continuam sendo
instantes absolutos (`Timestamptz(3)`). Nenhuma coluna é convertida para
“data local” de forma destrutiva. A serialização HTTP continua em ISO 8601
UTC (D116).

**Justificativa:** `ARCHITECTURE.md` §4.3; D106; D116.

---

## 6. Projeções, contrato e privacidade

### D232 — Tipos de projeção fechados `[F]`

**Decisão:** a Application define tipos próprios, sem expor tipos Prisma ou
entidades:

- `DashboardStatusCounts`;
- `InstallationListItem`;
- `DashboardView` (agrega contadores e as três listas).

**Justificativa:** `ARCHITECTURE.md` §7.3 e §14.3; D113; o padrão atual usa
`QuoteSummaryView` e `QuoteDetailView`.

### D233 — Campos de `InstallationListItem` `[P]`

**Decisão:** cada item contém somente os campos abaixo, sem telefone
(D234 `[A]`):

```text
quoteId
quoteNumber
customerName
scheduledInstallationAt
status
```

**Alternativas:** incluir `customerId` (rejeitada: `quoteId` identifica o
orçamento e o cliente não é necessário para a ação operacional); incluir
`totalCents` (rejeitada: dado financeiro sem uso na lista e com custo de
cálculo).

**Impacto:** projeção SQL estreita; não reutiliza as CTEs de totais de
`QuoteSummaryView`.

### D234 — Telefone do cliente nas listas `[A]`

**Decisão aprovada (2026-10-20):** não incluir telefone em nenhuma das
listas operacionais.

**Alternativas consideradas:**

- **A (aprovada):** não incluir telefone.
- **B:** incluir telefone nas três listas.
- **C:** incluir telefone somente em “atrasadas”.

**Motivo:** `PROJECT_SPEC.md` §12.1 não pede telefone; a projeção resumida
de D113 também não o inclui. O dashboard operacional precisa de número,
cliente, data e situação. O telefone pode ser obtido no detalhe do cliente
quando necessário. Incluí-lo agora amplia a exposição de dado pessoal sem
requisito.

**Impacto:** `InstallationListItem` não tem `customerPhone`; o join não
seleciona `customers.phone`. B e C ficam descartadas. Adicionar o campo no
futuro seria retrocompatível, mas exigiria nova decisão.

### D235 — Dados proibidos nas projeções `[F]`

**Decisão:** o dashboard não retorna `taxId`, `email`, endereço, telefone,
observações, valores financeiros, composição de cortinas, detalhes de
produção ou histórico.

**Justificativa:** `PROJECT_SPEC.md` §14 (dados pessoais); D137 (não
registrar dados pessoais); D113 (projeção mínima); D234 (telefone não
incluído).

### D236 — Cliente soft-deleted permanece visível `[F]`

**Decisão:** o join com `customers` **não** filtra `deleted_at`. Orçamentos
de clientes removidos logicamente continuam aparecendo nos contadores e nas
listas operacionais.

**Justificativa:** D111 (soft delete não invalida orçamentos históricos); a
busca e o histórico do cliente já seguem esse comportamento
(`PrismaSearchQuotesQuery` não filtra `deleted_at`; D155). A FK
`onDelete: Restrict` garante que o cliente existe fisicamente.

**Impacto:** nenhum `WHERE c.deleted_at IS NULL`; teste específico com
cliente soft-deleted.

### D237 — Serialização `[F]`

**Decisão:** contadores são inteiros; `status` é a string do enum;
`scheduledInstallationAt` é ISO 8601 UTC; listas vazias são `[]`.

**Justificativa:** D116; mappers atuais de resposta.

---

## 7. HTTP

### D238 — Endpoint único `GET /dashboard` `[P]`

**Decisão:** expor apenas `GET /dashboard`, autenticado, retornando
contadores e as três listas. Não criar `GET /instalacoes/proximas`,
`GET /instalacoes/semana` ou `GET /instalacoes/atrasadas` nesta fase.

**Alternativas:**

- **A (recomendada):** um endpoint agregado.
- **B:** um endpoint por lista. Rejeitada: não há consumidor separado; o
  `PROJECT_SPEC.md` §12.1 fala do dashboard como uma visão.
- **C:** endpoint agregado mais endpoints independentes. Rejeitada:
  duplicação de contrato e superfície HTTP sem necessidade.

**Impacto:** uma rota; os filtros por situação continuam disponíveis em
`GET /orcamentos?status=` (D257).

### D239 — Forma da resposta `[P]`

**Decisão:** resposta `200` com:

```json
{
  "statusCounts": {
    "draft": 0,
    "sent": 0,
    "expired": 0,
    "confirmed": 0,
    "inProduction": 0
  },
  "upcomingInstallations": [],
  "weeklyInstallations": [],
  "overdueInstallations": []
}
```

Cada item de lista segue D233:

```json
{
  "quoteId": "uuid",
  "quoteNumber": "ORC-2026-001",
  "customerName": "Cliente",
  "scheduledInstallationAt": "2026-10-20T15:00:00.000Z",
  "status": "CONFIRMED"
}
```

A forma de `statusCounts` é consequência de D214 `[A]`: exatamente as cinco
chaves acima, sem `completed` ou `cancelled`. Os itens seguem D233 e não
incluem `customerPhone`, conforme D234 `[A]`.

**Justificativa:** nomes em camelCase seguem os DTOs atuais; a resposta é
fechada e não inclui metadados de paginação ou cache.

### D240 — Uma query de Application, métodos independentes no port `[P]`

**Decisão:** criar uma única `GetDashboardQuery` que orquestra um port com
métodos explícitos:

```text
countByStatus(now)
listUpcoming(now, limit)
listWeek(weekStart, weekEnd)
listOverdue(now)
```

A implementação Prisma pode executar uma ou várias consultas SQL; o
contrato da Application não depende disso.

**Alternativas:**

- **A (recomendada):** uma query de Application e um port com quatro
  métodos. Testável por método, sem quatro classes e sem um SQL monolítico.
- **B:** quatro queries de Application e quatro ports. Rejeitada: quatro
  classes para um único endpoint, sem reutilização concreta.
- **C:** um único método `load(now, weekStart, weekEnd)` com um SQL que
  devolve tudo. Rejeitada: acopla os testes e dificulta evoluir uma lista
  sem tocar nas outras.

**Impacto:** uma classe de query registrada no módulo; um port abstrato.

### D241 — Status HTTP `[F]`

**Decisão:** `200` em sucesso; `401` sem sessão; erros inesperados seguem o
mapeamento global existente. Não há `404` (não há id) nem `409` (leitura sem
transição).

**Justificativa:** `ARCHITECTURE.md` §15; padrão dos controllers atuais.

### D242 — Autenticação e CSRF `[F]`

**Decisão:** a rota usa o mesmo `AuthGuard` das demais rotas. Sendo `GET`,
não participa da proteção CSRF aplicada a métodos mutáveis.

**Justificativa:** `OrcamentosController` já declara `@UseGuards(AuthGuard)`
no nível da classe; D194; `PROJECT_SPEC.md` §13.

### D243 — Sem parâmetros de query `[P]`

**Decisão:** `GET /dashboard` não aceita `from`, `to`, `status`, `limit` ou
`search`. O limite de próximas instalações é fixo por D223; a semana é a
corrente por D219; filtros detalhados continuam em `GET /orcamentos`.

**Alternativa:** aceitar `limit` opcional. Rejeitada: contrato sem consumidor
definido e validação adicional sem necessidade.

---

## 8. Infraestrutura, `EXPIRED` e performance

### D244 — Port abstrato e implementação Prisma `[P]`

**Decisão:**

- `DashboardQueryRepository` abstrato em `application/ports/`;
- `PrismaDashboardQuery` em `infrastructure/persistence/`;
- `GetDashboardQuery` em `application/queries/`;
- registro dos providers em `orcamentos.module.ts`.

**Justificativa:** mesmo padrão de `QuoteSearchQueryRepository` /
`PrismaSearchQuotesQuery`; a Application não importa Prisma.

### D245 — Prisma restrito à Infrastructure `[F]`

**Decisão:** nenhum import de Prisma na Application, no domínio ou na
Presentation. O SQL bruto, se usado, fica em `PrismaDashboardQuery`.

**Justificativa:** `ARCHITECTURE.md` §9.1; D112/D113; `AGENTS.MD`.

### D246 — Reutilização da condição de `EXPIRED` `[P]`

**Decisão:** extrair as condições SQL de expiração para um helper único da
Infrastructure (por exemplo, `quote-expiration.sql.ts`) e usá-lo na nova
consulta do dashboard. `PrismaSearchQuotesQuery` **não** é refatorado nesta
fase; a duplicação remanescente continua documentada como dívida de D113.

**Alternativas:**

- **A (recomendada):** helper compartilhado para o novo código; refatoração
  do código antigo fora do escopo.
- **B:** duplicar a condição uma terceira vez. Rejeitada: aumenta o risco de
  divergência entre busca, detalhe e dashboard.
- **C:** refatorar `PrismaSearchQuotesQuery` agora para usar o helper.
  Rejeitada nesta fase: alteraria código já concluído e ampliaria o diff sem
  necessidade funcional.

**Impacto:** o helper deve ser coberto por teste de integração que compare
`EXPIRED` e `SENT` válido com a regra do domínio nos limites de `validUntil`.

**Nota de implementação (DASHBOARD-11):** DASHBOARD-05 aplicou o helper também
a `PrismaSearchQuotesQuery` (alternativa C), porque a task exigia uma única
fórmula de `EXPIRED` para busca e dashboard. O comportamento da busca foi
preservado e coberto pela suíte existente; a refatoração eliminou a duplicação
registrada como dívida de D113. O texto original permanece como histórico da
decisão de abertura.

### D247 — Índices existentes são suficientes `[F]`

**Decisão:** não criar índice nem migration na Fase 9. Os índices
`quotes_status_idx`, `quotes_valid_until_idx`,
`quotes_scheduled_installation_at_idx` e `quotes_customer_id_idx` cobrem as
colunas de filtro das consultas previstas.

**Justificativa:** schema e migration atuais; D122; volume inicial do MVP.
Índices compostos ou parciais só se justificam com medição real.

**Impacto:** nenhuma alteração de banco. Reavaliar somente se uma medição
concreta demonstrar necessidade.

### D248 — Sem cache, materialização ou jobs `[F]`

**Decisão:** não usar Redis, cache de aplicação, view materializada, tabela
de dashboard, cron, scheduler ou persistência de `EXPIRED`/atraso.

**Justificativa:** D106/D107; `ARCHITECTURE.md` §7.3; escopo desta fase;
volume do MVP.

### D249 — Sem paginação nas listas `[P]`

**Decisão:** “semana” e “atrasadas” retornam todos os itens; “próximas” é
limitada por D223. Não há `page`, `cursor` ou `offset`.

**Justificativa:** D113 lista tudo no MVP; o dashboard é uma visão
operacional. Reavaliar com volume real.

---

## 9. Testes

### D250 — Testes unitários `[P]`

**Decisão:** cobrir, sem banco:

- mapeamento de `DashboardView` a partir do port mockado;
- aplicação do limite de próximas instalações;
- lista vazia;
- contadores com todas as combinações de D214;
- helper de fronteira semanal (segunda-feira, virada de semana, fuso).

**Justificativa:** `ARCHITECTURE.md` §17.1; queries atuais têm testes
unitários de aplicação.

### D251 — Testes de integração `[F]`

**Decisão:** testar `PrismaDashboardQuery` contra PostgreSQL real, no padrão
de `search-quotes.query.spec.ts`, com `Clock` fixo, cobrindo:

- contagem por situação;
- `SENT` válido × `EXPIRED` com `validUntil` nulo, futuro, igual e passado;
- próximas, semana e atrasadas com datas nos limites;
- exclusão de `COMPLETED` e `CANCELLED`;
- ordenação e desempate;
- cliente soft-deleted;
- resultado vazio.

**Justificativa:** `ARCHITECTURE.md` §17.2; a regra SQL não é coberta por
teste unitário.

### D252 — Testes E2E `[F]`

**Decisão:** cobrir `GET /dashboard`:

- `401` sem sessão;
- `200` com o contrato completo e listas vazias;
- `200` com orçamentos em todas as situações e instalações;
- ausência de efeitos colaterais (sem histórico, sem alteração de status).

**Justificativa:** `ARCHITECTURE.md` §17.3; padrão dos e2e existentes.

### D253 — Fronteiras temporais obrigatórias `[F]`

**Decisão:** os testes devem fixar `now` e cobrir:

- `validUntil` exatamente em `now` → não expirado;
- `validUntil` 1 ms antes → expirado;
- `validUntil` 1 ms depois → válido;
- `scheduledInstallationAt` exatamente em `now` → próximo, não atrasado;
- 1 ms antes → atrasado;
- 1 ms depois → próximo;
- `weekStart` exato → incluído; 1 ms antes → excluído;
- `weekEnd` exato → excluído; 1 ms antes → incluído.

**Justificativa:** D106/D107 usam comparações estritas; D225 fixa
`[início, fim)`.

### D254 — Isolamento dos testes `[P]`

**Decisão:** cada teste cria clientes e orçamentos próprios e limpa os dados
ao final; nenhum teste depende de ordem ou de dados de outro. E2E continua
com `fileParallelism: false` (D206).

**Justificativa:** padrão dos testes existentes; evita flutuação por dados
compartilhados.

---

## 10. Nomenclatura e arquivos

### D255 — Nomes `[P]`

**Decisão:**

| Elemento | Nome |
| --- | --- |
| Query de Application | `GetDashboardQuery` |
| Port | `DashboardQueryRepository` |
| Implementação Prisma | `PrismaDashboardQuery` |
| Projeção de contadores | `DashboardStatusCounts` |
| Projeção de item | `InstallationListItem` |
| Projeção agregada | `DashboardView` |
| DTO de resposta | `DashboardResponseDto` |
| Método do controller | `getDashboard()` |
| Rota | `GET /dashboard` |

### D256 — Arquivos previstos `[P]`

**Decisão:** a implementação futura cria:

```text
backend/src/modules/orcamentos/application/queries/get-dashboard.query.ts
backend/src/modules/orcamentos/application/ports/dashboard-query.repository.ts
backend/src/modules/orcamentos/infrastructure/persistence/prisma-dashboard.query.ts
backend/src/modules/orcamentos/presentation/dto/dashboard-response.dto.ts
backend/src/modules/orcamentos/presentation/dashboard-response.mapper.ts
backend/test/dashboard.e2e-spec.ts
```

Altera `orcamentos.module.ts` e o controller (ou cria um controller dedicado,
mantendo o `AuthGuard`). Pode criar um helper de fronteira semanal e um
helper SQL de expiração. Não altera schema, migration, seed ou dependências.

### D257 — Atalhos e filtros reutilizam a busca existente `[F]`

**Decisão:** os cards/estágios do dashboard não criam uma API de filtro
própria. A navegação para listas usa `GET /orcamentos?status=`, que já aceita
as seis situações persistidas e o valor virtual `EXPIRED`.

**Justificativa:** `PROJECT_SPEC.md` §12.1 (“cards e estágios podem funcionar
como atalhos/filtros”); D113.

### D258 — Leituras não geram efeitos colaterais `[F]`

**Decisão:** `GET /dashboard` não grava histórico, não altera status, não
persiste `EXPIRED`/atraso e não agenda jobs.

**Justificativa:** D106/D107; `ARCHITECTURE.md` §7.3; padrão das queries
existentes.

### D259 — Apresentação de datas no frontend `[P]`

**Decisão:** o backend entrega instantes ISO 8601 UTC. A conversão para o
fuso de exibição e a decisão de agrupamento visual pertencem ao frontend
(Fase 11); o backend apenas aplica D228 às fronteiras da semana.

**Justificativa:** separação de responsabilidades; D116.

---

## 11. Contrato consolidado (proposta)

O contrato abaixo incorpora D214 `[A]` e D234 `[A]`:

```http
GET /dashboard
Cookie: session=...
```

```json
{
  "statusCounts": {
    "draft": 3,
    "sent": 5,
    "expired": 2,
    "confirmed": 4,
    "inProduction": 1
  },
  "upcomingInstallations": [
    {
      "quoteId": "…",
      "quoteNumber": "ORC-2026-014",
      "customerName": "Maria",
      "scheduledInstallationAt": "2026-10-21T13:00:00.000Z",
      "status": "CONFIRMED"
    }
  ],
  "weeklyInstallations": [],
  "overdueInstallations": []
}
```

Regras do contrato:

- `statusCounts` é sempre completo, mesmo com valor zero;
- as três listas são sempre arrays;
- `upcomingInstallations` tem no máximo o limite de D223;
- `weeklyInstallations` e `overdueInstallations` não têm limite próprio;
- nenhum campo adicional é retornado;
- não há envelope `data`, metadados de paginação ou `generatedAt`.

---

## 12. Cobertura dos temas obrigatórios

| # | Tema | Decisão |
| --- | --- | --- |
| 1 | Itens antigos já concluídos | D211 |
| 2 | Escopo exato remanescente | D210 |
| 3 | Dashboard como read model, não domínio | D212 |
| 4 | Situações exibidas | D214 `[A]` |
| 5 | `EXPIRED` separado | D215 |
| 6 | Relação `SENT` × `EXPIRED` | D215/D216 |
| 7 | Inclusão/exclusão de `COMPLETED` | D214 `[A]` |
| 8 | Inclusão/exclusão de `CANCELLED` | D214 `[A]` |
| 9 | Definição de próxima instalação | D220 |
| 10 | Definição de semana | D219 `[A]` |
| 11 | Definição de atrasada | D221 |
| 12 | Status elegíveis | D222 |
| 13 | Ordenação | D224 |
| 14 | Limites | D223 `[A]` / D225 `[A]` |
| 15 | Fuso horário | D228 `[A]` |
| 16 | `Clock` | D229 |
| 17 | Limites inclusivos/exclusivos | D225 `[A]` |
| 18 | Tipos de projeção | D232 |
| 19 | Campos por item | D233 |
| 20 | Telefone do cliente | D234 `[A]` |
| 21 | Endpoints | D238 |
| 22 | Query agregada × independente | D240 |
| 23 | Port/read repository | D244 |
| 24 | Prisma direto no read-side | D245 |
| 25 | Reutilização da condição `EXPIRED` | D246 |
| 26 | Soft delete do cliente | D236 |
| 27 | Índices existentes | D247 |
| 28 | Necessidade de novos índices | D247 |
| 29 | Ausência de cache/materialização | D248 |
| 30 | Forma da resposta | D239 |
| 31 | Status codes | D241 |
| 32 | Autenticação | D242 |
| 33 | Query params | D243 |
| 34 | Testes unitários | D250 |
| 35 | Testes de integração | D251 |
| 36 | Testes E2E | D252 |
| 37 | Fronteiras temporais | D253 |

---

## 13. Validação humana registrada

Em 2026-10-20, o responsável do produto validou as quatro decisões
originalmente abertas. Todas foram promovidas a `[A]`:

| Decisão | Escolha aprovada |
| --- | --- |
| D214 | Somente `DRAFT`, `SENT` válido, `EXPIRED`, `CONFIRMED` e `IN_PRODUCTION`. |
| D219 | Semana civil em `America/Sao_Paulo`, segunda `00:00` → segunda seguinte `00:00`, limite inferior inclusivo e superior exclusivo, incluindo dias já transcorridos. |
| D223 | Limitar as próximas instalações a 5 itens. |
| D234 | Não incluir telefone em nenhuma das listas operacionais. |

### 13.1 D214 — Contadores `[A]`

| Alternativa | Conteúdo | Situação |
| --- | --- | --- |
| **A** | `DRAFT`, `SENT` válido, `EXPIRED`, `CONFIRMED`, `IN_PRODUCTION` | **Aprovada** |
| B | A + `COMPLETED` + `CANCELLED` | Descartada |
| C | A + `COMPLETED`, sem `CANCELLED` | Descartada |

**Motivo:** o `PROJECT_SPEC.md` §12.1 trata `COMPLETED` e `CANCELLED` como
estados relevantes, mas não como cards principais; o funil operacional é
formado pelos cinco contadores de A. `EXPIRED` continua separado.
**Impacto:** fixa as cinco chaves de `statusCounts`, o DTO, os testes e os
cards do frontend. As alternativas B e C não serão implementadas.

### 13.2 D219 — Semana `[A]`

| Alternativa | Conteúdo | Situação |
| --- | --- | --- |
| **A** | Semana civil corrente, segunda `00:00` → segunda seguinte `00:00`, `America/Sao_Paulo`, incluindo dias passados | **Aprovada** |
| B | Próximos 7 dias a partir de `now` | Descartada |
| C | Semana civil corrente, somente de `now` até a próxima segunda | Descartada |

**Motivo:** é a única alternativa que corresponde a “semana” e mantém a
visão operacional do que está agendado no calendário corrente. “Próximas” já
cobre o futuro; “atrasadas” cobre o passado não concluído.
**Impacto:** exige o helper de fronteira (D230) e testes de limite. B e C não
serão implementadas.

### 13.3 D223 — Limite de próximas instalações `[A]`

| Alternativa | Conteúdo | Situação |
| --- | --- | --- |
| **A** | 5 itens | **Aprovada** |
| B | 10 itens | Descartada |
| C | Todos os itens | Descartada |

**Motivo:** o dashboard destaca, não lista tudo; 5 cabe em um card e evita
resposta grande sem paginação (D249). O limite pode ser revisto depois sem
quebrar o contrato.
**Impacto:** fixa `LIMIT 5` na consulta e o teste de limite. B e C não serão
implementadas.

### 13.4 D234 — Telefone `[A]`

| Alternativa | Conteúdo | Situação |
| --- | --- | --- |
| **A** | Não incluir telefone | **Aprovada** |
| B | Incluir telefone nas três listas | Descartada |
| C | Incluir telefone somente em “atrasadas” | Descartada |

**Motivo:** não há requisito no `PROJECT_SPEC.md`; a projeção mínima de D113
não inclui telefone; o dashboard operacional funciona com número, cliente,
data e situação. Incluir amplia a exposição de dado pessoal (D235).
**Impacto:** o join não seleciona `customers.phone` e o item não tem
`customerPhone`. B e C não serão implementadas.

### 13.5 Decisões `[P]` promovidas por consequência direta

As decisões abaixo não alteram comportamento além do já proposto e são
consequência direta e necessária de D219. Foram promovidas a `[A]`:

| Decisão | Conteúdo | Origem |
| --- | --- | --- |
| D225 | Fronteiras inclusivas/exclusivas: semana `[weekStart, weekEnd)`; próximas `>= now`; atrasadas `< now`. | D219 |
| D226 | A semana inclui os dias já transcorridos, desde que o orçamento continue em `CONFIRMED`/`IN_PRODUCTION`. | D219 |
| D228 | Fuso das fronteiras de calendário: `America/Sao_Paulo`. | D219 |

As demais decisões `[P]` permanecem propostas. Em especial, D233 e D239
continuam `[P]` porque o conjunto completo de campos e a forma da resposta
não são consequência direta das quatro escolhas; ambos já foram atualizados
para refletir D214 e D234.

---

## 14. Alternativas descartadas

| Alternativa | Motivo da rejeição |
| --- | --- |
| Criar agregado/entidade `Dashboard` | Não há regra de domínio própria; violaria D212 e `ARCHITECTURE.md` §7.3. |
| Persistir `EXPIRED` ou `lateInstallation` | Contraria D106/D107; exigiria job e estado duplicado. |
| Criar tabela/materialized view de dashboard | Sem necessidade de volume; contraria D248. |
| Criar quatro classes de query e quatro endpoints | Superfície sem consumidor; D238/D240. |
| Reutilizar `QuoteSummaryView` nas listas | Carrega CTEs de totais e campos desnecessários; D233. |
| Paginar as listas operacionais | D113/D249; volume inicial baixo. |
| Filtrar clientes soft-deleted | Contraria D111/D155; perderia contexto histórico. |
| Calcular a semana em UTC ou no fuso do servidor | D228; produziria fronteiras erradas para a operação brasileira. |
| Usar `new Date()` no controller/query | D229; quebraria determinismo dos testes. |
| Terceira cópia da condição `EXPIRED` | D246; risco de divergência. |
| Incluir dados financeiros nas listas | D235; sem uso operacional e com custo de cálculo. |

---

## 15. Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| Divergência entre a regra de `EXPIRED` do domínio, da busca e do dashboard | D246: helper único para o novo código + teste de paridade nos limites. |
| Erro de fronteira semanal | D230/D253: helper puro, `now` fixo e testes de segunda-feira/virada. |
| Testes instáveis por tempo real | D229/D253: `Clock` fixo; E2E usa datas relativas com folga. |
| Resposta pesada ou sem limite | D233 (projeção estreita), D223 (limite), D249 (sem paginação por enquanto). |
| Exposição de dado pessoal | D234/D235: lista mínima; telefone não incluído. |
| Cliente soft-deleted sumir | D236: join sem filtro de `deleted_at` + teste. |
| Contrato mudar após o frontend | D214/D219/D223/D234 aprovadas em 2026-10-20; D233/D239 permanecem propostas e devem ser congeladas antes do frontend. |

---

## 16. Decomposição definitiva da implementação

A parte pendente da Fase 9 é dividida em nove tasks atômicas. Cada task segue
o ciclo:

```text
READ
→ IMPLEMENT
→ VERIFY
→ REVIEW
→ REPAIR
→ RE-VERIFY
→ DONE
```

| Task | Entrega |
| --- | --- |
| DASHBOARD-03 | Definir contratos do read-side |
| DASHBOARD-04 | Implementar fronteiras temporais |
| DASHBOARD-05 | Centralizar condição de `EXPIRED` para queries |
| DASHBOARD-06 | Implementar `PrismaDashboardQuery` |
| DASHBOARD-07 | Implementar `GetDashboardQuery` |
| DASHBOARD-08 | Expor `GET /dashboard` |
| DASHBOARD-09 | Consolidar testes de integração |
| DASHBOARD-10 | E2E do dashboard |
| DASHBOARD-11 | Revisão semântica, reparos e fechamento |

### DASHBOARD-03 — Definir contratos do read-side

**Goal:** materializar os contratos da Application sem acessar Prisma, HTTP
ou NestJS.

**Scope:** criar os tipos fechados e o port de leitura.

`DashboardStatusCounts` contém exatamente:

```ts
interface DashboardStatusCounts {
  draft: number;
  sent: number;
  expired: number;
  confirmed: number;
  inProduction: number;
}
```

Não incluir `completed` nem `cancelled`.

`InstallationListItem` contém somente:

```ts
interface InstallationListItem {
  quoteId: string;
  quoteNumber: string;
  customerName: string;
  scheduledInstallationAt: Date;
  status: QuoteStatus;
}
```

Não incluir telefone, email, `taxId`, endereço, valores financeiros,
cortinas, notas ou `BusinessData`.

`DashboardView` agrega:

```ts
interface DashboardView {
  statusCounts: DashboardStatusCounts;
  upcomingInstallations: InstallationListItem[];
  weeklyInstallations: InstallationListItem[];
  overdueInstallations: InstallationListItem[];
}
```

`DashboardQueryRepository` é um port abstrato da Application com métodos
explícitos e estreitos:

```ts
abstract getStatusCounts(now: Date): Promise<DashboardStatusCounts>;

abstract listUpcomingInstallations(
  now: Date,
  limit: number,
): Promise<InstallationListItem[]>;

abstract listWeeklyInstallations(
  start: Date,
  end: Date,
): Promise<InstallationListItem[]>;

abstract listOverdueInstallations(
  now: Date,
): Promise<InstallationListItem[]>;
```

Não criar repository genérico, entidade `Dashboard`, Aggregate Root,
framework CQRS ou tipos Prisma na Application.

**Tests:** nenhum teste é necessário para interfaces sem comportamento.
Criar testes apenas se houver transformação concreta.

**Acceptance criteria:**

- Application não importa Prisma;
- nenhum tipo HTTP;
- nenhum dado proibido nas projeções;
- contadores exatamente conforme D214;
- telefone ausente;
- nenhuma abstração especulativa.

**Verification:** `pnpm lint`, `pnpm test`, `pnpm build`.

**Commit sugerido:** `feat(DASHBOARD-03): define dashboard read contracts`.

---

### DASHBOARD-04 — Implementar fronteiras temporais

**Goal:** centralizar o cálculo determinístico da semana civil usada pelo
dashboard.

**Scope:** criar helper puro na Application.

Entrada: `now: Date`. Saída: `{ start: Date; end: Date }`.

Regras:

- timezone `America/Sao_Paulo`;
- semana inicia segunda-feira;
- `start` = segunda `00:00` local;
- `end` = segunda seguinte `00:00` local;
- intervalo `[start, end)`;
- dias já transcorridos permanecem dentro da lista semanal.

Não usar `now + 7 dias` como definição de semana. Não alterar timestamps
persistidos. Não criar dependência externa apenas para datas sem necessidade
demonstrada. Reutilizar `Clock` quando o comportamento depender de “agora”.

**Tests obrigatórios:** segunda-feira; domingo; meio da semana; mudança de
mês; mudança de ano; data próxima de meia-noite UTC; início exato da semana;
fim exclusivo. Os testes não dependem do relógio real.

**Acceptance criteria:** timezone explícito; nenhuma lógica de banco; nenhum
`new Date()` espalhado em queries para decidir a semana; helper determinístico.

**Verification:** `pnpm lint`, `pnpm test`, `pnpm build`.

**Commit sugerido:** `feat(DASHBOARD-04): add dashboard week boundaries`.

---

### DASHBOARD-05 — Centralizar condição de `EXPIRED` para queries

**Goal:** evitar uma terceira implementação independente da semântica de
`EXPIRED`.

**Scope:** inspecionar a implementação existente usada por
`SearchQuotesQuery`/`PrismaSearchQuotesQuery` e extrair somente o necessário
para reutilização pelas consultas do dashboard.

A semântica permanece exatamente igual à vigente:

```text
EXPIRED virtual = status persistido SENT
                  AND validUntil expirado conforme a regra vigente

SENT válido    = status persistido SENT
                  AND não expirado
```

Não alterar comportamento existente. Não fazer refactor amplo. Não mover
lógica de domínio por estética. A solução pode ser um helper Prisma
compartilhado, um fragmento/função de construção de `where` ou outra
abstração mínima coerente com o código atual.

**Tests:** regressão para `validUntil > now`, `validUntil == now`,
`validUntil < now` e `validUntil == null`; rodar também os testes existentes
de busca/filtro de Orçamento.

**Acceptance criteria:** `SearchQuotes` continua com comportamento idêntico;
o dashboard pode reutilizar a mesma condição; não há terceira fórmula de
expiração; nenhum schema alterado.

**Verification:** `pnpm lint`, `pnpm test`, `pnpm build`.

**Commit sugerido:** `refactor(DASHBOARD-05): share expired quote query predicate`.

---

### DASHBOARD-06 — Implementar `PrismaDashboardQuery`

**Goal:** implementar todo o read-side do dashboard contra PostgreSQL.

**Scope:** criar a implementação concreta de `DashboardQueryRepository` na
Infrastructure.

**Status counts:**

- `draft` = `DRAFT`;
- `sent` = `SENT` válido, excluindo expirados;
- `expired` = `SENT` virtualmente expirado;
- `confirmed` = `CONFIRMED`;
- `inProduction` = `IN_PRODUCTION`;
- sem janela temporal;
- `COMPLETED` e `CANCELLED` não entram.

**Upcoming installations:**

```text
scheduledInstallationAt >= now
AND status IN (CONFIRMED, IN_PRODUCTION)
ORDER BY scheduledInstallationAt ASC, quoteNumber ASC
LIMIT 5
```

**Weekly installations:**

```text
scheduledInstallationAt >= start
AND scheduledInstallationAt < end
AND status IN (CONFIRMED, IN_PRODUCTION)
ORDER BY scheduledInstallationAt ASC, quoteNumber ASC
```

Inclui instalações passadas da semana.

**Overdue installations:** usar semanticamente D107, sem criar nova
definição. Excluir estados não elegíveis, incluindo terminais. Ordenar por
`scheduledInstallationAt ASC, quoteNumber ASC` — mais antigas primeiro.

**Cliente:** join com `Customer` somente para `customerName`. Cliente
soft-deleted continua aparecendo; não filtrar `deletedAt IS NULL`. Não
selecionar telefone.

**Performance:** usar os índices atuais; não criar migration; não criar CTEs
de totais; não reconstruir Aggregate Root; não carregar
curtains/components.

**Integration tests iniciais:** cada contador; `SENT` válido × `EXPIRED`;
próximas; limite 5; semana; atrasadas; ordenação; cliente soft-deleted;
resultados vazios.

**Acceptance criteria:** projeções estreitas; Prisma apenas na
Infrastructure; queries sem efeitos colaterais; nenhuma regra financeira
carregada; nenhuma migration.

**Verification:** `pnpm lint`, `pnpm test`, `pnpm build`,
`npx prisma validate`.

**Commit sugerido:** `feat(DASHBOARD-06): implement prisma dashboard queries`.

---

### DASHBOARD-07 — Implementar `GetDashboardQuery`

**Goal:** orquestrar a composição do dashboard na Application.

**Scope:** criar `GetDashboardQuery` com dependências
`DashboardQueryRepository` e `Clock` existente.

Fluxo conceitual:

```text
now = clock.now()
week = calculateWeekBoundaries(now)

statusCounts = repository.getStatusCounts(now)
upcoming = repository.listUpcomingInstallations(now, 5)
weekly = repository.listWeeklyInstallations(week.start, week.end)
overdue = repository.listOverdueInstallations(now)

return DashboardView
```

Pode usar `Promise.all` se não houver dependência entre as leituras e se isso
estiver coerente com o padrão do projeto. Não usar transação. Não abrir
aggregate. Não duplicar predicates.

**Tests com mocks do port:** usa `Clock`; calcula a fronteira correta; passa
`limit = 5`; retorna exatamente a estrutura esperada; propaga erro técnico
inesperado; arrays vazios permanecem `[]`.

**Acceptance criteria:** nenhuma dependência Prisma; nenhuma dependência
HTTP; nenhum side effect; nenhuma regra de negócio recalculada.

**Verification:** `pnpm lint`, `pnpm test`, `pnpm build`.

**Commit sugerido:** `feat(DASHBOARD-07): add dashboard query`.

---

### DASHBOARD-08 — Expor `GET /dashboard`

**Goal:** materializar o contrato HTTP aprovado.

**Scope:** criar `GET /dashboard`, sem query params, protegido por
`AuthGuard`. Como `GET`: sem CSRF, sem mutation e sem histórico.

Resposta conceitual:

```json
{
  "statusCounts": {
    "draft": 0,
    "sent": 0,
    "expired": 0,
    "confirmed": 0,
    "inProduction": 0
  },
  "upcomingInstallations": [],
  "weeklyInstallations": [],
  "overdueInstallations": []
}
```

Item de instalação:

```json
{
  "quoteId": "...",
  "quoteNumber": "ORC-2026-001",
  "customerName": "...",
  "scheduledInstallationAt": "2026-10-20T18:00:00.000Z",
  "status": "IN_PRODUCTION"
}
```

Datas em ISO 8601 UTC; a apresentação local pertence ao frontend. Não expor
telefone.

**Wiring:** registrar repository concreto, query e controller/rota no módulo
adequado conforme D213/D255. Não criar módulo `dashboard/` se a decisão
aprovada manteve tudo em `orcamentos`.

**Tests:** mapper/DTO quando aplicável; `AuthGuard`; shape exato; arrays
vazios; nenhuma chave `completed`/`cancelled` nos contadores; nenhum
`phone`.

**Verification:** `pnpm lint`, `pnpm test`, `pnpm build`.

**Commit sugerido:** `feat(DASHBOARD-08): expose dashboard endpoint`.

---

### DASHBOARD-09 — Consolidar testes de integração

**Goal:** executar uma bateria dedicada ao read-side com PostgreSQL real.

**Scope:** consolidar os cenários relevantes em arquivo(s) coerentes com o
padrão atual.

**Counts:** `DRAFT`; `SENT` válido; `EXPIRED`; `CONFIRMED`;
`IN_PRODUCTION`; `COMPLETED` não contado; `CANCELLED` não contado.

**Expiration boundary:** `validUntil > now`; `validUntil == now`;
`validUntil < now`; `validUntil == null`.

**Upcoming:** passado; exatamente `now`; futuro; limite 5; ordenação
determinística.

**Week:** exatamente `start`; 1 ms antes de `start`; dentro da semana; 1 ms
antes de `end`; exatamente `end`.

**Overdue:** passado; exatamente `now`; futuro; completed; cancelled; regras
de D107.

**Customer:** ativo; soft-deleted.

**Critical assertions:** o dashboard não altera `Quote`, não atualiza
`updatedAt`, não cria histórico, não modifica `Customer` e não persiste
estado derivado.

**Verification:** `pnpm test`, `pnpm lint`, `pnpm build`. Repetir a suite se
houver qualquer sinal de flakiness temporal.

**Commit sugerido:** `test(DASHBOARD-09): cover dashboard read queries`.

---

### DASHBOARD-10 — E2E do dashboard

**Goal:** validar o contrato completo HTTP → Application → Prisma.

**Scope:** criar E2E de `GET /dashboard`.

**Auth:** sem sessão → `401`; sessão válida → `200`.

**Empty:** banco sem orçamentos elegíveis retorna os cinco contadores
zerados e as três listas vazias.

**Populated:** fixtures suficientes para provar os cinco contadores, `SENT` ×
`EXPIRED`, próximas limitadas a 5, semana civil, atrasadas, ordenação,
cliente soft-deleted, `COMPLETED`/`CANCELLED` fora dos cards e telefone
ausente.

**Contract assertions:** não retornar email, phone, `taxId`, address, notes,
totals ou curtains.

**Time:** usar estratégia testável/determinística já usada pelo projeto. Não
construir teste dependente do dia real atual.

**Verification:** `pnpm test:e2e`, `pnpm lint`, `pnpm build`.

**Commit sugerido:** `test(DASHBOARD-10): add dashboard e2e coverage`.

---

### DASHBOARD-11 — Revisão semântica, reparos e fechamento

**Goal:** executar revisão final da Fase 9 e atualizar o roadmap. Começar
como auditoria read-only.

**Revisar decisões:** conferir integralmente D210–D259.

**Checklist funcional:**

- queries antigas sem regressão: `SearchQuotesQuery`, `GetQuoteQuery`,
  `ListCustomerQuotesQuery`, `ListQuoteHistoryQuery`;
- contadores exatamente `DRAFT`, `SENT` válido, `EXPIRED`, `CONFIRMED`,
  `IN_PRODUCTION`;
- próximas: `>= now`, statuses corretos, 5 resultados, ordem determinística;
- semana: semana civil de São Paulo, `[start, end)`, inclui dias já passados;
- atrasadas: regra idêntica a D107, mais antigas primeiro;
- privacidade: `InstallationListItem` sem phone, email, `taxId`, address ou
  dados financeiros;
- arquitetura: read-side, sem aggregate novo, sem módulo desnecessário,
  Prisma apenas na Infrastructure, sem cache, tabela, view ou materialização,
  sem side effect;
- performance: nenhum índice novo, nenhuma migration, seleções estreitas,
  nenhuma CTE financeira desnecessária.

**Mechanical gates:** `pnpm lint`, `pnpm test`, `pnpm test:e2e`,
`pnpm build`, `npx prisma validate`, `npx prisma migrate status`,
`git diff --check`, `git status --short`.

**Repair:** se houver finding, seguir
`REPRODUCE → REPAIR → TARGETED TEST → FULL RELEVANT SUITE → SEMANTIC RECHECK`.
Não fechar com finding bloqueante.

**Documentation:** atualizar `docs/development/09-queries-dashboard.md` e
`docs/IMPLEMENTATION_PLAN.md`. Marcar a Fase 9 como concluída somente se tudo
estiver verde. Não iniciar frontend.

**Commit sugerido:** `docs(DASHBOARD-11): close dashboard phase`.

### 16.10 Gates obrigatórios por task

**Gate 1 — mecânico:** no mínimo `pnpm lint`, `pnpm test` e `pnpm build`.
Adicionar `pnpm test:e2e` e `npx prisma validate` quando aplicável.

**Gate 2 — semântico:** revisar `PROJECT_SPEC`, `ARCHITECTURE`,
`09-queries-dashboard.md`, `AGENTS.MD` e os acceptance criteria. Perguntas:

1. Foi criada alguma regra nova?
2. `EXPIRED` divergiu da implementação existente?
3. `lateInstallation` divergiu de D107?
4. Prisma vazou para a Application?
5. Algum dado pessoal desnecessário foi exposto?
6. Algum side effect foi introduzido?
7. `COMPLETED`/`CANCELLED` entraram nos contadores por engano?
8. Algum limite temporal usa timezone incorreto?
9. Algum arquivo fora do escopo foi alterado?

### 16.11 Commits

Cada task concluída gera no máximo um commit atômico. Antes do commit,
executar `git diff --check` e `git status --short`. Preferir `git add -p`.
Não usar commit para esconder alteração fora do escopo.

---

## 17. Condição de parada e fora de escopo

A decomposição acima é a sequência definitiva. A rodada de abertura executou
somente **DASHBOARD-03**; as rodadas seguintes executaram DASHBOARD-04 a
DASHBOARD-11, e a Fase 9 foi encerrada em 2026-10-20 (seção 19).

Não fizeram parte de DASHBOARD-03 (escopo das tasks seguintes):

- implementar fronteiras temporais (DASHBOARD-04);
- alterar `PrismaSearchQuotesQuery` ou criar helper de `EXPIRED`
  (DASHBOARD-05);
- implementar `PrismaDashboardQuery` (DASHBOARD-06);
- implementar `GetDashboardQuery` (DASHBOARD-07);
- criar DTO, endpoint ou wiring (DASHBOARD-08);
- criar testes de integração ou E2E (DASHBOARD-09/DASHBOARD-10);
- atualizar `docs/IMPLEMENTATION_PLAN.md` ou fechar a Fase 9
  (DASHBOARD-11);
- iniciar frontend.

A validação humana de D210–D259 está concluída. As decisões não são reabertas
por esta decomposição.

---

## 18. Conclusão

A parte pendente da Fase 9 está especificada em nível de contrato e
decomposta em nove tasks atômicas. As quatro decisões abertas foram
aprovadas em 2026-10-20 e promovidas a `[A]`, junto com D225, D226 e D228,
que são consequência direta de D219. Não há necessidade de alterar o modelo
de dados, criar índices, migrations ou dependências.

Com as decisões aprovadas:

- `GET /dashboard` retorna cinco contadores e três listas;
- “próximas” usa `>= now`, statuses `CONFIRMED`/`IN_PRODUCTION`, ordem
  ascendente e limite 5;
- “semana” usa a semana civil de `America/Sao_Paulo`, início inclusivo e fim
  exclusivo;
- “atrasadas” reutiliza D107;
- nenhuma lista expõe telefone ou dados financeiros;
- a leitura é determinística via `Clock`, sem cache, materialização ou
  persistência de condições derivadas.

---

## 19. Fechamento da Fase 9

**Estado:** CONCLUÍDA em 2026-10-20.

DASHBOARD-03 a DASHBOARD-11 foram executadas na ordem especificada. O
dashboard está disponível em `GET /dashboard`, protegido por `AuthGuard`, com
cinco contadores e três listas operacionais, sem parâmetros de consulta.

**Entregas:**

- read model, port e `GetDashboardQuery` na camada Application;
- fronteiras da semana civil de `America/Sao_Paulo` como helper puro;
- helper SQL único de expiração, compartilhado por `PrismaDashboardQuery` e
  `PrismaSearchQuotesQuery` (nota em D246);
- `PrismaDashboardQuery` com projeções estreitas, sem filtro de cliente
  excluído, ordem determinística e limite 5 em “próximas”;
- DTO, mapper e rota no `OrcamentosController`, com wiring no módulo;
- testes unitários, de integração com PostgreSQL e E2E com `Clock` fixo.

**Gate 1 — execução final (2026-10-20, a partir de `backend/`):**

| Comando | Resultado |
|---|---|
| `pnpm lint` | passou, sem avisos |
| `pnpm test` | 96 arquivos, 1091 testes, todos passando |
| `pnpm test:e2e` | 9 arquivos, 83 testes, todos passando |
| `pnpm build` | passou; permanece apenas o aviso já conhecido do PNG ausente (D150) |
| `npx prisma validate` | schema válido |
| `npx prisma migrate status` | 2 migrations, banco atualizado |
| `git diff --check` | sem problemas |

**Gate 2 — revisão semântica final:** D210–D259 conferidas contra
`PROJECT_SPEC` §12.1, `ARCHITECTURE` §7.3 e os critérios de aceite. Nenhum
finding bloqueante permaneceu.

**Findings reparados em DASHBOARD-11:**

1. colisão entre o método da rota e a dependência injetada no controller,
   corrigida renomeando a propriedade para `dashboardQuery`;
2. ausência de asserção de somente leitura no E2E, adicionada comparando
   `Quote`, `Customer` e a contagem de histórico antes e depois da requisição;
3. ausência de teste explícito dos limites estritos de 1 ms em torno de `now`
   para “atrasadas” e “próximas”, adicionado à suíte de integração;
4. divergência entre D246 e a implementação de DASHBOARD-05, registrada em
   nota na própria decisão.

**Fora do escopo:** nenhuma alteração de schema, migration, índice ou
dependência; nenhuma tabela, view, cache ou job; frontend não iniciado. A
pendência visual do PNG da logo (D150) continua pertencendo à Fase 8.
