# ORCAMENTO-02 — Decisões técnicas e de domínio do módulo Orçamento

**Status:** implementada e revisada — núcleo de Orçamento fechado em 2026-10-20 (ORCAMENTO-48); decisões bloqueantes aprovadas em 2026-10-19
**Data:** 2026-10-19
**Task de origem:** `ORCAMENTO-02 — Fechar decisões técnicas e de domínio do módulo Orçamento`
**Auditoria de origem:** `docs/development/04-orcamentos-audit.md` (ORCAMENTO-01)
**Fontes de verdade:** `docs/PROJECT_SPEC.md` (§2–§12, §14–§18), `docs/ARCHITECTURE.md` (§2–§19, §22), `docs/IMPLEMENTATION_PLAN.md` (Fases 4–9), decisões D1–D75

Este documento **não implementa** o módulo Orçamento. Ele fecha as decisões necessárias para que a implementação possa ser decomposta em tasks atômicas. Nenhum código, schema, migration, endpoint, repository ou teste foi alterado.

---

## 1. Como ler este documento

Cada decisão tem um identificador sequencial a partir de **D76** (a última decisão existente é D75, em `03-clientes.md`) e um marcador de origem:

| Marcador | Significado |
|---|---|
| **[F]** | Confirmada pelas fontes. A decisão já está determinada por `PROJECT_SPEC`, `ARCHITECTURE` ou por decisões D1–D75. Não requer validação humana; apenas registra o entendimento. |
| **[P]** | Proposta. As fontes não detalham o ponto; a recomendação preenche a lacuna com a alternativa mais simples compatível com elas. Requer validação humana, mas normalmente não bloqueia a decomposição. |
| **[V]** | Requer validação humana. Há ambiguidade material ou o ponto altera contrato de comportamento/API. **Bloqueia** a decomposição da task correspondente até ser validado. |
| **[A]** | Aprovada na revisão humana de 2026-10-19. Passa a ser normativa e não bloqueia a decomposição. |

Regras de leitura:

- uma decisão marcada **[F]** não pode ser alterada sem antes atualizar a fonte que a determina;
- uma decisão **[P]** ou **[V]** passa a ser normativa somente após validação humana;
- propostas não podem ser tratadas como regra de negócio já aprovada;
- nenhuma decisão autoriza alterar o schema Prisma atual.

### 1.1 Nomenclatura

- Código, schema, campos JSON e nomes de classes/arquivos permanecem em inglês, conforme `ARCHITECTURE.md` §1.2 e D73.
- Rotas HTTP permanecem em português, seguindo `ARCHITECTURE.md` §14.2 e o padrão vigente de `/clientes`.
- Documentação de produto e de desenvolvimento permanece em português.
- A tabela de correspondência entre os termos de `PROJECT_SPEC` e os identificadores de código está em D116.

### 1.2 Revisão humana de 2026-10-19

Foram aprovadas as seis decisões que bloqueavam a decomposição:

| Decisão | Resultado |
|---|---|
| D81 | Aprovada — ano comercial em `America/Sao_Paulo`; padding mínimo de 3 dígitos, crescendo naturalmente após 999. |
| D92 | Aprovada — a API aceita somente `commercialAdjustmentCents`; “total final desejado” é conveniência da UI. |
| D97 | Aprovada — o cliente precisa existir e estar ativo no envio. |
| D98 | Aprovada — `validUntil` informado no primeiro envio deve ser estritamente futuro. |
| D100 | Aprovada com ajuste — na reabertura, `confirmedAt` e `scheduledInstallationAt` passam a `null`; valores anteriores ficam em `QUOTE_REOPENED.details`; `firstSentAt` e `validUntil` permanecem; não há renovação automática. |
| D117 | Aprovada com ajuste — `PATCH` realmente parcial; campos opcionais omitidos não viram `null`; coleções editáveis (`curtains`, `components`, `generalAddOns`) enviadas representam seu estado completo e são reconciliadas por `id`; coleções omitidas permanecem inalteradas; operação atômica e um único `QUOTE_EDITED`. |

Essas decisões passam a ser normativas. As demais decisões **[P]** continuam como propostas até validação.

---

## 2. Sumário das decisões

| ID | Tema | Status |
|---|---|---|
| D76 | Contrato e fronteira do aggregate `Quote` | [F] |
| D77 | Idioma de código, schema, API e documentação | [F] |
| D78 | Criação a partir do cliente e imutabilidade do vínculo | [F]/[P] |
| D79 | Primeiro salvamento e status inicial | [F] |
| D80 | Numeração atômica e contador anual | [F] |
| D81 | Formato, ano comercial e padding do número | [A] |
| D82 | Value Object `QuoteNumber` | [P] |
| D83 | Identidade e sequência da `Curtain` | [P] |
| D84 | Defaults de borda e fator de tecido | [F] |
| D85 | Cálculos intrínsecos da cortina | [F] |
| D86 | Representação numérica e aritmética exata | [P] |
| D87 | `FinancialComponent` / `FinancialItem` | [P] |
| D88 | Adicionais gerais | [F] |
| D89 | Mão de obra como preset | [F] |
| D90 | Value Object `Discount` | [F] |
| D91 | Cálculo monetário do desconto | [P] |
| D92 | Ajuste comercial | [A] |
| D93 | Totais derivados | [P] |
| D94 | Endereço de instalação como snapshot | [F]/[P] |
| D95 | Endereço parcial no rascunho | [P] |
| D96 | Máquina de estados | [F] |
| D97 | Gate de envio | [A] |
| D98 | Datas e validade no envio | [A] |
| D99 | Confirmação | [F]/[P] |
| D100 | Reabertura | [A] |
| D101 | Renovação | [F]/[P] |
| D102 | Cancelamento | [F]/[P] |
| D103 | Início de produção | [F] |
| D104 | Instalação | [P] |
| D105 | Conclusão do serviço | [F] |
| D106 | Expiração derivada | [F] |
| D107 | Instalação atrasada derivada | [F] |
| D108 | Histórico: modelo e atomicidade | [F] |
| D109 | Histórico: detalhes dos eventos | [P] |
| D110 | Exclusão física de rascunho | [F] |
| D111 | Ausência de soft delete de orçamento | [F] |
| D112 | Repository do aggregate | [F]/[P] |
| D113 | Queries e projeções de leitura | [P] |
| D114 | Use cases | [P] |
| D115 | API HTTP | [F]/[P] |
| D116 | DTOs e contrato JSON | [P] |
| D117 | Semântica de atualização | [A] |
| D118 | Taxonomia de erros e mapeamento HTTP | [P] |
| D119 | Fronteira transacional | [P] |
| D120 | Concorrência | [F] |
| D121 | Estratégia de testes | [F]/[P] |
| D122 | Índices | [F] |
| D123 | Estrutura do módulo e wiring | [F]/[P] |
| D124 | Escopo desta fase e exclusões | [F] |

---

## 3. Decisões

### 3.1 Contrato do aggregate

#### D76 — Contrato e fronteira do aggregate `Quote` [F]

`Quote` é o Aggregate Root do núcleo comercial e operacional. Sua fronteira de domínio inclui:

```text
Quote (AR)
├── id
├── quoteNumber
├── customerId
├── status
├── installationAddress
├── curtains: Curtain[]
│   └── components: FinancialItem[]
├── generalAddOns: FinancialItem[]
├── discount
├── commercialAdjustmentCents
├── notes
└── lifecycle dates
```

- `Curtain` é Entity interna, com identidade própria e sem repository.
- `FinancialItem` é a representação interna compartilhada por componentes de cortina e adicionais gerais; as coleções permanecem semanticamente separadas.
- `Money`, `QuoteNumber`, `InstallationAddress` e `Discount` são Value Objects do módulo.
- O histórico **não** faz parte da coleção carregada com o aggregate.
- `Customer` é Aggregate Root separado; o orçamento conhece apenas `customerId`.
- Não existem entidades `Service`, `Environment`, `TrackType`, `FabricCatalog`, `ProductionOrder` nem status de instalação.

**Motivo:** `ARCHITECTURE.md` §3.2–§3.8 e §8; `PROJECT_SPEC.md` §2.2–§2.8.

---

### 3.2 Criação

#### D77 — Idioma de código, schema, API e documentação [F]

Identificadores de código, nomes de classes, colunas, tabelas, enums e campos JSON em inglês. Rotas HTTP em português. Documentação de produto/desenvolvimento em português. Valores de enum trafegados na API em inglês (`DRAFT`, `SENT`, `CONFIRMED`, `IN_PRODUCTION`, `COMPLETED`, `CANCELLED`).

**Motivo:** `ARCHITECTURE.md` §1.2; D15; D73.

#### D78 — Criação a partir do cliente e imutabilidade do vínculo [F]/[P]

- A criação ocorre em `POST /clientes/:customerId/orcamentos`.
- `customerId` é definido pelo contexto da rota, é obrigatório desde o primeiro salvamento e **não pode ser alterado** depois.
- Não existe operação para trocar o cliente de um orçamento. Se o cliente estiver errado e o orçamento ainda for `DRAFT`, o rascunho deve ser excluído e recriado.
- **[P]** O cliente referenciado deve existir e não estar removido logicamente. Caso contrário, a resposta é `404`.
- Os demais dados podem estar incompletos no primeiro salvamento.

**Motivo:** `PROJECT_SPEC.md` §3.4, §4.2 e §8.6; `ARCHITECTURE.md` §3.2.

#### D79 — Primeiro salvamento e status inicial [F]

- Nenhum registro é criado ao abrir o formulário. O orçamento só existe após a primeira ação `Salvar rascunho`.
- `POST` cria o orçamento imediatamente com todos os dados enviados, com `status = DRAFT` definido explicitamente pelo domínio.
- Não existe endpoint de “rascunho vazio”.
- A criação recebe número e `createdAt` e grava o evento `QUOTE_CREATED` na mesma transação.
- `updatedAt` é gerenciado pela persistência.
- O rascunho pode conter dados técnicos e comerciais incompletos, mas os tipos/formas enviados pelo DTO precisam ser estruturalmente válidos.

**Motivo:** `PROJECT_SPEC.md` §4.1–§4.2; schema sem default de status; D3.

---

### 3.3 Numeração

#### D80 — Numeração atômica e contador anual [F]

- O contador é `QuoteSequence(year PK, lastNumber)`.
- A reserva usa incremento atômico em uma única operação (`INSERT ... ON CONFLICT (year) DO UPDATE ... RETURNING` ou equivalente no Prisma), **nunca** `MAX(quoteNumber) + 1`.
- A reserva do número, a inserção do orçamento (com filhos) e o evento `QUOTE_CREATED` ocorrem na **mesma transação interativa** do Prisma.
- Número nunca é reutilizado.
- Excluir um rascunho consome o número definitivamente.
- Lacunas são permitidas.
- `quoteNumber` continua `UNIQUE` no banco como última defesa.

**Motivo:** `PROJECT_SPEC.md` §4.3; `ARCHITECTURE.md` §12.

#### D81 — Formato, ano comercial e padding do número [A]

Decisão aprovada em 2026-10-19:

- Formato canônico: `ORÇ-AAAA-NNN`, com `Ç` maiúsculo e hífen.
- O ano é o ano civil do instante de criação convertido para **`America/Sao_Paulo`**.
- O sequencial tem padding mínimo de 3 dígitos (`001` a `999`). Acima de 999, cresce naturalmente (`ORÇ-2026-1000`).
- O valor é armazenado sempre em maiúsculas.
- Busca por número compara o valor canônico; a implementação de busca pode usar `ILIKE`/normalização para tolerar digitação em minúsculas.

Alternativas consideradas:

| Alternativa | Avaliação |
|---|---|
| Ano em UTC | simples, mas muda o ano comercial às 21h de 31/12 no horário de Brasília |
| Ano pelo fuso local do servidor | depende de configuração de deployment; frágil |
| Fixar 3 dígitos e falhar acima de 999 | desnecessário para o MVP e introduz limite artificial |
| `ORC` sem cedilha | contraria o formato comercial explícito de `PROJECT_SPEC` §4.3 |

**Aprovação (2026-10-19):** ano comercial em `America/Sao_Paulo`; padding mínimo de 3 dígitos, crescendo naturalmente após 999. As alternativas de UTC, fuso do servidor e limite fixo em 999 foram rejeitadas.

#### D82 — Value Object `QuoteNumber` [P]

- Imutável.
- Valida o formato canônico `^ORÇ-\d{4}-\d{3,}$`.
- Expõe ano e sequencial.
- Pode ser construído a partir de `(year, sequence)` por uma função pura de formatação.
- Não conhece SQL, locks, relógio ou concorrência.

**Motivo:** `ARCHITECTURE.md` §12; separação entre domínio e infraestrutura.

---

### 3.4 Cortina

#### D83 — Identidade e sequência da `Curtain` [P]

- `Curtain` é Entity interna; `id` é UUID v4 gerado pela aplicação no domínio, seguindo o padrão de `Customer.create` (`randomUUID()`). O default `uuid()` do banco permanece como fallback.
- `sequence` é posição de apresentação, 1-based.
- O servidor normaliza `sequence` para `1..N` conforme a ordem do array recebido na criação ou quando a coleção de cortinas é enviada em um `PATCH`. Se a coleção for omitida no `PATCH`, nada é alterado (D117). O cliente não envia `sequence`.
- `UNIQUE(quoteId, sequence)` protege a invariante no banco.
- Não existe `quantity` de cortinas; cada registro representa uma cortina física.

Alternativa considerada: aceitar `sequence` do cliente e preservar lacunas. Rejeitada por permitir duplicidade e ordenação ambígua sem benefício de produto.

**Motivo:** `PROJECT_SPEC.md` §2.3; `ARCHITECTURE.md` §3.3; D11.

#### D84 — Defaults de borda e fator de tecido [F]

- Quando `borderValue` não é informado na criação da cortina, o **domínio** aplica `0,15`.
- Quando `fabricFactor` não é informado na criação da cortina, o **domínio** aplica `3,5`.
- O banco não possui defaults para esses campos.
- Os valores podem ser alterados individualmente depois; `borderValue = 0` é válido.
- Sugestões de `Mão de obra` (quantidade = quantidade de tecido, unidade `m`, preço `R$ 30,00`) são presets de UX; o backend não cria componentes automaticamente.

**Motivo:** `PROJECT_SPEC.md` §6.2, §6.4 e §7.4; D4.

#### D85 — Cálculos intrínsecos da cortina [F]

```text
finalWidth     = openingWidth + (2 × borderValue)
fabricQuantity = finalWidth × fabricFactor
```

- Ambos são derivados e **não são persistidos**.
- Não há arredondamento de negócio; o resultado matemático é usado diretamente.
- `fabricQuantity` pode ter até 6 casas decimais.
- A altura não participa do cálculo.
- Na criação/edição, valores negativos de medidas são rejeitados.
- No envio: `openingWidth > 0`, `height > 0`, `borderValue >= 0`, `fabricFactor > 0`.

**Motivo:** `PROJECT_SPEC.md` §6; `ARCHITECTURE.md` §3.3 e §10.1.

#### D86 — Representação numérica e aritmética exata [P]

- As medidas entram na API como números decimais em metros, com no máximo 3 casas.
- O domínio representa medidas como números, mas valida a escala de 3 casas na entrada.
- Os cálculos usam **aritmética inteira escalada**, sem `Float` e sem nova dependência:
  - medidas e fator em milésimos (`×1000`);
  - `finalWidth` em milímetros;
  - `fabricQuantity` em milionésimos (`×1.000.000`) = `finalWidthMm × fabricFactorMilli` (produto de dois inteiros na escala 10⁻⁶).
- Valores monetários são inteiros em centavos.
- Quantidades de itens financeiros são representadas em milionésimos para o cálculo.
- O total de um item usa `BigInt` para evitar overflow:

```text
totalCents = HALF_UP(quantityMicro × unitPriceCents / 1.000.000)
```

- O valor do desconto percentual também usa `BigInt` (D91).
- Totais calculados precisam caber em `Int` de 32 bits (limite do schema); valores fora da faixa são rejeitados.

Alternativa considerada: adicionar `decimal.js`. Rejeitada por ser dependência nova para um cálculo que inteiros escalados resolvem com exatidão.

**Motivo:** `ARCHITECTURE.md` §10; D5–D7; regra de não introduzir dependência sem justificativa.

#### D87 — `FinancialComponent` / `FinancialItem` [P]

- Entity interna do aggregate, com `id` UUID gerado pela aplicação.
- Campos: `name`, `quantity`, `unit`, `unitPriceCents`; `totalCents` é derivado.
- `name`: obrigatório e não vazio em qualquer salvamento.
- `quantity`: `> 0` quando presente; `unitPriceCents`: `> 0` quando presente.
- `unit`: texto livre **opcional**; não bloqueia o envio, pois o gate de `PROJECT_SPEC` §8.5 exige apenas quantidade e valor unitário.
- Em `DRAFT`, `quantity` e `unitPriceCents` podem ser nulos enquanto a consultora preenche o item.
- Em status não rascunho, qualquer edição só é aceita com todos os itens completos.
- Zero ou negativo é sempre rejeitado; o componente deve ser removido.
- No envio, cada cortina precisa de pelo menos um componente completo e todos os componentes presentes precisam estar completos.
- O total é calculado com `HALF_UP` por item (D86).

Alternativa considerada: tornar `unit` obrigatória. Rejeitada porque o gate de envio não a exige e o schema a mantém nullable.

**Motivo:** `PROJECT_SPEC.md` §2.4 e §7.2; `ARCHITECTURE.md` §3.4; D5.

#### D88 — Adicionais gerais [F]

- Usam a mesma semântica de `FinancialItem`, em coleção e tabela separadas.
- Começam vazios.
- Quando presentes, seguem as mesmas regras de validade dos componentes.
- `generalAddOnsTotal = Σ totalCents` e entra em `subtotal` antes do desconto.
- Não são detalhados no PDF comercial; a projeção do PDF pertence à Fase 8.

**Motivo:** `PROJECT_SPEC.md` §2.5, §7.6 e §7.9; `ARCHITECTURE.md` §3.4 e §9.3.

#### D89 — Mão de obra como preset [F]

Não existe tipo, entidade ou regra especial de mão de obra. `Mão de obra` é apenas um nome sugerido de `FinancialItem`, com quantidade sugerida igual a `fabricQuantity`, unidade `m` e valor unitário padrão `R$ 30,00` na interface. O backend não cria, não recalcula e não altera esse componente automaticamente.

**Motivo:** `PROJECT_SPEC.md` §7.4; `ARCHITECTURE.md` §3.4.

---

### 3.5 Cálculos financeiros

#### D90 — Value Object `Discount` [F]

- Existe no máximo um desconto global.
- `NO_DISCOUNT`: `percentage` e `fixedAmountCents` nulos.
- `PERCENTAGE`: `0 < percentage <= 100`, com até 2 casas; `fixedAmountCents` nulo.
- `FIXED_AMOUNT`: `0 < fixedAmountCents <= subtotal` no envio; `percentage` nulo.
- Combinações inválidas são rejeitadas.
- Não existe desconto por cortina.

**Motivo:** `PROJECT_SPEC.md` §2.6 e §7.7; `ARCHITECTURE.md` §3.6; D7.

#### D91 — Cálculo monetário do desconto [P]

- `subtotal` é a soma de totais de itens já arredondados.
- Percentual persistido como `Decimal(5,2)`; no domínio, o percentual é convertido para centésimos de ponto percentual (`12,34% → 1234`).
- Valor monetário:

```text
discountValueCents = HALF_UP(subtotalCents × percentageHundredths / 10.000)
```

- Valor fixo é usado como está.
- O desconto é aplicado depois de `subtotal` e antes do ajuste comercial.

Consequência documentada: um desconto de 100% zera o total; como o envio exige `total > 0`, ele só é aceitável se houver ajuste comercial positivo.

**Motivo:** `PROJECT_SPEC.md` §7.7 e §7.9; `ARCHITECTURE.md` §10.3.

#### D92 — Ajuste comercial [A]

Decisão aprovada em 2026-10-19:

- Campo opcional `commercialAdjustmentCents`, inteiro com sinal.
- Ausência e zero são equivalentes; o valor canônico persistido é `null` quando não há ajuste.
- Aplicado por último:

```text
totalCents = calculatedTotalCents + commercialAdjustmentCents
```

- Pode ser positivo ou negativo.
- No envio, `totalCents > 0`.
- Em `DRAFT`, o valor pode ser qualquer inteiro; a validação do total final ocorre no gate de envio.
- O contrato HTTP aceita **apenas `commercialAdjustmentCents`**. A interface pode calcular o ajuste a partir de um “valor final desejado”, mas o backend não recebe esse valor nem deriva o ajuste.
- O ajuste não substitui o desconto e fica registrado no orçamento.

Alternativas consideradas:

| Alternativa | Avaliação |
|---|---|
| Aceitar `desiredFinalTotalCents` e derivar o ajuste no backend | conveniente para a UI, mas cria duas fontes de verdade e exige desempate se ambos forem enviados |
| Aceitar os dois campos | contrato ambíguo e desnecessário no MVP |
| Limitar o ajuste para nunca tornar o total negativo | mais complexo que a regra já existente `total > 0` no envio |

**Aprovação (2026-10-19):** a API aceita somente `commercialAdjustmentCents`. “Total final desejado” é conveniência da UI e não integra o contrato do backend.

#### D93 — Totais derivados [P]

Ordem de cálculo:

```text
itemTotalCents      = HALF_UP(quantity × unitPrice)
curtainTotalCents   = Σ itemTotalCents
curtainsSubtotal    = Σ curtainTotalCents
addOnsSubtotal      = Σ addOnTotalCents
subtotalCents       = curtainsSubtotal + addOnsSubtotal
discountValueCents  = percentual ou valor fixo
calculatedTotalCents = subtotalCents - discountValueCents
totalCents          = calculatedTotalCents + adjustmentCents
```

- Nenhum total é persistido.
- Totais são recalculados em toda leitura.
- O detalhe expõe os valores por item, por cortina e os agregados.
- Listas podem calcular `totalCents` diretamente na query de leitura, sem reconstruir o aggregate.
- Nomes propostos para o JSON: `curtainsSubtotalCents`, `generalAddOnsSubtotalCents`, `subtotalCents`, `discountValueCents`, `calculatedTotalCents`, `commercialAdjustmentCents`, `totalCents`.

**Motivo:** `PROJECT_SPEC.md` §7.9; `ARCHITECTURE.md` §9.3 e §10.3.

---

### 3.6 Endereço de instalação

#### D94 — Endereço de instalação como snapshot [F]/[P]

- `InstallationAddress` é Value Object próprio do módulo de orçamentos.
- Estrutura: `street`, `number`, `neighborhood`, `city`, `complement?`, `postalCode?`, `state?`.
- Um endereço é **completo** quando possui `street`, `number`, `neighborhood` e `city`. Os demais são opcionais.
- `number` é textual.
- Quando a consultora escolhe “usar endereço do cliente”, os campos são copiados campo a campo para o orçamento, criando um snapshot independente.
- Alterações posteriores no cadastro do cliente não alteram o orçamento.
- **[P]** Não existe endpoint de cópia no backend. A interface lê o cliente e envia os campos de endereço; o backend apenas valida e persiste o snapshot.
- **[P]** Quando presentes, `postalCode` precisa ter 8 dígitos e `state` precisa ter 2 letras maiúsculas; ambos são normalizados.

**Motivo:** `PROJECT_SPEC.md` §5 e §2.8; `ARCHITECTURE.md` §3.8; D2.

#### D95 — Endereço parcial no rascunho [P]

- Em `DRAFT`, o endereço pode estar ausente, vazio ou parcial.
- Campos parciais são persistidos como enviados, sem exigir todos os campos obrigatórios.
- Strings vazias são normalizadas para `null`.
- No envio, o endereço precisa estar completo.
- Em qualquer salvamento fora de `DRAFT`, o endereço precisa estar completo.
- Não há exigência “tudo ou nada” no rascunho; isso difere do VO de endereço do cliente, que é all-or-nothing no cadastro.

**Motivo:** `PROJECT_SPEC.md` §5; `ARCHITECTURE.md` §3.8 e §9.3.

---

### 3.7 Ciclo de vida

#### D96 — Máquina de estados [F]

Status persistidos: `DRAFT`, `SENT`, `CONFIRMED`, `IN_PRODUCTION`, `COMPLETED`, `CANCELLED`.

| Origem | Ação de domínio | Destino | Condição |
|---|---|---|---|
| `DRAFT` | `markAsSent` | `SENT` | gate de D97 |
| `DRAFT` | `cancel` | `CANCELLED` | motivo opcional |
| `SENT` | `confirm` | `CONFIRMED` | não expirado |
| `SENT` | `renew` | `SENT` | nova validade futura |
| `SENT` | `cancel` | `CANCELLED` | motivo opcional |
| `CONFIRMED` | `reopen` | `SENT` | — |
| `CONFIRMED` | `startProduction` | `IN_PRODUCTION` | sem gate redundante |
| `CONFIRMED` | `cancel` | `CANCELLED` | motivo opcional |
| `IN_PRODUCTION` | `complete` | `COMPLETED` | sem instalação futura |
| `COMPLETED` | — | terminal | imutável |
| `CANCELLED` | — | terminal | imutável |

Regras:

- `EXPIRED` e `Instalação atrasada` nunca são status persistidos.
- Não existe rollback de `IN_PRODUCTION`.
- Não existe cancelamento em `IN_PRODUCTION` ou `COMPLETED`.
- Não existe reabertura fora de `CONFIRMED`.
- Transições só podem ocorrer por métodos do aggregate; controllers e use cases não atribuem `status` diretamente.
- Transição inválida gera erro de domínio `InvalidQuoteTransitionError`.

**Motivo:** `PROJECT_SPEC.md` §8; `ARCHITECTURE.md` §4.2.

#### D97 — Gate de envio [A]

`markAsSent` só é permitido a partir de `DRAFT` e exige:

- cliente existente e **não removido logicamente**;
- endereço de instalação completo;
- pelo menos uma cortina;
- para cada cortina:
  - `room` preenchido;
  - `openingWidth > 0`;
  - `height > 0`;
  - `borderValue >= 0`;
  - `fabricFactor > 0`;
  - `material` preenchido;
  - pelo menos um componente financeiro completo;
- todos os componentes presentes com `quantity > 0` e `unitPriceCents > 0`;
- todos os adicionais gerais presentes válidos;
- desconto válido;
- ajuste comercial, quando presente, resultando em total válido;
- `totalCents > 0`;
- validade final estritamente futura (D98).

Violações geram `QuoteValidationError` com a lista de regras violadas; a Presentation decide o status HTTP (D118).

**Aprovação (2026-10-19):** o cliente precisa existir e estar ativo no envio. Um cliente removido logicamente bloqueia a transição.

**Motivo:** `PROJECT_SPEC.md` §8.5.

#### D98 — Datas e validade no envio [A]

- `markAsSent` só existe em `DRAFT`.
- No primeiro envio, `firstSentAt = now`; o campo nunca é sobrescrito depois.
- A validade final é:
  - o `validUntil` enviado pelo consultor, se presente; ou
  - `now + 30 dias`, quando ausente.
- Se enviada, `validUntil` precisa ser **estritamente futura** no momento do envio.
- O status passa a `SENT`.
- O histórico `QUOTE_SENT` registra a validade aplicada.
- Não existe ação de “reenviar”. Após reabrir, o orçamento já está em `SENT`; editar não altera `firstSentAt` nem `validUntil`.
- Editar um orçamento `SENT` mantém status, `firstSentAt` e `validUntil`.

**Aprovação (2026-10-19):** `validUntil` informado no primeiro envio deve ser estritamente futuro; a sugestão de `+30 dias` continua sendo o valor padrão quando o campo não é enviado.

**Motivo:** `PROJECT_SPEC.md` §8.5–§8.6.

#### D99 — Confirmação [F]/[P]

- Permitida apenas em `SENT` e somente se **não expirado** (`now <= validUntil`).
- **[P]** Se `validUntil` estiver nulo em um orçamento `SENT` (estado inconsistente), a confirmação é bloqueada como conflito de estado.
- Grava `confirmedAt = now`, muda o status para `CONFIRMED` e registra `QUOTE_CONFIRMED`.
- Não exige assinatura, comprovante, upload ou canal.
- A edição técnica/comercial passa a ser bloqueada.
- Uma nova confirmação após reabertura grava um novo `confirmedAt`.

**Motivo:** `PROJECT_SPEC.md` §8.9; `ARCHITECTURE.md` §4.3.

#### D100 — Reabertura [A]

- Permitida apenas em `CONFIRMED`.
- Muda o status para `SENT`; mantém número, registro, `firstSentAt` e `validUntil`.
- Não cria versão formal, não renova automaticamente a validade e não altera o número.
- `confirmedAt` passa a `null`.
- `scheduledInstallationAt` passa a `null`.
- Os valores anteriores de `confirmedAt` e `scheduledInstallationAt` são registrados em `QUOTE_REOPENED.details`.
- Nenhum evento de instalação é emitido; a remoção do agendamento é consequência da reabertura e fica registrada no próprio `QUOTE_REOPENED`.
- Se a validade já tiver vencido, o orçamento passa a ser apresentado como expirado e precisa ser renovado antes de nova confirmação.
- A edição volta a ser permitida.

Alternativas consideradas:

| Ponto | Alternativa | Avaliação |
|---|---|---|
| `confirmedAt` | manter a data anterior | deixa um orçamento `SENT` com data de confirmação obsoleta e enganosa em consultas |
| `confirmedAt` | limpar (aprovado) | estado corrente coerente; valor anterior fica no histórico |
| instalação | preservar o agendamento | mantém um dado que não pode ser gerenciado em `SENT` e pode conflitar com um novo agendamento após reconfirmar |
| instalação | limpar e registrar o valor anterior (aprovado) | estado corrente coerente; a intenção anterior permanece rastreável no histórico |
| instalação | limpar + `INSTALLATION_REMOVED` separado | criaria dois eventos para uma única ação de reabertura |

**Aprovação (2026-10-19):** reabrir zera `confirmedAt` e `scheduledInstallationAt`; ambos os valores anteriores ficam em `QUOTE_REOPENED.details`. `firstSentAt` e `validUntil` permanecem, e não há renovação automática.

**Motivo:** `PROJECT_SPEC.md` §8.10; `ARCHITECTURE.md` §4.4.

#### D101 — Renovação [F]/[P]

- Permitida em `SENT`, esteja o orçamento válido ou expirado.
- Exige uma nova `validUntil` **estritamente futura**.
- Atualiza apenas `validUntil`; status permanece `SENT`.
- Mantém número, `firstSentAt` e demais dados.
- Não cria nova versão.
- Registra `QUOTE_RENEWED` com `previousValidUntil` e `newValidUntil`.
- **[P]** A nova validade pode ser maior ou menor que a anterior, desde que futura.

**Motivo:** `PROJECT_SPEC.md` §8.6 e §8.8.

#### D102 — Cancelamento [F]/[P]

- Permitido em `DRAFT`, `SENT` e `CONFIRMED`.
- Proibido em `IN_PRODUCTION`, `COMPLETED` e `CANCELLED`.
- O motivo é opcional, textual, com `trim`; **[P]** limite de 500 caracteres.
- O motivo é gravado em `QUOTE_CANCELLED.details.reason`; não existe coluna própria.
- O status passa a `CANCELLED`, que é terminal.
- Um orçamento cancelado permanece consultável, mas não pode ser editado, renovado, confirmado, reaberto ou excluído fisicamente.
- **[P]** `scheduledInstallationAt` é preservado como dado histórico; porque o status é terminal, não produz efeito operacional.
- Uma nova negociação exige um novo orçamento.

**Motivo:** `PROJECT_SPEC.md` §8.11; D1.

#### D103 — Início de produção [F]

- Permitido apenas em `CONFIRMED`.
- Grava `productionStartedAt = now`, muda para `IN_PRODUCTION` e registra `PRODUCTION_STARTED`.
- Não existe segundo gate de validação.
- Não existe rollback para `CONFIRMED`.
- Não existe cancelamento após o início da produção.

**Motivo:** `PROJECT_SPEC.md` §8.12.

#### D104 — Instalação [P]

- O único dado é `scheduledInstallationAt`; não existe status de instalação.
- Permitida apenas em `CONFIRMED` e `IN_PRODUCTION`.
- `PUT /orcamentos/:id/instalacao` define ou substitui a data.
- `DELETE /orcamentos/:id/instalacao` remove a data e responde `204`.
- Datas passadas são aceitas; a condição “atrasada” é derivada (D107).
- Eventos:
  - ausência → valor: `INSTALLATION_SCHEDULED`;
  - valor → outro valor: `INSTALLATION_CHANGED`;
  - valor → ausência: `INSTALLATION_REMOVED`.
- **[P]** Se o valor enviado for idêntico ao atual, a operação é um no-op: responde `200` com o detalhe e **não** grava evento.
- `details` registra valor anterior e novo quando aplicável.

**Motivo:** `PROJECT_SPEC.md` §9.1; `ARCHITECTURE.md` §4.4.

#### D105 — Conclusão do serviço [F]

- Permitida apenas em `IN_PRODUCTION`.
- Se `scheduledInstallationAt != null && scheduledInstallationAt > now`, a conclusão é bloqueada com conflito de estado.
- Caso contrário, grava `completedAt = now`, muda para `COMPLETED` e registra `SERVICE_COMPLETED`.
- `COMPLETED` é terminal e imutável.
- Não exige que tenha havido instalação.

**Motivo:** `PROJECT_SPEC.md` §8.13 e §9.2.

#### D106 — Expiração derivada [F]

```text
expired = status == SENT && validUntil != null && now > validUntil
```

- Nunca é persistido; não há job de expiração.
- A comparação é entre instantes absolutos; fuso horário não altera o resultado.
- Enquanto expirado, o orçamento continua editável, pode gerar PDF e pode ser cancelado, mas não pode ser confirmado.
- Renovar remove a condição.
- A API expõe `expired: boolean`; o filtro `EXPIRED` é virtual na consulta.

**Motivo:** `PROJECT_SPEC.md` §8.2 e §8.7; `ARCHITECTURE.md` §4.3.

#### D107 — Instalação atrasada derivada [F]

```text
lateInstallation =
  scheduledInstallationAt != null
  && scheduledInstallationAt < now
  && status in (CONFIRMED, IN_PRODUCTION)
```

- Não é status, não é persistida e não gera histórico.
- A API expõe `lateInstallation: boolean`.

**Motivo:** `PROJECT_SPEC.md` §9.3; `ARCHITECTURE.md` §4.3.

---

### 3.8 Histórico

#### D108 — Histórico: modelo e atomicidade [F]

- Persistido em `quote_history`, associado por `quoteId`.
- Não é carregado junto do aggregate e não reconstrói estado.
- A Application grava os eventos na **mesma transação** da mudança de estado.
- Cada operação de negócio gera no máximo um evento; uma edição salva gera um único `QUOTE_EDITED`.
- Todos os 14 tipos de `HistoryEventType` já existem; nesta fase, apenas os eventos de negócio do orçamento são emitidos. Eventos de PDF e ordem de produção pertencem à Fase 8.
- A leitura usa `ORDER BY occurredAt ASC, id ASC`.
- Não há event sourcing, Domain Events ou event bus.

**Motivo:** `PROJECT_SPEC.md` §11; `ARCHITECTURE.md` §8; D10.

#### D109 — Histórico: detalhes dos eventos [P]

Contrato mínimo de `details`:

| Evento | `details` |
|---|---|
| `QUOTE_CREATED` | `{ "quoteNumber": "ORÇ-2026-001" }` |
| `QUOTE_SENT` | `{ "validUntil": "<ISO>", "firstSend": true }` |
| `QUOTE_EDITED` | `{ "changes": [ ... ] }` |
| `QUOTE_CONFIRMED` | ausente |
| `QUOTE_REOPENED` | `{ "previousConfirmedAt": "<ISO>" ou null, "previousScheduledInstallationAt": "<ISO>" ou null }` |
| `QUOTE_RENEWED` | `{ "previousValidUntil": "<ISO>", "newValidUntil": "<ISO>" }` |
| `QUOTE_CANCELLED` | `{ "reason": "<texto>"? }` |
| `PRODUCTION_STARTED` | ausente |
| `INSTALLATION_SCHEDULED` | `{ "scheduledInstallationAt": "<ISO>" }` |
| `INSTALLATION_CHANGED` | `{ "previousScheduledInstallationAt": "<ISO>", "scheduledInstallationAt": "<ISO>" }` |
| `INSTALLATION_REMOVED` | `{ "previousScheduledInstallationAt": "<ISO>" }` |
| `SERVICE_COMPLETED` | ausente |
| `COMMERCIAL_PDF_GENERATED` / `PRODUCTION_ORDER_GENERATED` | definido na Fase 8 |

Cada item de `changes` em `QUOTE_EDITED` tem o formato:

```json
{
  "field": "height",
  "previous": 2.6,
  "next": 2.65,
  "curtainSequence": 1,
  "curtainRoom": "Sala",
  "componentName": "Tecido"
}
```

- `curtainSequence`, `curtainRoom` e `componentName` são opcionais e servem para localizar o item alterado.
- Valores são serializados como JSON primitivos; não há diff aninhado por componente.
- Uma edição sem mudanças efetivas não grava evento e não altera `updatedAt` por regra de negócio (o `updatedAt` só muda se houver `UPDATE` real).
- O formato é propositalmente versionless; mudanças futuras devem ser compatíveis.

**Motivo:** `PROJECT_SPEC.md` §11; `ARCHITECTURE.md` §8; D18.

---

### 3.9 Exclusão

#### D110 — Exclusão física de rascunho [F]

- `DELETE /orcamentos/:id` só é permitido em `DRAFT`.
- Responde `204`; filhos e histórico são removidos por cascade.
- O número consumido não é devolvido e nunca é reutilizado.
- Em qualquer outro status, responde `409`.
- Orçamento inexistente responde `404`.
- Como o registro deixa de existir, nenhum evento de histórico é preservado.

**Motivo:** `PROJECT_SPEC.md` §4.3 e §8.4; `ARCHITECTURE.md` §9.5.

#### D111 — Ausência de soft delete de orçamento [F]

- `Quote` não possui `deletedAt`.
- `CANCELLED` e `COMPLETED` permanecem consultáveis indefinidamente.
- Não existe exclusão física fora de `DRAFT`.
- O soft delete do cliente não remove nem invalida orçamentos históricos; a FK `Restrict` impede a exclusão física do cliente com orçamentos.

**Motivo:** `PROJECT_SPEC.md` §2.1 e §8.11/§8.13; `ARCHITECTURE.md` §9.4–§9.5.

---

### 3.10 Repository

#### D112 — Repository do aggregate [F]/[P]

- Existe apenas `QuoteRepository` como port de Aggregate Root; não há repositories para `Curtain`, `FinancialItem`, `Discount` ou `InstallationAddress`.
- `findById(id)` carrega o aggregate completo (orçamento + cortinas + componentes + adicionais), inclusive em status terminais.
- `save` persiste o aggregate e reconcilia os filhos (D117).
- A criação recebe o número reservado e grava orçamento, filhos e histórico atomicamente (D119).
- `QuoteMapper` faz Domain ↔ Persistence na infraestrutura.
- Operações de leitura usam Query Services/read repositories separados, sem reconstruir aggregates.
- Não existe `Repository<T>` genérico.

**Motivo:** `ARCHITECTURE.md` §7, §9.2 e §9.3; D64.

---

### 3.11 Queries

#### D113 — Queries e projeções de leitura [P]

| Query | Responsabilidade |
|---|---|
| `GetQuoteQuery` | detalhe por id, com cortinas, componentes, adicionais, derivados e totais |
| `SearchQuotesQuery` | lista/busca com filtros e projeção resumida |
| `ListCustomerQuotesQuery` | histórico de orçamentos de um cliente |
| `ListQuoteHistoryQuery` | eventos do orçamento em ordem cronológica |
| `DashboardQuery` | contadores e listas operacionais (Fase 9) |

Decisões propostas:

- `GET /orcamentos` aceita `search` e `status`.
- `search` compara, sem diferenciar maiúsculas, o nome do cliente **ou** o número do orçamento por conteúdo (`contains`).
- `status` aceita os 6 status persistidos e o valor virtual `EXPIRED`.
- `EXPIRED` filtra `status = SENT AND valid_until IS NOT NULL AND valid_until < now`; `SENT` válido filtra `status = SENT AND (valid_until IS NULL OR valid_until >= now)`.
- Ordenação padrão: `createdAt DESC, id DESC`.
- **Não há paginação no MVP.** A lista retorna todos os resultados do filtro. Reavaliar com volume real.
- A projeção resumida inclui `id`, `quoteNumber`, `customer: { id, name }`, `status`, `expired`, `totalCents`, `createdAt`, `validUntil`, `scheduledInstallationAt`.
- `totalCents` de lista é calculado na própria query SQL (somas), sem N+1 e sem reconstruir aggregate.
- `GET /orcamentos/:id` usa o aggregate para derivar os valores e expõe `expired` e `lateInstallation`.
- O dashboard é implementado na Fase 9 e reutiliza projeções; esta spec fixa apenas que ele não deve reconstruir aggregates.

**Motivo:** `PROJECT_SPEC.md` §12; `ARCHITECTURE.md` §7.3.

---

### 3.12 Use cases

#### D114 — Use cases [P]

| Use case | Operação |
|---|---|
| `CreateQuoteFromCustomer` | primeiro salvamento; reserva número; cria `DRAFT` |
| `UpdateQuote` | atualização completa dos dados editáveis |
| `MarkQuoteAsSent` | gate + transição para `SENT` |
| `ConfirmQuote` | `SENT → CONFIRMED` |
| `ReopenQuote` | `CONFIRMED → SENT` |
| `RenewQuote` | nova validade |
| `CancelQuote` | `CANCELLED` |
| `StartProduction` | `CONFIRMED → IN_PRODUCTION` |
| `ScheduleInstallation` | define/substitui instalação |
| `RemoveInstallation` | remove instalação |
| `CompleteService` | `IN_PRODUCTION → COMPLETED` |
| `DeleteDraftQuote` | exclusão física de `DRAFT` |
| `GetQuoteQuery` | leitura de detalhe |
| `SearchQuotesQuery` | busca/listagem |
| `ListCustomerQuotesQuery` | histórico do cliente |
| `ListQuoteHistoryQuery` | histórico do orçamento |

Cada use case carrega o aggregate, chama o comportamento de domínio correspondente, coordena a persistência e o histórico, e retorna dados de aplicação. O controller não contém regra de negócio.

**Motivo:** `ARCHITECTURE.md` §5–§6; D65.

---

### 3.13 API HTTP

#### D115 — API HTTP [F]/[P]

Todas as rotas exigem `AuthGuard`.

| Método | Rota | Resposta |
|---|---|---|
| `POST` | `/clientes/:customerId/orcamentos` | `201` detalhe |
| `GET` | `/clientes/:customerId/orcamentos` | `200` lista resumida |
| `GET` | `/orcamentos?search=&status=` | `200` lista resumida |
| `GET` | `/orcamentos/:id` | `200` detalhe |
| `PATCH` | `/orcamentos/:id` | `200` detalhe |
| `DELETE` | `/orcamentos/:id` | `204` |
| `POST` | `/orcamentos/:id/enviar` | `200` detalhe |
| `POST` | `/orcamentos/:id/confirmar` | `200` detalhe |
| `POST` | `/orcamentos/:id/reabrir` | `200` detalhe |
| `POST` | `/orcamentos/:id/renovar` | `200` detalhe |
| `POST` | `/orcamentos/:id/cancelar` | `200` detalhe |
| `POST` | `/orcamentos/:id/iniciar-producao` | `200` detalhe |
| `POST` | `/orcamentos/:id/concluir` | `200` detalhe |
| `PUT` | `/orcamentos/:id/instalacao` | `200` detalhe |
| `DELETE` | `/orcamentos/:id/instalacao` | `204` |
| `GET` | `/orcamentos/:id/historico` | `200` lista de eventos |

Regras:

- Transições são ações explícitas com `POST`; não existe `PATCH` de `status`.
- `PATCH` é parcial; coleções enviadas representam seu estado completo (D117).
- `customerId` e `quoteNumber` não aparecem no corpo de atualização.
- Rotas de PDF e ordem de produção pertencem à Fase 8 e não são implementadas aqui.
- A resposta de ações é o detalhe atualizado, relido após a persistência para expor `updatedAt`.
- **Não há paginação**; ver D113.

**Motivo:** `ARCHITECTURE.md` §14; `PROJECT_SPEC.md` §8–§9.

---

### 3.14 DTOs

#### D116 — DTOs e contrato JSON [P]

Correspondência de termos:

| `PROJECT_SPEC` | Código/JSON |
|---|---|
| `numeroOrcamento` | `quoteNumber` |
| `cliente` | `customerId` |
| `status` | `status` |
| `observacoes` | `notes` |
| `descontoGlobal` | `discount` |
| `ajusteComercial` | `commercialAdjustmentCents` |
| `enderecoInstalacao` | `installationAddress` |
| `cortinas` | `curtains` |
| `sequencia` | `sequence` |
| `ambiente` | `room` |
| `descricao` | `description` |
| `material` | `material` |
| `larguraVao` | `openingWidth` |
| `valorBorda` | `borderValue` |
| `larguraFinal` | `finalWidth` (derivado, somente leitura) |
| `altura` | `height` |
| `fatorTecido` | `fabricFactor` |
| `quantidadeTecido` | `fabricQuantity` (derivado, somente leitura) |
| `componentesFinanceiros` | `components` |
| `nome` | `name` |
| `quantidade` | `quantity` |
| `unidade` | `unit` |
| `valorUnitario` | `unitPriceCents` |
| `total` | `totalCents` (derivado, somente leitura) |
| `adicionaisGerais` | `generalAddOns` |
| `dataPrimeiroEnvio` | `firstSentAt` |
| `dataValidade` | `validUntil` |
| `dataConfirmacao` | `confirmedAt` |
| `dataInicioProducao` | `productionStartedAt` |
| `dataInstalacaoAgendada` | `scheduledInstallationAt` |
| `dataConclusao` | `completedAt` |
| `dataCriacao` | `createdAt` |
| `dataAtualizacao` | `updatedAt` |
| `expirado` | `expired` |
| `instalacaoAtrasada` | `lateInstallation` |

Regras de contrato:

- Dinheiro sempre em centavos inteiros (`*Cents`).
- Medidas e quantidades como números JSON; medidas com até 3 casas; quantidades com até 6 casas.
- Datas em ISO 8601 UTC (`Timestamptz` convertido para UTC na serialização).
- Enums em inglês.
- `quoteNumber`, `customerId`, `status`, timestamps e derivados são somente leitura na resposta.
- `curtains[].id` e `components[].id` são opcionais na entrada (D117) e sempre presentes na saída.
- `sequence` não é aceito na entrada; é derivado da ordem.
- `discount` tem o formato `{ "type": "NO_DISCOUNT" | "PERCENTAGE" | "FIXED_AMOUNT", "percentage": number | null, "fixedAmountCents": number | null }`.
- `installationAddress` pode ser `null` ou parcial em `DRAFT`.
- A resposta de detalhe inclui `totals` com os campos de D93.
- Entidades de domínio nunca são retornadas diretamente.

**Motivo:** `ARCHITECTURE.md` §14.3; D66–D68; D73.

---

### 3.15 Atualização

#### D117 — Semântica de atualização [A]

Decisão aprovada em 2026-10-19, com ajuste:

- `PATCH /orcamentos/:id` só é permitido em `DRAFT` ou `SENT` (incluindo a condição derivada expirada).
- É proibido em `CONFIRMED`, `IN_PRODUCTION`, `COMPLETED` e `CANCELLED`.
- O `PATCH` é **realmente parcial**.

Campos escalares:

- campo omitido → mantém o valor atual;
- campo com `null` → limpa o valor quando o campo permite ausência;
- campo com valor → substitui o valor atual;
- campo opcional omitido **não** é tratado como `null`.

Coleções editáveis do aggregate:

- coleção omitida → não altera a coleção existente;
- coleção enviada → representa o **estado completo** daquela coleção.

Reconciliação de filhos:

- item com `id` existente e pertencente ao orçamento → atualizar;
- item sem `id` → criar nova Entity com UUID;
- item existente ausente de uma coleção que foi enviada → remover;
- `id` inexistente ou pertencente a outro orçamento → rejeitar;
- `sequence` das cortinas é recalculada para `1..N` conforme a ordem recebida.

As regras de coleção se aplicam em cada nível:

- `curtains` omitido → nenhuma cortina é criada, alterada ou removida;
- `curtains` enviado → o array é o conjunto completo de cortinas;
- `components` de uma cortina enviada omitido → os componentes existentes permanecem;
- `components` enviado → o array é o conjunto completo de componentes daquela cortina;
- `generalAddOns` omitido → os adicionais existentes permanecem;
- `generalAddOns` enviado → o array é o conjunto completo de adicionais gerais.

Demais regras:

- `customerId`, `quoteNumber` e `status` não são aceitos no corpo.
- Editar um orçamento `SENT` mantém status, `firstSentAt` e `validUntil`.
- `installationAddress` e `discount` seguem a regra de campo: omitido mantém, `null` limpa quando permitido, objeto enviado substitui o valor completo.
- Um `PATCH` simples de `notes`, `discount` ou `installationAddress` não exige reenvio das cortinas.
- A remoção de uma cortina remove seus componentes em cascade.
- A operação inteira é atômica.
- Se houver qualquer mudança efetiva, grava **um único** `QUOTE_EDITED` com o diff relevante da edição (D109).
- Se nada mudar, responde `200` com o detalhe e não grava evento.

Alternativas consideradas:

| Alternativa | Avaliação |
|---|---|
| Substituição total do recurso (campos omitidos limpos) | simples, mas transforma `PATCH` em `PUT` e apaga dados sem intenção explícita |
| Substituir todas as coleções (delete + recreate) | simples, mas troca ids a cada salvamento e dificulta rastrear itens |
| Reconciliar por `id` (aprovado) | preserva identidade das Entities internas e permite diff coerente |
| Reconciliar por `sequence` | frágil quando a ordem muda |

**Aprovação (2026-10-19):** `PATCH` parcial conforme acima. Campos opcionais omitidos não são tratados como `null`. Coleções enviadas (`curtains`, `components` de cada cortina e `generalAddOns`) são conjuntos completos; coleções omitidas permanecem inalteradas. A reconciliação por `id` e o recálculo de `sequence` são atômicos e geram no máximo um `QUOTE_EDITED`.

**Motivo:** `ARCHITECTURE.md` §3.3–§3.4; `PROJECT_SPEC.md` §15.

---

### 3.16 Erros

#### D118 — Taxonomia de erros e mapeamento HTTP [P]

| Erro | Origem | HTTP |
|---|---|---|
| `QuoteNotFoundError` | aggregate/use case | `404` |
| `QuoteCustomerNotFoundError` | criação | `404` |
| `InvalidQuoteTransitionError` | aggregate | `409` |
| `QuoteNotEditableError` | aggregate | `409` |
| `QuoteValidationError` (com violações) | gate/invariantes | `422` |
| `UnknownQuoteItemError` / `ForeignKeyMismatchError` | atualização | `422` |
| erro estrutural de DTO | `ValidationPipe` | `400` |
| sessão ausente/inválida | `AuthGuard` | `401` |
| erro inesperado | qualquer camada | `500` genérico |

- Erros de domínio não conhecem HTTP.
- A Presentation mapeia categorias; nenhum stack trace ou detalhe de persistência é exposto.
- `QuoteValidationError` carrega a lista de regras violadas; a resposta pode expor `message` e `errors` sem dados internos.
- `409` é reservado a conflito de estado; `422` a dados de negócio inválidos.

**Motivo:** `ARCHITECTURE.md` §15; D69.

---

### 3.17 Transações

#### D119 — Fronteira transacional [P]

- Toda operação de escrita executa em **uma** transação interativa do Prisma.
- Criação: incremento do contador + inserção do orçamento + filhos + `QUOTE_CREATED` na mesma transação.
- Mutações: leitura do aggregate + validação + persistência + evento de histórico na mesma transação.
- Exclusão de rascunho: `DELETE` único com cascade.
- Consultas não abrem transação.
- Geração de PDF/ordem de produção, na Fase 8, não mantém transação aberta.
- Não será criado Unit of Work genérico. O mecanismo concreto pode ser um método transacional no repository de infraestrutura ou um helper estreito do próprio módulo; a Application não conhece Prisma.
- A assinatura concreta do método de criação pode ser refinada na implementação, desde que preserve a atomicidade descrita.

**Motivo:** `ARCHITECTURE.md` §11–§12; D70.

---

### 3.18 Concorrência

#### D120 — Concorrência [F]

- Estratégia inicial: **last-write-wins**, sem coluna `version` e sem optimistic locking.
- A unicidade do número é garantida pelo contador atômico e pela constraint `UNIQUE`.
- Ações revalidam o estado atual dentro da transação; uma segunda ação concorrente sobre estado já alterado recebe `404` ou `409`.
- Exclusão concorrente com transição: uma operação vence; a outra recebe conflito ou não encontrado.
- O risco de sobrescrita em edições simultâneas é aceito e documentado. Optimistic locking fica adiado conforme `ARCHITECTURE.md` §22 e D75.

**Motivo:** `ARCHITECTURE.md` §22; D75.

---

### 3.19 Testes

#### D121 — Estratégia de testes [F]/[P]

Unitários:

- `Money` e arredondamento `HALF_UP`;
- `QuoteNumber`;
- `Discount` e cálculo percentual;
- `InstallationAddress` (completo/parcial);
- `FinancialItem` (validações e total);
- `Curtain` (cálculos, defaults, sequência);
- `Quote` (transições, gates, totais, expiração, reabertura, renovação, cancelamento, edição).

Integração:

- mapper e repository;
- carregamento completo do aggregate e reconciliação de filhos;
- numeração concorrente (criações paralelas sem número duplicado);
- rollback transacional (número/orçamento/histórico);
- cascades e constraints do banco;
- queries de busca, filtros de `EXPIRED` e histórico.

E2E:

- login → cliente → rascunho → envio → confirmação → produção → instalação → conclusão;
- transições inválidas;
- expiração e renovação;
- reabertura;
- cancelamento;
- exclusão de rascunho;
- proteção de rotas sem sessão.

Padrões: PostgreSQL real, tokens aleatórios para isolamento, limpeza por ids rastreados, cookie de sessão válido e `Origin` permitido, espelhando os testes de Clientes.

**Motivo:** `ARCHITECTURE.md` §17; D71.

---

### 3.20 Índices

#### D122 — Índices [F]

Os índices existentes são suficientes:

| Índice | Consulta |
|---|---|
| `quotes.customer_id` | histórico de orçamentos do cliente |
| `quotes.status` | filtros por situação |
| `quotes.valid_until` | separação entre `SENT` válido e expirado |
| `quotes.scheduled_installation_at` | próximas instalações, semana e atrasadas |
| `quote_history(quote_id, occurred_at)` | histórico cronológico |
| `financial_components.curtain_id` | carregamento do aggregate |
| `general_add_ons.quote_id` | carregamento do aggregate |
| `quotes.quote_number` UNIQUE | busca por número |
| `curtains(quote_id, sequence)` UNIQUE | ordenação e unicidade |

Nenhum índice novo é necessário nesta fase. Índices compostos, índice parcial e índices de cidade continuam deliberadamente excluídos até existir necessidade concreta (D17). Nenhuma migration é prevista.

**Motivo:** `ARCHITECTURE.md` §13.3; `01-prisma-indexes.md`.

---

### 3.21 Estrutura do módulo

#### D123 — Estrutura do módulo e wiring [F]/[P]

- Módulo `backend/src/modules/orcamentos/` com `domain/`, `application/`, `infrastructure/`, `presentation/` e `orcamentos.module.ts`, conforme `ARCHITECTURE.md` §19.
- `Money` permanece em `orcamentos/domain/value-objects/`; só será movido para `shared` se outro módulo realmente o reutilizar.
- `OrcamentosModule` importa `AuthModule` e `PrismaModule`.
- Providers seguem o padrão de Clientes: token de classe abstrata para ports, implementação Prisma na infraestrutura.
- `OrcamentosController` é registrado no módulo e aplica `AuthGuard`.
- As rotas aninhadas `/clientes/:customerId/orcamentos` pertencem ao controller de Orçamentos; o módulo de Clientes não importa Orçamentos, evitando ciclo.
- `OrcamentosModule` é importado em `AppModule`.
- Nenhuma alteração em `ClientesModule` é necessária.

**Motivo:** `ARCHITECTURE.md` §19; padrão vigente de `ClientesModule`.

---

### 3.22 Escopo e exclusões

#### D124 — Escopo desta fase e exclusões [F]

Incluído no escopo das decisões:

- aggregate, entidades internas e VOs;
- numeração;
- criação e edição;
- ciclo de vida e histórico;
- instalação;
- queries básicas de orçamento;
- API HTTP correspondente.

Fora do escopo desta spec e das tasks dele derivadas:

- geração de PDF comercial e ordem de produção (Fase 8);
- dashboard e consultas operacionais detalhadas (Fase 9);
- dados do negócio (Fase 10);
- frontend (Fase 11);
- biblioteca de PDF, hosting, observabilidade, MFA e demais itens de `ARCHITECTURE.md` §22;
- alteração de schema ou migration.

**Motivo:** `IMPLEMENTATION_PLAN.md` Fases 4–9; `ARCHITECTURE.md` §22.

---

## 4. Tabela de revisão — decisões materialmente abertas

Somente decisões **[P]**, **[V]** ou aprovadas nesta revisão que alteram comportamento, contrato ou fronteira. Decisões [F] não aparecem.

| Decisão | Alternativas | Recomendação | Motivo | Bloqueante? |
|---|---|---|---|---|
| D78 — cliente ativo na criação | exigir ativo / permitir removido logicamente | exigir cliente existente e ativo | coerência com soft delete e com a criação a partir da tela do cliente | Não |
| D81 — fuso do ano comercial | UTC / fuso do servidor / `America/Sao_Paulo` | `America/Sao_Paulo` | é o fuso comercial do negócio; evita virada de ano às 21h de 31/12 | Não — aprovada em 2026-10-19 |
| D81 — padding acima de 999 | fixar 3 dígitos / crescer naturalmente | crescer para 4+ dígitos | evita limite artificial sem mudar o formato | Não — aprovada em 2026-10-19 |
| D83/D117 — identidade na edição | substituir coleções / reconciliar por `id` | reconciliar por `id`, `sequence` derivada da ordem | preserva Entities internas e permite diff coerente | Não — aprovada com ajuste em 2026-10-19 |
| D86 — aritmética decimal | `decimal.js` / inteiros escalados | inteiros escalados com `BigInt` | exatidão sem dependência nova | Não |
| D87 — `unit` opcional | obrigatório no envio / opcional | opcional | o gate de §8.5 não exige unidade; schema nullable | Não |
| D92 — contrato do ajuste | aceitar ajuste / aceitar total final desejado / ambos | aceitar apenas `commercialAdjustmentCents` | uma única fonte de verdade no backend | Não — aprovada em 2026-10-19 |
| D95 — endereço parcial | all-or-nothing / parcial no rascunho | parcial no rascunho, completo no envio | `PROJECT_SPEC` §5 permite endereço vazio durante o rascunho | Não |
| D97 — cliente removido no envio | bloquear / permitir | bloquear | evita enviar orçamento de cliente excluído | Não — aprovada em 2026-10-19 |
| D98 — validade no primeiro envio | aceitar passado / exigir futura | exigir estritamente futura | evita orçamento já expirado no envio | Não — aprovada em 2026-10-19 |
| D99 — `validUntil` nulo em `SENT` | permitir confirmação / bloquear | bloquear como estado inconsistente | `SENT` sempre deveria ter validade | Não |
| D100 — `confirmedAt` na reabertura | manter / limpar | limpar e registrar o anterior no histórico | evita data de confirmação obsoleta | Não — aprovada em 2026-10-19 |
| D100 — instalação na reabertura | limpar / preservar | limpar e registrar o valor anterior no histórico | evita agendamento inacessível em `SENT` e mantém rastreabilidade | Não — aprovada com ajuste em 2026-10-19 |
| D101 — renovar `SENT` válido | permitir / apenas expirado | permitir | `PROJECT_SPEC` §8.6 permite renovar em `SENT` | Não |
| D102 — motivo do cancelamento | coluna / histórico | histórico, limite de 500 caracteres | D1; nenhuma coluna prevista | Não |
| D104 — instalação idêntica | gravar evento / no-op | no-op sem evento | evita ruído no histórico | Não |
| D109 — payload de `details` | schema versionado / JSON livre | JSON livre com o contrato mínimo da tabela | D18; simplicidade do MVP | Não |
| D113 — paginação | paginar / listar tudo | listar tudo no MVP | volume inicial baixo; o `PROJECT_SPEC` não exige paginação | Não |
| D116 — ids aninhados | exigir / opcionais | opcionais para reconciliação | compatível com D117 | Não |
| D118 — status de erro | 400 para tudo / 409 + 422 | 409 para estado, 422 para validação de negócio | distingue conflito de dados inválidos | Não |
| D119 — mecanismo transacional | Unit of Work / método transacional no repository | método transacional module-scoped | evita abstração genérica | Parcial |
| D123 — dono das rotas aninhadas | Clientes / Orçamentos | Orçamentos | evita dependência circular entre módulos | Não |

---

## 5. Respostas às perguntas obrigatórias

### 5.1 Alguma regra de negócio foi inventada?

Não. Nenhuma decisão contradiz `PROJECT_SPEC`, `ARCHITECTURE` ou D1–D75. Onde as fontes eram silentes, a resposta foi marcada como **[P]** ou **[V]**. Em 2026-10-19, D81, D92, D97, D98, D100 e D117 foram aprovadas e passaram a **[A]**; as demais continuam como propostas. As extrapolações são:

- fuso do ano comercial e padding acima de 999 (D81 — aprovada);
- exigência de cliente ativo na criação e no envio (D78/D97 — D97 aprovada);
- validade estritamente futura no envio (D98 — aprovada);
- limpeza de `confirmedAt` e de `scheduledInstallationAt` na reabertura (D100 — aprovada com ajuste);
- contrato do ajuste comercial apenas por `commercialAdjustmentCents` (D92 — aprovada);
- reconciliação de filhos por `id` e `PATCH` parcial (D83/D117 — D117 aprovada com ajuste);
- `unit` opcional (D87);
- no-op de instalação idêntica (D104);
- limite de 500 caracteres para o motivo de cancelamento (D102);
- ausência de paginação (D113).

### 5.2 Orçamento continua sendo Aggregate Root independente?

Sim. `Quote` é o único Aggregate Root do módulo (D76). `Customer` permanece um Aggregate Root separado, referenciado apenas por `customerId`.

### 5.3 Cliente está fora do aggregate?

Sim. O aggregate não carrega nem altera o cliente. O vínculo é imutável e usa FK `Restrict`. O endereço do cliente é copiado como snapshot para o orçamento, sem compartilhamento de Value Object entre módulos (D76, D78, D94, D111).

### 5.4 Cortina é Entity interna?

Sim. `Curtain` e `FinancialItem` são Entities internas, com identidade própria, sem repositories e com cascade a partir de `Quote` (D76, D83, D87, D112).

### 5.5 Histórico está fora do aggregate carregado?

Sim. `quote_history` é uma tabela separada, consultada por query própria, e não integra o aggregate. A Application grava os eventos na mesma transação da mudança de estado. Não é event sourcing (D108).

### 5.6 Algum valor derivado é persistido?

Não. Não são persistidos:

- `finalWidth`;
- `fabricQuantity`;
- totais de item, cortina, adicionais, subtotal, desconto, total calculado e total final;
- a condição `expired`;
- a condição `lateInstallation`.

Todos são recalculados na leitura (D85, D93, D106, D107).

### 5.7 Há ambiguidade de ciclo de vida?

As ambiguidades materiais foram resolvidas na revisão de 2026-10-19:

1. limpeza de `confirmedAt` na reabertura — D100 aprovada;
2. destinação de `scheduledInstallationAt` na reabertura — D100 aprovada com ajuste (limpar e registrar o valor anterior);
3. cliente removido logicamente no gate de envio — D97 aprovada (bloquear);
4. validade passada no primeiro envio — D98 aprovada (exigir futura).

Permanecem como propostas não bloqueantes:

5. renovação de `SENT` ainda válido (D101) — recomendação: permitir;
6. `validUntil` nulo em `SENT` (D99) — recomendação: bloquear a confirmação como estado inconsistente.

### 5.8 As ações HTTP estão bem definidas?

Sim. As transições são ações explícitas `POST`; não há `PATCH` de status; instalação usa `PUT`/`DELETE`; a exclusão física é `DELETE` restrita a rascunho (D96, D110, D115). Pontos ainda abertos: status de erro (D118), paginação (D113) e contrato de certos detalhes (D109).

### 5.9 Prisma está restrito?

Sim. Prisma permanece exclusivamente na Infrastructure Layer. O domínio não importa Prisma, NestJS ou HTTP. Mappers convertem `Prisma.Decimal` para tipos do domínio. A Application depende de ports, não do client Prisma (D112, D119, D123).

### 5.10 Há abstração especulativa?

Não. Foram explicitamente rejeitados:

- repository genérico;
- Unit of Work genérico;
- Domain Events/event bus;
- CQRS formal;
- soft delete de orçamento;
- entidade `Service`;
- entidade `Environment`;
- `TrackType` estruturado;
- catálogo de tecidos;
- versão formal de orçamento;
- ordem de produção persistida;
- paginação antecipada;
- `decimal.js` sem necessidade comprovada.

O único mecanismo novo é o transaction helper estreito do próprio módulo, justificado pela atomicidade exigida (D119).

### 5.11 As decisões são suficientes para decompor em tasks atômicas?

Sim. As seis decisões que bloqueavam a decomposição foram aprovadas em 2026-10-19:

- D81 — fuso e padding;
- D92 — contrato do ajuste comercial;
- D97 — cliente ativo no envio;
- D98 — validade futura no envio;
- D100 — `confirmedAt` e instalação na reabertura (com ajuste);
- D117 — semântica de atualização e reconciliação de filhos (com ajuste).

As demais decisões **[P]** podem ser resolvidas durante a implementação com as recomendações deste documento. Nenhuma task foi criada nesta etapa.

---

## 6. Riscos

| ID | Risco | Mitigação |
|---|---|---|
| R1 | fuso do ano comercial divergente entre ambientes | fixar `America/Sao_Paulo` e testar a virada do ano (D81) |
| R2 | número reservado sem orçamento | transação única (D80/D119); lacunas são aceitáveis |
| R3 | edições concorrentes sobrescritas | last-write-wins documentado (D120) |
| R4 | reconciliação de filhos apaga ou duplica itens | contrato por `id` + testes de integração (D117) |
| R5 | divergência de arredondamento entre domínio e SQL | fórmulas centralizadas; projeções só somam valores já calculados (D93) |
| R6 | `EXPIRED` tratado como status | derivar sempre por `status + validUntil` (D106) |
| R7 | histórico sem contrato | payload mínimo definido em D109 |
| R8 | transições implementadas fora do aggregate | métodos de domínio obrigatórios (D96) |
| R9 | cliente removido com rascunho pendente | bloqueio proposto em D97 |
| R10 | overflow em cálculos monetários | `BigInt` e validação de faixa (D86) |
| R11 | `confirmedAt` obsoleto após reabertura | limpeza aprovada em D100; valor anterior no histórico |
| R12 | implementação fragmentada em specs divergentes | consolidar em `04-orcamentos.md` e ajustar o plano na decomposição |
| R13 | listas sem paginação | aceito no MVP; reavaliar com dados reais |
| R14 | eventos de PDF/ordem de produção emitidos antes da Fase 8 | restringir emissão à fase correspondente (D108/D124) |

---

## 7. Condição de parada

- Nenhuma implementação foi realizada.
- Nenhum schema, migration, endpoint, repository ou teste foi alterado.
- Nenhuma task `ORCAMENTO-03+` foi criada.
- As decisões bloqueantes D81, D92, D97, D98, D100 e D117 foram aprovadas em 2026-10-19 e não impedem mais a decomposição.
- As demais decisões **[P]** podem ser validadas antes ou durante a decomposição; as recomendações deste documento permanecem como padrão provisório.

# 7. Tasks de implementação — módulo Orçamento

## 7.1 Workflow obrigatório para todas as tasks

Toda task implementável desta fase deve seguir:

```text
READ
→ IMPLEMENT
→ VERIFY
→ SEMANTIC REVIEW
→ REPAIR
→ RE-VERIFY
→ DONE
```

Nenhuma task deve ser considerada concluída apenas porque o código compila.

### Gate 1 — verificação mecânica

Executar os checks aplicáveis à task:

- testes unitários específicos;
- testes de integração específicos;
- testes E2E, quando houver contrato HTTP;
- `pnpm lint`;
- `pnpm test`;
- `pnpm build`;
- `pnpm exec prisma validate`, quando houver interação com persistência/schema;
- `pnpm exec prisma migrate status`, quando relevante.

### Gate 2 — revisão semântica

Antes de concluir cada task, revisar explicitamente contra:

1. `docs/PROJECT_SPEC.md`;
2. `docs/ARCHITECTURE.md`;
3. `docs/development/04-orcamentos.md`;
4. `AGENTS.md`;
5. acceptance criteria da própria task.

A revisão deve procurar, no mínimo:

- regra de negócio inventada;
- domínio dependente de Nest/Prisma/HTTP;
- valores derivados persistidos indevidamente;
- alteração incorreta de estado;
- histórico ausente;
- transação incompleta;
- arredondamento incorreto;
- reconciliação destrutiva de filhos;
- Prisma fora de `infrastructure`;
- abstração genérica/especulativa;
- arquivos fora do escopo.

### Regra de reparo

Se a verificação ou revisão encontrar problema:

1. não encerrar a task;
2. reparar;
3. executar novamente os testes diretamente afetados;
4. executar novamente os gates gerais;
5. repetir a revisão semântica.

### Git

Preferência: uma task implementável concluída = um commit atômico.

Não fazer commit se:

- houver teste falhando;
- houver finding sem tratamento;
- houver alteração fora do escopo;
- a revisão semântica não tiver sido concluída.

---

# ORCAMENTO-03 — Scaffold e wiring do módulo

## Goal

Criar exclusivamente a estrutura arquitetural do módulo Orçamentos.

## Scope

Criar:

```text
src/modules/orcamentos/
├── domain/
├── application/
├── infrastructure/
├── presentation/
└── orcamentos.module.ts
```

Integrar:

- `OrcamentosModule` em `AppModule`;
- `AuthModule` em `OrcamentosModule`;
- `PrismaModule` em `OrcamentosModule`.

Não criar comportamento de negócio.

As rotas aninhadas futuras:

```text
/clientes/:customerId/orcamentos
```

pertencem ao módulo/controller de Orçamentos.

Não alterar `ClientesModule`.

## Acceptance criteria

- aplicação inicializa;
- módulo resolve imports corretamente;
- nenhum endpoint funcional ainda;
- nenhum repository genérico;
- nenhum código Prisma fora de infrastructure;
- nenhuma dependência circular Clientes ↔ Orçamentos.

## Verification

- `pnpm lint`
- `pnpm test`
- `pnpm build`

## Semantic review

Confirmar:

- estrutura compatível com D123;
- nenhuma implementação antecipada;
- Auth reutilizada, não duplicada.

## Commit sugerido

`chore(ORCAMENTO-03): scaffold quotes module`

---

# ORCAMENTO-04 — Implementar Money e aritmética monetária exata

## Goal

Criar a representação monetária do domínio e as operações HALF_UP necessárias aos cálculos futuros.

## Scope

Implementar `Money` no domínio de Orçamentos.

Regras:

- representação interna em centavos inteiros;
- sem `float` para dinheiro;
- suportar soma/subtração;
- validar range compatível com persistência;
- cálculo quantidade × preço usando escala em milionésimos;
- usar `BigInt` internamente onde necessário;
- arredondamento monetário `HALF_UP`.

Implementar helper puro equivalente a:

```text
totalCents =
  HALF_UP(quantityMicro × unitPriceCents / 1_000_000)
```

Não introduzir `decimal.js`.

## Tests obrigatórios

Cobrir:

- zero;
- valores positivos;
- soma;
- subtração;
- arredondamento abaixo de meio centavo;
- exatamente meio centavo;
- acima de meio centavo;
- valores grandes próximos aos limites aceitos;
- overflow/rejeição fora do range;
- nenhum erro por ponto flutuante.

## Double-check

Comparar resultados manualmente em casos conhecidos.

Exemplo:

```text
1,500000 × R$ 30,00 = R$ 45,00
```

## Commit sugerido

`feat(ORCAMENTO-04): implement exact money arithmetic`

---

# ORCAMENTO-05 — Implementar utilitários de medidas e precisão

## Goal

Garantir aritmética exata para medidas e quantidades.

## Scope

Implementar representação/conversão para:

- medida de entrada: escala 3;
- fator: escala 3;
- quantidade derivada: escala 6.

Utilizar inteiros escalados:

```text
openingWidthMilli
borderMilli
fabricFactorMilli
fabricQuantityMicro
```

Sem arredondamento automático de metragem.

## Tests obrigatórios

- `2.000 + 2 × 0.150 = 2.300`;
- `2.300 × 3.500 = 8.050000`;
- valores com três casas;
- resultados com seis casas;
- `border = 0`;
- rejeição de escala excessiva;
- negativos rejeitados;
- nenhum uso acidental de Float para cálculo.

## Semantic review

Confirmar que:

- altura não participa da quantidade de tecido;
- nenhum derivado foi persistido;
- medidas continuam expressas em metros externamente.

## Commit sugerido

`feat(ORCAMENTO-05): implement exact quote measurement arithmetic`

---

# ORCAMENTO-06 — Implementar QuoteNumber

## Goal

Implementar o Value Object do número comercial do orçamento.

## Scope

Formato canônico:

```text
ORÇ-AAAA-NNN
```

Regras aprovadas:

- ano comercial em `America/Sao_Paulo`;
- mínimo de três dígitos;
- acima de 999 cresce naturalmente;
- imutável;
- valida formato;
- pode expor ano/sequencial;
- não conhece banco, Prisma, locks ou relógio.

## Tests obrigatórios

- `ORÇ-2026-001`;
- `ORÇ-2026-999`;
- `ORÇ-2026-1000`;
- formatos inválidos;
- caracteres incorretos;
- ano/sequência extraídos corretamente.

## Commit sugerido

`feat(ORCAMENTO-06): implement quote number value object`

---

# ORCAMENTO-07 — Implementar InstallationAddress

## Goal

Representar o snapshot de endereço de instalação.

## Scope

Campos:

- street;
- number;
- neighborhood;
- city;
- complement;
- postalCode;
- state.

Regras:

- em `DRAFT`, endereço pode estar ausente ou parcial;
- strings vazias → `null`;
- CEP presente → oito dígitos;
- UF presente → duas letras maiúsculas;
- endereço completo requer:
  - street;
  - number;
  - neighborhood;
  - city;
- o VO deve conseguir responder `isComplete()`;
- não possui referência para Customer;
- snapshot independente.

Não compartilhar VO com Clientes.

## Tests obrigatórios

- endereço completo;
- endereço parcial;
- ausência;
- CEP formatado/normalizado;
- CEP inválido;
- UF lowercase → uppercase;
- UF inválida;
- `isComplete()`.

## Commit sugerido

`feat(ORCAMENTO-07): implement installation address value object`

---

# ORCAMENTO-08 — Implementar Discount

## Goal

Representar corretamente o desconto global.

## Scope

Tipos:

```text
NO_DISCOUNT
PERCENTAGE
FIXED_AMOUNT
```

Regras:

### NO_DISCOUNT
- percentage = null;
- fixedAmountCents = null.

### PERCENTAGE
- `0 < percentage <= 100`;
- até duas casas;
- fixedAmount nulo.

### FIXED_AMOUNT
- valor > 0;
- percentage nulo.

Validação `fixed <= subtotal` ocorre no contexto onde subtotal é conhecido.

Implementar cálculo percentual exato com `HALF_UP`.

## Tests

- combinações válidas;
- combinações inválidas;
- 10%;
- 12,34%;
- 100%;
- arredondamento HALF_UP;
- desconto fixo;
- nenhum desconto.

## Commit sugerido

`feat(ORCAMENTO-08): implement quote discount value object`

---

# ORCAMENTO-09 — Implementar FinancialItem

## Goal

Criar Entity interna compartilhada semanticamente por componentes financeiros e adicionais gerais.

## Scope

Campos:

- id;
- name;
- quantity;
- unit;
- unitPriceCents.

Regras:

- name obrigatório e não vazio;
- quantity pode estar ausente no rascunho;
- unitPrice pode estar ausente no rascunho;
- quando presentes, quantidade e preço devem ser > 0;
- unit é opcional;
- total é derivado;
- nenhum catálogo;
- nenhum tipo especial para mão de obra.

Método derivado:

```text
totalCents
```

usando ORCAMENTO-04.

## Tests

- item completo;
- item incompleto em rascunho;
- quantidade zero/negativa;
- preço zero/negativo;
- total;
- precisão;
- identidade preservada.

## Semantic review

Confirmar que mão de obra permanece apenas preset de UX.

## Commit sugerido

`feat(ORCAMENTO-09): implement financial item entity`

---

# ORCAMENTO-10 — Implementar Curtain

## Goal

Criar Entity Cortina com identidade e cálculos intrínsecos.

## Scope

Campos conforme spec:

- id;
- sequence;
- room;
- description;
- material;
- openingWidth;
- borderValue;
- height;
- fabricFactor;
- notes;
- components.

Defaults de domínio:

```text
borderValue = 0.150
fabricFactor = 3.500
```

Derivados:

```text
finalWidth
fabricQuantity
financialTotal
```

Regras:

- cada registro representa uma cortina;
- UUID próprio;
- sem repository;
- valores negativos rejeitados;
- `borderValue = 0` permitido;
- sequence é 1-based e controlada pelo aggregate;
- incompletude permitida em rascunho.

## Tests

Cobrir:

- defaults;
- valores customizados;
- largura final;
- tecido;
- seis casas;
- componentes;
- total da cortina;
- medidas inválidas;
- nenhuma regra de altura no cálculo de tecido.

## Commit sugerido

`feat(ORCAMENTO-10): implement curtain entity`

---

# ORCAMENTO-11 — Implementar núcleo do Aggregate Quote

## Goal

Criar `Quote` como Aggregate Root, inicialmente focado em estado `DRAFT`, composição e cálculos.

## Scope

Propriedades:

- id;
- quoteNumber;
- customerId;
- status;
- installationAddress;
- curtains;
- generalAddOns;
- discount;
- commercialAdjustmentCents;
- notes;
- lifecycle dates.

Não incluir histórico como coleção interna.

Implementar:

- criação/reconstituição;
- atualização de dados editáveis;
- normalização de sequence `1..N`;
- total de cortinas;
- total de adicionais;
- subtotal;
- valor do desconto;
- calculated total;
- commercial adjustment;
- total final.

Fórmula obrigatória:

```text
subtotal
- discountValue
+ commercialAdjustment
= total
```

Nenhum total persistido.

## Tests

- criação DRAFT;
- customerId imutável;
- quoteNumber imutável;
- totals;
- desconto;
- ajuste positivo;
- ajuste negativo;
- 100% desconto + ajuste positivo;
- filhos vazios;
- sequenciamento;
- nenhum histórico interno.

## Commit sugerido

`feat(ORCAMENTO-11): implement quote aggregate core`

---

# ORCAMENTO-12 — Implementar semântica de PATCH e reconciliação no domínio

## Goal

Materializar D117 sem ambiguidades.

## Scope

Campos escalares:

```text
omitido → mantém
null    → limpa quando permitido
valor   → substitui
```

Coleções:

```text
omitida → mantém coleção atual
enviada → representa estado completo daquela coleção
```

Reconciliação:

- id conhecido e pertencente ao aggregate → atualizar;
- sem id → criar;
- existente ausente de coleção enviada → remover;
- id desconhecido → rejeitar;
- id de outro contexto → rejeitar;
- `Curtain.sequence` recalculada `1..N`.

Aplicar coerentemente a:

- curtains;
- components;
- generalAddOns.

Não permitir alteração de:

- customerId;
- quoteNumber;
- status via PATCH.

## Tests obrigatórios

Testar isoladamente:

- PATCH apenas notes não altera curtains;
- coleção omitida preservada;
- coleção vazia enviada remove filhos;
- update de child por id;
- criação sem id;
- remoção por ausência;
- id inválido;
- id pertencente a outra cortina/orçamento;
- reorder recalcula sequence;
- filhos não duplicados;
- identidade preservada.

## Double-check

Este é um ponto crítico. Fazer revisão específica procurando:

- perda acidental de filhos;
- recriação desnecessária de UUIDs;
- efeito PUT disfarçado de PATCH.

## Commit sugerido

`feat(ORCAMENTO-12): implement quote child reconciliation`

---

# ORCAMENTO-13 — Implementar máquina de estados do Quote

## Goal

Centralizar todas as transições no Aggregate Root.

## Scope

Implementar comportamento para:

- markAsSent;
- confirm;
- reopen;
- renew;
- cancel;
- startProduction;
- schedule/change/remove installation;
- complete.

Status persistidos exclusivamente:

```text
DRAFT
SENT
CONFIRMED
IN_PRODUCTION
COMPLETED
CANCELLED
```

Não criar `EXPIRED`.

Não permitir atribuição direta de status pela Application.

## Tests

Criar matriz completa origem × ação.

Testar todas as transições válidas e inválidas.

Especialmente:

- DRAFT → SENT;
- SENT → CONFIRMED;
- CONFIRMED → SENT;
- CONFIRMED → IN_PRODUCTION;
- IN_PRODUCTION → COMPLETED;
- cancelamentos permitidos;
- cancelamento proibido após produção;
- COMPLETED terminal;
- CANCELLED terminal.

## Commit sugerido

`feat(ORCAMENTO-13): implement quote state machine`

---

# ORCAMENTO-14 — Implementar gate de envio

## Goal

Centralizar as condições necessárias para `markAsSent`.

## Scope

O domínio deve validar:

- endereço completo;
- pelo menos uma cortina;
- cada cortina com dados necessários;
- medidas válidas;
- material quando exigido;
- pelo menos um componente completo por cortina;
- componentes presentes completos;
- adicionais presentes completos;
- desconto válido contra subtotal;
- total final > 0.

A verificação de Cliente ativo é responsabilidade de aplicação, pois Customer é outro aggregate.

## Tests

Criar teste individual para cada violação.

Criar teste com múltiplas violações simultâneas, se o contrato prevê lista de violações.

Testar orçamento completamente válido.

## Double-check

Comparar o gate campo a campo com `PROJECT_SPEC`.

Não adicionar requisito não documentado, como unidade obrigatória.

## Commit sugerido

`feat(ORCAMENTO-14): implement quote send validation gate`

---

# ORCAMENTO-15 — Implementar validade e condições derivadas

## Goal

Implementar comportamento temporal sem persistir status derivados.

## Scope

- firstSentAt;
- validUntil;
- default `now + 30 dias`;
- validade explicitamente informada deve ser futura;
- `isExpired(now)`;
- instalação atrasada derivada;
- renovação de `SENT`, mesmo ainda válido.

Fonte de tempo deve ser testável; evitar chamadas espalhadas a `new Date()` no domínio.

Não criar scheduler.

## Tests

- validade default;
- validade custom futura;
- validade passada rejeitada;
- exatamente no limite;
- expirado;
- não expirado;
- status que não deve aparecer como expirado;
- instalação futura/passada.

## Commit sugerido

`feat(ORCAMENTO-15): implement quote temporal rules`

---

# ORCAMENTO-16 — Implementar reabertura e limpeza das datas aprovadas

## Goal

Materializar D100 revisada.

## Scope

Em:

```text
CONFIRMED → SENT
```

deve:

- `confirmedAt = null`;
- `scheduledInstallationAt = null`;
- preservar:
  - quoteNumber;
  - firstSentAt;
  - validUntil;
- não renovar automaticamente;
- voltar a permitir edição.

Os valores anteriores devem ficar disponíveis à Application para composição do histórico.

## Tests

- confirmedAt limpo;
- instalação limpa;
- firstSentAt preservado;
- validUntil preservado;
- orçamento expirado continua expirado após reabrir;
- reabertura fora de CONFIRMED rejeitada.

## Commit sugerido

`feat(ORCAMENTO-16): implement quote reopening semantics`

---

# ORCAMENTO-17 — Implementar contratos de histórico

## Goal

Definir os dados necessários para cada evento sem incorporar histórico ao aggregate.

## Scope

Criar tipos/builders estreitos para `details` conforme D109.

Eventos desta fase incluem:

- QUOTE_CREATED;
- QUOTE_SENT;
- QUOTE_EDITED;
- QUOTE_CONFIRMED;
- QUOTE_REOPENED;
- QUOTE_RENEWED;
- QUOTE_CANCELLED;
- PRODUCTION_STARTED;
- INSTALLATION_SCHEDULED;
- INSTALLATION_CHANGED;
- INSTALLATION_REMOVED;
- SERVICE_COMPLETED.

Não emitir nesta fase:

- COMMERCIAL_PDF_GENERATED;
- PRODUCTION_ORDER_GENERATED.

`QUOTE_EDITED` deve representar uma edição salva com um único evento.

## Tests

- payload de cada evento;
- campos opcionais;
- motivo cancelamento;
- previousConfirmedAt;
- previousScheduledInstallationAt;
- diff de edição.

## Commit sugerido

`feat(ORCAMENTO-17): define quote history contracts`

---

# ORCAMENTO-18 — Definir ports de aplicação e QuoteRepository

## Goal

Criar contratos mínimos necessários para persistência e dependências externas.

## Scope

Criar:

### QuoteRepository
- findById;
- save/reconcile conforme necessidade concreta;
- operação de criação transacional conforme D119;
- deleteDraft, se fizer sentido como operação específica.

### Customer eligibility/read port

Port estreito para responder:

```text
cliente existe e está ativo?
```

Não importar aggregate Customer para Quote.

### Clock, se necessário

Somente se a solução adotada para tempo justificar formalização.

Não criar:

- GenericRepository;
- repository para Curtain;
- repository para FinancialItem;
- UnitOfWork genérico.

## Verification

- build;
- testes de compilação/contratos quando úteis.

## Semantic review

Cada método precisa ter consumidor conhecido.

## Commit sugerido

`feat(ORCAMENTO-18): define quote application ports`

---

# ORCAMENTO-19 — Implementar QuoteMapper

## Goal

Mapear aggregate completo Prisma ↔ domínio.

## Scope

Mapear:

- Quote;
- Curtains;
- FinancialComponents;
- GeneralAddOns;
- Discount;
- InstallationAddress;
- lifecycle dates.

Não mapear:

- history para dentro do aggregate;
- valores derivados;
- totals.

## Tests

Round-trip:

- rascunho mínimo;
- rascunho completo;
- vários filhos;
- endereço parcial;
- desconto percentual;
- desconto fixo;
- ajuste negativo;
- lifecycle avançado.

## Double-check

Confirmar que nenhuma entidade recebe UUID novo durante `toDomain`.

## Commit sugerido

`feat(ORCAMENTO-19): implement quote persistence mapper`

---

# ORCAMENTO-20 — Implementar contador anual atômico

## Goal

Reservar números de orçamento com segurança concorrente.

## Scope

Usar `QuoteSequence`.

Garantir:

- incremento atômico;
- sem `MAX()+1`;
- reset natural por chave `year`;
- número não reutilizado;
- gaps permitidos;
- ano `America/Sao_Paulo`.

A implementação deve poder participar da transação de criação do orçamento.

## Integration tests obrigatórios

- primeiro número do ano;
- segundo número;
- anos diferentes;
- acima de 999;
- múltiplas reservas concorrentes sem duplicidade;
- unique constraint permanece defesa final.

## Commit sugerido

`feat(ORCAMENTO-20): implement atomic quote numbering`

---

# ORCAMENTO-21 — Implementar PrismaQuoteRepository — carregamento

## Goal

Reconstruir corretamente o aggregate completo.

## Scope

`findById` deve carregar:

```text
Quote
+ Curtains
  + FinancialComponents
+ GeneralAddOns
```

Não carregar histórico.

Deve funcionar também para status terminais.

## Integration tests

- sem filhos;
- múltiplas cortinas;
- múltiplos componentes;
- adicionais;
- endereço;
- desconto;
- status terminal;
- not found.

## Commit sugerido

`feat(ORCAMENTO-21): implement quote aggregate loading`

---

# ORCAMENTO-22 — Implementar persistência e reconciliação Prisma

## Goal

Persistir uma alteração do aggregate preservando corretamente identidades e filhos.

## Scope

Persistir atomicamente:

- escalares;
- endereço;
- desconto;
- curtains;
- financial components;
- general add-ons.

Reconciliação conforme D117.

Não executar delete/recreate indiscriminado das coleções.

## Integration tests críticos

- update de filho preserva id;
- reorder;
- create child;
- remove child;
- coleções omitidas preservadas;
- coleção vazia enviada removida;
- tentativa de usar id estrangeiro falha;
- rollback integral em erro no meio da operação.

## Double-check obrigatória

Após cada cenário, consultar diretamente o PostgreSQL e confirmar:

- ausência de duplicatas;
- ausência de órfãos;
- sequence correta;
- IDs esperados.

## Commit sugerido

`feat(ORCAMENTO-22): persist and reconcile quote aggregate`

---

# ORCAMENTO-23 — Implementar fronteira transacional e histórico

## Goal

Garantir D108/D119: estado e histórico nunca divergem.

## Scope

Criar mecanismo estreito, module-scoped, sem Unit of Work genérico.

Para mutações:

```text
BEGIN
→ carregar aggregate
→ validar/mutar
→ persistir aggregate
→ inserir history event
→ COMMIT
```

Para criação:

```text
BEGIN
→ reservar número
→ inserir aggregate e filhos
→ inserir QUOTE_CREATED
→ COMMIT
```

Em falha:

```text
ROLLBACK de tudo
```

## Integration tests obrigatórios

Injetar/forçar falha antes do histórico e provar rollback.

Testar:

- criação sem número órfão dentro da mesma operação;
- estado não muda se history insert falhar;
- history não aparece se aggregate falhar;
- exatamente um evento por operação.

## Commit sugerido

`feat(ORCAMENTO-23): implement transactional quote persistence`

---

# ORCAMENTO-24 — Implementar CreateQuoteFromCustomer

## Goal

Implementar o primeiro salvamento do rascunho.

## Scope

Fluxo:

1. verificar Customer existente e ativo;
2. determinar ano comercial;
3. reservar número;
4. criar Quote DRAFT;
5. aplicar dados enviados;
6. persistir aggregate/filhos;
7. criar `QUOTE_CREATED`;
8. tudo em uma transação.

Customer removido → `404`.

customerId vem da rota e torna-se imutável.

## Tests

- cliente ativo;
- inexistente;
- soft-deleted;
- rascunho mínimo;
- rascunho completo;
- número gerado;
- evento;
- rollback.

## Commit sugerido

`feat(ORCAMENTO-24): implement quote creation`

---

# ORCAMENTO-25 — Implementar UpdateQuote

## Goal

Implementar PATCH realmente parcial.

## Scope

Permitido somente em:

- DRAFT;
- SENT, inclusive expirado.

Usar D117 integralmente.

Se houver alteração efetiva:

- salvar aggregate;
- gerar exatamente um `QUOTE_EDITED`.

Se payload não produzir alteração:

- não gerar ruído de histórico.

Não alterar:

- firstSentAt;
- validUntil apenas por editar;
- status;
- customerId;
- quoteNumber.

## Tests

Cobrir todos os cenários de ORCAMENTO-12 também no nível application + persistence.

Especialmente:

- notes-only;
- adjustment-only;
- endereço parcial;
- coleção omitida;
- child reconciliation;
- status não editável → conflito;
- no-op.

## Commit sugerido

`feat(ORCAMENTO-25): implement quote update use case`

---

# ORCAMENTO-26 — Implementar MarkQuoteAsSent

## Goal

Executar o gate e a primeira transição comercial.

## Scope

Application:

1. carregar Quote;
2. confirmar Customer ainda ativo;
3. executar gate;
4. definir validade;
5. `markAsSent`;
6. persistir;
7. gravar `QUOTE_SENT`;
8. mesma transação.

## Tests

- happy path;
- cada falha do gate;
- cliente removido após criação do draft;
- validade default;
- custom futura;
- passada;
- evento correto;
- rollback.

## Commit sugerido

`feat(ORCAMENTO-26): implement quote sending`

---

# ORCAMENTO-27 — Implementar ConfirmQuote

## Goal

Executar `SENT → CONFIRMED`.

## Scope

- somente SENT;
- bloquear expirado;
- bloquear estado inconsistente sem validUntil;
- preencher confirmedAt;
- gravar `QUOTE_CONFIRMED`.

## Tests

- válido;
- expirado;
- DRAFT;
- CONFIRMED;
- validUntil ausente;
- atomicidade.

## Commit sugerido

`feat(ORCAMENTO-27): implement quote confirmation`

---

# ORCAMENTO-28 — Implementar ReopenQuote

## Goal

Executar D100 aprovada.

## Scope

`CONFIRMED → SENT`

- limpar confirmedAt;
- limpar scheduledInstallationAt;
- preservar firstSentAt/validUntil;
- registrar valores anteriores em `QUOTE_REOPENED`;
- não renovar automaticamente.

## Tests

- datas;
- histórico;
- reabertura expirando imediatamente se validade antiga venceu;
- estado inválido.

## Commit sugerido

`feat(ORCAMENTO-28): implement quote reopening`

---

# ORCAMENTO-29 — Implementar RenewQuote

## Goal

Atualizar validade de orçamento SENT.

## Scope

- somente SENT;
- permitido válido ou expirado;
- nova validade futura;
- status continua SENT;
- quoteNumber permanece;
- firstSentAt permanece;
- `QUOTE_RENEWED`.

## Tests

- expirado;
- ainda válido;
- nova data inválida;
- outro status;
- evento.

## Commit sugerido

`feat(ORCAMENTO-29): implement quote renewal`

---

# ORCAMENTO-30 — Implementar CancelQuote

## Goal

Aplicar cancelamento permitido pelo lifecycle.

## Scope

Permitido conforme state machine até CONFIRMED.

Não permitido em:

- IN_PRODUCTION;
- COMPLETED;
- terminal já cancelado conforme contrato definido.

Motivo:

- opcional;
- registrado apenas no `QUOTE_CANCELLED.details`;
- não adicionar coluna.

## Tests

- DRAFT;
- SENT;
- CONFIRMED;
- IN_PRODUCTION rejeitado;
- COMPLETED rejeitado;
- motivo;
- sem motivo;
- histórico.

## Commit sugerido

`feat(ORCAMENTO-30): implement quote cancellation`

---

# ORCAMENTO-31 — Implementar StartProduction

## Goal

Executar `CONFIRMED → IN_PRODUCTION`.

## Scope

- preencher productionStartedAt;
- registrar `PRODUCTION_STARTED`;
- sem Aggregate/registro ProductionOrder;
- sem gate redundante.

## Tests

- confirmed;
- outros estados;
- data;
- histórico;
- cancelamento posterior bloqueado.

## Commit sugerido

`feat(ORCAMENTO-31): implement production start`

---

# ORCAMENTO-32 — Implementar gerenciamento de instalação

## Goal

Gerenciar `scheduledInstallationAt` sem criar status próprio.

## Scope

Operações:

- agendar;
- alterar;
- remover.

Gerar:

- INSTALLATION_SCHEDULED;
- INSTALLATION_CHANGED;
- INSTALLATION_REMOVED.

Mudança para o mesmo instante → no-op, sem histórico.

Respeitar estados aprovados pela spec.

## Tests

- schedule;
- change;
- remove;
- same value;
- estado inválido;
- histórico;
- instalação atrasada derivada.

## Commit sugerido

`feat(ORCAMENTO-32): implement installation scheduling`

---

# ORCAMENTO-33 — Implementar CompleteQuote

## Goal

Executar `IN_PRODUCTION → COMPLETED`.

## Scope

- preencher completedAt;
- registrar SERVICE_COMPLETED;
- bloquear conclusão quando existir instalação futura, conforme spec;
- COMPLETED torna aggregate terminal.

## Tests

- sem instalação;
- instalação passada;
- instalação futura;
- estado errado;
- imutabilidade após completar.

## Commit sugerido

`feat(ORCAMENTO-33): implement quote completion`

---

# ORCAMENTO-34 — Implementar exclusão física de rascunho

## Goal

Diferenciar exclusão de rascunho de cancelamento comercial.

## Scope

`DELETE` físico permitido apenas para DRAFT conforme spec.

Deleção:

- Quote;
- Curtains;
- components;
- add-ons;
- history associado conforme cascade já aprovado.

Número não é devolvido à sequência.

Não usar soft delete.

## Tests

- DRAFT excluído;
- filhos removidos;
- número não reutilizado;
- outros estados rejeitados;
- not found.

## Commit sugerido

`feat(ORCAMENTO-34): implement draft quote deletion`

---

# ORCAMENTO-35 — Implementar queries de detalhe e histórico

## Goal

Criar projeções de leitura sem reconstruir aggregate desnecessariamente.

## Scope

Implementar:

### GetQuoteQuery
Retornar:

- dados principais;
- endereço;
- curtains;
- components;
- add-ons;
- desconto;
- ajuste;
- derivados de medidas;
- totals;
- lifecycle;
- condição `expired`;
- condição de instalação atrasada.

### ListQuoteHistoryQuery
- ordem `occurredAt ASC, id ASC`;
- details;
- todos os eventos registrados.

Não reutilizar formulas divergentes.

## Tests

Comparar totais da query contra totais do domínio para os mesmos fixtures.

Esse teste de paridade é obrigatório.

## Commit sugerido

`feat(ORCAMENTO-35): implement quote detail and history queries`

---

# ORCAMENTO-36 — Implementar busca/listagem de Orçamentos

## Goal

Implementar projeção resumida para buscas e filtros do MVP.

## Scope

Conforme spec:

- busca por número;
- filtros por status;
- filtros por datas aprovados;
- `EXPIRED` derivado, nunca persistido;
- ordenação determinística;
- sem paginação no MVP, conforme D113;
- totals apenas conforme contrato aprovado.

Se filtro `EXPIRED` existir:

```text
status = SENT
AND validUntil < now
```

Para SENT não expirado:

```text
status = SENT
AND validUntil >= now
```

## Tests

- número;
- status;
- expired;
- sent válido;
- datas;
- ordenação;
- nenhum status fictício persistido.

## Commit sugerido

`feat(ORCAMENTO-36): implement quote search query`

---

# ORCAMENTO-37 — Implementar histórico de orçamentos por Cliente

## Goal

Cumprir o contrato adiado da fase Clientes.

## Scope

Implementar:

```text
GET /clientes/:customerId/orcamentos
```

como query sobre Quote.

Não adicionar coleção ao aggregate Customer.

Deve permitir histórico mesmo quando o Cliente estiver soft-deleted, conforme finalidade histórica aprovada.

## Tests

- cliente ativo;
- cliente soft-deleted com orçamentos;
- múltiplos orçamentos;
- ordenação;
- inexistente conforme contrato.

## Commit sugerido

`feat(ORCAMENTO-37): implement customer quote history query`

---

# ORCAMENTO-38 — Implementar DTOs HTTP

## Goal

Definir contrato HTTP completo sem expor entidades de domínio.

## Scope

DTOs para:

- create;
- update;
- Curtain;
- FinancialItem;
- Discount;
- InstallationAddress;
- send;
- renew;
- cancel;
- installation actions;
- detail response;
- list response;
- history response.

Regras:

- JSON em inglês;
- rotas em português;
- IDs aninhados opcionais onde D117 permite;
- class-validator;
- `@ValidateNested`;
- `@Type`;
- nenhuma conversão numérica implícita perigosa;
- DTO estrutural inválido → 400.

## Tests

Validar payloads representativos e payloads inválidos.

## Commit sugerido

`feat(ORCAMENTO-38): add quote HTTP DTOs`

---

# ORCAMENTO-39 — Implementar taxonomia e mapeamento HTTP de erros

## Goal

Manter domínio/application independentes de Nest.

## Scope

Mapear conforme D118:

- not found → 404;
- Customer não encontrado/inativo → 404;
- transição inválida → 409;
- não editável → 409;
- falha de regra/gate → 422;
- child id desconhecido/estrangeiro → 422;
- DTO estrutural → 400.

Não expor:

- Prisma errors;
- stack traces;
- detalhes internos.

## Tests

Um teste por categoria.

## Commit sugerido

`feat(ORCAMENTO-39): map quote errors to HTTP`

---

# ORCAMENTO-40 — Implementar OrcamentosController

## Goal

Expor o módulo via HTTP mantendo controllers finos.

## Scope

Rotas conforme D115, incluindo:

```text
POST   /clientes/:customerId/orcamentos
GET    /clientes/:customerId/orcamentos

GET    /orcamentos
GET    /orcamentos/:id
PATCH  /orcamentos/:id
DELETE /orcamentos/:id

POST /orcamentos/:id/enviar
POST /orcamentos/:id/confirmar
POST /orcamentos/:id/reabrir
POST /orcamentos/:id/renovar
POST /orcamentos/:id/cancelar
POST /orcamentos/:id/iniciar-producao
POST /orcamentos/:id/concluir
```

Adicionar endpoints de instalação exatamente conforme contrato final da spec.

Todas as rotas:

- AuthGuard;
- DTOs;
- controllers sem regra de negócio.

## Verification

- controller tests;
- Auth regression;
- lint/test/build.

## Commit sugerido

`feat(ORCAMENTO-40): expose quote REST API`

---

# ORCAMENTO-41 — Testes unitários completos do domínio

## Goal

Executar uma bateria consolidada de regressão sobre todas as regras de domínio.

## Scope obrigatório

Cobrir novamente de forma integrada no nível de domínio:

- Money;
- medidas;
- QuoteNumber;
- address;
- discount;
- FinancialItem;
- Curtain;
- aggregate;
- totals;
- D117;
- state machine;
- gate;
- expiração;
- renovação;
- cancelamento;
- produção;
- instalação;
- conclusão.

## Requirement

Não considerar apenas testes criados em tasks anteriores.

Criar uma matriz de rastreabilidade:

```text
regra/decisão → teste(s)
```

Especialmente D76–D124 aplicáveis ao domínio.

## Acceptance criteria

Nenhuma regra normativa sem pelo menos um teste positivo ou negativo apropriado.

## Commit sugerido

`test(ORCAMENTO-41): consolidate quote domain coverage`

---

# ORCAMENTO-42 — Testes de integração completos

## Goal

Validar persistência e transações contra PostgreSQL real.

## Prerequisite

```text
docker compose up -d postgres
```

ou mecanismo vigente equivalente.

## Scope

Cobrir:

- sequence;
- mapper;
- repository load;
- repository save;
- children;
- reconciliação;
- cascades;
- creation transaction;
- mutation + history transaction;
- rollback;
- queries;
- expired;
- customer history.

## Double-check adicional

Além das assertions da aplicação, inspecionar diretamente registros do banco nos testes críticos.

Validar:

- IDs;
- sequence;
- FK;
- número de rows;
- histórico;
- ausência de órfãos.

## Acceptance criteria

Testes independentes de ordem.

Dados isolados/limpos entre cenários.

## Commit sugerido

`test(ORCAMENTO-42): add quote integration coverage`

---

# ORCAMENTO-43 — E2E do fluxo comercial principal

## Goal

Validar o fluxo real API → Application → Domain → Prisma.

## Fluxo obrigatório

```text
login
→ criar cliente
→ criar orçamento DRAFT
→ editar
→ adicionar cortina
→ adicionar componente
→ adicionar adicional
→ configurar desconto/ajuste
→ enviar
→ confirmar
→ iniciar produção
→ agendar instalação
→ concluir
```

Validar:

- responses;
- status;
- datas;
- totals;
- histórico;
- autenticação.

## Negative flows

- sem auth → 401;
- envio incompleto → 422;
- confirmação expirada → conflito/regra correspondente;
- transição inválida → 409;
- cancelamento após produção → 409;
- child foreign id → 422;
- endereço incompleto no envio → 422.

## Commit sugerido

`test(ORCAMENTO-43): cover quote commercial lifecycle e2e`

---

# ORCAMENTO-44 — E2E de edição, reabertura, renovação e cancelamento

## Goal

Cobrir os fluxos que mais facilmente causam inconsistência de estado.

## Scope

### PATCH
- parcial real;
- collections omitted;
- collections sent;
- reconcile.

### Reopen
- confirmedAt limpo;
- installation limpo;
- validade preservada.

### Renew
- expirado;
- ainda válido.

### Cancel
- DRAFT;
- SENT;
- CONFIRMED;
- bloqueado após produção.

### Draft delete
- físico;
- número não reutilizado.

## Commit sugerido

`test(ORCAMENTO-44): cover quote alternate lifecycle e2e`

---

# ORCAMENTO-45 — Auditoria semântica da implementação

## Goal

Revisar a implementação completa antes do fechamento.

Esta task começa como **read-only**.

Não corrigir durante a primeira passagem.

## Checklist arquitetural

Confirmar:

- Quote é único Aggregate Root do módulo;
- Customer permanece externo;
- Curtain não possui repository;
- FinancialItem não possui repository;
- history não está dentro do aggregate;
- Prisma apenas em infrastructure;
- nenhum GenericRepository;
- nenhum UnitOfWork genérico;
- controllers finos;
- nenhum PDF/ProductionOrder implementado antecipadamente.

## Checklist de persistência

Confirmar:

- derivados não persistidos;
- `EXPIRED` não persistido;
- totals não persistidos;
- sequence única;
- quoteNumber unique;
- transações corretas;
- cascade somente onde previsto;
- Customer FK Restrict preservada.

## Checklist financeiro

Confirmar:

- centavos inteiros;
- HALF_UP;
- aritmética exata;
- fabric quantity sem arredondamento de negócio;
- desconto antes de adjustment;
- nenhum Float crítico.

## Checklist lifecycle

Confirmar cada transição contra D96–D107.

Especial atenção:

- cancelamento após produção;
- reabertura;
- validade;
- cliente ativo no envio;
- instalação;
- terminais.

## Checklist D117

Executar revisão dedicada procurando:

- campo omitido limpo por engano;
- coleção omitida alterada;
- perda de UUID;
- filhos duplicados;
- child de outro aggregate aceito;
- sequence inconsistente.

## Checklist histórico

Confirmar:

- exatamente um evento por operação;
- edição agrupada;
- atomicidade;
- details corretos;
- nenhum evento de PDF/ordem de produção ainda.

## Deliverable

Criar relatório com:

```text
A1 — severidade — descrição
Evidência
Impacto
Reparo recomendado
Arquivos envolvidos
```

Classificações:

- bloqueante;
- alta;
- média;
- baixa;
- observação.

## Commit

Somente se o relatório/documentação for versionado.

Sugestão:

`docs(ORCAMENTO-45): review quote implementation`

---

# ORCAMENTO-46 — Repair e re-verificação

## Goal

Corrigir todos os findings aplicáveis da ORCAMENTO-45.

## Process

Para cada finding:

```text
REPRODUCE
→ REPAIR
→ TARGETED TEST
→ FULL RELEVANT TEST SUITE
→ SEMANTIC RECHECK
```

Não agrupar correções não relacionadas sem necessidade.

## Mandatory checks após reparos

- unitários;
- integração;
- E2E;
- `pnpm lint`;
- `pnpm test`;
- `pnpm build`;
- `pnpm exec prisma validate`;
- `pnpm exec prisma migrate status`.

Reexecutar matriz de transições e D117 se qualquer código do aggregate/repository for alterado.

## Acceptance criteria

- zero findings bloqueantes/altos não tratados;
- médios justificados ou corrigidos;
- nenhuma regressão Clientes/Auth.

## Commit sugerido

`fix(ORCAMENTO-46): repair quote implementation findings`

---

# ORCAMENTO-47 — Revisão final independente

## Goal

Executar a segunda checagem sem assumir que ORCAMENTO-45/46 estavam corretas.

Esta é deliberadamente uma **segunda auditoria**.

## Scope

Reavaliar do zero:

1. `PROJECT_SPEC`;
2. `ARCHITECTURE`;
3. `04-orcamentos.md`;
4. implementação atual;
5. testes.

Perguntas obrigatórias:

1. Toda regra da spec possui implementação?
2. Toda implementação possui respaldo na spec/architecture?
3. Existe regra inventada?
4. Existe decisão aprovada não implementada?
5. Existe branch de lifecycle não testado?
6. Existe cálculo financeiro com caminho alternativo?
7. Existe duplicação de fórmula domínio/query?
8. Existe mutation sem transação?
9. Existe mutation sem histórico quando deveria haver?
10. Existe histórico sem mutation correspondente?
11. D117 funciona exatamente como documentado?
12. Existem arquivos/classes antecipando fases 5–9 indevidamente?

## Acceptance criteria

Relatório final sem depender do relatório anterior.

Se encontrar finding novo, voltar para repair antes de fechar.

## Commit

Somente documental se houver relatório.

---

# ORCAMENTO-48 — Fechamento da fase

## Goal

Encerrar formalmente a implementação do núcleo de Orçamento.

## Preconditions

Somente executar após ORCAMENTO-47 aprovada.

## Actions

- atualizar status de `04-orcamentos.md`;
- atualizar `IMPLEMENTATION_PLAN.md`;
- registrar tasks concluídas;
- registrar pendências deliberadamente adiadas;
- garantir que PDF e ordem de produção permanecem para fase própria;
- registrar qualquer dívida técnica aceita.

## Final verification

Executar novamente:

```text
pnpm lint
pnpm test
pnpm build
pnpm exec prisma validate
pnpm exec prisma migrate status
```

Executar suítes E2E de:

- Auth;
- Clientes;
- Orçamentos.

## Final semantic gate

Confirmar:

```text
✓ PROJECT_SPEC atendido para esta fase
✓ ARCHITECTURE respeitada
✓ ORCAMENTO-02 implementada
✓ zero finding bloqueante
✓ nenhuma regressão Auth
✓ nenhuma regressão Clientes
✓ nenhuma feature futura antecipada
✓ árvore Git sem mudanças inesperadas
```

## Commit sugerido

`docs(ORCAMENTO-48): close quote core stage`

---

# Fechamento da fase (ORCAMENTO-48)

**Data:** 2026-10-20

## Tasks concluídas

- ORCAMENTO-01 — auditoria inicial (`04-orcamentos-audit.md`);
- ORCAMENTO-02 — decisões técnicas e de domínio (D76–D124);
- ORCAMENTO-03 a ORCAMENTO-42 — domínio, persistência, use cases, queries,
  DTOs, controller, testes unitários e de integração;
- ORCAMENTO-43 e ORCAMENTO-44 — E2E do fluxo comercial principal e dos fluxos
  alternativos (edição, reabertura, renovação, cancelamento e exclusão de
  rascunho);
- ORCAMENTO-45 — auditoria semântica (`04-orcamentos-review.md`);
- ORCAMENTO-46 — reparo e re-verificação dos findings da auditoria;
- ORCAMENTO-47 — revisão final independente
  (`04-orcamentos-final-review.md`), aprovada sem findings bloqueantes;
- ORCAMENTO-48 — fechamento da fase.

## Pendências deliberadamente adiadas

- PDF comercial e ordem de produção: Fase 8 (D108, D124);
- dashboard e consultas operacionais detalhadas: Fase 9 (D113, D124);
- dados do negócio: Fase 10;
- frontend: Fase 11;
- paginação das listagens: fora do MVP (D113);
- optimistic locking: adiado; a estratégia vigente é last-write-wins (D120);
- livraria de PDF, hosting, observabilidade e MFA: `ARCHITECTURE.md` §22.

## Dívida técnica aceita

- D112 não lista o método transacional `mutate` no repository; o
  comportamento é autorizado por D119 e está implementado e testado.
- A mensagem fixa de `QuoteValidationError` também acompanha violações de
  faixa monetária (`TOTAL_OUT_OF_RANGE`); o contrato de erro permanece
  `message` + `errors`, sem impacto de comportamento.
- A projeção resumida de D113 duplica as fórmulas de D91/D93 em SQL por
  decisão explícita, para evitar N+1 e reconstrução de aggregate.
- O risco de sobrescrita em edições simultâneas é aceito e documentado em
  D120.