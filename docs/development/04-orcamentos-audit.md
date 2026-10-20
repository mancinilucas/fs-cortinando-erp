# ORCAMENTO-01 — Auditoria do estado atual do módulo Orçamento

**Status:** concluída
**Data:** 2026-10-19
**Task de origem:** `ORCAMENTO-01 — Auditoria do estado atual`
**Documento irmão:** `docs/development/04-orcamentos.md` (ORCAMENTO-02)

Esta task é exclusivamente de auditoria. Nenhum código, schema, migration, endpoint, repository ou teste foi criado ou alterado. As decisões abertas estão consolidadas em `04-orcamentos.md`.

---

## 1. Objetivo e escopo

Verificar, antes de qualquer implementação do módulo Orçamento:

- o que já existe no schema Prisma e no banco;
- o que já existe no backend e no frontend;
- quais regras de `PROJECT_SPEC.md` e `ARCHITECTURE.md` já estão materializadas;
- quais lacunas, inconsistências e riscos precisam ser fechados em ORCAMENTO-02.

Ficam fora do escopo desta auditoria: implementação, alteração de schema, migrations, endpoints, testes e qualquer decisão de produto não sustentada pelas fontes.

---

## 2. Fontes consultadas

| Fonte | Uso nesta auditoria |
|---|---|
| `docs/PROJECT_SPEC.md` | comportamento do produto: orçamento, cortina, composição financeira, ciclo de vida, instalação, histórico, dashboard e edição |
| `docs/ARCHITECTURE.md` | fronteiras de aggregate, camadas, persistência, precisão, transações, numeração, API e erros |
| `docs/IMPLEMENTATION_PLAN.md` | fases 4 a 9 e sequência de implementação |
| `docs/development/01-prisma-foundation.md` | decisões aprovadas de modelagem |
| `docs/development/01-prisma-constraints.md` | D1–D25: nulabilidade, enums, constraints e ações referenciais |
| `docs/development/01-prisma-precision.md` | tipos e escalas de medidas, quantidades e dinheiro |
| `docs/development/01-prisma-indexes.md` | índices justificados por consulta concreta |
| `docs/development/02-auth.md` | D26–D45: sessão, guards, rate limiting e padrões de erro |
| `docs/development/03-clientes-audit.md` | modelo de estrutura para esta auditoria |
| `docs/development/03-clientes.md` | D46–D75: convenções de repository, use cases, DTOs, erros, transações, testes, concorrência e nomenclatura |
| `backend/prisma/schema.prisma` | modelo relacional vigente |
| `backend/prisma/migrations/` | materialização do schema no PostgreSQL |
| `backend/src/` | estrutura NestJS existente |
| `frontend/src/` | estado atual do frontend |

---

## 3. Verificações executadas

| # | Verificação | Comando | Resultado |
|---|---|---|---|
| 1 | Schema Prisma válido | `npx prisma validate` (em `backend/`) | `The schema at prisma/schema.prisma is valid 🚀` |
| 2 | Estado das migrations | `npx prisma migrate status` (em `backend/`) | 2 migrations encontradas; `Database schema is up to date!` |
| 3 | Árvore de trabalho limpa | `git status --short` | sem alterações |
| 4 | Módulos NestJS existentes | `find src/modules -maxdepth 1 -mindepth 1 -type d` | apenas `auth` e `clientes` |
| 5 | Código de Orçamento existente | busca por `orcamento`, `quote`, `curtain`, `financial component`, `general add on`, `quote sequence` em `src/` e `test/` | nenhum código de domínio, aplicação, presentation ou repository; apenas uso direto de `prisma.quote` em testes de integração de Clientes |
| 6 | Frontend | inspeção de `frontend/src` e busca por termos de orçamento | apenas boilerplate Vite/React; nenhuma feature de orçamento |
| 7 | Client Prisma gerado | `backend/src/generated/prisma/models/` | modelos `Quote`, `Curtain`, `FinancialComponent`, `GeneralAddOn`, `QuoteHistory` e `QuoteSequence` já gerados a partir do schema |

Conclusão das verificações: **o banco e o schema já suportam o núcleo do módulo Orçamento; o backend e o frontend ainda não possuem nenhuma implementação do módulo.**

---

## 4. Estado atual do código

### 4.1 Backend

- `AppModule` importa `ThrottlerModule`, `PrismaModule`, `AuthModule` e `ClientesModule`.
- Não existe `OrcamentosModule`, controller, use case, aggregate, VO, repository, mapper ou query de orçamento.
- Não existe módulo `dados-do-negocio` nem geração de PDF/ordem de produção.
- O padrão vigente em `clientes/` é a referência de organização:
  - `domain/` com aggregate, VOs, normalizadores e port de repository;
  - `application/` com um use case por operação e uma query de leitura;
  - `infrastructure/` com repository Prisma, mapper e query Prisma;
  - `presentation/` com controller fino, DTOs, response mapper e error mapper.
- `AuthGuard`, `CsrfOriginGuard` e `LoggingThrottlerGuard` já existem e estão prontos para reutilização.
- `ValidationPipe({ whitelist: true, transform: true })` está configurado globalmente em `main.ts`.
- `ClientesModule` importa `AuthModule` e `PrismaModule` e registra providers por token de classe abstrata; o mesmo padrão deve ser usado em Orçamentos.

### 4.2 Frontend

- `frontend/src` contém apenas `App.jsx`, `main.jsx`, CSS e assets do template Vite.
- Não há cliente HTTP, roteamento, tela de clientes ou qualquer tela de orçamento.
- O frontend não impõe contrato existente ao backend.

### 4.3 Testes existentes que tocam Orçamento

Apenas `src/modules/clientes/clientes.integration.spec.ts` cria `prisma.quote` diretamente para verificar:

- que orçamentos históricos permanecem após o soft delete do cliente;
- que a exclusão física do cliente é bloqueada por `onDelete: Restrict`.

Esses testes não exercitam regras de orçamento e não substituem a cobertura do módulo.

---

## 5. Schema e relações relevantes

Fonte: `backend/prisma/schema.prisma` e migration `20261018024309_init`.

### 5.1 Enums

| Enum | Valores | Observações |
|---|---|---|
| `QuoteStatus` | `DRAFT`, `SENT`, `CONFIRMED`, `IN_PRODUCTION`, `COMPLETED`, `CANCELLED` | exatamente os 6 status persistidos; não há `EXPIRED`; coluna sem default |
| `DiscountType` | `NO_DISCOUNT`, `PERCENTAGE`, `FIXED_AMOUNT` | default `NO_DISCOUNT` |
| `HistoryEventType` | 14 valores: `QUOTE_CREATED`, `QUOTE_SENT`, `QUOTE_EDITED`, `QUOTE_CONFIRMED`, `QUOTE_REOPENED`, `QUOTE_RENEWED`, `QUOTE_CANCELLED`, `PRODUCTION_STARTED`, `INSTALLATION_SCHEDULED`, `INSTALLATION_CHANGED`, `INSTALLATION_REMOVED`, `SERVICE_COMPLETED`, `COMMERCIAL_PDF_GENERATED`, `PRODUCTION_ORDER_GENERATED` | cobre todos os eventos de `PROJECT_SPEC` §11 |

### 5.2 `Quote` (`quotes`)

| Campo | Tipo | Nulo | Observação |
|---|---|---|---|
| `id` | `UUID` PK | não | default `uuid()` no banco |
| `quoteNumber` | `String` UNIQUE | não | formato comercial `ORÇ-AAAA-NNN` validado no domínio |
| `customerId` | `UUID` FK → `customers.id` | não | `onDelete: Restrict` |
| `status` | `QuoteStatus` | não | **sem default**; criação deve definir `DRAFT` explicitamente |
| `notes` | `String` | sim | observações internas |
| `discountType` | `DiscountType` | não | default `NO_DISCOUNT` |
| `discountPercentage` | `Decimal(5,2)` | sim | usado apenas em `PERCENTAGE` |
| `discountFixedAmountCents` | `Int` | sim | usado apenas em `FIXED_AMOUNT` |
| `commercialAdjustmentCents` | `Int` | sim | aceita valor positivo ou negativo; ausência equivale a zero |
| `installationAddressPostalCode` | `String` | sim | endereço de instalação — snapshot |
| `installationAddressStreet` | `String` | sim | idem |
| `installationAddressNumber` | `String` | sim | idem; textual |
| `installationAddressComplement` | `String` | sim | idem |
| `installationAddressNeighborhood` | `String` | sim | idem |
| `installationAddressCity` | `String` | sim | idem |
| `installationAddressState` | `Char(2)` | sim | UF |
| `createdAt` | `Timestamptz(3)` | não | default `now()` |
| `updatedAt` | `Timestamptz(3)` | não | gerenciado por `@updatedAt` |
| `firstSentAt` | `Timestamptz(3)` | sim | primeiro envio |
| `validUntil` | `Timestamptz(3)` | sim | validade comercial |
| `confirmedAt` | `Timestamptz(3)` | sim | confirmação corrente |
| `productionStartedAt` | `Timestamptz(3)` | sim | início de produção |
| `scheduledInstallationAt` | `Timestamptz(3)` | sim | instalação agendada |
| `completedAt` | `Timestamptz(3)` | sim | conclusão do serviço |

Relações: `customer`, `curtains`, `generalAddOns`, `history`.
Índices: `customerId`, `status`, `validUntil`, `scheduledInstallationAt`.
Ausências deliberadas no schema: `deletedAt`, `cancelledAt`, `cancellationReason`, `reopenedAt`, `renewedAt`, totais persistidos, `version`/lock otimista.

### 5.3 `Curtain` (`curtains`)

| Campo | Tipo | Nulo | Observação |
|---|---|---|---|
| `id` | `UUID` PK | não | identidade interna |
| `quoteId` | `UUID` FK → `quotes.id` | não | `onDelete: Cascade` |
| `sequence` | `Int` | não | posição/apresentação; `UNIQUE(quoteId, sequence)` |
| `room` | `String` | sim | ambiente |
| `description` | `String` | sim | diferencia cortinas do mesmo ambiente |
| `material` | `String` | sim | obrigatório apenas no gate de envio |
| `openingWidth` | `Decimal(9,3)` | sim | metros |
| `borderValue` | `Decimal(6,3)` | sim | metros; default funcional 0,15 |
| `height` | `Decimal(9,3)` | sim | metros |
| `fabricFactor` | `Decimal(6,3)` | sim | default funcional 3,5 |
| `notes` | `String` | sim | campo interno |

Não existem colunas `finalWidth` nem `fabricQuantity`; ambos são derivados.
Relação: `components FinancialComponent[]` com cascade.

### 5.4 `FinancialComponent` (`financial_components`)

| Campo | Tipo | Nulo | Observação |
|---|---|---|---|
| `id` | `UUID` PK | não | identidade interna |
| `curtainId` | `UUID` FK → `curtains.id` | não | `onDelete: Cascade` |
| `name` | `String` | não | nome do componente/preset |
| `quantity` | `Decimal(12,6)` | sim | quantidade |
| `unit` | `String` | sim | unidade textual |
| `unitPriceCents` | `Int` | sim | valor unitário em centavos |

Índice: `curtainId`. Total do componente é derivado.

### 5.5 `GeneralAddOn` (`general_add_ons`)

Mesma estrutura de `FinancialComponent`, porém vinculada a `quoteId` (`onDelete: Cascade`), com índice em `quoteId`. Tabela separada por clareza referencial, apesar de compartilhar semântica de domínio.

### 5.6 `QuoteHistory` (`quote_history`)

| Campo | Tipo | Nulo | Observação |
|---|---|---|---|
| `id` | `UUID` PK | não | |
| `quoteId` | `UUID` FK → `quotes.id` | não | `onDelete: Cascade` |
| `eventType` | `HistoryEventType` | não | 14 eventos |
| `occurredAt` | `Timestamptz(3)` | não | default `now()` |
| `details` | `Json` | sim | valor anterior/novo e motivo de cancelamento |

Índice: `(quoteId, occurredAt)`. O histórico não é carregado junto do aggregate.

### 5.7 `QuoteSequence` (`quote_sequence`)

| Campo | Tipo | Observação |
|---|---|---|
| `year` | `Int` PK | ano comercial |
| `lastNumber` | `Int` default `0` | último número reservado no ano |

Não há FK para `quotes`; lacunas são permitidas e números não são reutilizados.

---

## 6. Fronteiras de aggregate

O que as fontes já determinam:

- `Quote` é Aggregate Root independente.
- `Customer` é Aggregate Root separado; o orçamento referencia apenas `customerId`, sem carregar nem alterar o cliente.
- `Curtain` é **Entity interna** de `Quote`, com identidade própria e sem repository.
- `ItemFinanceiro` (componentes de cortina e adicionais gerais) é **Entity interna** de `Quote`, sem repository.
- `Money`, `NumeroOrcamento`, `EnderecoInstalacao` e `Desconto` são Value Objects do módulo.
- O histórico é persistido separadamente, associado por `quoteId`, e não faz parte da coleção carregada com o aggregate.
- Não existe entidade `ServicoRealizado`; o histórico de serviços do cliente é derivado dos próprios orçamentos.
- Não existe `Ambiente`, `TipoTrilho`, catálogo de tecidos, ordem de produção persistida ou Aggregate Root de produção.

O schema atual sustenta essa fronteira: filhos em tabelas próprias com `onDelete: Cascade`, cliente com `Restrict` e histórico em tabela separada.

---

## 7. Ciclo de vida e status

### 7.1 Status persistidos

`DRAFT`, `SENT`, `CONFIRMED`, `IN_PRODUCTION`, `COMPLETED`, `CANCELLED`.

`EXPIRED` não é persistido: é condição derivada de `status == SENT && now > validUntil`.

`Instalação atrasada` também é condição derivada: `scheduledInstallationAt < now && status in (CONFIRMED, IN_PRODUCTION)`.

### 7.2 Transições previstas pelas fontes

| Origem | Ação | Destino | Observações |
|---|---|---|---|
| `DRAFT` | marcar como enviado | `SENT` | exige gate completo; primeiro envio grava `firstSentAt` e sugere `validUntil` |
| `DRAFT` | cancelar | `CANCELLED` | motivo opcional |
| `SENT` | confirmar | `CONFIRMED` | bloqueado se expirado |
| `SENT` | renovar | `SENT` | nova `validUntil`; mesmo status |
| `SENT` | cancelar | `CANCELLED` | |
| `CONFIRMED` | reabrir | `SENT` | mantém número e validade; não renova |
| `CONFIRMED` | iniciar produção | `IN_PRODUCTION` | sem gate redundante |
| `CONFIRMED` | cancelar | `CANCELLED` | |
| `IN_PRODUCTION` | concluir serviço | `COMPLETED` | bloqueado se houver instalação futura |
| `COMPLETED` | — | terminal | imutável |
| `CANCELLED` | — | terminal | imutável |

### 7.3 Datas persistidas

`createdAt`, `firstSentAt`, `validUntil`, `confirmedAt`, `productionStartedAt`, `scheduledInstallationAt`, `completedAt`.

Reabertura, renovação e cancelamento não possuem colunas próprias; ficam registrados no histórico. Isso é coerente com D1 e com `ARCHITECTURE.md` §4.4.

### 7.4 Lacunas de ciclo de vida

- Não há decisão sobre limpar ou preservar `confirmedAt` na reabertura.
- Não há decisão sobre o destino de `scheduledInstallationAt` na reabertura para `SENT`, status em que o agendamento não é gerenciável.
- Não há decisão explícita sobre exigir cliente ativo/vinculado no gate de envio quando o cliente foi removido logicamente após a criação do rascunho.
- Não há decisão explícita sobre validade informada no primeiro envio poder estar no passado.
- Não há decisão sobre renovar um orçamento `SENT` ainda válido (as fontes permitem, mas não detalham).

---

## 8. Cálculos e precisões

### 8.1 Medidas e quantidade de tecido

```text
finalWidth      = openingWidth + (2 × borderValue)
fabricQuantity  = finalWidth × fabricFactor
```

- Entradas em metros com até 3 casas decimais.
- `finalWidth` e `fabricQuantity` não são persistidos.
- Não há arredondamento de negócio para metragem; o resultado matemático é usado diretamente.
- `fabricQuantity` pode chegar a 6 casas decimais.
- A altura não participa do cálculo da quantidade de tecido.

### 8.2 Dinheiro

- Persistido em centavos inteiros (`Int`).
- `Money` no domínio é conceitualmente baseado em centavos.
- Arredondamento monetário: `HALF_UP` para centavos.
- Total do item = quantidade × valor unitário, arredondado para centavos.
- Valor monetário do desconto percentual = arredondado para centavos.
- Ajuste comercial é aplicado depois do desconto.

### 8.3 Composição

```text
curtainTotal        = Σ componentes da cortina
curtainSubtotal     = Σ totais das cortinas
addOnsTotal         = Σ adicionais gerais
subtotal            = curtainSubtotal + addOnsTotal
discountValue       = percentual ou valor fixo
calculatedTotal     = subtotal - discountValue
total               = calculatedTotal + commercialAdjustment
```

`total > 0` é exigido no envio. Nenhum total é persistido.

### 8.4 Desconto

- Um único desconto global.
- `PERCENTAGE`: `0 < percentual <= 100`, `Decimal(5,2)`.
- `FIXED_AMOUNT`: `0 < valor <= subtotal` no envio.
- `NO_DISCOUNT`: nenhum dos dois campos preenchido.
- Sem desconto por cortina.

### 8.5 Ajuste comercial

- Opcional.
- Pode ser positivo ou negativo.
- Não substitui o desconto.
- A interface pode receber o total final desejado e derivar o ajuste; o contrato interno do backend ainda precisa ser decidido.

---

## 9. Histórico

- Tabela separada `quote_history`, com 14 tipos de evento.
- `details` é `Json` livre, sem schema versionado.
- Índice `(quoteId, occurredAt)` para leitura cronológica.
- Não é event sourcing e não reconstrói o estado atual.
- Deve ser gravado na mesma transação da mudança relevante.
- Uma edição salva deve gerar **um único** `QUOTE_EDITED` agrupando as mudanças.
- Eventos de PDF e ordem de produção existem no enum, mas a geração de documentos pertence à Fase 8.
- O formato dos `details` (valor anterior/novo, identificação de cortina, motivo de cancelamento) ainda não está especificado.

---

## 10. Numeração

- Formato: `ORÇ-AAAA-NNN` (exemplo `ORÇ-2026-001`).
- Sequência anual, reiniciando a cada ano.
- Número nunca reutilizado; lacunas aceitáveis; excluir rascunho não devolve o número.
- `quoteNumber` tem `UNIQUE` no banco.
- `QuoteSequence(year PK, lastNumber)` já existe.
- A reserva atômica do contador **não está implementada**.
- `NumeroOrcamento` não existe.
- Não há definição de fuso horário para determinar o ano comercial.
- Não há definição de comportamento acima de `999` no ano.

---

## 11. Lacunas

| ID | Lacuna | Impacto |
|---|---|---|
| G1 | módulo `orcamentos/` inexistente | toda a implementação está pendente |
| G2 | aggregate `Quote`, entidades e VOs inexistentes | regras de negócio não estão materializadas |
| G3 | numerador anual não implementado | criação real depende disso |
| G4 | nenhum use case, repository, mapper ou query | nenhum fluxo funcional |
| G5 | nenhum endpoint de orçamento | API ausente |
| G6 | nenhuma projeção/consulta de orçamento | listas, busca e histórico ausentes |
| G7 | semântica de atualização de cortinas/componentes não definida | risco de perda de identidade e duplicação |
| G8 | contrato de `details` do histórico não definido | histórico inconsistente entre operações |
| G9 | estratégia concreta de transação não definida | risco de número sem orçamento ou estado sem histórico |
| G10 | fuso do ano comercial não definido | número pode mudar de ano no limite |
| G11 | padding acima de 999 não definido | formato indefinido em alto volume |
| G12 | regra de cliente ativo no envio não explícita | rascunho de cliente removido pode ser enviado |
| G13 | tratamento de `confirmedAt` na reabertura não definido | data de confirmação potencialmente obsoleta |
| G14 | destino de `scheduledInstallationAt` na reabertura não definido | instalação inacessível em `SENT` |
| G15 | nenhum teste de orçamento | regras críticas sem cobertura |
| G16 | nenhuma implementação de frontend | fluxo de UI pendente |
| G17 | `IMPLEMENTATION_PLAN.md` prevê specs `04-orcamento-domain.md` a `09-queries-dashboard.md`; esta task consolida tudo em `04-orcamentos.md` | divergência documental a resolver antes da decomposição |

---

## 12. Inconsistências e ambiguidades

| ID | Ponto | Situação |
|---|---|---|
| I1 | nome da data de instalação | `PROJECT_SPEC` usa `dataInstalacaoAgendada`; o schema usa `scheduledInstallationAt`. É mapeamento de nomenclatura, não divergência funcional (D15/D73). |
| I2 | `Quote.status` sem default | intencional: criação deve definir `DRAFT` explicitamente; default de banco mascararia transição (D3). |
| I3 | `Curtain.material` nullable | intencional: rascunho pode estar incompleto; o gate de envio exige material. |
| I4 | `FinancialComponent.unit` nullable | a unidade é conceitual, mas o gate de envio de `PROJECT_SPEC` §8.5 não a exige. Precisa de decisão explícita. |
| I5 | endereço parcial | o schema permite qualquer subconjunto de campos; `PROJECT_SPEC` só exige endereço completo no envio. O domínio precisa representar esse estado intermediário. |
| I6 | `motivoCancelamento` | não há coluna; D1 determina que o motivo fica em `QuoteHistory.details`. Confirmar o formato. |
| I7 | `confirmedAt` após reabrir | as fontes não dizem se a data corrente é limpa ou preservada. |
| I8 | `scheduledInstallationAt` após reabrir | as fontes não dizem se o agendamento é preservado, removido ou bloqueado. |
| I9 | cliente removido logicamente | `PROJECT_SPEC` §8.5 exige "cliente vinculado", mas não diz se cliente removido impede novo envio. |
| I10 | validade no primeiro envio | as fontes dizem que a consultora pode alterar a data sugerida, mas não exigem que ela seja futura. |
| I11 | renovação em `SENT` válido | `PROJECT_SPEC` §8.6 permite renovar; §8.8 não restringe a expirados. |
| I12 | `EXPIRED` derivado versus filtros | o banco não guarda `EXPIRED`; consultas e dashboard precisam separar `ENVIADO` válido de expirado por comparação com `validUntil`. |
| I13 | totais não persistidos | consultas de lista precisam calcular totais ou omiti-los; a decisão de contrato de resposta está aberta. |
| I14 | nomenclatura documental | `IMPLEMENTATION_PLAN.md` referencia specs `04`–`09` separadas; a task atual pede um único `04-orcamentos.md`. |
| I15 | eventos de PDF/ordem de produção | o enum já os contém, mas a implementação pertence à Fase 8; o módulo de orçamento não deve emitir esses eventos nesta fase. |

Nenhuma inconsistência de produto foi resolvida silenciosamente nesta auditoria. Todas as que exigem escolha estão listadas em ORCAMENTO-02.

---

## 13. Riscos

| ID | Risco | Mitigação prevista |
|---|---|---|
| R1 | ano comercial incorreto no limite do ano | decidir fuso e fonte do relógio (D81) |
| R2 | número reservado sem orçamento criado | lacuna é aceitável pelas regras; decidir se reserva e criação são atômicas (D79/D115) |
| R3 | edições concorrentes sobrescrevem umas às outras | last-write-wins aceito no MVP (D75/D120); documentar |
| R4 | reconciliação de cortinas/componentes em `PATCH` apaga ou duplica filhos | definir semântica de atualização por id e ordem (D83/D117) |
| R5 | cálculos monetários e de tecido divergentes entre domínio e consultas | centralizar fórmulas; projeções não duplicam regra de negócio |
| R6 | filtro `EXPIRED` implementado como status persistido | derivar sempre por `status + validUntil` |
| R7 | `details` do histórico sem contrato vira dado incompatível | definir payload mínimo por evento (D109) |
| R8 | transições implementadas em controller/application por atribuição direta de status | transições exclusivamente no aggregate |
| R9 | cliente removido logicamente com rascunho pendente | decidir gate de envio (D97) |
| R10 | arredondamento diferente por uso de `Float` ou `Number` | aritmética inteira escalada + `HALF_UP` (D86) |
| R11 | `confirmedAt` obsoleto após reabertura | decidir limpeza e registrar valor anterior no histórico (D100) |
| R12 | exclusão de rascunho concorrente com envio | operação atômica e resposta 404/409 após revalidação |
| R13 | listas sem paginação em volume grande | aceito no MVP; reavaliar com dados reais |
| R14 | implementação fragmentada em specs divergentes | consolidar decisões em `04-orcamentos.md` e ajustar o plano na decomposição |

---

## 14. Arquivos provavelmente afetados pela implementação futura

Nenhum destes arquivos existe hoje, exceto os pontos de integração indicados.

### 14.1 Backend — novos

```text
backend/src/modules/orcamentos/
├── domain/
│   ├── quote.ts
│   ├── curtain.ts
│   ├── financial-item.ts
│   ├── quote-status.ts
│   ├── value-objects/
│   │   ├── money.ts
│   │   ├── quote-number.ts
│   │   ├── installation-address.ts
│   │   └── discount.ts
│   ├── errors/
│   └── repositories/
│       └── quote.repository.ts
├── application/
│   ├── use-cases/
│   │   ├── create-quote.use-case.ts
│   │   ├── update-quote.use-case.ts
│   │   ├── mark-quote-as-sent.use-case.ts
│   │   ├── confirm-quote.use-case.ts
│   │   ├── reopen-quote.use-case.ts
│   │   ├── renew-quote.use-case.ts
│   │   ├── cancel-quote.use-case.ts
│   │   ├── start-production.use-case.ts
│   │   ├── schedule-installation.use-case.ts
│   │   ├── remove-installation.use-case.ts
│   │   ├── complete-service.use-case.ts
│   │   └── delete-draft-quote.use-case.ts
│   ├── queries/
│   │   ├── search-quotes.query.ts
│   │   ├── get-quote.query.ts
│   │   ├── list-customer-quotes.query.ts
│   │   └── list-quote-history.query.ts
│   └── errors/
├── infrastructure/
│   ├── prisma-quote.repository.ts
│   ├── quote.mapper.ts
│   ├── prisma-quote-number-sequence.ts
│   ├── prisma-search-quotes.query.ts
│   ├── prisma-list-quote-history.query.ts
│   └── prisma-list-customer-quotes.query.ts
├── presentation/
│   ├── orcamentos.controller.ts
│   ├── quote-error-mapper.ts
│   ├── quote-response.mapper.ts
│   └── dto/
└── orcamentos.module.ts
```

### 14.2 Backend — pontos de integração existentes

- `backend/src/app.module.ts` — importar `OrcamentosModule`.
- `backend/src/modules/clientes/` — nenhuma alteração de contrato; o módulo de orçamentos consulta `customers` diretamente pela infraestrutura de leitura ou reutiliza o port de cliente apenas se necessário.
- `backend/prisma/schema.prisma` — **nenhuma alteração prevista**; o schema atual já cobre o módulo.
- `backend/prisma/migrations/` — **nenhuma migration prevista** para esta fase.

### 14.3 Testes — novos

```text
backend/src/modules/orcamentos/domain/*.spec.ts
backend/src/modules/orcamentos/application/**/*.spec.ts
backend/src/modules/orcamentos/infrastructure/*.spec.ts
backend/src/modules/orcamentos/orcamentos.integration.spec.ts
backend/test/orcamentos.e2e-spec.ts
```

### 14.4 Frontend — futuro (Fase 11)

Nenhum arquivo atual além do boilerplate. A feature de orçamento será criada em `frontend/src/features/orcamentos/` quando a fase correspondente for iniciada.

---

## 15. Decisões a fechar em ORCAMENTO-02

| Tema | Por que está aberto | Decisão em `04-orcamentos.md` |
|---|---|---|
| contrato do aggregate | precisa ser fixado para orientar o código | D76 |
| nomenclatura de código e API | evitar mistura de idiomas | D77 |
| criação a partir do cliente | validar cliente ativo e imutabilidade | D78 |
| primeiro salvamento | status, número e timestamps | D79 |
| numeração atômica | contador e transação | D80 |
| formato, ano e padding | fuso e volume | D81 |
| VO de número | validação e imutabilidade | D82 |
| identidade e sequência da cortina | edição de coleções | D83 |
| defaults de borda/fator | onde aplicar | D84 |
| fórmulas e precisão | aritmética exata | D85–D86 |
| componentes financeiros | nulabilidade e validação no rascunho | D87 |
| adicionais gerais | semântica compartilhada | D88 |
| mão de obra | preset vs regra de domínio | D89 |
| desconto | combinações e cálculo monetário | D90–D91 |
| ajuste comercial | contrato da API e limites | D92 |
| totais | derivação e contrato de resposta | D93 |
| endereço de instalação | snapshot e estado parcial | D94–D95 |
| máquina de estados | tabela completa de transições | D96 |
| envio | gate e datas | D97–D98 |
| confirmação | expiração | D99 |
| reabertura | `confirmedAt` e instalação | D100 |
| renovação | validade e status | D101 |
| cancelamento | motivo e terminalidade | D102 |
| produção | transição e datas | D103 |
| instalação | agendamento, alteração e remoção | D104 |
| conclusão | bloqueio por instalação futura | D105 |
| expiração | condição derivada | D106 |
| instalação atrasada | condição derivada | D107 |
| histórico | atomicidade e eventos | D108–D109 |
| exclusão | física apenas em rascunho | D110–D111 |
| repository | port e carregamento do aggregate | D112 |
| queries | filtros, ordenação e paginação | D113 |
| use cases | lista e responsabilidades | D114 |
| API HTTP | rotas, verbos e status | D115 |
| DTOs | contrato JSON | D116 |
| atualização | reconciliação de filhos | D117 |
| erros | taxonomia e mapeamento HTTP | D118 |
| transações | fronteira por caso de uso | D119 |
| concorrência | last-write-wins | D120 |
| testes | estratégia por camada | D121 |
| índices | suficiência dos existentes | D122 |
| estrutura e wiring | módulo NestJS | D123 |
| escopo documental | documentos e dashboard | D124 |

**Status em 2026-10-19:** D81, D92, D97, D98, D100 e D117 foram aprovadas na revisão humana (duas delas com ajuste) e estão marcadas como `[A]` em `04-orcamentos.md`. As demais decisões D76–D124 continuam como propostas e aguardam validação. Nenhuma implementação foi realizada.

---

## 16. Conclusão da auditoria

O schema Prisma já está pronto para o módulo Orçamento e não requer alteração para a Fase 4 em diante. O banco local está sincronizado com as duas migrations existentes.

O código, porém, não possui nenhuma implementação do módulo: não há aggregate, VOs, entidades internas, use cases, repository, queries, controller, DTOs ou testes. O frontend também não possui feature de orçamento.

As fontes de produto e arquitetura cobrem a maior parte das regras. As decisões materialmente abertas concentram-se em:

- fuso e formato da numeração;
- semântica de atualização de coleções;
- tratamento de `confirmedAt` e do agendamento na reabertura;
- validade no primeiro envio e na renovação;
- contrato do ajuste comercial;
- formato dos `details` do histórico;
- fronteira transacional concreta;
- taxonomia de erros HTTP.

Essas decisões estão propostas em `docs/development/04-orcamentos.md` e precisam de validação humana antes da decomposição em tasks atômicas.
