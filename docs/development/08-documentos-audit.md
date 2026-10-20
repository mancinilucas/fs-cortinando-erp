# 08 — Auditoria da Fase 8 — Documentos (DOCUMENTOS-01)

**Status:** concluída em 2026-10-20
**Task de origem:** `DOCUMENTOS-01 — Auditoria do estado atual da Fase 8 — Documentos`
**Documento irmão:** `docs/development/08-documentos.md` (DOCUMENTOS-02)
**Escopo:** auditoria somente leitura. Nenhum código, schema, migration, seed, endpoint, DTO, serviço, dependência ou teste foi criado ou alterado.

> **Nomenclatura:** o código e o schema usam inglês (`Quote`, `Curtain`, `BusinessData`, `COMMERCIAL_PDF_GENERATED`). A documentação de produto permanece em português (`Orçamento`, `Cortina`, `DadosDoNegocio`, `PDF comercial`, `Ordem de produção`). O mapa existente está em `docs/development/01-prisma-naming.md`.

---

## 1. Objetivo e escopo

Determinar, com evidência do repositório, o que já existe para gerar o PDF comercial e a ordem de produção sob demanda, o que falta e quais decisões precisam ser fechadas antes da implementação.

Pergunta central:

> Os dados e a infraestrutura atuais são suficientes para gerar os dois documentos sem criar aggregate, tabela, repositório ou status de documento?

Resposta curta: **os dados de negócio existem e são suficientes; a camada de documentos não existe**. Não há projeção, renderer, biblioteca de PDF, rota, evento emitido, asset de logo nem testes de documento. As lacunas são de código e de decisão, não de modelagem do banco.

Ficam fora do escopo desta auditoria: implementação, alteração de schema ou migration, criação de rotas, instalação de bibliotecas, alteração de testes e qualquer decisão de produto não sustentada pelas fontes.

---

## 2. Fontes consultadas

| Fonte | Uso nesta auditoria |
|---|---|
| `docs/PROJECT_SPEC.md` | §2.7 dados do negócio; §8 ciclo de vida; §10.1–§10.7 documentos; §11 histórico; §14.3 segurança/privacidade; §15 edição e imutabilidade; §16 decisões adiadas |
| `docs/ARCHITECTURE.md` | §1.2 fronteiras; §2.2 produção como projeção; §5 camadas; §8 histórico; §9 Prisma; §11 transações; §14.2 rotas; §16 documentos; §22 decisões adiadas |
| `docs/IMPLEMENTATION_PLAN.md` | Fase 8 (escopo, dependências e estado); Fase 10 concluída |
| `docs/development/04-orcamentos.md` | D76–D124: aggregate, cálculos, ciclo de vida, histórico, queries, HTTP, erros, testes |
| `docs/development/04-orcamentos-audit.md` | estado do módulo Orçamento antes da implementação |
| `docs/development/10-dados-negocio.md` | D125–D142; em especial D140 (consumo pela Fase 8) e D141 (sem schema/migration) |
| `docs/development/10-dados-negocio-audit.md` | estado e contrato do módulo Dados do Negócio |
| `backend/prisma/schema.prisma` | modelos, enums e nulabilidade vigentes |
| `backend/prisma/migrations/` | materialização do schema |
| `backend/src/` | módulos, domínio, application, infrastructure, presentation, testes |
| `backend/package.json`, `backend/pnpm-lock.yaml`, `backend/pnpm-workspace.yaml` | dependências, scripts e restrições de runtime |
| `frontend/src/` | estado atual do frontend e assets |
| `docker-compose.yml`, `nest-cli.json`, `tsconfig.json` | runtime, build e cópia de assets |

---

## 3. Comandos e checks executados

Executados em `backend/` antes da geração desta documentação:

| # | Comando | Resultado |
|---|---|---|
| 1 | `pnpm lint` | ✅ exit 0 |
| 2 | `pnpm build` | ✅ exit 0 |
| 3 | `pnpm test` | ✅ 78 arquivos, 931 testes |
| 4 | `pnpm test:e2e` | ✅ 6 arquivos, 44 testes |
| 5 | `npx prisma validate` | ✅ schema válido |
| 6 | `npx prisma migrate status` | ✅ 2 migrations; banco atualizado |
| 7 | `git status --short` | `?? docs/development/08-documentos-audit.md` no início (arquivo de trabalho desta rodada, não rastreado); nenhum arquivo de código alterado |

Buscas executadas:

| Busca | Resultado |
|---|---|
| `pdf`, `pdf-lib`, `pdfkit`, `puppeteer`, `playwright`, `chromium`, `jspdf`, `canvas`, `sharp`, `fontkit` em `backend/src`, `backend/test`, `backend/package.json`, `backend/pnpm-lock.yaml` | nenhuma dependência ou código de geração de PDF; apenas referências transitórias sem uso (`@vitest/browser-playwright` como peer opcional) |
| `logo`, `font-face`, `.ttf`, `.otf`, `.woff` no repositório | nenhum asset de marca ou fonte; apenas assets do template Vite no frontend |
| `COMMERCIAL_PDF_GENERATED`, `PRODUCTION_ORDER_GENERATED` | presentes no enum Prisma e no tipo de leitura do histórico; ausentes do contrato de escrita do domínio e de qualquer código de geração |
| `ProductionOrder`, `ordem_producao`, `documento` em `backend/src` | nenhum aggregate, tabela, repositório, serviço ou rota |
| `infrastructure/documents` | apenas `.gitkeep` |

Nenhum comando com efeito de alteração foi executado.

---

## 4. Estado atual do código

### 4.1 Módulos e wiring

- `AppModule` importa `ThrottlerModule`, `PrismaModule`, `AuthModule`, `ClientesModule`, `DadosDoNegocioModule` e `OrcamentosModule` (`backend/src/app.module.ts`).
- `OrcamentosModule` importa apenas `AuthModule` e `PrismaModule`; registra o controller, o repository, os use cases e as queries (`backend/src/modules/orcamentos/orcamentos.module.ts:33-66`). **Não possui `exports`**.
- `DadosDoNegocioModule` importa `AuthModule` e `PrismaModule`; registra `BusinessDataStore`, `GetBusinessDataQuery` e `UpdateBusinessDataUseCase` (`backend/src/modules/dados-do-negocio/dados-do-negocio.module.ts:10-19`). **Não possui `exports`**.
- `ClientesModule` também não exporta providers; `GetCustomerUseCase` e `CustomerRepository` permanecem privados.
- `PrismaModule` exporta `PrismaService` (`backend/src/shared/database/prisma.module.ts:4-7`).
- `AuthModule` exporta `AuthGuard`, `SessionStore`, `SessionTokenService` e `UserStore`.

Consequência: `GetBusinessDataQuery` **não é injetável** no módulo de Orçamentos no estado atual.

### 4.2 Orçamentos

- Aggregate `Quote` com status persistidos `DRAFT`, `SENT`, `CONFIRMED`, `IN_PRODUCTION`, `COMPLETED`, `CANCELLED` (`backend/src/modules/orcamentos/domain/entities/quote.ts:27-34`).
- O aggregate conhece apenas `customerId`; **não há snapshot de nome, telefone, e-mail ou CPF/CNPJ do cliente** (`quote.ts:65-84,96-115`).
- `Quote` expõe derivados de negócio: `curtainsSubtotalCents`, `generalAddOnsSubtotalCents`, `subtotalCents`, `discountValueCents`, `calculatedTotalCents`, `effectiveCommercialAdjustmentCents`, `totalCents` (`quote.ts:685-725`).
- `Curtain` expõe `finalWidth` e `fabricQuantity` derivados (`backend/src/modules/orcamentos/domain/entities/curtain.ts:183-197`).
- `GetQuoteQuery` carrega o aggregate e devolve `QuoteDetailView` (`backend/src/modules/orcamentos/application/queries/get-quote.query.ts:29-87`). O read model inclui **dados permitidos e proibidos** nos documentos:
  - permitidos para o PDF comercial: `quoteNumber`, `status`, `validUntil`, `curtains[].room`, `curtains[].description`, `totals.totalCents`;
  - permitidos para a ordem de produção: `quoteNumber`, `curtains[].room`, `curtains[].description`, `curtains[].material`, `curtains[].finalWidth`, `curtains[].height`;
  - proibidos: `customerId`, `notes`, `installationAddress`, `curtains[].openingWidth`, `borderValue`, `fabricFactor`, `fabricQuantity`, `components`, `generalAddOns`, `discount`, `commercialAdjustmentCents`, todos os subtotais e `totals` detalhados.
  - o read model **não inclui** nome ou telefone do cliente.
- `QuoteDetailView` está em `backend/src/modules/orcamentos/application/queries/quote-read-model.ts:62-84`.
- Rotas existentes em `OrcamentosController` (`backend/src/modules/orcamentos/presentation/orcamentos.controller.ts:52-258`), todas protegidas por `AuthGuard` no nível da classe. **Não há rota de PDF ou de ordem de produção.**
- `ParseUUIDPipe` valida `:id`; DTOs usam o `ValidationPipe` global.

### 4.3 Dados do negócio

- `BusinessData` persiste `commercialNameOrConsultant`, `phone`, `email?` e `taxId?` (`backend/prisma/schema.prisma:206-215`). Não há endereço, site, logo ou campo específico de documento.
- `GetBusinessDataQuery.execute()` devolve `BusinessDataRecord` ou lança `BusinessDataNotFoundError` (`backend/src/modules/dados-do-negocio/application/get-business-data.query.ts:9-21`).
- O store usa o singleton lógico `"business"` (`backend/src/modules/dados-do-negocio/infrastructure/prisma-business-data.store.ts:11-19`).
- O controller expõe `GET` e `PUT /dados-do-negocio`; o mapper de erro do módulo mapeia `BusinessDataNotFoundError` para `404` (`backend/src/modules/dados-do-negocio/presentation/business-data-error-mapper.ts:8-18`).
- D140 determina que a Fase 8 consuma esses dados **pela Application**, sem Prisma direto e sem HTTP interno.
- D141 confirma que não há alteração de schema ou migration prevista.

### 4.4 Clientes

- `Customer` possui `name`, `phone`, `email?`, `taxId?`, endereço estruturado, `notes?` e `deletedAt?` (`backend/prisma/schema.prisma:76-98`).
- O vínculo `Quote.customerId` usa `onDelete: Restrict`; o cliente pode ser removido logicamente sem apagar orçamentos.
- O módulo de Orçamentos já lê `customers` diretamente em infraestrutura para elegibilidade (`PrismaCustomerEligibility`), sem depender do módulo de Clientes.
- Não existe consulta de contato do cliente (nome/telefone) no módulo de Orçamentos.

### 4.5 Frontend

- `frontend/src` contém apenas o template Vite (`App.jsx`, `main.jsx`, CSS e assets). Não há roteamento, cliente HTTP, feature de orçamento, download de PDF ou prévia.
- O frontend não impõe contrato à Fase 8.

### 4.6 Testes existentes

- 931 testes unitários/de integração e 44 testes E2E passam.
- Não há teste de documento, de projeção de documento, de conteúdo de PDF ou de dados proibidos.
- Os testes E2E de Orçamento já criam clientes, orçamentos, transicionam status e limpam dados; o harness pode hospedar testes de documento.
- O teste E2E de Dados do Negócio limpa `business_data` antes/depois de cada teste; a suíte E2E não desabilita paralelismo entre arquivos.

---

## 5. Dependências existentes

### 5.1 Backend

`backend/package.json`:

| Grupo | Dependências relevantes |
|---|---|
| runtime | NestJS 12 (`common`, `core`, `platform-express`, `throttler`), `@node-rs/argon2`, Prisma 7 (`client`, `adapter-pg`), `class-transformer`, `class-validator`, `dotenv`, `pg`, `reflect-metadata`, `rxjs` |
| desenvolvimento | Nest CLI/testing/schematics, `@types/*`, Vitest 4, `oxlint`, Prettier, Prisma CLI, Supertest, `tsx`, TypeScript 6, Vite 8 |

**Não há** `pdf-lib`, `pdfkit`, `puppeteer`, `playwright`, `jspdf`, `html-pdf`, `canvas`, `sharp`, `fontkit`, mecanismo de template HTML ou serviço externo de PDF.

### 5.2 Restrições de runtime e build

- `"type": "module"`; TypeScript com `module`/`moduleResolution: nodenext`; imports relativos com sufixo `.js`.
- `nest build` usa `tsc`; `nest-cli.json` não configura cópia de assets (`compilerOptions` contém apenas `deleteOutDir`).
- `pnpm-workspace.yaml` permite build scripts apenas para `@prisma/engines`, `esbuild` e `prisma`; uma dependência nativa nova exigiria allowlist explícita.
- Não há `engines`, `packageManager`, `.nvmrc` ou versão de Node fixada. O runtime observado na máquina é Node 26.
- Não há Dockerfile, `.dockerignore` ou CI. O `docker-compose.yml` usa `pnpm run start:dev` e não declara imagem, pacotes de sistema, fontes ou Chromium.
- O backend é servido por `node dist/main` em produção; qualquer asset fora do bundle TypeScript precisa ser copiado explicitamente.

### 5.3 Frontend

- React 19 + Vite 8, JavaScript/JSX (sem TypeScript), Tailwind 4, ESLint. `node_modules` não está instalado.
- Nenhuma dependência de PDF ou de geração de documento.

---

## 6. Dados disponíveis para o PDF comercial

| Dado exigido por `PROJECT_SPEC` §10.2 | Fonte | Disponível? | Observação |
|---|---|---|---|
| Número do orçamento | `Quote.quoteNumber` | ✅ | `QuoteNumber.value`, formato `ORÇ-AAAA-NNN` |
| Identidade do negócio | `BusinessData` | ⚠️ | dados existem, mas o módulo não exporta a query; quais campos compõem a identidade não está enumerado |
| Nome do cliente | `Customer.name` | ⚠️ | existe no cliente; ausente do aggregate e do read model de orçamento |
| Telefone do cliente | `Customer.phone` | ⚠️ | idem |
| Serviços por ambiente | `Curtain.room` + `Curtain.description?` | ⚠️ | não existe entidade “serviço”; a linha exata do serviço não está definida |
| Descrição da cortina, quando existente | `Curtain.description` | ✅ | campo opcional |
| Valor final consolidado | `Quote.totalCents` | ✅ | derivado; não persistido |
| Data exata de validade | `Quote.validUntil` | ⚠️ | presente em `SENT`; pode ser nulo em `DRAFT` (prévia) |

Dados disponíveis, mas **proibidos** no PDF comercial: CPF/CNPJ e endereço do cliente, endereço de instalação, dimensões, material/tecido, quantidade de tecido, borda, fator de tecido, componentes financeiros, adicionais itemizados, desconto, ajuste comercial, notas internas e totais detalhados.

O aggregate e o read model atuais contêm todos esses dados proibidos. A projeção do documento precisa ser um tipo fechado, construído a partir de campos permitidos, e não uma reutilização direta de `QuoteDetailView`.

---

## 7. Dados disponíveis para a ordem de produção

| Dado exigido por `PROJECT_SPEC` §10.6 | Fonte | Disponível? | Observação |
|---|---|---|---|
| `numeroOrcamento` | `Quote.quoteNumber` | ✅ | cabeçalho |
| `ambiente` | `Curtain.room` | ✅ | obrigatório no gate de envio; nulo apenas em rascunho |
| `descricao?` | `Curtain.description` | ✅ | opcional |
| `material` | `Curtain.material` | ✅ | obrigatório no gate de envio |
| `larguraFinal` | `Curtain.finalWidth` | ✅ | derivado de `openingWidth + 2 × borderValue` |
| `altura` | `Curtain.height` | ✅ | medida |

A ordem das cortinas pode seguir `Curtain.sequence` (1..N), já normalizada pelo domínio.

Dados disponíveis, mas **proibidos** na ordem de produção: nome, telefone, CPF/CNPJ e endereço do cliente; endereço de instalação; quantidade total de tecido; valor da borda; fator de tecido; trilho; entretela; frete; mão de obra; componentes financeiros; preços; desconto; dados da negociação; observações internas.

A ordem de produção **não depende** de `BusinessData` nem de dados do cliente. Depende apenas do aggregate de Orçamento e do status.

---

## 8. Estado de `infrastructure/documents/`

`backend/src/modules/orcamentos/infrastructure/documents/` contém apenas `.gitkeep`. Não há:

- porta ou adaptador de renderer;
- serviço ou use case de documento;
- template, layout, fonte ou asset;
- projeção de PDF comercial ou de ordem de produção;
- rota, DTO, header ou teste.

A pasta `infrastructure/persistence/` vizinha contém apenas repository, mappers, queries e sequence. Não há `ProductionOrder` em lugar nenhum do código.

---

## 9. Bibliotecas atuais e opções

Nenhuma biblioteca de PDF está instalada. As opções avaliadas nesta auditoria:

| Opção | Versão atual | Modelo | Vantagens | Riscos |
|---|---|---|---|---|
| `pdf-lib` | 1.17.1 | 100% JavaScript, geração em memória, `Uint8Array` | sem binário nativo, sem Chromium, tipos TypeScript inclusos, `embedFont`/`embedPng`, `StandardFonts` | layout, quebra de linha e paginação são manuais; última publicação é antiga |
| `pdfkit` | 0.20.2 | JavaScript, stream, pensado para Node | quebra de linha e paginação embutidas; manutenção ativa | pacote CJS e tipos externos (`@types/pdfkit`); integração ESM/NodeNext exige atenção |
| `@cantoo/pdf-lib` | 2.11.1 | fork mantido do `pdf-lib` | mesma API, correções recentes | dependência menos difundida; avaliar reputação/supply chain |
| Puppeteer/Playwright + HTML | — | Chromium headless | HTML/CSS livre | Chromium não existe no deploy declarado; peso, memória e superfície operacional; rejeitado |
| Serviço externo de PDF | — | HTTP | delega layout | dependência externa, custo, privacidade e disponibilidade; rejeitado |

Verificação feita via Context7 na documentação do `pdf-lib`: criação de `PDFDocument`, `embedFont(StandardFonts.*)`, `page.drawText`, `embedPng`/`embedJpg` e `save()` retornando `Uint8Array` em memória. A biblioteca é adequada ao runtime Node/ESM e não exige Chromium.

A escolha definitiva é uma decisão de DOCUMENTOS-02 (D148).

---

## 10. Assets e logo

- Assets versionados: apenas `frontend/src/assets/hero.png`, `react.svg`, `vite.svg`, `frontend/public/favicon.svg` e `icons.svg`, todos do template Vite. Nenhum é logo do negócio.
- Não há arquivo de fonte (`.ttf`, `.otf`, `.woff`, `.woff2`) no repositório.
- `PROJECT_SPEC` §2.7 determina identidade visual e logo **fixos no template**, sem upload ou gerenciamento.
- O `IMPLEMENTATION_PLAN.md` Fase 10 marca `[x] Manter logo como asset fixo` (linha 332), mas **nenhum asset de logo foi versionado**. A marcação não corresponde ao estado real; a Fase 8 não pode assumir que o logo existe.
- O backend não possui diretório de assets nem configuração de cópia no `nest-cli.json`. Um logo colocado em `src/` não chegaria automaticamente a `dist/` no `nest build`.
- `pdf-lib` embute PNG/JPEG; SVG não é suportado diretamente.

Consequência: o documento pode ser gerado apenas com identidade textual, ou o humano precisa fornecer um arquivo de logo (preferencialmente PNG) e autorizar sua inclusão no build.

---

## 11. Histórico existente

- Enum Prisma `HistoryEventType` com 14 valores, incluindo `COMMERCIAL_PDF_GENERATED` e `PRODUCTION_ORDER_GENERATED` (`backend/prisma/schema.prisma:32-49`).
- Tabela `quote_history` com `details` JSONB nullable, `occurredAt` com default `now()` e índice `(quoteId, occurredAt)`.
- Contrato de domínio em `backend/src/modules/orcamentos/domain/history/quote-history.ts`:
  - o union `QuoteHistoryEventType` tem **12 valores** e **não inclui** os dois eventos de documento (`:6-18`);
  - não há interfaces nem builders de `details` para documentos (`:74-154`).
- O port de leitura aceita os 14 valores (`application/ports/quote-history-query.repository.ts:8-11`), e `ListQuoteHistoryQuery` devolve `details` cru.
- O repository do aggregate grava histórico **junto com a mudança de estado**:
  - `save(quote, event)` sempre atualiza `quotes.updatedAt` e reconcilia filhos (`prisma-quote.repository.ts:91-105`);
  - `mutate(id, operation)` carrega o aggregate, executa a mutação e grava o evento; se a operação devolver `null`, nada é gravado (`:107-155`);
  - `insertHistory` é privado e aceita apenas `QuoteHistoryEventDraft` (`:157-172`).
- **Não existe método público append-only** para gravar um evento sem alterar o orçamento.
- D108 exige que cada operação de negócio gere no máximo um evento e que a gravação seja atômica com a mudança; D109 deixou os `details` dos dois eventos de documento para a Fase 8.
- `PROJECT_SPEC` §11 determina que **visualizar uma prévia não gera evento**.
- Nenhum código emite os eventos de documento hoje.

---

## 12. Contratos HTTP das fontes

- `ARCHITECTURE.md` §14.2 define:
  - `GET /orcamentos/:id/pdf`
  - `GET /orcamentos/:id/ordem-producao`
- `OrcamentosController` usa `@Controller()` com caminhos por rota e `@UseGuards(AuthGuard)` na classe; novas rotas herdam autenticação.
- `CsrfOriginGuard` global atua apenas em métodos mutáveis (`POST`, `PUT`, `PATCH`, `DELETE`); `GET` não exige `Origin`.
- `ParseUUIDPipe` em `:id` devolve `400` para UUID inválido.
- As fontes **não definem**:
  - headers de resposta, `Content-Disposition` ou nome de arquivo;
  - status codes para estado inválido, configuração ausente ou falha de renderização;
  - se a rota `GET` registra histórico (side effect) ou se seria necessário `POST`;
  - cache, idempotência ou comportamento em downloads repetidos;
  - locale, formato de moeda, data ou medidas;
  - compartilhamento (mecanismo adiado em `PROJECT_SPEC` §10.7 e `ARCHITECTURE.md` §22).
- O contrato existe apenas como esboço de rota; o restante está aberto.

---

## 13. Lacunas

| ID | Lacuna | Impacto |
|---|---|---|
| G1 | nenhuma projeção de PDF comercial | documento não pode ser composto |
| G2 | nenhuma projeção de ordem de produção | documento não pode ser composto |
| G3 | nenhuma biblioteca de PDF instalada | renderização inexistente |
| G4 | nenhum renderer, porta ou adapter em `infrastructure/documents/` | nenhuma geração |
| G5 | nenhuma rota de documento no controller | API ausente |
| G6 | `GetBusinessDataQuery` não é exportado pelo módulo | PDF comercial não consegue consumir a identidade sem alterar wiring |
| G7 | nenhuma consulta de contato do cliente no módulo de Orçamentos | PDF comercial não tem nome/telefone |
| G8 | `BusinessDataNotFoundError` não é conhecido pelo `mapQuoteError` | erro viraria `500` |
| G9 | union de eventos do domínio não inclui os dois eventos de documento | não há como tipar a gravação |
| G10 | não há escrita append-only de histórico | usar `save`/`mutate` alteraria o orçamento |
| G11 | contrato de `details` dos eventos de documento não definido | histórico incompleto/inconsistente |
| G12 | nenhum asset de logo e nenhuma cópia de assets no build | identidade visual incompleta |
| G13 | nenhum formatador de moeda, data ou medida | risco de locale/formatação divergente |
| G14 | nenhuma estratégia de inspeção de conteúdo de PDF | testes fracos contra vazamento |
| G15 | estados permitidos do PDF comercial não estão totalmente definidos | comportamento ambíguo em `CONFIRMED`, `IN_PRODUCTION`, `COMPLETED` e `CANCELLED` |
| G16 | `GET` com gravação de histórico não está decidido | side effect e duplicidade |
| G17 | composição exata da linha de serviço não está definida | conteúdo comercial ambíguo |
| G18 | quais campos de `BusinessData` formam a identidade não está definido | conteúdo comercial ambíguo |
| G19 | comportamento para `BusinessData` ausente não está definido | erro indefinido |
| G20 | ausência de CI, Dockerfile e versão de Node fixada | compatibilidade da biblioteca não é verificada no deploy |
| G21 | suíte E2E compartilha `business_data` sem isolamento entre arquivos | risco de flakiness ao adicionar testes de documento |
| G22 | nenhum teste de documento ou de dados proibidos | regras críticas sem cobertura |

---

## 14. Inconsistências e ambiguidades

| ID | Ponto | Situação |
|---|---|---|
| I1 | §10.2 exige “data exata de validade”, mas a prévia em `DRAFT` pode ocorrer sem `validUntil` | a fonte não define se a prévia omite a validade ou é bloqueada |
| I2 | §10.2 exige “serviços por ambiente”, mas não existe entidade de serviço | só há `room`, `description` e componentes financeiros (proibidos); o exemplo cita “Cortina sob medida”, que não é um campo |
| I3 | §2.7 define quatro campos de negócio; §10.2 fala apenas “identidade do negócio” | não está enumerado quais campos entram no PDF |
| I4 | §10.4 fala em manter “a versão mais recente ... caso o documento seja armazenado”; `ARCHITECTURE.md` §16.1 diz que não será persistido | as fontes são compatíveis apenas se a primeira for lida como condicional; a decisão de não persistir precisa ser explícita |
| I5 | §8.9 e §15 não listam PDF comercial em `CONFIRMED`; §8.13 permite reemissão em `CONCLUIDO`; §8.7 permite em expirado | estados permitidos do PDF comercial não estão fechados |
| I6 | §11 diz que visualizar prévia não gera evento; §10.4 diz que a geração registra | a mesma rota `GET /pdf` serve prévia e geração; a distinção depende do status |
| I7 | §10.4 não define se downloads repetidos geram novos eventos | duplicidade de histórico |
| I8 | o enum do banco tem 14 eventos; o union do domínio tem 12; D109 adiou os detalhes | contrato de escrita incompleto |
| I9 | D140 manda a Fase 8 decidir como falhar sem `BusinessData`; nenhuma fonte define o status HTTP | comportamento indefinido |
| I10 | §2.7 exige logo fixo; não existe asset no repositório | branding precisa ser fornecido ou dispensado |
| I11 | `ARCHITECTURE.md` define rotas `GET`, mas a geração grava histórico | `GET` deixa de ser seguro/idempotente |
| I12 | §10.2 não define formato de moeda, data, medidas, nome de arquivo ou paginação | apresentação indefinida |
| I13 | `Curtain.material` e `room` são nulos no schema, mas obrigatórios no gate de envio | nos estados da ordem de produção deveriam estar preenchidos; comportamento defensivo não definido |
| I14 | o cliente pode ser removido logicamente; o PDF comercial precisa de nome/telefone | não está definido se cliente removido ainda pode ser usado |
| I15 | o nome/telefone do cliente não são snapshot do orçamento | uma reemissão pode refletir dados cadastrais alterados depois do envio |
| I16 | não há regra de quebra de página para muitas cortinas | documento pode exceder uma página sem layout definido |
| I17 | o `details` dos eventos de documento não foi definido em D109 | payload livre pode virar dado incompatível |
| I18 | §10.7 exige compartilhamento, mas o mecanismo foi adiado | a Fase 8 entrega bytes; o compartilhamento fica para a Fase 11 |
| I19 | `IMPLEMENTATION_PLAN.md` Fase 10 marca `[x] Manter logo como asset fixo`, mas não há asset de logo no repositório | item do plano não corresponde ao estado real; a Fase 8 não pode assumir logo existente |

Nenhuma dessas ambiguidades foi resolvida silenciosamente nesta auditoria. Todas as que exigem escolha estão endereçadas em `08-documentos.md` como `[P]` ou `[V]`.

---

## 15. Riscos

| ID | Risco | Mitigação prevista |
|---|---|---|
| R1 | escolher solução baseada em Chromium e quebrar o deploy | usar biblioteca JavaScript pura, sem binário de sistema (D148) |
| R2 | inventar logo ou identidade visual | exigir asset humano ou gerar apenas identidade textual (D150) |
| R3 | `BusinessData` ausente virar `500` ou PDF sem identidade | erro de aplicação mapeado e testado (D186) |
| R4 | vazamento de dados proibidos ao reutilizar `QuoteDetailView` | projeções fechadas e testes negativos (D158, D167, D171, D204) |
| R5 | `GET` com gravação de histórico gerar eventos espúrios por prefetch/retry | decidir contrato e documentar `cache-control: no-store` (D179, D190, D191) |
| R6 | usar `save`/`mutate` e alterar `quotes.updatedAt` ou reconciliar filhos | caminho append-only dedicado (D183) |
| R7 | evento gravado antes da renderização | gravar somente após sucesso (D180, D181) |
| R8 | erro de renderização registrado como sucesso | idem |
| R9 | acentuação corrompida por fonte/encoding | usar fonte padrão WinAnsi e testar acentos (D149, D199, D200) |
| R10 | NBSP de `Intl.NumberFormat` não suportado pela fonte | normalizar para espaço antes de desenhar (D151) |
| R11 | logo ausente em `dist` | configurar cópia de assets ou embutir o arquivo (D150) |
| R12 | documento grande bloquear o event loop | documentos pequenos no MVP; medir se necessário (R14) |
| R13 | biblioteca sem manutenção ativa | fixar versão e isolar o adapter (D148, D197) |
| R14 | ausência de CI/runtime fixo esconder incompatibilidade | validar no build/testes locais; registrar dívida (G20) |
| R15 | testes E2E concorrentes corromperem o singleton `business_data` | serializar a suíte ou isolar o setup (D206) |
| R16 | reemissão refletir dados cadastrais atuais, não os do envio | decisão explícita sobre snapshot × projeção atual (D155/§16) |
| R17 | documento com muitas cortinas estourar a página | paginação automática definida (D152) |
| R18 | a implementação assumir que o logo já existe porque o plano marca o item como concluído | D150 exige decisão explícita e asset; a divergência está registrada em I19 |

---

## 16. Decisões necessárias para DOCUMENTOS-02

| Tema | Por que está aberto |
|---|---|
| fronteira e localização das projeções | não há código; é preciso fixar Application × Infrastructure |
| biblioteca de PDF e runtime | `ARCHITECTURE.md` §22 adiou a escolha |
| geração em memória e ausência de Chromium | precisa ser explícita para não depender de binário não declarado |
| fonte, encoding e logo | não há fonte nem asset; §2.7 exige logo fixo |
| locale e formatadores | nenhuma fonte define formato |
| composição exata do PDF comercial | §10.2 lista blocos, mas não a linha de serviço nem os campos da identidade |
| composição exata da ordem de produção | §10.6 lista campos, mas não rótulos, ordem ou formato de medida |
| estados permitidos de cada documento | `CONFIRMED`/`IN_PRODUCTION`/`COMPLETED`/`CANCELLED` não estão totalmente fechados para o PDF comercial |
| regeneração e downloads repetidos | não há regra de evento por repetição |
| prévia versus geração | a mesma rota `GET` pode ter efeitos distintos por status |
| `BusinessData` ausente | D140 delegou a decisão à Fase 8 |
| integração com `BusinessData` | o módulo não exporta a query |
| dados do cliente | não há consulta de contato no módulo de Orçamentos |
| `GET` versus `POST` | a rota documentada é `GET`, mas a geração grava histórico |
| headers, filename e status codes | não definidos nas fontes |
| escrita append-only de histórico | o repository atual não oferece |
| contrato de `details` dos eventos | D109 adiou |
| taxonomia e encapsulamento de erros | não há erros de documento |
| estratégia de testes de conteúdo | não há extração de texto nem dependência de teste |
| isolamento E2E de `business_data` | a suíte compartilha o singleton |

A numeração e o fechamento estão em `docs/development/08-documentos.md` (D143 em diante).

---

## 17. Arquivos provavelmente afetados pela implementação futura

> Nenhum destes arquivos foi criado ou alterado nesta task. Lista prospectiva.

### 17.1 Novos — application

```text
backend/src/modules/orcamentos/application/documents/
├── commercial-pdf.projection.ts
├── production-order.projection.ts
├── generate-commercial-pdf.use-case.ts
├── generate-production-order.use-case.ts
├── document-projection.mapper.ts
└── document.errors.ts

backend/src/modules/orcamentos/application/ports/
├── quote-document-renderer.ts
├── customer-contact.query.ts
└── quote-history-writer.ts
```

### 17.2 Novos — infrastructure

```text
backend/src/modules/orcamentos/infrastructure/documents/
├── pdf-lib-quote-document-renderer.ts
├── document-formatters.ts
├── layout.ts
└── assets/logo.png            (somente se D150 aprovar um asset)

backend/src/modules/orcamentos/infrastructure/persistence/
├── prisma-customer-contact.query.ts
└── prisma-quote-history-writer.ts
```

### 17.3 Alterados

- `backend/src/modules/orcamentos/domain/history/quote-history.ts` — incluir os dois eventos e seus `details` (D184).
- `backend/src/modules/orcamentos/orcamentos.module.ts` — registrar os novos providers e importar `DadosDoNegocioModule` (D154).
- `backend/src/modules/dados-do-negocio/dados-do-negocio.module.ts` — exportar `GetBusinessDataQuery` (D154).
- `backend/src/modules/orcamentos/presentation/orcamentos.controller.ts` — duas rotas `GET` (D189).
- `backend/src/modules/orcamentos/presentation/quote-error-mapper.ts` ou novo `document-error-mapper.ts` — mapear erros de documento (D196).
- `backend/package.json` e `backend/pnpm-lock.yaml` — `pdf-lib`; `unpdf` apenas em dev, se aprovado (D148, D201).
- `backend/nest-cli.json` — cópia do logo, se houver asset (D150).

### 17.4 Testes novos

```text
backend/src/modules/orcamentos/application/documents/*.spec.ts
backend/src/modules/orcamentos/infrastructure/documents/*.spec.ts
backend/src/modules/orcamentos/infrastructure/persistence/prisma-quote-history-writer.integration.spec.ts
backend/test/documentos.e2e-spec.ts
```

### 17.5 Não alterados

- `backend/prisma/schema.prisma`;
- `backend/prisma/migrations/`;
- `backend/prisma/seed.ts`;
- `frontend/`;
- regras de negócio do aggregate `Quote`;
- endpoints existentes de Orçamento, Clientes e Dados do Negócio.

---

## 18. Conclusão

O banco e o aggregate já oferecem todos os dados técnicos e comerciais necessários. O módulo de Dados do Negócio já oferece a identidade do negócio. O histórico já possui os dois tipos de evento no banco e na leitura. **Nenhuma migration é necessária.**

O que não existe é a camada de documentos: projeções, renderer, biblioteca, rotas, escrita append-only de histórico, formatação, asset de logo e testes. Também permanecem abertas decisões materiais de conteúdo, ciclo de vida, HTTP e falha.

A implementação pode começar depois da validação humana das decisões `[P]` e `[V]` de `docs/development/08-documentos.md`, sem antecipar nenhuma delas nesta rodada.

---

## 19. Observação de processo

Esta auditoria não alterou `docs/IMPLEMENTATION_PLAN.md`. O plano continua registrando a Fase 8 como pendente e a spec `08-documentos.md` como “a criar”; a spec foi criada em DOCUMENTOS-02. Qualquer ajuste de sequência ou de tasks no plano deve ser feito em rodada posterior, após validação.

Recomenda-se, em rodada autorizada, corrigir a Fase 10 do plano: o item `[x] Manter logo como asset fixo` não corresponde ao repositório (I19). A correção pode ser reabrir o item como pendente ou transferi-lo formalmente para a Fase 8, conforme a decisão D150 de `08-documentos.md`.
