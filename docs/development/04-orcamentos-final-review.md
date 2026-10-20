# Revisão final independente — ORCAMENTO-47

Data: 2026-10-20
Base auditada: `dcd20dc` (`fix(ORCAMENTO-46): repair quote implementation findings`)
Escopo: segunda auditoria do núcleo de Orçamento, sem assumir como corretas as
conclusões de ORCAMENTO-45/46.

## 1. Método

A revisão foi refeita a partir das fontes de verdade, nesta ordem:

1. `docs/PROJECT_SPEC.md` (comportamento de orçamento);
2. `docs/ARCHITECTURE.md` (fronteiras e decisões);
3. `docs/development/04-orcamentos.md` (D76–D124 e critérios de aceite);
4. implementação atual em `backend/src/modules/orcamentos/`;
5. testes unitários, de integração e E2E.

Além da leitura, a suíte completa foi executada repetidamente para verificar
determinismo dos gates. Nenhuma conclusão abaixo depende do relatório de
ORCAMENTO-45.

## 2. Resultado executivo

A implementação está aderente à spec. Nenhum finding alto ou bloqueante
permaneceu. Foi encontrado e corrigido um finding novo, de severidade média,
exclusivamente de isolamento de testes; nenhum código de produção foi alterado
por ele.

O núcleo está apto ao fechamento previsto em ORCAMENTO-48.

## 3. Finding encontrado e reparado

### F1 — Isolamento frágil entre specs de integração (médio, corrigido)

**Sintoma.** A suíte completa falhou de forma intermitente: 2 falhas em 8
execuções antes do reparo, com:

- `Unique constraint failed on the constraint: quotes_quote_number_key` ao
  criar orçamentos em `ScheduleInstallationUseCase integration` e em
  `PrismaQuoteRepository integration — transactions`;
- `QuoteNotFoundError` em um teste de agendamento cujo orçamento havia sido
  removido por outro arquivo de teste.

**Causa.** Vinte e uma specs tocam o PostgreSQL real em paralelo e reservavam
anos sintéticos por faixas que se sobrepunham:

- `schedule` usava 2000–2999, enquanto `transaction` usava 2301–2303,
  `create` usava 2400–2999 e as specs de loading/deletion/reconciliation
  usavam 2100/2399/2200;
- `get-quote` e `renew` usavam 7000–7999;
- `list-quote-history` e `cancel` usavam 8000–8999;
- `update` e `complete` usavam 3000–3999;
- `delete` e `confirm` usavam 5000–5999; `delete` e `reopen`, 6000–6999;
- a spec da sequência usava 5000–9999 e ainda zerava o contador do ano sorteado.

Os fixtures de várias specs são inseridos diretamente com `prisma.quote.create`
(sem passar pelo contador anual), e a limpeza é feita por prefixo
`ORÇ-{ano}-`. Quando dois arquivos sorteavam o mesmo ano, um podia violar a
constraint de número ou apagar os orçamentos do outro no meio da execução.

**Reparo.** Todas as specs que acessam o banco receberam faixas de ano
disjuntas: 1000–1099 (search), 1100–1199 (list customer), 1200–1299
(get quote), 1300–1399 (history query), 1400–1499 (remove installation),
1500–1599 (schedule), 1601–1603 (repository transactions), 1700–1999
(creation, três faixas), 2001–2003 (repository loading/deletion/reconciliation),
2100–2199 (update), 2200–2299 (complete), 2300–2399 (send), 2400–2599
(delete draft), 2600–2699 (confirm), 2700–2799 (reopen), 2800–2899 (renew),
2900–2999 (cancel), 3000–3099 (start production) e 3100–3199 (sequence).
Nenhuma alteração em código de produção, schema ou comportamento do produto.

**Verificação.** Após o reparo, 20 execuções consecutivas da suíte completa
passaram sem falhas (885 testes em 71 arquivos), além do E2E (33 testes em 5
arquivos). O determinismo agora é estrutural: as faixas não podem colidir,
independentemente do sorteio.

## 4. Observações não bloqueantes

1. **D112 × `mutate`.** A lista de métodos de `QuoteRepository` em D112 cita
   `findById`, `save`, criação e exclusão, mas não o método `mutate`. A
   implementação está respaldada por D119 (“método transacional no repository
   de infraestrutura”) e é o caminho usado por todas as mutações. Registrado
   como dívida documental para ORCAMENTO-48.
2. **Mensagem de `QuoteValidationError`.** A mensagem fixa (“Quote does not
   satisfy the sending requirements”) também acompanha violações de
   `TOTAL_OUT_OF_RANGE` em criação/edição de `DRAFT`. O contrato HTTP expõe
   `message` e `errors`; não há violação de D118, apenas texto genérico.
3. **Eventos da Fase 8.** O tipo de leitura do histórico expõe os 14 valores
   persistidos, inclusive PDF/ordem de produção, porque D108 os declara
   existentes; o domínio só grava os 12 eventos de negócio desta fase. Não há
   implementação antecipada da Fase 8.
4. **Duplicação SQL deliberada.** `PrismaSearchQuotesQuery` reimplementa D93/D91
   para a projeção resumida, exatamente como D113 determina (“`totalCents` de
   lista é calculado na própria query SQL”). A equivalência com o domínio foi
   conferida: arredondamento por item, soma HALF_UP do percentual, desconto
   fixo e ajuste comercial após o desconto.

## 5. Respostas às perguntas obrigatórias

### 1. Toda regra da spec possui implementação?

Sim. A rastreabilidade foi conferida decisão a decisão:

- D96/D97/D98/D99/D101/D102/D103/D104/D105: matriz de transições e gates em
  `domain/entities/quote.ts`, acionados por use cases dedicados;
- D100: reabertura limpa `confirmedAt` e `scheduledInstallationAt` e devolve os
  valores anteriores para o histórico;
- D106/D107: expiração e instalação atrasada são derivadas, nunca persistidas;
- D108/D109: histórico gravado na mesma transação, com os contratos de
  `details` e o diff plano de `QUOTE_EDITED`;
- D110/D111: exclusão física somente de `DRAFT`, cascade, sem soft delete;
- D112/D119/D120: aggregate único, leitura/mutação transacional e
  last-write-wins com revalidação de status;
- D113: quatro queries de leitura, filtros de `EXPIRED`, projeção resumida e
  ordenação `createdAt DESC, id DESC`;
- D114/D115/D116: 12 use cases de escrita, 4 de leitura, 16 rotas HTTP,
  `AuthGuard` e DTOs com os campos somente leitura descartados;
- D117/D118: `PATCH` parcial com reconciliação por `id` e taxonomia
  404/409/422/400/401/500;
- D121/D122/D123/D124: cobertura unitária/integração/E2E, índices existentes,
  wiring do módulo e ausência de itens de fases futuras.

PDF comercial e ordem de produção são explicitamente Fase 8 (D108/D124) e não
possuem implementação nesta fase.

### 2. Toda implementação possui respaldo na spec/architecture?

Sim. Cada arquivo do módulo mapeia para uma decisão:

- `Quote`, `Curtain`, `FinancialItem`, `Discount`, `InstallationAddress`,
  `QuoteNumber`, `Money`: D76–D95;
- `quote.ts` (métodos de ciclo de vida e `applyPatch`): D96–D107 e D117;
- `QuoteRepository`/`PrismaQuoteRepository`/`QuoteMapper`: D112 e D119;
- `MarkQuoteAsSentUseCase` e `CustomerEligibility`: D78/D97;
- queries e projeções: D113;
- controller e DTOs: D115/D116/D118;
- módulo e wiring: D123.

As duas regras acrescentadas no reparo de ORCAMENTO-46 têm respaldo explícito:
a validação de faixa monetária deriva de D86 (“faixa persistida”), e o gate de
edição em `SENT` deriva de D87 (“em status não rascunho, qualquer edição só é
aceita com todos os itens completos”), D95 (“em qualquer salvamento fora de
`DRAFT`, o endereço precisa estar completo”) e D97 (condições de envio).

### 3. Existe regra inventada?

Não. Não foi encontrada decisão de produto sem origem em `PROJECT_SPEC`,
`ARCHITECTURE` ou nas decisões D76–D124. Os códigos de violação
(`TOTAL_OUT_OF_RANGE`, `INSTALLATION_ADDRESS_INCOMPLETE`, etc.) são detalhes de
contrato de erro, não regras novas.

### 4. Existe decisão aprovada não implementada?

Não. Foram verificadas as decisões aprovadas que alteram comportamento:

- D78/D97: cliente existente e não removido é exigido na criação e no envio;
- D81: ano comercial em `America/Sao_Paulo`, padding mínimo de 3 dígitos;
- D92: apenas `commercialAdjustmentCents`, sem total final desejado;
- D98: validade explícita estritamente futura; padrão de 30 dias;
- D100: limpeza de confirmação e instalação na reabertura;
- D117: `PATCH` realmente parcial, coleções completas quando enviadas.

A única lacuna é documental (D112 não lista `mutate`), coberta por D119 e
registrada na observação 1.

### 5. Existe branch de lifecycle não testado?

Não. A spec `quote-state-machine.spec.ts` percorre `describe.each` de todas as
transições contra os 6 status persistidos, verificando tanto os caminhos
permitidos quanto `InvalidQuoteTransitionError` e preservação de estado nos
proibidos. Além disso:

- D99: confirmação exatamente no limite, após expiração e com validade nula;
- D100: reabertura e limpeza de datas;
- D101: renovação válida/expirada e validade não futura;
- D102: motivo normalizado, vazio e acima de 500 caracteres;
- D104: agendamento idêntico e remoção ausente como no-op;
- D105: conclusão bloqueada por instalação futura;
- D110: exclusão permitida só em `DRAFT` e bloqueada nos demais status;
- D120: concorrência de envio, confirmação e exclusão cobertas por testes de
  integração.

O E2E cobre o ciclo completo, transições inválidas, expiração/renovação,
reabertura, cancelamento, exclusão de rascunho e proteção sem sessão.

### 6. Existe cálculo financeiro com caminho alternativo?

Não no detalhe. `GetQuoteQuery` e o mapper apenas leem getters do aggregate;
`QuoteDetailResponseDto.totals` vem de D93 sem recomputação. Não há aritmética
monetária na Application ou na Presentation. O único caminho paralelo é a
projeção resumida em SQL de D113, intencional e restrita a listas.

### 7. Existe duplicação de fórmula domínio/query?

Apenas a duplicação autorizada por D113. `PrismaSearchQuotesQuery` calcula
`totalCents` em SQL para evitar N+1 e reconstrução de aggregate. A comparação
com D91/D93 confirmou a mesma ordem de operações e o mesmo arredondamento
(`ROUND` half-up por item, percentual half-up, desconto fixo, ajuste após o
desconto). O caminho de detalhe não duplica fórmula.

### 8. Existe mutation sem transação?

Não. Criação, `save` e `mutate` usam `$transaction` interativa do Prisma; a
exclusão de rascunho é um único `DELETE` com cascade, como D119 permite. Todas
as mutações da Application passam por `QuoteRepository`; não há acesso a Prisma
na Application nem escrita direta no controller.

### 9. Existe mutation sem histórico quando deveria haver?

Não. Toda operação de negócio efetiva grava exatamente um evento na mesma
transação. Caminhos sem evento são os previstos: edição sem mudança efetiva
(D109), agendamento idêntico e remoção de instalação ausente (D104), e exclusão
física de rascunho (D110). Testes de integração forçam falha de persistência e
confirmam que estado e histórico não divergem.

### 10. Existe histórico sem mutation correspondente?

Não. Os eventos são inseridos somente dentro da transação que persiste a
mudança. Testes de rollback verificam ausência de histórico órfão quando a
operação lança ou quando o insert de histórico falha. Criações e mutações
concorrentes deixam no máximo um evento vencedor.

### 11. D117 funciona exatamente como documentado?

Sim. Foram verificados:

- campos omitidos mantêm valor; `null` limpa quando permitido; valor substitui;
- coleções omitidas não são tocadas; coleções enviadas representam o conjunto
  completo, inclusive `components` por cortina e `generalAddOns`;
- reconciliação por `id`: existente atualiza, sem `id` cria, ausente remove,
  `id` desconhecido ou de outro orçamento gera `UnknownQuoteItemError`;
- `sequence` é recalculada por ordem e não é aceita na entrada;
- `customerId`, `quoteNumber` e `status` são descartados pelo whitelist;
- edição em `SENT` mantém status, `firstSentAt` e `validUntil`, e o gate
  preserva a completude exigida por D87/D95;
- mudança efetiva gera um único `QUOTE_EDITED`; ausência de mudança responde
  200 sem evento e sem `UPDATE`;
- a operação é atômica e a exclusão de cortina remove componentes em cascade.

A matriz é exercitada no domínio, em integração e no E2E.

### 12. Existem arquivos/classes antecipando fases 5–9 indevidamente?

Não. Só existem os diretórios de scaffold com `.gitkeep` e os dois valores de
`HistoryEventType` da Fase 8, que já fazem parte do schema e são apenas
legíveis (D108). Não há `DashboardQuery`, geração de PDF, ordem de produção,
frontend ou qualquer entidade fora do escopo de D124.

## 6. Verificação mecânica

Executada em `backend/` após o reparo:

| Check | Resultado |
|---|---|
| `pnpm build` | 0 |
| `pnpm lint` | 0 |
| `pnpm test` | 885/885 em 71 arquivos; 20 execuções consecutivas verdes |
| `pnpm test:e2e` | 33/33 em 5 arquivos |
| `pnpm exec prisma validate` | schema válido |
| `pnpm exec prisma migrate status` | banco atualizado (2 migrations) |

Os 21 arquivos alterados são exclusivamente specs de integração do módulo de
Orçamento.

## 7. Conclusão

Não há findings altos ou bloqueantes. O finding médio F1 foi corrigido e
verificado. As observações restantes são documentais e não alteram
comportamento. A implementação atende a `PROJECT_SPEC`, `ARCHITECTURE`, a
development spec e os critérios de aceite de ORCAMENTO-47, estando apta ao
fechamento de ORCAMENTO-48.
