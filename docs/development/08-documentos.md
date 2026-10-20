# 08 — Documentos (Fase 8)

**Status:** DOCUMENTOS-02 concluída em 2026-10-20. Validação humana registrada em 2026-10-20: 30 decisões `[F]`, 37 `[A]`, 0 `[P]`, 0 `[V]`. Decomposição definitiva `DOCUMENTOS-03…21` registrada; implementação autorizada.
**Decisões:** D143–D209.
**Implementação:** não iniciada nesta rodada. Nenhum código, schema, migration, rota ou dependência foi alterado.
**Auditoria de origem:** `docs/development/08-documentos-audit.md` (DOCUMENTOS-01).
**Pendência operacional:** asset PNG da logo (D150) antes da finalização visual do renderer. Não há bloqueio funcional para iniciar `DOCUMENTOS-03`.

> Esta spec fecha as decisões técnicas, funcionais e de contrato da Fase 8. Todas as decisões propostas ou que exigiam validação humana foram **aprovadas em 2026-10-20**. A implementação está autorizada e segue a decomposição definitiva `DOCUMENTOS-03…21` (seção 13); a única pendência é o asset PNG da logo para a finalização visual.

---

## 1. Objetivo

Permitir que a consultora gere, sob demanda:

1. o **PDF comercial** do orçamento, para envio ao cliente;
2. a **ordem de produção**, para as costureiras terceirizadas;

sem criar aggregate, tabela, repositório, status, cache ou versionamento de documento.

A Fase 8 é uma camada de **projeção e renderização**. O orçamento continua sendo a única fonte de verdade. Nenhuma regra de negócio é recalculada.

---

## 2. Escopo e não escopo

### 2.1 Incluído

- projeção fechada do PDF comercial;
- projeção fechada da ordem de produção;
- geração em memória e resposta HTTP;
- integração com Dados do Negócio pela Application;
- leitura do contato atual do cliente;
- registro dos dois eventos de histórico;
- erros, status HTTP, headers e nome de arquivo;
- testes unitários, de integração, E2E e de conteúdo.

### 2.2 Fora do escopo

- persistência, armazenamento, cache ou versionamento de PDF;
- tabela, aggregate, repository, status ou numeração de documento;
- migration ou alteração de schema;
- tela, botão ou fluxo de frontend (Fase 11);
- mecanismo de compartilhamento (WhatsApp, Web Share, link público);
- upload ou gerenciamento de logo;
- assinatura, QR Code, autenticação de PDF ou marca d'água;
- envio por e-mail ou integração externa;
- alteração do aggregate `Quote` ou de suas regras;
- alteração de `docs/IMPLEMENTATION_PLAN.md` nesta rodada.

---

## 3. Fontes e precedência

| Ordem | Fonte | Uso |
|---|---|---|
| 1 | `docs/PROJECT_SPEC.md` | comportamento do produto |
| 2 | `docs/ARCHITECTURE.md` | fronteiras e decisões técnicas |
| 3 | esta spec | implementação da Fase 8 |
| 4 | `docs/IMPLEMENTATION_PLAN.md` | sequência e progresso |

Referências principais:

- `PROJECT_SPEC.md` §2.7, §8.4–§8.13, §10.1–§10.7, §11, §14.2–§14.4, §15;
- `ARCHITECTURE.md` §1.2, §5.1–§5.4, §11, §14.2–§14.3, §16.1–§16.2, §17, §22;
- `docs/development/04-orcamentos.md` D76–D124 (aggregate, cálculos, ciclo de vida, histórico, queries, HTTP, erros, testes);
- `docs/development/10-dados-negocio.md` D125–D142, em especial D140;
- `docs/development/08-documentos-audit.md`.

---

## 4. Marcadores

| Marcador | Significado |
|---|---|
| `[F]` | determinado pelas fontes. Não é proposta; a implementação deve seguir. |
| `[A]` | aprovada por validação humana em 2026-10-20. A implementação deve seguir. |
| `[P]` | proposta desta spec. Não utilizada após a validação de 2026-10-20. |
| `[V]` | exigia validação humana antes da implementação. Não utilizada após a validação de 2026-10-20. |

Nesta spec há 30 decisões `[F]` e 37 decisões `[A]`. Todas as decisões originalmente `[P]` ou `[V]` foram aprovadas em 2026-10-20 e promovidas a `[A]`; não resta decisão aberta.

---

## 5. Mapa das decisões

| Grupo | Decisões |
|---|---|
| Arquitetura e fronteiras | D143–D147, D153–D158 |
| Biblioteca, fonte, logo, locale e layout | D148–D152 |
| PDF comercial | D159–D168 |
| Ordem de produção | D169–D173 |
| Ciclo de vida, regeneração e histórico | D174–D185 |
| Dados do Negócio | D186–D188 |
| HTTP | D189–D195 |
| Erros | D196–D198 |
| Testes | D199–D206 |
| Escopo, abstrações e contrato futuro | D207–D209 |

---

## 6. Decisões

### 6.1 Arquitetura e fronteiras

#### D143 — Documentos são projeções sob demanda, não um novo conceito de negócio [F]

O PDF comercial e a ordem de produção são **projeções de leitura** do orçamento. Não existe um conceito de negócio “documento”, nem entidade, aggregate, status, ciclo de vida próprio, numeração ou repositório.

- **Fonte:** `ARCHITECTURE.md` §16.1–§16.2; `PROJECT_SPEC.md` §10.4–§10.5; `IMPLEMENTATION_PLAN.md` Fase 8.
- **Consequência:** a Fase 8 não adiciona nada ao domínio de Orçamento além dos dois tipos de evento de histórico já previstos no banco.

#### D144 — PDF não é persistido, armazenado nem versionado [F]

Cada requisição gera o arquivo a partir dos dados atuais. Não há tabela, bucket, pasta, cache ou “versão mais recente” armazenada.

- **Fonte:** `ARCHITECTURE.md` §16.1 (“não será persistido nem versionado no MVP”); `PROJECT_SPEC.md` §10.4 (“não existe versionamento de arquivos PDF no MVP”).
- **Leitura da condicional:** `PROJECT_SPEC.md` §10.4 diz “caso o documento seja armazenado”; a condição **não** é satisfeita: `ARCHITECTURE.md` §16.1 decidiu não armazenar. Não há contradição a resolver.
- **Consequência:** não existe URL permanente, histórico de arquivos, download de versão antiga nem “última versão” em disco.

#### D145 — Localização no módulo `orcamentos` [A]

**Alternativas:**

- **A.** `orcamentos/application/documents/` e `orcamentos/infrastructure/documents/` (recomendada).
- **B.** novo módulo `documentos`, importando Orçamentos e Clientes.
- **C.** `shared/documents/`.

**Decisão aprovada em 2026-10-20:** A.

**Motivo:** o documento deriva do aggregate `Quote`; não há novo bounded context nem necessidade de ACL (`ARCHITECTURE.md` §16.2). Um módulo novo obrigaria a exportar repository/aggregate ou a duplicar leitura. `shared/` sugeriria reutilização por outros módulos que não existe. A pasta `infrastructure/documents/` já foi reservada na implementação do Orçamento.

**Status:** Aprovada em 2026-10-20.

#### D146 — Separação entre projeção (Application) e renderização (Infrastructure) [F]

- A **Application** carrega o aggregate, valida a disponibilidade, coleta dados de negócio/cliente, monta uma projeção fechada e coordena a gravação do histórico.
- A **Infrastructure** converte a projeção em bytes de PDF.
- O **Domain** não conhece PDF, biblioteca, layout, fonte ou arquivo.

- **Fonte:** `ARCHITECTURE.md` §5.1 (Domain não conhece geração de PDF), §5.2 (Application coordena geração de documentos), §5.3 (Infrastructure gera PDF).
- **Consequência:** o renderer não recebe `Quote`, `QuoteDetailView` nem `PrismaService`; recebe somente a projeção.

#### D147 — Porta `QuoteDocumentRenderer` na Application [A]

**Alternativas:**

- **A.** uma porta com dois métodos explícitos, `renderCommercialPdf` e `renderProductionOrder` (recomendada).
- **B.** duas portas separadas, uma por documento.
- **C.** use case importando `pdf-lib` diretamente.

**Decisão aprovada em 2026-10-20:** A.

```ts
export abstract class QuoteDocumentRenderer {
  abstract renderCommercialPdf(
    projection: CommercialPdfProjection,
  ): Promise<Uint8Array>;

  abstract renderProductionOrder(
    projection: ProductionOrderProjection,
  ): Promise<Uint8Array>;
}
```

**Motivo:** é a mesma capacidade técnica (renderizar documento do orçamento) com dois contratos explícitos. `Uint8Array` não acopla a Application à biblioteca. Duas portas (B) adicionariam cerimônia sem necessidade; C violaria D146.

**Status:** Aprovada em 2026-10-20.

### 6.2 Biblioteca, fonte, logo, locale e layout

#### D148 — `pdf-lib` 1.17.1, geração em memória, sem Chromium [A]

**Alternativas:**

- **A.** `pdf-lib` 1.17.1, JavaScript puro, em memória (recomendada).
- **B.** `pdfkit` 0.20.2.
- **C.** `@cantoo/pdf-lib` 2.11.1.
- **D.** Puppeteer/Playwright + HTML/Chromium.
- **E.** serviço externo de PDF.

**Decisão aprovada em 2026-10-20:** A.

**Motivo:**

- não exige binário nativo, Chromium, pacote de sistema ou permissão de build no `pnpm-workspace.yaml`;
- funciona no runtime Node/ESM já usado pelo backend;
- gera `Uint8Array` em memória, compatível com D144;
- inclui tipos TypeScript e suporte a `embedPng`/`embedJpg`;
- o layout manual é aceitável para dois documentos simples (D152).

**Riscos aceitos:** a última publicação é 1.17.1, de 2021; a versão deve ser fixada em `1.17.1` (sem `^`) e a biblioteca fica isolada no adapter (D197). Se a manutenção se tornar um problema, a porta permite trocar por B ou C sem alterar Application/HTTP.

**Não usar Chromium:** não há Dockerfile, imagem com Chromium, CI ou dependência declarada. Introduzir Chromium sem decisão explícita violaria o deploy atual. D148 rejeita D e E para o MVP.

**Status:** Aprovada em 2026-10-20.

#### D149 — Fonte padrão Helvetica/WinAnsi [A]

**Alternativas:**

- **A.** `StandardFonts.Helvetica` e `Helvetica-Bold` (WinAnsi), sem arquivo de fonte (recomendada).
- **B.** embutir uma fonte TTF (por exemplo, Inter/Roboto) com `@pdf-lib/fontkit`.
- **C.** `StandardFonts.TimesRoman`.

**Decisão aprovada em 2026-10-20:** A.

**Motivo:** o texto do produto é português e cabe em WinAnsi (acentos, `ç`, `ã`, `õ`, `—`, `R$`). Não exige asset, licença, dependência extra nem cópia de arquivo para `dist/`. A fonte é menor e o PDF abre em qualquer leitor.

**Cuidados:**

- normalizar `U+00A0` (NBSP) para espaço comum antes de desenhar;
- se um caractere não suportado for desenhado, o adapter captura o erro e lança `DocumentRenderError` (D197);
- o texto deve ser testado com acentos (D200).

**Status:** Aprovada em 2026-10-20.

#### D150 — Logo e identidade visual fixa [A]

`PROJECT_SPEC.md` §2.7 e §10.2 exigem template visual fixo com identidade do negócio e logo fixos, sem upload. O repositório **não contém** nenhum logo do negócio (apenas assets do template Vite). O `IMPLEMENTATION_PLAN.md` Fase 10 marca `[x] Manter logo como asset fixo`, mas essa marcação não corresponde ao estado real (auditoria, I19); não deve ser tratada como evidência de que o asset existe.

**Decisão aprovada em 2026-10-20:**

- usar um PNG fixo versionado no backend;
- não criar upload, CRUD, configuração ou gerenciamento de logo;
- o asset fica em `backend/src/modules/orcamentos/infrastructure/documents/assets/logo.png` e é copiado para `dist/` via `nest-cli.json`;
- o renderer embute o PNG no PDF;
- não inventar, gerar automaticamente ou substituir a logo por uma imagem genérica.

**Pendência operacional:** se o PNG ainda não tiver sido fornecido quando a implementação chegar ao renderer, estruturar o suporte ao asset (leitura e cópia de build) e reportar o bloqueio da finalização visual. A implementação não deve criar uma imagem substituta; a aceitação visual do renderer fica pendente até o asset ser fornecido.

**Motivo:** o logo é um asset fixo, não um dado gerenciável pelo usuário; §2.7 exige identidade visual fixa.

**Status:** Aprovada em 2026-10-20, com pendência de asset.

#### D151 — Locale `pt-BR` e formatadores [A]

**Alternativas:**

- **A.** usar `Intl` com locale e timezone explícitos, centralizado em `document-formatters.ts` (recomendada).
- **B.** formatar manualmente com `replace` e `toFixed`.
- **C.** usar o locale padrão do processo.

**Decisão aprovada em 2026-10-20:** A.

**Regras:**

- moeda: `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`; substituir NBSP por espaço comum;
- data: `Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' })`;
- telefone: exibir como armazenado (já normalizado/trimado); não reformatar;
- CPF/CNPJ do negócio: se exibido (D160), formatar por comprimento (11 → CPF, 14 → CNPJ); não alterar o dado persistido;
- medidas: D172.

**Motivo:** o produto é brasileiro e os exemplos das fontes usam `R$` e `DD/MM/AAAA`. O timezone explícito evita que um instante próximo da meia-noite seja exibido no dia anterior. `Intl` já existe no Node, sem dependência nova.

**Status:** Aprovada em 2026-10-20.

#### D152 — Layout A4 e paginação automática [A]

**Alternativas:**

- **A.** A4 retrato, margens fixas, cursor vertical e quebra automática de página (recomendada).
- **B.** uma página por documento, limitando o número de cortinas (rejeitada: o orçamento não tem limite).
- **C.** HTML + Chromium (rejeitada por D148).

**Decisão aprovada em 2026-10-20:** A.

**Regras de apresentação:**

- A4 (595,28 × 841,89 pt), margens de 48 pt;
- Helvetica 10/12 para corpo, 16 bold para título, 11 bold para rótulos de seção;
- quebra de página quando o cursor ultrapassar a margem inferior; nova página e continuação;
- na ordem de produção, repetir o cabeçalho da tabela na nova página;
- descrições/materiais longos quebram com `maxWidth` e `lineHeight`;
- rodapé opcional com “Página X” (sem total, para evitar duas passagens);
- nenhuma imagem além do logo (D150).

**Motivo:** o número de cortinas é variável e o documento não pode cortar conteúdo. A apresentação exata não está nas fontes; esta foi a decisão aprovada em 2026-10-20.

**Status:** Aprovada em 2026-10-20.

### 6.3 Integração com outros módulos e projeções

#### D153 — Dados do Negócio consumidos pela Application, sem Prisma direto e sem HTTP interno [F]

A Fase 8 deve obter a identidade do negócio por `GetBusinessDataQuery` ou projeção equivalente da Application de Dados do Negócio.

- **Não** acessar `PrismaService.businessData` em `orcamentos/`.
- **Não** chamar `GET /dados-do-negocio` internamente.
- **Não** duplicar normalização, validação ou fallback.

- **Fonte:** `docs/development/10-dados-negocio.md` D140 `[F]`; `ARCHITECTURE.md` §5–§7.
- **Consequência:** o wiring de módulos precisa ser ajustado (D154), mas nenhuma regra de Dados do Negócio é reimplementada.

#### D154 — Exportar `GetBusinessDataQuery` e importar `DadosDoNegocioModule` [A]

**Alternativas:**

- **A.** `DadosDoNegocioModule` exporta `GetBusinessDataQuery`; `OrcamentosModule` importa o módulo (recomendada).
- **B.** criar uma porta `BusinessIdentityQuery` em Orçamentos e um adapter que delega à query.
- **C.** leitura direta de `business_data` em infraestrutura de Orçamentos (proibida por D140).

**Decisão aprovada em 2026-10-20:** A.

**Motivo:** é o mínimo para cumprir D140, sem nova abstração. A query já devolve os quatro campos e já lança `BusinessDataNotFoundError`; a tradução para erro de documento fica no use case (D186/D196).

**Status:** Aprovada em 2026-10-20.

#### D155 — Contato do cliente por consulta estreita na Application de Clientes [A]

O PDF comercial precisa apenas de `name` e `phone` do cliente.

**Alternativas:**

- **A.** criar `GetCustomerContactQuery` em `clientes/application`, devolvendo `{ name, phone } | null`, exportá-la e importar `ClientesModule` em Orçamentos (recomendada).
- **B.** ler `customers` diretamente em `orcamentos/infrastructure` por uma porta estreita (há precedente em `PrismaCustomerEligibility`).
- **C.** adicionar snapshot de nome/telefone ao `Quote` (exigiria schema/migration; fora da Fase 8).

**Decisão aprovada em 2026-10-20:** A.

**Motivo:** mantém a integração entre módulos na Application, como D140; expõe somente dois campos, evitando que dados proibidos do cliente cheguem à projeção; não altera schema. A consulta deve buscar por `id` **ignorando `deletedAt`**, porque o orçamento existente continua válido após o soft delete do cliente. Se a linha não existir, o use case lança `DocumentCustomerNotFoundError`.

**Status:** Aprovada em 2026-10-20.

#### D156 — Ordem de produção não consome cliente nem Dados do Negócio [F]

A ordem de produção é composta exclusivamente pelo número do orçamento e pelos dados técnicos das cortinas.

- **Fonte:** `PROJECT_SPEC.md` §10.6 e §14.3; `ARCHITECTURE.md` §16.2.
- **Consequência:** a geração da ordem de produção não depende de `ClientesModule` nem de `DadosDoNegocioModule`, e continua funcionando com `BusinessData` ausente.

#### D157 — Nenhuma regra de negócio é recalculada [F]

As projeções usam os valores derivados do aggregate e dos comportamentos existentes:

- `quote.quoteNumber.value`;
- `quote.totalCents`;
- `curtain.finalWidth`;
- `curtain.height`;
- `quote.validUntil`;
- `quote.status`;
- `quote.isExpired(now)` quando aplicável.

Não há nova fórmula de total, desconto, ajuste, largura final, quantidade de tecido ou validade no código de documento.

- **Fonte:** `ARCHITECTURE.md` §5.1–§5.2; `04-orcamentos.md` §3.5 (cálculos financeiros) e D76–D124; `PROJECT_SPEC.md` §14.2 (“dados derivados calculados de forma consistente”).
- **Consequência:** a projeção carrega o aggregate por `QuoteRepository.findById` e usa getters; não reutiliza SQL que recalcule totais.

#### D158 — Projeções fechadas; nunca reutilizar `QuoteDetailView` [F]

Os tipos de projeção contêm **somente** os campos autorizados. O renderer recebe a projeção, não o aggregate nem o read model interno.

- **Fonte:** `PROJECT_SPEC.md` §10.2 e §10.6 (listas de proibição); `ARCHITECTURE.md` §16.2 (“somente as informações autorizadas”).
- **Consequência:** `QuoteDetailView` (que contém notas, endereço, componentes, preços e desconto) não pode ser passado ao renderer nem usado como base por spread. O mapper constrói campo a campo.

### 6.4 PDF comercial

#### D159 — Composição e ordem dos blocos [F]

O PDF comercial contém, nesta ordem:

1. cabeçalho com o número do orçamento;
2. identidade do negócio (D160);
3. bloco do cliente: nome e telefone (D162);
4. bloco de serviços por ambiente (D161);
5. valor final consolidado (D163);
6. data exata de validade (D164).

- **Fonte:** `PROJECT_SPEC.md` §10.2, incluindo o exemplo conceitual.
- **Consequência:** não há blocos adicionais de condições, pagamento, garantia, assinatura, QR Code ou termos. Rótulos exatos são apresentação; o conteúdo obrigatório é o acima.

#### D160 — Campos da identidade do negócio [A]

`PROJECT_SPEC.md` §2.7 modela quatro campos; §10.2 pede “identidade do negócio”, sem enumerar quais aparecem.

**Alternativas:**

- **A.** exibir todos os campos não vazios: `commercialNameOrConsultant`, `phone`, `email`, `taxId` (recomendada).
- **B.** exibir apenas `commercialNameOrConsultant` e `phone`.
- **C.** exibir nome, telefone e e-mail; omitir `taxId`.

**Decisão aprovada em 2026-10-20:** A, com omissão dos opcionais vazios (D166) e formatação de CPF/CNPJ (D151).

**Motivo:** os quatro campos foram modelados na Fase 10 justamente para a identidade do negócio; o CPF/CNPJ proibido em §10.2 é o **do cliente**, não o do negócio. A escolha foi aprovada em 2026-10-20.

**Status:** Aprovada em 2026-10-20.

#### D161 — Linha de serviço por ambiente [A]

`PROJECT_SPEC.md` §10.2 pede “serviços por ambiente” e o exemplo mostra `Quarto — Cortina sob medida` e `Sala — Janela principal — Cortina sob medida`. Não existe entidade “serviço”; há `room` e `description` na cortina.

**Alternativas:**

- **A.** uma linha por cortina: `{room} — {description} — Cortina sob medida`; quando não houver descrição, `{room} — Cortina sob medida` (recomendada).
- **B.** uma linha por cortina: `{room} — {description}` quando houver descrição; caso contrário, `{room} — Cortina sob medida`.
- **C.** agrupar cortinas do mesmo ambiente em uma linha, concatenando descrições.
- **D.** exibir apenas `{room}`.

**Decisão aprovada em 2026-10-20:** A.

**Motivo:** reproduz o exemplo da fonte, preserva a ordem das cortinas e mantém o produto identificável. A descrição é opcional e não substitui o nome do produto. Não há preço, dimensão, material ou quantidade na linha.

**Status:** Aprovada em 2026-10-20.

#### D162 — Nome e telefone do cliente [F]

O PDF comercial exibe **somente** `Customer.name` e `Customer.phone` do cliente vinculado. Não exibe e-mail, CPF/CNPJ, endereço cadastral, endereço de instalação nem observações.

- **Fonte:** `PROJECT_SPEC.md` §10.2 (lista de campos permitidos e proibidos).
- **Dados atuais:** a projeção lê o cadastro atual do cliente, conforme `ARCHITECTURE.md` §16.1 (“dados atuais”). Reemissões refletem alterações cadastrais posteriores; o histórico já gravado não é alterado (`PROJECT_SPEC.md` §14.2). Não há snapshot no schema e criar um exigiria migration fora da Fase 8.

#### D163 — Valor final consolidado [F]

O documento exibe apenas `quote.totalCents`, formatado em BRL, sob o rótulo “VALOR TOTAL DO SERVIÇO”.

- **Fonte:** `PROJECT_SPEC.md` §10.2.
- **Proibido:** subtotal, componentes financeiros, adicionais gerais itemizados, desconto itemizado, ajuste comercial, valor por cortina, frete, mão de obra e qualquer detalhamento.

#### D164 — Validade [A]

**Alternativas:**

- **A.** em estado de geração (D174), exigir `validUntil` não nulo e exibir “Orçamento válido até: DD/MM/AAAA”; na prévia em `DRAFT`, omitir a linha quando `validUntil` for nulo (recomendada).
- **B.** bloquear a prévia enquanto `validUntil` for nulo.
- **C.** exibir “a definir” na prévia (texto inventado; rejeitada).

**Decisão aprovada em 2026-10-20:** A.

**Motivo:** `PROJECT_SPEC.md` §8.5 permite `validUntil` nulo em rascunho; §10.3 permite prévia “quando houver dados suficientes”; §10.2 exige a data exata no documento final. Em estado de geração, `validUntil` deve existir; se estiver nulo por inconsistência, o use case lança `DocumentDataIncompleteError` (D173/D196) em vez de gerar um documento sem validade.

**Status:** Aprovada em 2026-10-20.

#### D165 — Dados mínimos para a prévia em `DRAFT` [A]

**Alternativas:**

- **A.** prévia permissiva: exigir identidade do negócio configurada, contato do cliente e ao menos uma cortina com `room`; omitir o valor quando `totalCents === 0` e a validade quando nula (recomendada).
- **B.** prévia próxima do documento final: exigir também `totalCents > 0` e `validUntil` não nulo.
- **C.** aplicar o gate completo de envio (rejeitada: a prévia deixaria de servir ao rascunho).

**Decisão aprovada em 2026-10-20:** A.

**Motivo:** `PROJECT_SPEC.md` §10.3 diz “quando houver dados suficientes” e que a prévia **não substitui o gate completo de envio**. Exigir o gate completo contradiz o uso da prévia; exigir total/validade (B) cria um segundo gate não previsto. A opção A mostra o que já existe, sem inventar valores.

**Status:** Aprovada em 2026-10-20.

#### D166 — Campos opcionais vazios não são renderizados [F]

Descrição, e-mail e CPF/CNPJ vazios ou somente espaços não geram rótulo, linha ou espaço reservado. O mesmo vale para a validade nula na prévia (D164) e para o total zero na prévia (D165).

- **Fonte:** `PROJECT_SPEC.md` §10.2 (“Campos opcionais vazios não são renderizados”); §10.6 (`descricao?`).

#### D167 — Dados proibidos no PDF comercial [F]

Não podem aparecer no PDF comercial:

- CPF/CNPJ do cliente;
- endereço cadastral do cliente;
- endereço de instalação;
- dimensões (largura, altura, largura final);
- material/tecido;
- quantidade de tecido;
- borda;
- fator de tecido;
- componentes financeiros internos;
- adicionais gerais itemizados;
- desconto itemizado;
- ajuste comercial;
- observações internas;
- subtotais, preços por cortina e qualquer detalhe financeiro além do total consolidado.

- **Fonte:** `PROJECT_SPEC.md` §10.2.
- **Princípio:** o que não está na lista de permitidos de §10.2 não entra no documento.

#### D168 — Sem detalhamento financeiro [F]

O único valor financeiro do PDF comercial é o total consolidado. Não há tabela de componentes, linha de desconto, linha de adicional, “valor sem desconto”, “entrada” ou “parcelas”.

- **Fonte:** `PROJECT_SPEC.md` §10.2.
- **Consequência:** o mapper não pode copiar `generalAddOns`, `discount`, `commercialAdjustmentCents` nem `totals` detalhados de `QuoteDetailView`.

### 6.5 Ordem de produção

#### D169 — Composição da ordem de produção [F]

A ordem de produção contém:

1. título “ORDEM DE PRODUÇÃO” (apresentação);
2. cabeçalho com `numeroOrcamento`;
3. um bloco por cortina, na ordem de `sequence`, com `ambiente`, `descricao?`, `material`, `larguraFinal` e `altura`.

Não contém bloco de cliente, identidade do negócio, logo, data, endereço, preço, observação ou número próprio de documento.

- **Fonte:** `PROJECT_SPEC.md` §10.6; §14.3; `ARCHITECTURE.md` §16.2.
- **Consequência:** o número do orçamento é a única identificação. Um rótulo sequencial por cortina (“Cortina 1”) é permitido como apresentação, não como identificador persistido.

#### D170 — Dados técnicos por cortina [F]

| Campo do documento | Origem | Regra |
|---|---|---|
| `ambiente` | `curtain.room` | obrigatório no estado de geração; D173 se nulo |
| `descricao` | `curtain.description` | opcional; omitir se vazio (D166) |
| `material` | `curtain.material` | obrigatório no estado de geração; D173 se nulo |
| `larguraFinal` | `curtain.finalWidth` | derivado pelo domínio; não recalcular |
| `altura` | `curtain.height` | medida do domínio |

- **Fonte:** `PROJECT_SPEC.md` §10.6; D157.
- **Consequência:** a projeção não inclui `openingWidth`, `borderValue`, `fabricFactor`, `fabricQuantity`, `components`, `notes` ou qualquer campo financeiro.

#### D171 — Dados proibidos na ordem de produção [F]

Não podem aparecer na ordem de produção:

- nome, telefone, CPF/CNPJ e endereço do cliente;
- endereço de instalação;
- quantidade total de tecido;
- valor da borda;
- fator de tecido;
- trilho;
- entretela;
- frete;
- mão de obra;
- componentes financeiros;
- preços;
- desconto;
- dados da negociação;
- observações internas;
- identidade do negócio ou logo (não necessários à confecção; §10.6 diz “apenas as informações necessárias”).

- **Fonte:** `PROJECT_SPEC.md` §10.6 e §14.3; `ARCHITECTURE.md` §16.2.

#### D172 — Formato das medidas [A]

**Alternativas:**

- **A.** até 3 casas decimais, vírgula, sem zeros à direita: `2,6 m`, `2,60 m`, `2,605 m` (recomendada).
- **B.** sempre 2 casas: `2,60 m` (perde a terceira casa).
- **C.** sempre 3 casas: `2,600 m` (preserva, mas é ruidoso).

**Decisão aprovada em 2026-10-20:** A.

**Motivo:** as colunas são `Decimal(9,3)`; a ordem de produção não pode arredondar milímetros. Os exemplos das fontes usam 2 casas, mas são ilustrativos. Formatar com `Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })` e sufixo ` m`.

**Status:** Aprovada em 2026-10-20.

#### D173 — Dados técnicos incompletos [A]

Se, em um estado que permite a ordem de produção, `room`, `material`, `height` ou `finalWidth` estiverem nulos, a geração falha com `DocumentDataIncompleteError` (HTTP 409); nenhum PDF e nenhum evento são produzidos.

**Alternativas:** renderizar em branco (rejeitada: instrução incompleta para a costureira); renderizar “a definir” (rejeitada: inventa conteúdo); assumir valores padrão (proibida).

**Motivo:** o gate de envio já exige esses dados; a falha é defensiva contra dados legados/inconsistentes. Não é uma regra de negócio nova, é uma recusa a produzir documento inseguro.

**Status:** Aprovada em 2026-10-20.

### 6.6 Ciclo de vida, regeneração e histórico

#### D174 — Estados permitidos do PDF comercial [A]

**Decisão aprovada em 2026-10-20, com alteração da recomendação original:**

| Estado | PDF comercial |
|---|---|
| `DRAFT` | prévia permitida, sem evento |
| `SENT` | geração/reemissão permitida |
| `EXPIRED` | geração/reemissão permitida |
| `CONFIRMED` | geração/reemissão permitida |
| `IN_PRODUCTION` | geração/reemissão permitida |
| `COMPLETED` | geração/reemissão permitida |
| `CANCELLED` | geração bloqueada (`409`) |

O PDF é uma projeção dos dados atuais do orçamento e não altera o lifecycle. A regeneração após confirmação, produção ou conclusão reflete os dados atuais disponíveis no orçamento, sem versionamento de arquivo.

Em `DRAFT`, a rota é uma prévia e não grava evento. Nos demais estados não cancelados, é geração/reemissão e grava evento (D179/D180). Em `CANCELLED`, não há geração nem prévia.

**Fonte da alteração:** validação humana de 2026-10-20. A recomendação original estrita foi substituída.

**Status:** Aprovada com alteração.

#### D175 — Estados permitidos da ordem de produção [F]

Disponível exclusivamente em `CONFIRMADO`, `EM_PRODUCAO` e `CONCLUIDO`. Indisponível em `RASCUNHO`, `ENVIADO`, `EXPIRADO` e `CANCELADO`.

- **Fonte:** `PROJECT_SPEC.md` §10.5.
- **Consequência:** `EXPIRADO` é condição de `ENVIADO`; continua indisponível. Gerar a ordem não muda o status e não é pré-requisito para iniciar a produção.

#### D176 — `CANCELADO` não gera documentos [F]

Orçamento cancelado não gera PDF comercial nem ordem de produção. Como não há PDF persistido, não há arquivo a consultar.

- **Fonte:** `PROJECT_SPEC.md` §8.11, §10.5, §15.
- **Consequência:** ambas as rotas respondem `409` (D193) em `CANCELLED`.

#### D177 — Regeneração a cada requisição, sem cache [F]

Cada requisição bem-sucedida gera um novo arquivo a partir dos dados atuais. Não há cache de bytes, ETag, versão ou “último PDF”.

- **Fonte:** `ARCHITECTURE.md` §16.1; `PROJECT_SPEC.md` §10.4.
- **Consequência:** o renderer é chamado sempre; não há armazenamento em memória de longa duração.

#### D178 — Prévia em `RASCUNHO` não gera evento [F]

A prévia em `DRAFT` não grava histórico, não altera status, não atualiza `updatedAt` e não substitui o gate de envio.

- **Fonte:** `PROJECT_SPEC.md` §8.4, §10.3 e §11 (“visualizar uma prévia” não gera evento); D108.
- **Consequência:** o caminho de prévia não injeta `QuoteHistoryWriter`/não o chama.

#### D179 — Downloads repetidos e eventos [A]

**Alternativas:**

- **A.** cada geração bem-sucedida em estado de geração grava um evento (recomendada).
- **B.** apenas a primeira geração de cada tipo por orçamento grava evento; reemissões não.
- **C.** deduplicar por janela de tempo (por exemplo, 5 minutos) ou por requisição idêntica.

**Decisão aprovada em 2026-10-20:** A.

**Motivo:** `PROJECT_SPEC.md` §10.4 diz que “o histórico registra a geração do documento”, sem regra de primeira vez ou deduplicação. Cada requisição realmente gera um novo arquivo; registrar cada uma é fiel. O risco de ruído (duplo clique, retry) é mitigado no frontend e por `Cache-Control: no-store`, não por regra inventada. A alternativa B foi rejeitada em 2026-10-20.

**Status:** Aprovada em 2026-10-20.

#### D180 — Momento do evento e falha da escrita [A]

**Decisão aprovada em 2026-10-20:**

1. carregar os dados;
2. validar a disponibilidade;
3. montar a projeção;
4. renderizar os bytes em memória;
5. registrar o evento de histórico;
6. devolver os bytes.

**Regras:**

- falha na montagem da projeção ou na renderização: nenhum evento é registrado;
- falha na gravação do histórico: os bytes **não** são devolvidos, a requisição falha e não existe tentativa de compensação de arquivo, pois nenhum arquivo é persistido;
- nenhuma transação de banco permanece aberta durante a renderização (D185);
- `occurredAt` corresponde ao momento da escrita do histórico, não ao início da requisição;
- após o evento persistido, eventual desconexão HTTP não remove o evento (a geração ocorreu no servidor).

**Motivo:** mantém a invariante “evento de geração existe se e somente se o documento foi gerado com sucesso”.

**Status:** Aprovada em 2026-10-20.

#### D181 — Falhas nunca registram sucesso [F]

Nenhuma falha de leitura, projeção, validação, renderização ou resposta grava evento de geração. O evento só é gravado depois de os bytes existirem.

- **Fonte:** `PROJECT_SPEC.md` §10.4 e §11 (o histórico registra a geração); §14.4 (falhas não corrompem o estado).
- **Consequência:** não há evento “tentativa”, “erro” ou “falha” nesta fase.

#### D182 — Conteúdo de `details` dos eventos de documento [A]

**Alternativas:**

- **A.** `details` ausente/`undefined` (recomendada).
- **B.** `{ statusAtGeneration }`.
- **C.** `{ documentType }` (redundante com o tipo do evento).

**Decisão aprovada em 2026-10-20:** A.

**Motivo:** o tipo do evento e `occurredAt` já identificam o fato; não há requisito de auditoria adicional em D109. Guardar status ou dados do cliente duplicaria informação e poderia expor dados desnecessários. O `details` é nullable no schema.

**Proibido em `details`:** bytes do PDF, caminho de arquivo, nome/telefone/CPF/CNPJ do cliente, preços, endereço ou qualquer dado proibido nos documentos.

**Status:** Aprovada em 2026-10-20.

#### D183 — Escrita append-only de histórico [A]

**Alternativas:**

- **A.** nova porta `QuoteHistoryWriter` na Application, com `PrismaQuoteHistoryWriter` na Infrastructure, que apenas insere a linha (recomendada).
- **B.** método público `appendHistory` no `QuoteRepository`.
- **C.** usar `save`/`mutate` do repository atual.

**Decisão aprovada em 2026-10-20:** A.

```ts
export abstract class QuoteHistoryWriter {
  abstract append(input: {
    quoteId: string;
    event: QuoteHistoryEventDraft;
    occurredAt: Date;
  }): Promise<void>;
}
```

**Motivo:** `save` e `mutate` atualizam `quotes.updatedAt` e reconciliam cortinas/componentes; usá-los para um evento de documento violaria D144/D177 (geração não altera o orçamento). A porta separada expressa a intenção, é testável e não amplia o repository do aggregate. A inserção é única e não precisa de `$transaction`.

**Status:** Aprovada em 2026-10-20.

#### D184 — Incluir os dois eventos no contrato de domínio [A]

Adicionar ao union `QuoteHistoryEventType` e ao `QuoteHistoryDetailsMap`:

```ts
| 'COMMERCIAL_PDF_GENERATED'
| 'PRODUCTION_ORDER_GENERATED'
```

com `details: undefined` em ambos.

**Alternativas:** manter o union atual e fazer cast no repository (rejeitada: perde type safety); definir os tipos apenas na Application (rejeitada: o domínio é o dono do contrato de histórico, D108).

**Motivo:** o enum do banco já tem os 14 valores e a leitura já os aceita; falta apenas o contrato de escrita. Não há novo payload (D182).

**Status:** Aprovada em 2026-10-20.

#### D185 — Nenhuma transação aberta durante a renderização [F]

A leitura dos dados, a renderização e a gravação do evento não são envolvidas em uma transação que permaneça aberta durante o processamento do documento.

- **Fonte:** `ARCHITECTURE.md` §11 (“Geração de arquivos PDF não deve manter uma transação de banco aberta durante processamento de documento”).
- **Consequência:** as leituras são queries curtas; o render ocorre fora de `$transaction`; a inserção do histórico é uma operação separada. Não há necessidade de Unit of Work.

### 6.7 Dados do Negócio

#### D186 — Comportamento quando `BusinessData` não está configurado [A]

**Alternativas:**

- **A.** falhar com `BusinessDataNotConfiguredError` → HTTP `409`, mensagem clara, sem PDF e sem evento (recomendada).
- **B.** HTTP `404`, espelhando `GET /dados-do-negocio` (rejeitada: o recurso orçamento existe; 404 confundiria).
- **C.** HTTP `422`.
- **D.** gerar o PDF sem identidade (proibida por D140 e §10.2).

**Decisão aprovada em 2026-10-20:** A.

**Motivo:** o orçamento existe; o que falta é uma configuração prévia do sistema. `409 Conflict` comunica que o estado atual não permite concluir a operação. A mensagem deve orientar a configurar os dados do negócio. O evento não é gravado.

**Status:** Aprovada em 2026-10-20.

#### D187 — Ordem de produção independente de `BusinessData` [F]

A ordem de produção não lê `BusinessData` nem contato do cliente; funciona mesmo com a configuração ausente.

- **Fonte:** `PROJECT_SPEC.md` §10.6; D156.
- **Consequência:** a ausência de configuração nunca bloqueia a ordem de produção.

#### D188 — Leitura dos dados do negócio a cada geração, sem cache [A]

**Alternativas:**

- **A.** consultar `GetBusinessDataQuery` em cada geração (recomendada).
- **B.** cache em memória com invalidação.
- **C.** snapshot no orçamento.

**Decisão aprovada em 2026-10-20:** A.

**Motivo:** é uma única linha; a configuração muda raramente; não há requisito de performance que justifique cache; B adicionaria invalidação e C exigiria schema. A projeção sempre reflete a configuração atual.

**Status:** Aprovada em 2026-10-20.

### 6.8 HTTP

#### D189 — Rotas `GET /orcamentos/:id/pdf` e `GET /orcamentos/:id/ordem-producao` [F]

As duas rotas ficam no `OrcamentosController`, herdam `AuthGuard` e usam `ParseUUIDPipe` em `:id`.

- **Fonte:** `ARCHITECTURE.md` §14.2; `04-orcamentos.md` §3.13.
- **Consequência:** não há novo controller, módulo ou prefixo. A resposta é binária, não JSON.

#### D190 — `GET` versus `POST` para geração [A]

**Alternativas:**

- **A.** manter `GET` conforme `ARCHITECTURE.md` §14.2; aceitar o efeito de histórico como auditoria de acesso e usar `Cache-Control: no-store` (recomendada).
- **B.** trocar para `POST /orcamentos/:id/pdf` e `POST /orcamentos/:id/ordem-producao`.
- **C.** separar: `GET` para prévia e `POST` para geração explícita.

**Decisão aprovada em 2026-10-20:** A.

**Motivo:** a rota documentada é `GET`; mudar para `POST` altera o contrato arquitetural e exigiria atualizar `ARCHITECTURE.md` em rodada autorizada, além de complicar o download no frontend. O efeito é um evento de auditoria, não uma alteração de estado de negócio; com A, a semântica é “gerar e baixar”, documentada. As alternativas B e C foram rejeitadas em 2026-10-20.

**Riscos de A:** prefetch, retry ou duplo clique podem gerar eventos repetidos (D179). Mitigar com `no-store` e sem prefetch no frontend.

**Status:** Aprovada em 2026-10-20.

#### D191 — Headers de resposta [A]

**Decisão aprovada em 2026-10-20:**

```text
Content-Type: application/pdf
Content-Disposition: inline; filename="orcamento-ORC-2026-001.pdf"
Cache-Control: no-store
```

- `Content-Length` é definido automaticamente pelo `StreamableFile`.
- `inline` permite visualizar no navegador; o frontend pode forçar download com `download`/blob.
- `no-store` evita cache de um documento gerado sob demanda.
- `X-Content-Type-Options: nosniff` é opcional; se adotado, aplicar apenas a estas respostas ou globalmente em rodada própria.

**Alternativas:** `attachment` (força download; pior para prévia); `?download=1` (adiciona contrato não previsto).

**Motivo:** não há header definido nas fontes; esta é a decisão aprovada, mínima e segura.

**Status:** Aprovada em 2026-10-20.

#### D192 — Nome do arquivo [A]

**Decisão aprovada em 2026-10-20:**

| Documento | Nome |
|---|---|
| PDF comercial | `orcamento-{numero}.pdf` |
| Ordem de produção | `ordem-de-producao-{numero}.pdf` |

Onde `{numero}` é `quoteNumber` em ASCII (por exemplo, `ORC-2026-001`). Usar `filename*` (RFC 5987) para preservar o valor original com `Ç`, e o fallback ASCII em `filename`.

**Alternativas:** UUID (não identificável); nome do cliente (expõe dado pessoal); data/hora (instável).

**Motivo:** o número é único e reconhecível pela consultora; não expõe dado pessoal.

**Status:** Aprovada em 2026-10-20.

#### D193 — Status codes [A]

| Situação | Status | Mensagem estável |
|---|---|---|
| Sucesso | `200` | corpo PDF |
| UUID inválido | `400` | validação existente do `ParseUUIDPipe` |
| Não autenticado | `401` | guard existente |
| Orçamento não encontrado | `404` | `QuoteNotFoundError` existente |
| Estado não permite o documento | `409` | `Document is not available in the current status` |
| `BusinessData` ausente | `409` | `Business data is not configured` |
| Dados do documento incompletos | `409` | `Document data is incomplete` |
| Cliente do orçamento ausente | `409` | `Document data is incomplete` |
| Falha de renderização | `500` | `Could not generate the document` |
| Falha ao gravar histórico | `500` | `Could not generate the document` |

**Alternativas:** `422` para configuração/dados ausentes; `404` para `BusinessData` (rejeitada em D186); `503` para falha de renderização.

**Motivo:** `409` representa conflito com o estado atual (status/configuração/dados), sem inventar um novo formato de erro. `500` não expõe detalhes internos (D198). Não há `403`, pois não há papéis além de autenticado.

**Status:** Aprovada em 2026-10-20.

#### D194 — Autenticação e CSRF [F]

As rotas exigem sessão autenticada (`AuthGuard`), como todas as rotas de Orçamento. Por serem `GET`, não passam pelo `CsrfOriginGuard` (que atua apenas em métodos mutáveis).

- **Fonte:** `PROJECT_SPEC.md` §13 e §14.3; `ARCHITECTURE.md` §14.2; código atual do controller e do guard.
- **Consequência:** nenhuma nova regra de autorização é criada na Fase 8.

#### D195 — Resposta binária com `StreamableFile` [A]

**Alternativas:**

- **A.** `StreamableFile` do Nest com `Buffer.from(bytes)` e headers via `@Header`/`@Res({ passthrough: true })` (recomendada).
- **B.** `@Res()` direto e `res.send(buffer)`.
- **C.** JSON com base64 (rejeitada: incha a resposta e quebra o contrato de PDF).

**Decisão aprovada em 2026-10-20:** A.

**Motivo:** é o mecanismo nativo do Nest, define `Content-Length`, funciona com interceptors e mantém o controller fino. B contorna o ciclo de vida do Nest; C não é um PDF.

**Status:** Aprovada em 2026-10-20.

### 6.9 Erros

#### D196 — Taxonomia e mapeamento de erros [A]

**Erros de Application** (sem imports de Nest/Prisma):

```ts
DocumentNotAvailableError
BusinessDataNotConfiguredError
DocumentCustomerNotFoundError
DocumentDataIncompleteError
DocumentRenderError
DocumentHistoryWriteError
```

Mapeamento em `presentation/document-error-mapper.ts`:

| Erro | HTTP |
|---|---|
| `QuoteNotFoundError` (existente) | `404` |
| `DocumentNotAvailableError` | `409` |
| `BusinessDataNotConfiguredError` | `409` |
| `DocumentCustomerNotFoundError` | `409` |
| `DocumentDataIncompleteError` | `409` |
| `DocumentRenderError` | `500` |
| `DocumentHistoryWriteError` | `500` |

**Decisão aprovada em 2026-10-20:** mapper dedicado, composto com `mapQuoteError` no `handleDocument` do controller. Não introduzir um campo `code` novo no corpo de erro; manter o formato Nest existente (`statusCode`, `message`, `error`) para não divergir das demais rotas.

**Alternativas:** estender `mapQuoteError` (mistura erros de orçamento e documento); um único erro genérico `DocumentError` (perde distinção de status).

**Motivo:** cada erro tem uma causa e um status distintos; a separação mantém o controller fino.

**Status:** Aprovada em 2026-10-20.

#### D197 — Encapsulamento da biblioteca [A]

- Somente `infrastructure/documents/pdf-lib-quote-document-renderer.ts` importa `pdf-lib`.
- A Application e a Presentation não importam tipos da biblioteca.
- A porta devolve `Uint8Array`.
- O adapter captura erros da biblioteca e lança `DocumentRenderError` com `cause` (não serializada).
- O adapter não acessa Prisma, repositórios, HTTP ou filesystem para escrita; o logo é lido como asset somente no startup, conforme D150.

**Motivo:** permite trocar a biblioteca sem alterar contratos (D148) e impede que detalhes técnicos vazem para o HTTP.

**Status:** Aprovada em 2026-10-20.

#### D198 — Sem detalhes internos na resposta HTTP [F]

O corpo de erro não contém stack trace, caminho de arquivo, mensagem da biblioteca, SQL, nome de tabela, dados do cliente ou conteúdo do documento. Detalhes técnicos ficam no log do servidor.

- **Fonte:** `PROJECT_SPEC.md` §14.4 (“mensagens compreensíveis ... sem corromper o estado”); §14.3; prática de segurança.
- **Consequência:** a mensagem ao usuário é estável e genérica; o log recebe a causa.

### 6.10 Testes

#### D199 — Testes unitários das projeções e use cases [F]

Devem existir testes que provem:

- o conjunto fechado de campos de cada projeção;
- a ausência de dados proibidos (valores-sentinela);
- a omissão de opcionais vazios;
- a ordem das cortinas;
- a disponibilidade por status (D174/D175);
- a prévia em `DRAFT` sem chamada ao writer de histórico;
- a geração que chama o writer uma vez;
- a falha de render que não chama o writer;
- o union de eventos com os dois novos valores.

- **Fonte:** `ARCHITECTURE.md` §17 (testes focados em risco e regras críticas); `AGENTS.MD` (testes antes de concluir); D204.
- **Consequência:** os testes de projeção podem rodar sem banco, com dublês do aggregate e das queries.

#### D200 — Inspeção do conteúdo do PDF renderizado [A]

**Alternativas:**

- **A.** gerar o PDF em teste, extrair o texto com `unpdf` (devDependency) e afirmar presença/ausência de strings (recomendada).
- **B.** comparar bytes com snapshot (frágil: qualquer ajuste de layout quebra).
- **C.** testar apenas a projeção (não detecta vazamento no renderer).
- **D.** Chromium/Playwright para ler o PDF (pesado e desnecessário).

**Decisão aprovada em 2026-10-20:** A.

**Motivo:** o teste precisa verificar o **arquivo**, não só a projeção, para pegar um renderer que desenhe campos proibidos. A extração de texto é pura JavaScript e rápida. Testar também `%PDF-` no início e o número de páginas.

**Status:** Aprovada em 2026-10-20.

#### D201 — Dependência de teste para extração de texto [A]

**Alternativas:**

- **A.** `unpdf` fixado como `devDependency` (recomendada).
- **B.** `pdfjs-dist` como `devDependency` (maior, mesma função).
- **C.** parser manual do content stream (frágil).
- **D.** sem extração; apenas testes de projeção (mais fraco).

**Decisão aprovada em 2026-10-20:** A.

**Motivo:** `unpdf` é JavaScript puro, sem binário nativo, adequado a Node/ESM e usado apenas em testes; não entra no bundle de produção nem exige permissão de build no pnpm. A escolha exata da versão deve ser fixada no momento da implementação.

**Status:** Aprovada em 2026-10-20.

#### D202 — Teste de integração da escrita append-only [A]

Testar `PrismaQuoteHistoryWriter` contra o banco de teste:

- insere o evento com o `quoteId`, tipo e `occurredAt` corretos;
- não altera `quotes.updatedAt`;
- não cria, altera ou remove cortinas/componentes;
- respeita a FK;
- o evento aparece em `GET /orcamentos/:id/historico`.

**Alternativas:** testar apenas com mock (não prova a não-alteração do orçamento).

**Motivo:** a invariante “gerar documento não altera o orçamento” é crítica e só é provada contra o Prisma real.

**Status:** Aprovada em 2026-10-20.

#### D203 — Testes E2E [A]

Cenários mínimos:

- `401` sem sessão nas duas rotas;
- PDF comercial em `SENT` → `200`, `application/pdf`, filename, bytes `%PDF-`;
- prévia em `DRAFT` → `200`, **sem** novo evento de histórico;
- PDF comercial em estado não permitido (conforme D174) → `409`;
- ordem de produção em `CONFIRMED` → `200`, sem nome/telefone/CPF/endereço/preços;
- ordem de produção em `SENT` → `409`;
- `BusinessData` ausente → `409` no PDF comercial e `200` na ordem de produção;
- UUID inválido → `400`; orçamento inexistente → `404`;
- geração repetida → dois eventos, conforme D179 A;
- evento com `occurredAt` posterior ao início da requisição.

**Motivo:** cobre o contrato HTTP e as invariantes de histórico.

**Status:** Aprovada em 2026-10-20.

#### D204 — Testes negativos de dados proibidos [F]

Cada campo proibido deve ter um valor-sentinela único no fixture (por exemplo, CPF/CNPJ `99988877766`, observação `SENTINELA-NOTA-INTERNA`, endereço `Rua Sentinela 123`, componente `SENTINELA-COMPONENTE`) e o teste deve afirmar que esse valor **não** aparece no texto extraído do PDF.

Cobertura mínima:

- PDF comercial: CPF/CNPJ, endereço do cliente, endereço de instalação, dimensões, material, quantidade de tecido, borda, fator, componentes, adicionais, desconto, ajuste, observações;
- ordem de produção: nome, telefone, CPF/CNPJ, endereços, quantidade de tecido, borda, fator, trilho, entretela, frete, mão de obra, componentes, preços, desconto, observações.

- **Fonte:** `PROJECT_SPEC.md` §10.2, §10.6, §14.3; `ARCHITECTURE.md` §16.2.
- **Consequência:** não basta testar a projeção; o teste deve inspecionar o PDF (D200).

#### D205 — Regressão e paridade com as fontes [A]

- matriz requisito → teste para cada campo permitido e proibido de §10.2/§10.6;
- alterar o valor de um componente e provar que o total do PDF muda (usa o getter do domínio, não uma cópia);
- alterar o nome do cliente e provar que a reemissão reflete o cadastro atual (comportamento documentado em D162);
- revisão de código garantindo que nenhuma fórmula de negócio foi duplicada.

**Motivo:** protege contra regressões silenciosas e contra a tentação de recalcular no renderer.

**Status:** Aprovada em 2026-10-20.

#### D206 — Isolamento dos testes E2E que usam `business_data` [A]

**Alternativas:**

- **A.** `fileParallelism: false` em `vitest.config.e2e.ts` (recomendada).
- **B.** banco/schema separado por arquivo (pesado).
- **C.** lock por arquivo (complexo).
- **D.** aceitar a concorrência (risco de flakiness).

**Decisão aprovada em 2026-10-20:** A.

**Motivo:** o teste de Dados do Negócio apaga `business_data` em `beforeEach`/`afterAll`; um teste de documentos que use o singleton `"business"` em paralelo pode falhar de forma intermitente. A suíte E2E é pequena (segundos); serializar é barato e determinístico.

**Status:** Aprovada em 2026-10-20.

### 6.11 Escopo, abstrações e contrato futuro

#### D207 — Duas projeções explícitas, sem abstração genérica [F]

Não criar:

- `Document` como entidade/aggregate;
- `DocumentRepository`;
- `DocumentStatus`;
- enum de tipo de documento além dos dois eventos de histórico;
- registry/plugin de documentos;
- template engine genérica;
- `PdfService` genérico;
- interface `Document<T>`.

Helpers internos de formatação e layout são permitidos porque não generalizam o negócio.

- **Fonte:** `AGENTS.MD` (“não introduzir abstrações para necessidades futuras hipotéticas”); `ARCHITECTURE.md` §16.2; `PROJECT_SPEC.md` §10.7.
- **Consequência:** o código tem dois fluxos nomeados; se um terceiro documento real surgir, a abstração será extraída com base em repetição concreta.

#### D208 — Contrato consumível pela Fase 11 [F]

A Fase 11 pode consumir:

- `GET /orcamentos/:id/pdf` → `200` com bytes `application/pdf`;
- `GET /orcamentos/:id/ordem-producao` → `200` com bytes `application/pdf`;
- erros no formato Nest existente, com status de D193;
- headers de D191/D192;
- nenhuma URL persistente, lista de documentos ou metadado JSON.

- **Fonte:** `ARCHITECTURE.md` §14.2; `PROJECT_SPEC.md` §10.7; `IMPLEMENTATION_PLAN.md` Fase 11.
- **Consequência:** o frontend pode baixar via `fetch` com credenciais + `blob`, ou abrir a URL; não depende de armazenamento.

#### D209 — Compartilhamento fora do backend da Fase 8 [A]

**Alternativas:**

- **A.** a Fase 8 entrega os bytes; o compartilhamento (Web Share, download, WhatsApp) fica para a Fase 11 ou posterior (recomendada).
- **B.** implementar agora um link público ou integração com WhatsApp.
- **C.** implementar envio por e-mail.

**Decisão aprovada em 2026-10-20:** A.

**Motivo:** `PROJECT_SPEC.md` §10.7 exige compartilhamento, mas `ARCHITECTURE.md` §22 adia o mecanismo técnico; não há requisito de link, API ou e-mail. B/C inventariam escopo e infraestrutura. A Fase 8 deve apenas garantir que o arquivo possa ser obtido.

**Status:** Aprovada em 2026-10-20.

---

## 7. Cobertura dos temas obrigatórios

| Tema | Decisões |
|---|---|
| Fronteira e aggregate | D143, D144, D146, D158, D207 |
| Localização do módulo | D145 |
| Projeção × renderer | D146, D147, D158 |
| Porta de renderer | D147, D197 |
| Integração com Dados do Negócio | D153, D154, D186–D188 |
| Biblioteca de PDF | D148 |
| Geração em memória | D148, D177 |
| Fonte e encoding | D149 |
| Logo | D150 |
| Locale e formatadores | D151, D172 |
| Composição do PDF comercial | D159–D168 |
| Identidade do negócio | D160 |
| Dados do cliente | D155, D162 |
| Detalhamento financeiro | D163, D168 |
| Validade | D164 |
| Informação de cortina no PDF comercial | D161 |
| Omissões do PDF comercial | D166–D168 |
| Composição da ordem de produção | D169–D173 |
| Dados técnicos | D170, D172, D173 |
| Identificação da ordem | D169 |
| Proibições da ordem | D171 |
| Estados permitidos | D174–D176 |
| Regeneração | D177 |
| `CANCELLED` | D176 |
| `EXPIRED` | D174, D175 |
| `BusinessData` ausente | D186 |
| Erro de `BusinessData` | D186, D196 |
| Dependência de `BusinessData` | D153, D154, D187 |
| Rotas | D189 |
| `GET` × `POST` | D190 |
| Headers | D191 |
| Nome do arquivo | D192 |
| Status codes | D193 |
| Autenticação/CSRF | D194 |
| Momento do evento | D180 |
| Falha na gravação | D180, D181 |
| Downloads repetidos | D179 |
| `details` do evento | D182 |
| Consistência do histórico | D180, D181, D183, D185 |
| Taxonomia de erros | D196 |
| Mapeamento de erros | D196 |
| Encapsulamento da biblioteca | D197, D198 |
| Testes unitários | D199 |
| Testes de integração | D202 |
| Testes E2E | D203 |
| Inspeção de conteúdo | D200, D201 |
| Testes negativos | D204 |
| Regressão | D205 |
| Abstração genérica | D207 |
| Contrato para a Fase 11 | D208 |

---

## 8. Revisão humana — decisões aprovadas

> As 37 decisões originalmente `[P]` ou `[V]` foram validadas em 2026-10-20 e promovidas a `[A]`. `Status` registra o resultado da validação: **Aprovada**; **Aprovada com alteração** (D174); **Aprovada — asset pendente** (D150).

| Decisão | Alternativas | Decisão aprovada | Motivo | Status |
|---|---|---|---|---|
| D145 — localização no módulo | dentro de `orcamentos`; novo módulo; `shared` | dentro de `orcamentos` | documento deriva do aggregate; sem novo contexto/ACL | Aprovada |
| D147 — porta do renderer | uma porta/dois métodos; duas portas; import direto | uma porta/dois métodos | mesma capacidade, sem acoplar à biblioteca | Aprovada |
| D148 — biblioteca | pdf-lib; pdfkit; fork; Chromium; serviço externo | pdf-lib 1.17.1 em memória | sem binário/Chromium; runtime atual; tipos | Aprovada |
| D149 — fonte | Helvetica WinAnsi; TTF embutida; Times | Helvetica WinAnsi | português cabe em WinAnsi; sem asset | Aprovada |
| D150 — logo | PNG fixo; só texto; base64; SVG | PNG fixo versionado | §2.7 exige logo fixo; asset ainda não fornecido | Aprovada — asset pendente |
| D151 — locale | `Intl` explícito; manual; locale do processo | `Intl` pt-BR + America/Sao_Paulo | formato brasileiro e data correta | Aprovada |
| D152 — layout | A4 paginado; página única; HTML/Chromium | A4 paginado | número de cortinas é variável | Aprovada |
| D154 — wiring de Dados do Negócio | exportar query; porta nova; Prisma direto | exportar query e importar módulo | mínimo para D140 | Aprovada |
| D155 — contato do cliente | query em Clientes; Prisma em Orçamentos; snapshot | query em Clientes | integração Application→Application; só dois campos | Aprovada |
| D160 — identidade do negócio | todos os campos; nome+telefone; nome+telefone+e-mail | todos os campos não vazios | os quatro campos foram modelados para isso | Aprovada |
| D161 — linha de serviço | room+descrição+produto; room+descrição; agrupar; só room | room+descrição+“Cortina sob medida” | reproduz o exemplo da fonte | Aprovada |
| D164 — validade | exigir e omitir na prévia; bloquear prévia; “a definir” | exigir na geração; omitir na prévia se nula | §8.5 permite nulo em rascunho | Aprovada |
| D165 — dados mínimos da prévia | permissiva; exigir total/validade; gate completo | permissiva | prévia não substitui o gate de envio | Aprovada |
| D172 — formato de medida | até 3 casas; 2 casas; 3 casas | até 3 casas, sem zeros à direita | precisão de produção | Aprovada |
| D173 — dados incompletos | falhar; renderizar em branco; “a definir” | falhar com 409 | não entregar instrução incompleta | Aprovada |
| D174 — estados do PDF comercial | estrito (SENT/EXPIRED); amplo; híbrido | todos os estados não cancelados (DRAFT sem evento) | alteração aprovada: permite reemissão até COMPLETED | Aprovada com alteração |
| D179 — downloads repetidos | evento por geração; só o primeiro; deduplicar | evento por geração | §10.4 não prevê deduplicação | Aprovada |
| D180 — momento/falha do evento | após render e falhar sem bytes; antes do render; só log | após render; falha de histórico = erro | histórico confiável | Aprovada |
| D182 — `details` | ausente; status; tipo | ausente | tipo + occurredAt bastam; evita dados | Aprovada |
| D183 — escrita append-only | porta nova; método no repository; save/mutate | porta nova | save/mutate alteram o orçamento | Aprovada |
| D184 — union de eventos | adicionar; cast; definir na Application | adicionar ao domínio | banco/leitura já têm os valores | Aprovada |
| D186 — BusinessData ausente | 409; 404; 422; gerar sem identidade | 409, sem PDF/evento | orçamento existe; falta configuração | Aprovada |
| D188 — leitura por geração | sem cache; cache; snapshot | sem cache | simples e sempre atual | Aprovada |
| D190 — GET × POST | GET; POST; GET+POST | GET documentado + no-store | contrato arquitetural; efeito é auditoria | Aprovada |
| D191 — headers | inline+no-store; attachment; query flag | inline + no-store | prévia e download; sem cache | Aprovada |
| D192 — filename | número do orçamento; UUID; nome do cliente | `orcamento-{numero}.pdf` / `ordem-de-producao-{numero}.pdf` | identificável e sem dado pessoal | Aprovada |
| D193 — status codes | 409/500; 422; 404 | tabela de D193 | conflito de estado; sem vazar detalhe | Aprovada |
| D195 — resposta binária | StreamableFile; `@Res`; base64 | StreamableFile | nativo do Nest | Aprovada |
| D196 — taxonomia | mapper dedicado; estender mapper; erro único | mapper dedicado | causas/status distintos | Aprovada |
| D197 — encapsulamento | só infra importa; Application importa; vazar erro | só infra + wrapper | troca de biblioteca e erros seguros | Aprovada |
| D200 — inspeção do PDF | extrair texto; snapshot; só projeção; Chromium | extrair texto | detecta vazamento no arquivo | Aprovada |
| D201 — dependência de teste | unpdf; pdfjs-dist; parser manual; nenhuma | unpdf dev-only | puro JS; sem produção | Aprovada |
| D202 — integração do writer | teste com Prisma; mock | teste com Prisma | prova que o orçamento não muda | Aprovada |
| D203 — E2E | lista de D203 | lista de D203 | cobre contrato e histórico | Aprovada |
| D205 — regressão | matriz e provas de getter; só unitários | matriz e provas de getter | evita regressão e recálculo | Aprovada |
| D206 — isolamento E2E | serializar; banco por arquivo; lock; aceitar | `fileParallelism: false` | singleton `business_data` | Aprovada |
| D209 — compartilhamento | adiar; link/WhatsApp; e-mail | adiar para a Fase 11 | §22 adia o mecanismo | Aprovada |

---
## 9. Decisões já determinadas pelas fontes

Estas decisões **não** são propostas; decorrem de `PROJECT_SPEC.md`, `ARCHITECTURE.md` ou de decisões anteriores já fechadas.

- **D143** — documentos são projeções sob demanda, sem conceito/aggregate próprio.
- **D144** — PDF não persistido, armazenado ou versionado.
- **D146** — projeção na Application; renderização na Infrastructure.
- **D153** — Dados do Negócio via Application, sem Prisma direto e sem HTTP interno (D140).
- **D156** — ordem de produção sem cliente e sem Dados do Negócio.
- **D157** — nenhuma regra de negócio recalculada; getters do domínio.
- **D158** — projeções fechadas; `QuoteDetailView` não é reutilizado.
- **D159** — composição e ordem dos blocos do PDF comercial.
- **D162** — somente nome e telefone do cliente.
- **D163** — somente o total consolidado.
- **D166** — opcionais vazios não renderizados.
- **D167** — lista de dados proibidos no PDF comercial.
- **D168** — sem detalhamento financeiro.
- **D169** — composição da ordem de produção.
- **D170** — campos técnicos e origem por getter.
- **D171** — lista de dados proibidos na ordem de produção.
- **D175** — ordem de produção em `CONFIRMADO`, `EM_PRODUCAO`, `CONCLUIDO`.
- **D176** — `CANCELADO` não gera documentos.
- **D177** — regeneração a cada requisição, sem cache.
- **D178** — prévia em `RASCUNHO` não gera evento.
- **D181** — falhas nunca registram sucesso.
- **D185** — nenhuma transação aberta durante a renderização.
- **D187** — ordem de produção independente de `BusinessData`.
- **D189** — rotas `GET /orcamentos/:id/pdf` e `GET /orcamentos/:id/ordem-producao`.
- **D194** — autenticação obrigatória; `GET` fora do CSRF.
- **D198** — sem detalhes internos na resposta HTTP.
- **D199** — testes unitários de projeção/use case.
- **D204** — testes negativos de dados proibidos no PDF.
- **D207** — duas projeções explícitas; sem abstração genérica.
- **D208** — contrato de bytes consumível pela Fase 11.

---

## 10. Decisões aprovadas

Todas as 37 decisões abaixo foram aprovadas em 2026-10-20. As decisões D150, D174 e D180 têm registro específico na seção 11; as demais seguem a recomendação registrada na seção 6.

- **D145** — documentos dentro do módulo `orcamentos`.
- **D147** — porta `QuoteDocumentRenderer` com dois métodos explícitos.
- **D148** — `pdf-lib` 1.17.1, em memória, sem Chromium.
- **D149** — Helvetica/Helvetica-Bold WinAnsi.
- **D150** — PNG fixo versionado, sem upload/CRUD; asset pendente.
- **D151** — `Intl` `pt-BR` + `America/Sao_Paulo`.
- **D152** — A4, margens e paginação automática.
- **D154** — exportar `GetBusinessDataQuery` e importar `DadosDoNegocioModule`.
- **D155** — `GetCustomerContactQuery` na Application de Clientes.
- **D160** — todos os campos não vazios da identidade do negócio.
- **D161** — `{room} — {description} — Cortina sob medida`, com fallback.
- **D164** — validade obrigatória na geração; omitida na prévia se nula.
- **D165** — prévia permissiva em `DRAFT`, sem substituir o gate de envio.
- **D172** — medidas com até 3 casas, sem zeros à direita.
- **D173** — dados técnicos incompletos → `409`.
- **D174** — geração/reemissão em todos os estados não cancelados; `DRAFT` sem evento; `CANCELLED` bloqueado.
- **D179** — um evento por geração bem-sucedida.
- **D180** — evento após render; falha de histórico → erro sem bytes.
- **D182** — `details` ausente nos dois eventos.
- **D183** — porta append-only `QuoteHistoryWriter`.
- **D184** — adicionar os dois eventos ao union do domínio.
- **D186** — `BusinessData` ausente → `409`, sem PDF/evento.
- **D188** — ler Dados do Negócio a cada geração.
- **D190** — manter `GET` documentado, com `no-store`.
- **D191** — `Content-Type`, `Content-Disposition: inline`, `Cache-Control: no-store`.
- **D192** — `orcamento-{numero}.pdf` e `ordem-de-producao-{numero}.pdf`.
- **D193** — tabela de status `400/401/404/409/500`.
- **D195** — `StreamableFile`.
- **D196** — erros de documento + mapper dedicado.
- **D197** — `pdf-lib` somente na Infrastructure e erros encapsulados.
- **D200** — inspeção de texto do PDF.
- **D201** — `unpdf` como `devDependency`.
- **D202** — teste de integração do writer.
- **D203** — cenários E2E.
- **D205** — matriz de regressão e provas de getter.
- **D206** — `fileParallelism: false` no E2E.
- **D209** — compartilhamento fora da Fase 8.

---

## 11. Decisões abertas

**Nenhuma.** Não resta decisão `[P]` ou `[V]` que bloqueie a implementação. Os registros abaixo documentam o resultado da validação humana de 2026-10-20.

### D150 — Logo

- **Status:** aprovada, com pendência operacional de asset.
- **Decisão:** PNG fixo versionado em `backend/src/modules/orcamentos/infrastructure/documents/assets/logo.png`, copiado para `dist/` via `nest-cli.json`; sem upload, CRUD, configuração ou gerenciamento; o renderer embute o PNG.
- **Pendência:** o asset ainda não foi fornecido. A implementação deve estruturar leitura e cópia de build; se o PNG não existir ao finalizar o renderer, reportar o bloqueio da finalização visual e **não** criar imagem substituta. Não há bloqueio funcional para decompor `DOCUMENTOS-03+`.

### D174 — Estados do PDF comercial

- **Status:** aprovada com alteração da recomendação original.
- **Decisão:** `DRAFT` permite prévia sem evento; `SENT`, `EXPIRED`, `CONFIRMED`, `IN_PRODUCTION` e `COMPLETED` permitem geração/reemissão com evento; `CANCELLED` responde `409`.
- **Consequência:** o PDF projeta os dados atuais do orçamento e não altera o lifecycle; não há versionamento de arquivo.

### D180 — Momento do evento e falha da escrita

- **Status:** aprovada, com complemento.
- **Decisão:** carregar/validar → montar projeção → renderizar em memória → registrar histórico → devolver bytes. Falha de render não grava evento; falha de histórico não devolve bytes e faz a requisição falhar, sem compensação de arquivo; nenhuma transação de banco fica aberta durante a renderização.

---

## 12. Revisão semântica obrigatória

| # | Pergunta | Resposta | Referência |
|---|---|---|---|
| 1 | Nenhum conceito de negócio novo foi introduzido? | Sim. Documento é projeção; não há entidade/status/numeração. | D143, D207 |
| 2 | Nenhum aggregate/persistência de documento foi criado? | Sim. Sem tabela, repository ou aggregate. | D143, D144 |
| 3 | O PDF não é persistido? | Sim. Gerado em memória a cada requisição. | D144, D177 |
| 4 | O renderer não acessa Prisma? | Sim. Recebe apenas a projeção; Prisma fica na Application/leitura. | D146, D147, D197 |
| 5 | Nenhuma regra de negócio é recalculada? | Sim. Usa getters do aggregate. | D157 |
| 6 | O PDF comercial não expõe dados não autorizados? | Sim no desenho: projeção fechada + testes negativos. | D158, D167, D204 |
| 7 | A ordem de produção não expõe dados financeiros? | Sim. Lista fechada e proibida. | D171 |
| 8 | Os dados do negócio são acessados via Application? | Sim. `GetBusinessDataQuery`, sem Prisma/HTTP interno. | D153, D154 |
| 9 | Não há chamada HTTP interna? | Sim. Nenhuma. | D153 |
| 10 | A biblioteca funciona no runtime/deploy? | Sim, com ressalva: `pdf-lib` é JS puro e roda em Node/ESM; não há CI/Docker/Node fixo para provar no deploy. | D148; auditoria G20/R14 |
| 11 | Não há dependência de Chromium não documentada? | Sim. Chromium é explicitamente rejeitado. | D148 |
| 12 | O comportamento sem `BusinessData` está definido? | Sim. `409`, sem PDF/evento (D186 aprovada). | D186 |
| 13 | Os estados permitidos estão sem ambiguidade? | Sim. Ordem de produção fechada; PDF comercial em todos os estados não cancelados, com `DRAFT` sem evento (D174 aprovada com alteração). | D174, D175 |
| 14 | `GET` × `POST` foi decidido considerando o histórico? | Sim. `GET` mantido com `no-store`; o evento é tratado como auditoria (D190 aprovada). | D190, D179 |
| 15 | O momento do evento está definido? | Sim. Após renderização bem-sucedida, antes de devolver os bytes; falha de histórico não devolve bytes (D180 aprovada). | D180 |
| 16 | Falhas não registram sucesso falso? | Sim. Nenhum evento antes de os bytes existirem. | D180, D181 |
| 17 | Downloads repetidos estão definidos? | Sim. Um evento por geração (D179 aprovada). | D179 |
| 18 | Filename/headers estão definidos? | Sim. `inline`, `no-store`, `orcamento-{numero}.pdf` e `ordem-de-producao-{numero}.pdf` (D191/D192 aprovadas). | D191, D192 |
| 19 | O locale brasileiro está definido? | Sim. `pt-BR` + `America/Sao_Paulo` (D151 aprovada). | D151 |
| 20 | Os testes detectam dados proibidos? | Sim. Sentinela + extração de texto com `unpdf` (D200/D201 aprovadas). | D200, D201, D204 |
| 21 | Não há abstração genérica especulativa? | Sim. Duas projeções e duas rotas explícitas. | D207 |
| 22 | A Fase 11 pode consumir o contrato? | Sim. Bytes via `GET`, com headers/status aprovados (D190–D193). | D208 |

---

## 13. Decomposição definitiva das tasks

> A implementação está autorizada. Não há decisão `[P]` ou `[V]`; não há bloqueio funcional para iniciar `DOCUMENTOS-03`. A única pendência é operacional: o PNG da logo (D150) precisa ser fornecido antes da finalização visual do renderer, sem impedir o restante da fase.

A sequência preliminar `DOCUMENTOS-03…08` foi substituída pela decomposição definitiva abaixo. Nenhuma task foi executada nesta rodada.

### 13.1 Regras de execução

Cada task implementável segue:

```text
READ
→ IMPLEMENT
→ VERIFY
→ REVIEW
→ REPAIR
→ RE-VERIFY
→ DONE
```

Uma task não está concluída apenas porque compila.

**Gate 1 — mecânico.** No mínimo:

```bash
pnpm lint
pnpm test
pnpm build
```

Adicionar conforme o escopo:

```bash
pnpm test:e2e
npx prisma validate
npx prisma migrate status
git diff --check
git status --short
```

**Gate 2 — semântico.** Revisar contra `PROJECT_SPEC.md`, `ARCHITECTURE.md`, esta spec, `AGENTS.MD` e os critérios de aceite da task. Perguntas mínimas:

1. Foi inventada alguma regra?
2. Houve vazamento de campo proibido?
3. Houve duplicação de cálculo?
4. A Infrastructure vazou para a Application?
5. O PDF passou a ser persistido?
6. Algum módulo passou a acessar Prisma de outro módulo?
7. Algum evento foi criado em momento incorreto?
8. Algum arquivo fora do escopo foi alterado?

**Commits.** Cada task concluída gera no máximo um commit atômico. Antes de commitar, conferir `git diff --check` e `git status --short`; não incluir alteração não relacionada. Mudança preexistente fora da task não deve ser sobrescrita nem removida: deve ser reportada.

### 13.2 Sequência

| Task | Escopo | Depende de |
|---|---|---|
| DOCUMENTOS-03 | Contratos de projeção e renderer | D143–D147, D158–D171, D197 |
| DOCUMENTOS-04 | Integração com Dados do Negócio | D153–D154 |
| DOCUMENTOS-05 | Consulta estreita de contato do Cliente | D155 |
| DOCUMENTOS-06 | Projeção do PDF comercial | 03, 04, 05; D159–D168 |
| DOCUMENTOS-07 | Projeção da ordem de produção | 03; D169–D173 |
| DOCUMENTOS-08 | Formatadores de documento | D151, D172 |
| DOCUMENTOS-09 | Histórico append-only de documentos | D182–D184 |
| DOCUMENTOS-10 | Erros e disponibilidade dos documentos | 03; D174–D176, D193, D196 |
| DOCUMENTOS-11 | Use case do PDF comercial | 06, 09, 10 |
| DOCUMENTOS-12 | Use case da ordem de produção | 07, 09, 10 |
| DOCUMENTOS-13 | Instalar e isolar `pdf-lib` | 03; D148, D197 |
| DOCUMENTOS-14 | Infraestrutura de asset da logo | D150 |
| DOCUMENTOS-15 | Renderer do PDF comercial | 06, 08, 13, 14 |
| DOCUMENTOS-16 | Renderer da ordem de produção | 07, 08, 13 |
| DOCUMENTOS-17 | Contrato HTTP e rotas | 11, 12; D189–D195 |
| DOCUMENTOS-18 | Inspeção real de PDFs e testes de conteúdo | 15, 16; D200–D204 |
| DOCUMENTOS-19 | Testes de integração | 11, 12, 17; D202 |
| DOCUMENTOS-20 | E2E completo dos documentos | 17, 18, 19; D203, D206 |
| DOCUMENTOS-21 | Auditoria semântica, reparos e fechamento | todas |

### 13.3 DOCUMENTOS-03 — Contratos de projeção e renderer

**Goal:** criar somente os contratos internos necessários à Fase 8, sem geração real de PDF e sem integração externa.

**Scope:** criar em `orcamentos/application/documents/` ou estrutura equivalente aprovada:

- `CommercialPdfProjection`: tipo fechado com somente os campos permitidos, suportando conceitualmente `quoteNumber`, `businessIdentity`, `customer`, `serviceLines`, `totalCents?` e `validUntil?`, conforme D159–D168. Não incluir `Quote`, `QuoteDetailView`, `customerId`, endereço, componentes, adicionais, desconto, ajuste, notas, medidas ou material.
- `ProductionOrderProjection`: tipo fechado com somente `quoteNumber` e `curtains[]`; cada cortina somente com os campos autorizados em D169–D171.
- `QuoteDocumentRenderer`: porta da Application com `renderCommercialPdf(...)` e `renderProductionOrder(...)`, retornando `Promise<Uint8Array>`. Não importar `pdf-lib`.

**Tests:** testes de tipo/estrutura quando úteis; o principal gate é a revisão semântica.

**Acceptance criteria:** nenhum tipo Prisma; nenhum NestJS; nenhuma biblioteca PDF; nenhum aggregate passado ao renderer; projeções sem campos proibidos; nenhuma abstração genérica de documento.

**Verification:**

```bash
pnpm lint
pnpm test
pnpm build
```

**Revisão semântica:** comparar campo por campo contra D158–D171.

**Commit:** `feat(DOCUMENTOS-03): define document projection contracts`

### 13.4 DOCUMENTOS-04 — Integração com Dados do Negócio

**Goal:** permitir que Orçamentos consuma `GetBusinessDataQuery` pela Application.

**Scope:** exportar `GetBusinessDataQuery` em `DadosDoNegocioModule`; importar `DadosDoNegocioModule` em `OrcamentosModule`; nenhum Prisma direto; nenhuma chamada HTTP interna; nenhuma duplicação de normalização. Não criar adapter adicional sem necessidade concreta.

**Tests:** provider resolve corretamente; regressão do módulo Dados do Negócio; build do módulo Orçamentos.

**Acceptance criteria:** direção de dependência permanece Application → Application; nenhuma Infrastructure de Orçamentos conhece `business_data`.

**Verification:** `pnpm lint`, `pnpm test`, `pnpm build`.

**Commit:** `feat(DOCUMENTOS-04): expose business data query to quotes`

### 13.5 DOCUMENTOS-05 — Consulta estreita de contato do Cliente

**Goal:** fornecer ao PDF comercial somente nome e telefone do cliente.

**Scope:** criar `GetCustomerContactQuery` em Clientes, retornando conceitualmente `{ name, phone }` ou `null`/erro conforme contrato aprovado. A consulta busca pelo id, consegue ler cliente soft-deleted e não retorna email, taxId, endereço nem notes; não reconstrói aggregate se desnecessário. Exportar a query via `ClientesModule`; `OrcamentosModule` importa `ClientesModule`.

**Tests:** cliente ativo; cliente soft-deleted; inexistente; retorno somente com nome e telefone.

**Double-check:** soft delete não pode impedir a reemissão histórica de orçamento.

**Commit:** `feat(DOCUMENTOS-05): add customer contact query for documents`

### 13.6 DOCUMENTOS-06 — Projeção do PDF comercial

**Goal:** construir a projeção comercial sem renderizar PDF.

**Scope:** mapper/builder de Application que recebe os dados explicitamente necessários e produz `CommercialPdfProjection`, contendo número do orçamento; identidade do negócio (`commercialNameOrConsultant`, `phone`, `email` e `taxId` somente se não vazios); cliente (`name`, `phone`); uma linha por cortina no formato `{room} — {description} — Cortina sob medida`, ou `{room} — Cortina sob medida` sem descrição; total final consolidado; validade quando existente.

**DRAFT preview (D165):** BusinessData configurado; cliente existente; ao menos uma cortina com `room`; `totalCents === 0` → total omitido; `validUntil === null` → validade omitida; não aplicar o gate completo de envio.

**Dados proibidos:** testes devem provar ausência de dados fiscais do cliente, endereços, material, medidas, componentes, adicionais, desconto, ajuste, notas e detalhamento financeiro.

**Tests obrigatórios:** identidade completa; opcionais da identidade ausentes; descrição presente/ausente; várias cortinas; total; DRAFT sem total; DRAFT sem validade; nenhuma propriedade proibida.

**Commit:** `feat(DOCUMENTOS-06): build commercial quote projection`

### 13.7 DOCUMENTOS-07 — Projeção da ordem de produção

**Goal:** construir uma projeção técnica fechada.

**Scope:** para cada `Curtain`, incluir `sequence`, `room`, `description?`, `material`, `finalWidth` e `height`. Não incluir cliente, BusinessData, endereço, `openingWidth`, `borderValue`, `fabricFactor`, `fabricQuantity`, components, generalAddOns, notes, prices, subtotal, desconto, ajuste ou total. Usar `curtain.finalWidth`; não recalcular.

**Validation:** em estado permitido, dados técnicos ausentes → `DocumentDataIncompleteError`. Não renderizar valor vazio nem “a definir”.

**Tests:** uma cortina; várias em `sequence`; description opcional; valor derivado vindo do domínio; ausência de room; ausência de material; ausência de height; ausência/impossibilidade de `finalWidth`; prova explícita de dados proibidos ausentes.

**Commit:** `feat(DOCUMENTOS-07): build production order projection`

### 13.8 DOCUMENTOS-08 — Formatadores de documento

**Goal:** centralizar somente formatação visual.

**Scope:** helpers puros para:

- moeda `R$ 1.234,56` com `Intl.NumberFormat('pt-BR')`, normalizando NBSP para espaço comum quando necessário para WinAnsi;
- data `DD/MM/AAAA` com timezone `America/Sao_Paulo`;
- medidas com até três casas decimais, preservando precisão: `2,6 m`, `2,65 m`, `2,605 m`; não arredondar para duas casas;
- CPF/CNPJ do negócio somente para apresentação, sem alterar persistência.

**Tests:** valores monetários; datas próximas à meia-noite UTC; medidas de 1, 2 e 3 casas; CPF; CNPJ; strings com NBSP.

**Commit:** `feat(DOCUMENTOS-08): add document formatters`

### 13.9 DOCUMENTOS-09 — Histórico append-only de documentos

**Goal:** registrar eventos de geração sem modificar o aggregate.

**Scope:** adicionar ao union existente `COMMERCIAL_PDF_GENERATED` e `PRODUCTION_ORDER_GENERATED`. Criar o port estreito `QuoteHistoryWriter`, conforme D183, com operação conceitual `append(quoteId, event)`. A implementação Prisma apenas executa `INSERT` em `quote_history`; não executa `QuoteRepository.save` nem `mutate`, não atualiza `quotes.updatedAt` e não reconcilia filhos. `details` deve ser ausente.

**Integration tests:** evento inserido; `occurredAt` correto; quote semanticamente inalterado; `updatedAt` não muda; filhos não mudam; eventos repetidos são permitidos.

**Commit:** `feat(DOCUMENTOS-09): add append-only document history writer`

### 13.10 DOCUMENTOS-10 — Erros e disponibilidade dos documentos

**Goal:** centralizar as regras de disponibilidade sem misturá-las ao renderer.

**Scope:** criar erros explícitos conforme D193/D196. Os nomes canônicos são os de D196 — `DocumentNotAvailableError`, `BusinessDataNotConfiguredError`, `DocumentCustomerNotFoundError`, `DocumentDataIncompleteError`, `DocumentRenderError` e `DocumentHistoryWriteError`; “equivalentes” não autoriza renomear. Não vazar erro técnico de PDF.

**PDF comercial (D174):** `DRAFT` → prévia; `SENT`, `EXPIRED`, `CONFIRMED`, `IN_PRODUCTION`, `COMPLETED` → geração; `CANCELLED` → rejeição. `EXPIRED` continua condição derivada de `SENT`.

**Ordem de produção (D175):** permitida em `CONFIRMED`, `IN_PRODUCTION` e `COMPLETED`; rejeitada nos demais estados.

**Mapping HTTP:** usar exatamente a tabela aprovada de D193.

**Tests:** matriz completa `status × PDF comercial` e `status × ordem de produção`, cobrindo `EXPIRED` separadamente.

**Commit:** `feat(DOCUMENTOS-10): define document availability and errors`

### 13.11 DOCUMENTOS-11 — Use case do PDF comercial

**Goal:** orquestrar geração/prévia comercial sem implementar layout.

**Scope:** o use case deve:

1. carregar `Quote` pelo repository;
2. validar existência e status;
3. buscar `BusinessData`;
4. traduzir ausência para erro de documento;
5. buscar contato do `Customer`;
6. montar a projeção;
7. chamar `QuoteDocumentRenderer.renderCommercialPdf`;
8. em `DRAFT`, retornar bytes sem gravar histórico;
9. em estado de geração, gravar `COMMERCIAL_PDF_GENERATED` e somente depois retornar bytes.

Não abrir transação durante o renderer.

**Failure semantics (D180):** falha de projeção → nenhum evento; falha do renderer → nenhum evento; falha do histórico → requisição falha e bytes não são entregues.

**Tests:** DRAFT preview; SENT; EXPIRED; CONFIRMED; IN_PRODUCTION; COMPLETED; CANCELLED; BusinessData ausente; customer ausente; renderer falhando; history falhando; evento repetido em gerações sucessivas.

**Commit:** `feat(DOCUMENTOS-11): implement commercial pdf generation use case`

### 13.12 DOCUMENTOS-12 — Use case da ordem de produção

**Goal:** orquestrar a ordem de produção.

**Scope:** carregar `Quote`; validar status; construir projeção; renderizar; gravar `PRODUCTION_ORDER_GENERATED`; devolver bytes. Não ler Customer nem BusinessData; não acessar dados financeiros.

**Tests:** estados permitidos/proibidos; dados técnicos incompletos; renderer falha; history falha; reemissão gera novo evento.

**Commit:** `feat(DOCUMENTOS-12): implement production order generation use case`

### 13.13 DOCUMENTOS-13 — Instalar e isolar `pdf-lib`

**Goal:** adicionar a dependência técnica sem misturar layout ou regra.

**Scope:** adicionar `pdf-lib@1.17.1` com versão exata, sem `^`. Não instalar Chromium, Puppeteer, Playwright, pdfkit, fontkit em runtime nem bibliotecas nativas. Criar adapter inicial de `QuoteDocumentRenderer` em `orcamentos/infrastructure/documents/`, que pode inicialmente produzir um PDF mínimo para validar ESM, runtime Node, `Uint8Array`, Helvetica e caracteres pt-BR. Não implementar ainda o layout completo.

**Tests:** smoke/unit test provando assinatura PDF nos bytes, abertura por parser compatível e texto básico com acentos.

**Verification extra:** `pnpm install`, `pnpm lint`, `pnpm test`, `pnpm build`; revisar `package.json` e `pnpm-lock.yaml`. Nenhuma dependência não esperada deve ser adicionada.

**Commit:** `feat(DOCUMENTOS-13): add pdf-lib document renderer adapter`

### 13.14 DOCUMENTOS-14 — Infraestrutura do asset da logo

**Goal:** garantir carregamento reproduzível do PNG fixo.

**Scope:** quando o PNG real estiver disponível, colocá-lo em `infrastructure/documents/assets/logo.png`, configurar a cópia no build via `nest-cli.json` e criar loader estreito na Infrastructure.

**Regras:** nenhum upload; nenhum campo novo; nenhum base64 definitivo em código; não buscar arquivo no frontend; não depender de `cwd` acidental; funcionar em source/dev e em `dist`/produção.

**Caso o asset ainda não exista:** não inventar logo. Implementar apenas o mecanismo estrutural que possa ser validado sem falsificar o asset e registrar a pendência. Não marcar a finalização visual como concluída sem o PNG real.

**Tests:** path correto; asset ausente gera erro controlado; build preserva/copia o asset quando presente.

**Commit:** `feat(DOCUMENTOS-14): add fixed business logo asset support`

### 13.15 DOCUMENTOS-15 — Renderer do PDF comercial

**Goal:** renderizar `CommercialPdfProjection` em A4.

**Scope:** implementar somente apresentação: logo + identidade; número do orçamento; cliente; serviços por ambiente; total; validade quando existente. Usar A4 portrait, margens de 48 pt, Helvetica/Helvetica-Bold, cursor vertical, word wrapping e paginação automática; sem HTML e sem Chromium. Não recalcular regra de negócio.

**Tests:** PDF válido; múltiplas páginas; acentos; descrição longa; várias cortinas; identidade opcional; total; validade.

**Critical negative tests:** o renderer/projeção não pode produzir CPF do cliente, endereço, material, dimensões, componentes, desconto, ajuste nem valores internos.

**Commit:** `feat(DOCUMENTOS-15): render commercial quote pdf`

### 13.16 DOCUMENTOS-16 — Renderer da ordem de produção

**Goal:** renderizar documento técnico.

**Scope:** título; `quoteNumber`; blocos/tabela de cortinas com `sequence`, `room`, `description` opcional, `material`, `finalWidth` e `height`. Em nova página, repetir o cabeçalho da estrutura/tabulação quando aplicável. Não usar logo nem BusinessData.

**Critical negative tests:** o PDF não pode conter nome/telefone do cliente, endereço, preço, subtotal, total, desconto, ajuste, componentes financeiros, frete, mão de obra, `fabricQuantity`, `border` nem `factor`.

**Commit:** `feat(DOCUMENTOS-16): render production order pdf`

### 13.17 DOCUMENTOS-17 — Contrato HTTP e rotas

**Goal:** expor os dois fluxos aprovados.

**Routes:** `GET /orcamentos/:id/pdf` e `GET /orcamentos/:id/ordem-producao`. Manter `AuthGuard`; não criar `POST` alternativo.

**Response:** usar `StreamableFile`, com `Content-Type: application/pdf`, `Content-Disposition: inline; filename="..."` e `Cache-Control: no-store`. O filename deve ser sanitizado e derivado somente do número do orçamento; não usar nome do cliente. Preferir representação ASCII segura em `filename`, podendo usar `filename*` quando necessário.

**Tests:** auth; UUID inválido; headers; bytes; mapeamentos de status; nenhum envelope JSON.

**Commit:** `feat(DOCUMENTOS-17): expose quote document endpoints`

### 13.18 DOCUMENTOS-18 — Inspeção real de PDFs e testes de conteúdo

**Goal:** provar o conteúdo do arquivo gerado, não apenas da projeção.

**Scope:** adicionar `unpdf` somente como `devDependency`, conforme D201; criar helper de teste para extrair texto dos PDFs; não usar parser em runtime.

**PDF comercial — presença:** `quoteNumber`, identidade, cliente, linhas de serviço, total e validade quando existente. **Ausência (sentinela):** `taxId` do cliente, endereço, material, medidas, preços internos, desconto, ajuste e notes.

**Ordem de produção — presença:** `quoteNumber`, room, description quando aplicável, material, `finalWidth` e height. **Ausência:** customer name, customer phone, BusinessData, valores financeiros, endereço e dados proibidos de D171.

**Commit:** `test(DOCUMENTOS-18): verify generated pdf content`

### 13.19 DOCUMENTOS-19 — Testes de integração completos

**Goal:** validar interação entre Application, módulos e PostgreSQL.

**Scope:** cobrir BusinessData real, customer contact real, aggregate real, history writer, geração final, histórico, regeneração e ausência de alteração no orçamento.

**Critical assertions:** antes/depois da geração, comparar status da Quote, datas de lifecycle, `updatedAt`, filhos e totais. Somente `quote_history` pode receber nova linha. DRAFT preview não altera sequer o histórico.

**Failure semantics:** forçar falhas de renderer e history writer quando tecnicamente possível; confirmar o contrato D180.

**Commit:** `test(DOCUMENTOS-19): cover document integration flows`

### 13.20 DOCUMENTOS-20 — E2E completo

**Goal:** validar HTTP → Application → renderer → history.

**E2E PDF comercial:** 401; UUID inválido; DRAFT preview; SENT; EXPIRED; CONFIRMED; IN_PRODUCTION; COMPLETED; CANCELLED 409; BusinessData ausente 409; customer soft-deleted; headers; conteúdo; evento; múltiplas gerações → múltiplos eventos; preview → nenhum evento.

**E2E ordem de produção:** CONFIRMED; IN_PRODUCTION; COMPLETED; estados proibidos; headers; conteúdo técnico; ausência de dados financeiros/pessoais; evento por geração.

**Isolation:** aplicar a estratégia de D206. Se necessário, `fileParallelism: false` na configuração E2E que compartilha `business_data`; não alterar o paralelismo dos testes unitários sem necessidade.

**Commit:** `test(DOCUMENTOS-20): cover document generation e2e`

### 13.21 DOCUMENTOS-21 — Auditoria semântica, reparos e fechamento

**Goal:** executar revisão final independente da Fase 8, começando como read-only.

**Audit checklist — arquitetura:** nenhum Document aggregate; nenhum repository de documento; nenhum PDF persistido; renderer somente na Infrastructure; projeção/Application não importa `pdf-lib`; nenhuma chamada HTTP interna; nenhum Prisma de BusinessData em Orçamentos.

**Segurança e privacidade:** PDF comercial somente com dados autorizados; ordem de produção sem dado financeiro nem dado pessoal proibido.

**Lifecycle:** D174 aplicada integralmente; D175 aplicada integralmente; CANCELLED bloqueado; DRAFT preview sem evento.

**Histórico:** um evento por geração real; nenhum evento em falha; nenhum evento em preview; history writer não altera Quote; falha do histórico impede a entrega dos bytes.

**Técnico:** `pdf-lib` isolada; sem Chromium; PDF em memória; sem temporários persistentes; asset reproduzível; locale/timezone explícitos; conteúdo testado via parser.

**Mechanical gates:**

```bash
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
npx prisma validate
npx prisma migrate status
git diff --check
git status --short
```

**Repair:** qualquer finding segue `REPRODUCE → REPAIR → TARGETED TEST → FULL RELEVANT SUITE → SEMANTIC RECHECK`. Não fechar com finding bloqueante ou alto.

**Documentation:** ao final, atualizar esta spec e `IMPLEMENTATION_PLAN.md`; marcar a Fase 8 concluída apenas se todos os gates estiverem verdes; registrar eventual pendência exclusivamente visual do logo se ela impedir a conclusão real.

**Commit:** `docs(DOCUMENTOS-21): close documents phase`

---

## 14. Condição de parada

DOCUMENTOS-02 termina com:

- duas projeções especificadas, sem implementação;
- decisões D143–D209 registradas e classificadas;
- 30 decisões `[F]` e 37 decisões `[A]`; 0 `[P]` e 0 `[V]`;
- nenhuma decisão aberta;
- decomposição definitiva `DOCUMENTOS-03…21` registrada;
- nenhum arquivo de código, schema, migration, seed, endpoint, DTO, serviço, dependência ou teste alterado;
- nenhum commit de implementação.

A implementação está autorizada. Cada task `DOCUMENTOS-03…21` só é concluída após o Gate 1 e o Gate 2 aplicáveis. A Fase 8 só é encerrada em `DOCUMENTOS-21`, com todos os gates verdes e a pendência do PNG da logo (D150) registrada como exclusivamente visual, se ainda existir.
