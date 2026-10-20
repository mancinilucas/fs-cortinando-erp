# 04 — Revisão semântica da implementação do módulo Orçamento

**Status:** ORCAMENTO-45 concluída em 2026-10-20; achados encaminhados para reparo na ORCAMENTO-46.
**Task de origem:** `docs/development/04-orcamentos.md` → ORCAMENTO-45
**Fontes de verdade:** `docs/PROJECT_SPEC.md` (§2–§12), `docs/ARCHITECTURE.md` (§2–§15, §22), `docs/development/04-orcamentos.md` (D76–D124), `docs/IMPLEMENTATION_PLAN.md`, `AGENTS.MD` e `CLAUDE.md`
**Escopo:** revisão em leitura. Nenhum código, schema, migration, endpoint, repository ou teste foi criado ou alterado. As correções pertencem à ORCAMENTO-46.

---

## 1. Verificação executada

| Comando | Resultado |
|---|---|
| `pnpm build` | ✅ exit 0 |
| `pnpm lint` | ✅ exit 0 |
| `pnpm test` | ✅ 71 arquivos / 871 testes |
| `pnpm test:e2e` | ✅ 5 arquivos / 31 testes |
| `pnpm exec prisma validate` | ✅ schema válido |
| `pnpm exec prisma migrate status` | ✅ banco atualizado, sem migrations pendentes |
| `git status --short` | ✅ árvore limpa antes da revisão |

Verificações pontuais de escopo:

- `grep` por imports de NestJS, Prisma ou `generated/prisma` em `backend/src/modules/orcamentos/domain` → nenhuma ocorrência.
- `grep` por Prisma em `backend/src/modules/orcamentos/application` (código de produção) → nenhuma ocorrência; apenas specs importam a implementação de infraestrutura (observação O1).
- `grep` por `UnitOfWork`/`GenericRepository` → nenhuma ocorrência.
- `grep` por PDF/ordem de produção → apenas o enum de histórico e o comentário de que pertencem à Fase 8; nenhum fluxo implementado.
- `onDelete` no schema → `Restrict` de `Quote.customer`; `Cascade` apenas para `Quote → Curtain`, `Curtain → FinancialComponent`, `Quote → GeneralAddOn` e `Quote → QuoteHistory`, conforme D110.

---

## 2. Checklists

### 2.1 Arquitetura

| Item | Resultado | Evidência |
|---|---|---|
| `Quote` é o único Aggregate Root do módulo | ✅ | `domain/entities/quote.ts`; `domain/repositories/quote.repository.ts` é o único port de persistência do aggregate. |
| `Customer` permanece externo | ✅ | `application/ports/customer-eligibility.port.ts`, implementado por `PrismaCustomerEligibility`; o módulo não importa o módulo Clientes nem um repositório de cliente. |
| `Curtain` não possui repository | ✅ | Entity interna, sem port próprio; persistida por `PrismaQuoteRepository`. |
| `FinancialItem` não possui repository | ✅ | Entity interna compartilhada por componentes e adicionais; sem port próprio. |
| Histórico não está dentro do aggregate | ✅ | `Quote` não carrega eventos; escrita via parâmetro `event` do repository e leitura por `QuoteHistoryQueryRepository`. |
| Prisma apenas em infrastructure | ✅ | Nenhum import de Prisma em `domain/` ou `application/` de produção. |
| Nenhum repositório genérico | ✅ | Apenas ports específicos (`QuoteRepository`, `QuoteSearchQueryRepository`, `QuoteHistoryQueryRepository`). |
| Nenhum Unit of Work genérico | ✅ | Transação concentrada no repository (`create`/`save`); o helper é específico do módulo. |
| Controllers finos | ✅ | `OrcamentosController` apenas vincula rotas/DTOs, delega e mapeia erros; nenhuma regra de negócio. |
| Nenhum PDF/ordem de produção antecipado | ✅ | Não há use case, rota, entidade ou evento emitido; os dois tipos existem apenas no enum para a Fase 8. |

### 2.2 Persistência

| Item | Resultado | Evidência |
|---|---|---|
| Derivados não persistidos | ✅ | `finalWidth`, `fabricQuantity` e `totalCents` são getters; o schema não possui colunas correspondentes. |
| `EXPIRED` não persistido | ✅ | Status persistidos são os seis de D96; `expired` é derivado em `Quote.isExpired` e na query (`valid_until < now`). |
| Totais não persistidos | ✅ | Nenhuma coluna de total no model `Quote`; detalhe recalcula, lista calcula em SQL. |
| `sequence` única | ✅ | `@@unique([quoteId, sequence])` no model `Curtain`; normalização `1..N` no aggregate. |
| `quoteNumber` único | ✅ | `@unique` em `Quote.quoteNumber`; sequência reservada atomicamente em `quote_sequence`. |
| Transações corretas na escrita | ⚠️ | `create` e `save` agrupam persistência + histórico em `$transaction`, mas a leitura/validação do aggregate ocorre fora da transação (achado A2). |
| Cascade somente onde previsto | ✅ | Apenas as relações internas do aggregate e o histórico usam `Cascade`; cliente usa `Restrict`. |
| FK `Customer` `Restrict` preservada | ✅ | `schema.prisma:126`. |

### 2.3 Financeiro

| Item | Resultado | Evidência |
|---|---|---|
| Centavos inteiros | ✅ | `Money` aceita apenas inteiros; DTOs usam `@IsInt` para `*Cents`. |
| `HALF_UP` | ✅ | `divideHalfUp` em `domain/value-objects/money.ts`; `ROUND` numérico no SQL da lista. |
| Aritmética exata | ✅ | Somas/descontos em `BigInt`; medidas e quantidades em inteiros escalados (`measurements.ts`). |
| Fabric quantity sem arredondamento de negócio | ✅ | `finalWidthMilli × fabricFactorMilli` inteiro, convertido para micro sem arredondar. |
| Desconto antes do ajuste | ✅ | `calculatedTotalCents = subtotal − desconto`; `totalCents = calculado + ajuste`. |
| Nenhum `Float` crítico | ✅ | Nenhum cálculo monetário usa ponto flutuante binário; percentual é convertido para centésimos inteiros. |
| Totais fora de `Int32` são rejeitados | ⚠️ | `Money` lança `RangeError`, mas o erro não é convertido em rejeição de negócio e pode ocorrer depois da persistência (achado A3). |

### 2.4 Lifecycle (D96–D107)

| Regra | Resultado | Evidência |
|---|---|---|
| `markAsSent` apenas de `DRAFT`, com gate D97 | ✅ | `Quote.markAsSent` + `validateForSend`; cliente ativo verificado no use case. |
| Validade padrão `+30 dias` e validade enviada estritamente futura | ✅ | `DEFAULT_VALIDITY_MILLISECONDS`; violação `VALID_UNTIL_NOT_FUTURE`. |
| `confirm` apenas `SENT` e não expirado | ✅ | `now > validUntil` → `InvalidQuoteTransitionError` (409); `validUntil` nulo também bloqueia. |
| `reopen` apenas `CONFIRMED`, limpando confirmação e instalação | ✅ | `reopen()` retorna os valores anteriores; `firstSentAt`/`validUntil` preservados. |
| `renew` apenas `SENT`, válido ou expirado, com nova validade futura | ✅ | `renew()` valida `validUntil > now`; status e `firstSentAt` preservados. |
| `cancel` em `DRAFT`, `SENT`, `CONFIRMED`; proibido depois | ✅ | `assertStatus(DRAFT, SENT, CONFIRMED)`; motivo opcional com trim e limite de 500. |
| `startProduction` apenas `CONFIRMED` | ✅ | Sem gate redundante; grava `productionStartedAt`. |
| `complete` apenas `IN_PRODUCTION`; bloqueado com instalação futura | ✅ | `scheduledInstallationAt > now` → conflito; não exige instalação. |
| Instalação apenas em `CONFIRMED`/`IN_PRODUCTION` | ✅ | `setScheduledInstallation`/`removeScheduledInstallation`. |
| Eventos de instalação corretos | ✅ | `SCHEDULED`/`CHANGED`/`UNCHANGED`; valor idêntico não grava evento; remoção de ausência é no-op. |
| `EXPIRED` e instalação atrasada derivados | ✅ | `isExpired`/`isLateInstallation`; não persistidos. |
| Terminais imutáveis | ✅ | `COMPLETED` e `CANCELLED` não aceitam PATCH, transições ou exclusão. |
| Edição permitida apenas em `DRAFT`/`SENT` | ✅ | `applyPatch` bloqueia os demais status com `QuoteNotEditableError` (409). |
| Regras de completude em edição fora de `DRAFT` | ⚠️ | D87/D95 exigem itens e endereço completos em qualquer salvamento fora de `DRAFT`; `applyPatch` não as aplica (achado A1). |

### 2.5 D117 — atualização parcial

| Item procurado | Resultado | Evidência |
|---|---|---|
| Campo omitido limpo por engano | ✅ | `QuoteRequestMapper.toUpdateInput` só copia campos `!== undefined`; `updateEditableData`/`applyPatch` idem. |
| Coleção omitida alterada | ✅ | `applyPatch` só reconcilia `curtains`/`generalAddOns` quando enviados; `components` só quando enviado. |
| Perda de UUID | ✅ | `reconcileFinancialItems` e `reconcileCurtains` preservam ids existentes; novos itens recebem UUID. |
| Filhos duplicados | ✅ | `assertPatchReconcilable` e `assertFinancialItemPatchesReconcilable` rejeitam ids repetidos. |
| Child de outro aggregate aceito | ✅ | Ids desconhecidos são rejeitados antes de qualquer mutação; E2E cobre cortina/componente estrangeiros com `422`. |
| `sequence` inconsistente | ✅ | `reconcileCurtains` normaliza `1..N` conforme a ordem enviada; `sequence` não é aceito no DTO. |
| Operação atômica e no máximo um `QUOTE_EDITED` | ✅ | Um único `save` após o diff; patch sem mudança efetiva não grava evento. |
| Coleção enviada representa o estado completo | ✅ | Itens ausentes do array são removidos; E2E de reconciliação cobre remoção/criação/atualização. |

### 2.6 Histórico

| Item | Resultado | Evidência |
|---|---|---|
| Exatamente um evento por operação | ✅ | Cada use case grava um único `save(quote, event)`; no-ops não gravam. |
| Edição agrupada | ✅ | `UpdateQuoteUseCase` captura o estado, aplica o patch e grava um único `QUOTE_EDITED` com o diff. |
| Atomicidade estado + histórico | ⚠️ | A gravação é atômica dentro de `save`, mas a validação não ocorre na mesma transação (achado A2). |
| `details` conforme D109 | ✅ | `QuoteHistoryDetails` implementa todos os formatos; `QUOTE_SENT` registra validade aplicada e `firstSend: true`. |
| Ordenação `occurredAt ASC, id ASC` | ✅ | `PrismaQuoteHistoryQueryRepository.listByQuoteId`. |
| Nenhum evento de PDF/ordem de produção | ✅ | Apenas os 12 eventos de negócio são emitidos nesta fase. |
| Histórico não carregado pelo aggregate | ✅ | `findById` não inclui `history`; leitura separada. |

---

## 3. Achados

### A1 — Alta — Edição de orçamento `SENT` ignora as regras de completude fora de `DRAFT`

**Descrição.** `Quote.applyPatch` aceita patches em `DRAFT` e `SENT` e valida apenas a reconciliabilidade dos ids (`backend/src/modules/orcamentos/domain/entities/quote.ts:199-223`). Não há verificação de que o endereço permaneça completo nem de que todos os componentes e adicionais permaneçam completos depois da edição. `Quote.confirm` também não reexecuta o gate de envio: valida apenas status e validade (`quote.ts:376-392`).

As decisões aplicáveis são explícitas:

- D87 (`docs/development/04-orcamentos.md:295`): “Em status não rascunho, qualquer edição só é aceita com todos os itens completos.”
- D95 (`docs/development/04-orcamentos.md:426`): “Em qualquer salvamento fora de `DRAFT`, o endereço precisa estar completo.”

**Evidência.**

- `Quote.applyPatch` (`quote.ts:199-223`) só chama `assertPatchReconcilable`, `updateEditableData`, `reconcileCurtains` e `reconcileFinancialItems`.
- Nenhuma chamada a `validateForSend` ou verificação equivalente em `applyPatch`; `confirm` (`quote.ts:376-392`) não verifica endereço, cortinas ou itens.
- `UpdateQuoteUseCase` aplica o patch e persiste sem checagem adicional (`backend/src/modules/orcamentos/application/use-cases/update-quote.use-case.ts:44-63`).
- O E2E de PATCH cobre apenas `DRAFT`; não existe caso de PATCH em `SENT` com dados incompletos.

**Cenário que reproduz.** `POST /orcamentos/:id/enviar` em um orçamento completo → `SENT`. Em seguida, `PATCH` com `installationAddress: null` (ou com `curtains: []`, ou criando um componente sem `quantity`/`unitPriceCents`). O patch retorna `200`; `POST /confirmar` retorna `200` e o orçamento passa a `CONFIRMED` sem endereço, sem cortinas ou com itens incompletos, contrariando o gate que seria aplicado no envio.

**Impacto.** O orçamento confirmado pode ficar sem endereço de instalação ou sem composição financeira completa. Além da inconsistência de negócio, a violação não fica registrada como erro; o histórico registra a edição e a confirmação como operações válidas. O defeito também abre uma via para contornar o gate de envio usando um PATCH depois do envio.

**Reparo recomendado.** Em `Quote.applyPatch`, após calcular o estado resultante e antes de retornar, quando `this.status !== DRAFT`, reutilizar as verificações de D97 (exceto a existência do cliente, que é responsabilidade da Application): endereço presente e `isComplete()`; ao menos uma cortina; por cortina, `room`, `openingWidth > 0`, `height > 0`, `borderValue >= 0`, `fabricFactor > 0`, `material` e ao menos um componente completo; todos os componentes e adicionais presentes completos; desconto aplicável e total válido. Em caso de violação, lançar `QuoteValidationError` (HTTP `422` via D118), sem persistir nem gravar `QUOTE_EDITED`. Um patch apenas de `notes`/`discount` em orçamento `SENT` completo deve continuar funcionando. Adicionar testes unitários de `applyPatch` em `SENT` (endereço limpo, coleção de cortinas esvaziada, componente incompleto criado, componentes removidos de uma cortina) e E2E de `PATCH` em `SENT` retornando `422` com o estado persistido inalterado.

**Arquivos envolvidos.**

- `backend/src/modules/orcamentos/domain/entities/quote.ts`
- `backend/src/modules/orcamentos/domain/entities/quote-patch.spec.ts`
- `backend/src/modules/orcamentos/application/use-cases/update-quote.use-case.spec.ts`
- `backend/test/orcamentos-alternate-lifecycle.e2e-spec.ts`

---

### A2 — Alta — Transições não revalidam o estado dentro da transação (D119/D120)

**Descrição.** Todos os use cases de mutação carregam o aggregate fora de qualquer transação, aplicam o comportamento de domínio e só então chamam `save`. O `save` abre a transação apenas para escrever: faz `tx.quote.update({ where: { id } })` incondicional, reconcilia filhos e insere o histórico (`backend/src/modules/orcamentos/infrastructure/persistence/prisma-quote.repository.ts:82-96`). Não há leitura, comparação de status nem atualização condicional dentro da transação.

**Evidência.**

- `findById` seguido de `save`: `confirm-quote.use-case.ts:24-32`, `mark-quote-as-sent.use-case.ts:30-53`, `reopen-quote.use-case.ts:21-29`, `renew-quote.use-case.ts:26-34`, `cancel-quote.use-case.ts:22-30`, `start-production.use-case.ts:24-32`, `complete-service.use-case.ts:23-31`, `schedule-installation.use-case.ts:22-52`, `remove-installation.use-case.ts:21-33`.
- `save` sem guarda de status/versão: `prisma-quote.repository.ts:82-96`.
- A única operação com revalidação concorrente é a exclusão de rascunho: `deleteMany({ where: { id, status: 'DRAFT' } })` e re-leitura após `false` (`prisma-quote.repository.ts:211-217`; `delete-draft-quote.use-case.ts:20-44`).
- D119 (`docs/development/04-orcamentos.md:987`): “Mutações: leitura do aggregate + validação + persistência + evento de histórico na mesma transação.”
- D120 (`docs/development/04-orcamentos.md:1004`): “Ações revalidam o estado atual dentro da transação; uma segunda ação concorrente sobre estado já alterado recebe `404` ou `409`.”

**Cenário que reproduz.**

1. Duas requisições `POST /orcamentos/:id/confirmar` simultâneas: ambas leem o mesmo aggregate `SENT`, ambas chamam `confirm()` e ambas executam `save`, gerando dois eventos `QUOTE_CONFIRMED` e duas respostas `200`. O mesmo ocorre com `iniciar-producao`, `concluir`, `reabrir`, `renovar`, `cancelar` e `enviar`.
2. `DELETE /orcamentos/:id` (rascunho) concorrente com `enviar`: uma operação vence; a outra pode receber `500`, porque `tx.quote.update` lança `P2025` (registro inexistente) e `mapQuoteError` não mapeia esse erro (`presentation/quote-error-mapper.ts:20-50`).
3. Criação concorrente com soft delete do cliente: `existsAndIsActive` roda fora da transação de criação; o orçamento pode ser criado para um cliente removido logicamente no intervalo.

**Impacto.** O histórico pode conter eventos duplicados ou fora de ordem de estado (dois `QUOTE_CONFIRMED`, duas conclusões) e o cliente recebe sucesso para uma operação que não deveria mais ser válida. Em corrida com exclusão, o erro vira `500` em vez de `404`/`409`, contrariando a taxonomia de D118 e a regra explícita de D120. A ausência de guarda também permite que uma ação baseada em estado obsoleto sobrescreva uma transição já persistida (por exemplo, `confirmar` depois de um `cancelar` concorrente), pois o `update` grava o status do objeto carregado antes da corrida.

**Reparo recomendado.** Introduzir um método transacional estreito no `QuoteRepository` (permitido por D119), por exemplo `mutate(id, operation)` ou `saveTransition(id, expectedStatuses, operation)`, que: abra `$transaction`; carregue o aggregate completo com o client da transação; entregue o aggregate ao callback da Application para executar a validação/comportamento de domínio; persista o aggregate, os filhos e o único evento na mesma transação; e use uma atualização condicional (por exemplo `updateMany` com `id` e status esperado) ou re-leia e compare o status antes de gravar. Resultado `null`/contagem zero deve ser traduzido para `QuoteNotFoundError` (404) ou `InvalidQuoteTransitionError` (409), nunca `500`. O PATCH pode permanecer em `save` com last-write-wins, conforme D120 aceita para edições, mas as transições precisam da revalidação. Mapear `P2025` remanescente para 404 como defesa adicional. Adicionar teste de integração com chamadas concorrentes (duas confirmações; exclusão contra transição) comprovando um vencedor, um `404`/`409` e exatamente um evento no histórico.

**Arquivos envolvidos.**

- `backend/src/modules/orcamentos/domain/repositories/quote.repository.ts`
- `backend/src/modules/orcamentos/infrastructure/persistence/prisma-quote.repository.ts`
- `backend/src/modules/orcamentos/application/use-cases/*.ts` (transições)
- `backend/src/modules/orcamentos/infrastructure/persistence/prisma-quote.repository.transaction.integration.spec.ts`
- `backend/src/modules/orcamentos/presentation/quote-error-mapper.ts`

---

### A3 — Média — Totais derivados fora de `Int32` geram `RangeError` não mapeado, podendo persistir e responder `500`

**Descrição.** D86 exige que os totais calculados caibam em `Int` de 32 bits e que valores fora da faixa sejam rejeitados (`docs/development/04-orcamentos.md:281`). A implementação rejeita no nível de `Money`, mas lança `RangeError` genérico. O `RangeError` não é convertido em erro de domínio nem mapeado na Presentation; `mapQuoteError` o repassa e o Nest responde `500` (`presentation/quote-error-mapper.ts:20-50`). Como os DTOs permitem `quantity` até `999999.999999` e `unitPriceCents` até `2147483647`, o produto pode exceder `Int32` já na criação ou no cálculo do subtotal.

**Evidência.**

- `Money.add`/`subtract` usam `checkedNumber` → `assertRange`, que lança `RangeError` quando o resultado sai de `Int32` (`domain/value-objects/money.ts:25-41, 85-96`).
- O total por item usa `calculateItemTotalCents` → `checkedNumber` (`money.ts:55-64`; `domain/entities/financial-item.ts:100-109`).
- Os subtotais do aggregate usam `Money.add`/`fromCents` (`quote.ts:636-676`).
- O detalhe calcula todos os totais antes de responder (`application/queries/get-quote.query.ts:67-75`).
- O controller persiste a criação/edição e só depois relê o detalhe (`presentation/orcamentos.controller.ts:81-85, 127-129`), de modo que o `RangeError` acontece **depois** do commit.
- `mapQuoteError` só traduz `QuoteNotFoundError`, `QuoteCustomerNotFoundError`, `InvalidQuoteTransitionError`, `QuoteNotEditableError`, `QuoteValidationError` e `UnknownQuoteItemError`; `RangeError` cai no `throw error` final (`quote-error-mapper.ts:20-50`).

**Cenário que reproduz.** `POST /clientes/:id/orcamentos` com um componente de `quantity: 999999.999999` e `unitPriceCents: 2147483647` responde `500`, embora o orçamento já tenha sido persistido (o total do item excede `Int32`); um `GET` posterior no mesmo orçamento também retorna `500`. Alternativamente, dois componentes válidos isoladamente cujo subtotal excede `Int32` fazem o `POST`/`PATCH` persistirem e a resposta de detalhe falhar. No envio, o `RangeError` também escapa como `500`.

**Impacto.** A API aceita e persiste um estado que não consegue ler. Uma criação que responde `500` pode ser repetida pelo cliente, gerando orçamentos duplicados com números distintos; um `PATCH` pode ser aplicado e reportado como falha. O comportamento contradiz D86 e a taxonomia de D118 (`422` para dado de negócio inválido).

**Reparo recomendado.** Tornar a faixa de `Int32` uma regra de negócio explícita antes da persistência: validar o total de cada item completo e os subtotais/total do aggregate durante `Quote.create`, `applyPatch` e `validateForSend`, acumulando violações em `QuoteValidationError` (por exemplo, `TOTAL_OUT_OF_RANGE`/`ITEM_TOTAL_OUT_OF_RANGE`) em vez de deixar o `RangeError` escapar. Alternativamente, capturar os `RangeError` específicos das funções de dinheiro/medida e convertê-los em `QuoteValidationError` no ponto de uso; não mapear todo `RangeError` genérico na Presentation, para não mascarar erros de programação. Garantir que a validação ocorra **antes** do `save` (e não apenas na releitura). Adicionar testes unitários e de integração/E2E: criação com total de item fora da faixa → `422` e nenhuma linha persistida; PATCH que produz subtotal fora da faixa → `422` e estado inalterado; `enviar` com total fora da faixa → `422`.

**Arquivos envolvidos.**

- `backend/src/modules/orcamentos/domain/entities/quote.ts`
- `backend/src/modules/orcamentos/domain/entities/financial-item.ts`
- `backend/src/modules/orcamentos/domain/value-objects/money.ts`
- `backend/src/modules/orcamentos/application/use-cases/create-quote-from-customer.use-case.ts`
- `backend/src/modules/orcamentos/application/use-cases/update-quote.use-case.ts`
- `backend/src/modules/orcamentos/application/use-cases/mark-quote-as-sent.use-case.ts`
- testes unitários/E2E correspondentes

---

## 4. Observações sem reparo necessário

1. **Specs da Application importam a implementação Prisma.** `confirm-quote.use-case.spec.ts` e `mark-quote-as-sent.use-case.spec.ts` estendem `PrismaQuoteRepository` para simular falha na gravação do histórico. O código de produção respeita a fronteira; a dependência existe apenas em teste. Após a ORCAMENTO-46, os testes substituem `mutate` em vez de `save`, acompanhando o novo ponto transacional.

2. **Leitura do histórico em duas instruções.** `PrismaQuoteHistoryQueryRepository.listByQuoteId` verifica a existência do orçamento e depois lista os eventos. Uma exclusão de rascunho concorrente entre as duas consultas pode produzir `200 []` em vez de `404`. D119 determina que consultas não abrem transação, então o comportamento é aceitável; se a ORCAMENTO-46 alterar a exclusão, vale reavaliar.

3. **Remoção de instalação ausente.** `DELETE /orcamentos/:id/instalacao` em `CONFIRMED`/`IN_PRODUCTION` sem data responde `204` sem evento. D104 define apenas valor → ausência; tratar ausência → ausência como no-op é coerente com a regra de no-op da mesma decisão. Nenhuma regra de negócio foi inventada.

---

## 5. Conclusão

A implementação está alinhada com as fronteiras arquiteturais, a modelagem de persistência, a aritmética financeira, a máquina de estados D96–D107, a semântica de atualização D117 e o contrato de histórico D108/D109. As suítes unitárias, de integração e E2E passam, o schema é válido e o banco está atualizado.

Há dois achados de severidade **alta** que precisam de reparo antes do fechamento da fase:

- **A1**: edições em `SENT` não respeitam as regras de completude de D87/D95 e podem ser confirmadas em estado inválido.
- **A2**: as transições não revalidam o estado dentro da transação, contrariando D119/D120 e permitindo eventos duplicados e respostas `500` em corridas.

O achado **A3** (média) deve ser corrigido na ORCAMENTO-46 porque a entrada é aceita pelo contrato atual e o resultado é um estado persistido e ilegível; se não for corrigido, precisa de justificativa explícita e registro de risco.

Nenhum código foi alterado nesta task. A correção e a re-verificação pertencem à ORCAMENTO-46.

---

## 6. Resultado do reparo (ORCAMENTO-46)

Status em 2026-10-20: A1, A2 e A3 corrigidos; observações 2 e 3 permanecem sem alteração.

### A1 — Corrigido

- `Quote.applyPatch` reaplica o gate de envio (D87/D95, sem a checagem de cliente) quando o estado não é `DRAFT`; a edição de um orçamento `SENT` que deixaria endereço, cortina ou componente incompletos falha com `QuoteValidationError` (`422`). Rascunhos continuam aceitando itens incompletos e validam apenas a faixa monetária (D86).
- Testes: `domain/entities/quote-patch.spec.ts` (quatro casos de `SENT`) e `test/orcamentos-alternate-lifecycle.e2e-spec.ts` (endereço limpo e coleção vazia → `422`, estado e histórico inalterados).

### A2 — Corrigido

- `QuoteRepository.mutate(id, operation)` carrega o aggregate dentro da transação, executa o comportamento de domínio e persiste estado, filhos e único evento com `updateMany` condicionado ao status observado. Resultado zero é traduzido para `QuoteNotFoundError` (`404`) ou `InvalidQuoteTransitionError` (`409`), nunca `500`.
- Todos os use cases de transição e `UpdateQuoteUseCase` passaram a usar `mutate`; `DeleteDraftQuoteUseCase` manteve a exclusão condicional já existente.
- Testes: concorrência em `confirm-quote.use-case.spec.ts`, `mark-quote-as-sent.use-case.spec.ts` e `delete-draft-quote.use-case.spec.ts` (um vencedor, um conflito, um único evento) e contrato de `mutate` em `prisma-quote.repository.transaction.integration.spec.ts`.

### A3 — Corrigido

- `Quote.create`, `applyPatch` em `DRAFT` e `validateForSend` convertem o `RangeError` de faixa monetária em violação `TOTAL_OUT_OF_RANGE` de `QuoteValidationError`; a validação ocorre antes de qualquer `save`, de modo que nada é persistido quando o total não cabe em `Int32`.
- Testes: `quote-patch.spec.ts` (criação, total do item e subtotal) e `test/orcamentos.e2e-spec.ts` (criação → `422`, nenhuma linha persistida).

### Verificação final

- `pnpm build`: exit 0.
- `pnpm lint`: exit 0.
- `pnpm test`: 71 arquivos, 885 testes aprovados.
- `pnpm test:e2e`: 5 arquivos, 33 testes aprovados.
- `pnpm exec prisma validate`: exit 0.
- `pnpm exec prisma migrate status`: banco atualizado.

