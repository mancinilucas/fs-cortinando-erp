# 10 — Auditoria do módulo Dados do Negócio (DADOS-DO-NEGOCIO-01)

**Status:** concluída em 2026-10-20
**Task de origem:** `DADOS-DO-NEGOCIO-01 — Auditar o estado atual`
**Fontes de verdade:** `docs/PROJECT_SPEC.md` (§2.7, §10.2, §13–§14, §17), `docs/ARCHITECTURE.md` (§2.1, §5–§7, §14.2, §16, §19–§22), `docs/IMPLEMENTATION_PLAN.md` (Fase 10), `AGENTS.MD`, `CLAUDE.md`
**Escopo:** leitura e inspeção. Nenhum código, schema, migration, endpoint, repositório, use case, DTO ou teste foi criado ou alterado.

> **Nomenclatura:** o código e o schema usam inglês (`BusinessData`, `commercialNameOrConsultant`, `phone`, `taxId`). A documentação de produto permanece em português (`DadosDoNegocio`, `nomeComercialOuConsultor`, `telefone`, `cpfCnpj`). O mapa existente está em `docs/development/01-prisma-naming.md`.

> **Observação de processo:** a task `DADOS-DO-NEGOCIO-01` ainda não possuía definição formal em `docs/development/`. Ela foi executada seguindo o padrão já usado em `AUTH-01`, `CLIENTES-01` e `ORCAMENTO-01`: auditoria somente leitura, sem implementação, produzindo este relatório. A task `DADOS-DO-NEGOCIO-02` materializa as decisões em `docs/development/10-dados-negocio.md`.

---

## 1. Objetivo

Determinar, com evidência do repositório, o que já existe do módulo Dados do Negócio, o que falta e quais decisões precisam ser fechadas antes de qualquer implementação.

A pergunta central é:

> O schema e a tabela `business_data` são suficientes para implementar `GET /dados-do-negocio` e `PUT /dados-do-negocio` sem alterar o banco?

A resposta é **sim, com decisões de contrato pendentes**. O schema atual cobre os quatro campos de produto e o timestamp técnico. O que falta é módulo, camada de aplicação, persistência, apresentação, testes e a definição explícita do comportamento quando ainda não existe configuração.

---

## 2. Comandos e checks executados

Executados a partir de `backend/`:

| Comando | Resultado |
|---|---|
| `npx prisma validate` | ✅ schema válido |
| `npx prisma migrate status` | ✅ banco atualizado; 2 migrations encontradas |
| `pnpm build` | ✅ exit 0 |
| `pnpm lint` | ✅ exit 0 |
| `pnpm test` | ⚠️ primeira execução: 884/885, com 1 falha em `delete-draft-quote.use-case.spec.ts`; a spec isolada passou e 3 execuções completas seguintes passaram 885/885. Falha pré-existente e intermitente do módulo Orçamento, não relacionada a Dados do Negócio. |
| `pnpm test:e2e` | ✅ 33/33 em 5 arquivos |
| `git status --short` | ✅ árvore limpa antes da geração desta documentação |

Buscas executadas:

| Busca | Resultado |
|---|---|
| `BusinessData`, `businessData`, `business_data`, `dados-do-negocio`, `DadosDoNegocio` em `backend/src`, `backend/test`, `frontend/src` e `backend/prisma` | ✅ somente `schema.prisma` e a migration inicial; nenhuma referência em código de aplicação, testes ou frontend |
| Estrutura de `backend/src/modules` | ✅ existem apenas `auth`, `clientes` e `orcamentos` |
| Estrutura de `backend/src/shared` | ✅ `database`, `http` e `text`; `normalizeEmail` já é compartilhado |
| `docs/development/` | ✅ não existia `10-dados-negocio.md` nem `10-dados-negocio-audit.md` antes desta task |

Nenhum código, schema, migration ou teste foi executado com efeito de alteração.

---

## 3. Estado atual

### 3.1 Resumo

O módulo Dados do Negócio **não existe em código**. Existe apenas a persistência mínima criada na fundação Prisma.

| Item | Estado |
|---|---|
| Model Prisma `BusinessData` | existe |
| Tabela `business_data` | existe na migration inicial |
| Campos de produto | existem e correspondem a `PROJECT_SPEC` §2.7 |
| `createdAt` | **não existe** |
| `updatedAt` | existe, obrigatório, gerenciado por `@updatedAt` |
| `id` | existe, `TEXT` PK, sem default no schema ou na migration |
| `DadosDoNegocioModule` | **não existe** |
| Camada `domain/` | **não existe**; não é necessária pela arquitetura |
| Porta de persistência | **não existe** |
| Store Prisma / mapper | **não existem** |
| Use cases / query | **não existem** |
| Controller / DTOs | **não existem** |
| Testes | **não existem** |
| Seed | **não existe** para `business_data` |
| Integração com PDF | **não existe**; pertence à Fase 8 |
| Frontend | **não existe**; pertence à Fase 11 |

### 3.2 Evidência

`backend/prisma/schema.prisma:206-214`:

```prisma
model BusinessData {
  id                         String   @id
  commercialNameOrConsultant String   @map("commercial_name_or_consultant")
  phone                      String
  email                      String?
  taxId                      String?  @map("tax_id")
  updatedAt                  DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@map("business_data")
}
```

`backend/prisma/migrations/20261018024309_init/migration.sql:145-153`:

```sql
CREATE TABLE "business_data" (
    "id" TEXT NOT NULL,
    "commercial_name_or_consultant" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "tax_id" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "business_data_pkey" PRIMARY KEY ("id")
);
```

Não há outra constraint, índice, default de coluna, trigger ou seed relacionado a `business_data`.

---

## 4. Schema e conformidade

### 4.1 Campos

| Campo Prisma | Coluna | Tipo | Null | Constraint / observação |
|---|---|---|---|---|
| `id` | `id` | `TEXT` | NOT NULL | PK; sem default no schema e sem `DEFAULT` na migration |
| `commercialNameOrConsultant` | `commercial_name_or_consultant` | `TEXT` | NOT NULL | obrigatório em `PROJECT_SPEC` §2.7 |
| `phone` | `phone` | `TEXT` | NOT NULL | obrigatório em `PROJECT_SPEC` §2.7 |
| `email` | `email` | `TEXT` | NULL | opcional em `PROJECT_SPEC` §2.7; sem `UNIQUE` |
| `taxId` | `tax_id` | `TEXT` | NULL | opcional em `PROJECT_SPEC` §2.7; sem `UNIQUE` |
| `updatedAt` | `updated_at` | `TIMESTAMPTZ(3)` | NOT NULL | `@updatedAt` do Prisma; sem `DEFAULT` na migration |

### 4.2 Índices e constraints

| Item | Estado |
|---|---|
| PK `business_data_pkey` | existe |
| Índices adicionais | **não existem** |
| Unicidade de `email` | **não existe** |
| Unicidade de `tax_id` | **não existe** |
| Constraint de linha única | **não existe** |
| `CHECK` de formato | **não existe** |
| `created_at` | **não existe** |

### 4.3 Matriz de conformidade com `PROJECT_SPEC` §2.7

| Requisito | Fonte | Situação |
|---|---|---|
| `nomeComercialOuConsultor` obrigatório | §2.7 | ✅ `NOT NULL` |
| `telefone` obrigatório | §2.7 | ✅ `NOT NULL` |
| `email` opcional | §2.7 | ✅ `NULL` |
| `cpfCnpj` opcional | §2.7 | ✅ `NULL` |
| Identidade visual e logo fixos no template | §2.7 | ✅ não há coluna nem upload; correto |
| Sem gerenciamento de logo | §2.7 | ✅ não há endpoint, tabela ou campo |
| Campos opcionais vazios não exibidos no PDF | §2.7 | ⏳ regra da Fase 8; não pertence a esta fase |
| Configuração simples e única | §2.7 | ⚠️ o schema permite várias linhas; a unicidade lógica depende da aplicação |
| `updatedAt` técnico | schema | ✅ existe; não é campo de produto |
| `createdAt` | — | ✅ não exigido; não existe |
| `id` | — | ✅ técnico; não é campo de produto |

### 4.4 Conclusão sobre o schema

O schema atual é **suficiente** para a Fase 10. Nenhuma migration é necessária para expor `GET` e `PUT`:

- o `id` pode ser fornecido pela aplicação com um valor fixo;
- o `updatedAt` é preenchido pelo Prisma em criação e atualização;
- os quatro campos de produto já existem com a nulabilidade correta;
- não há requisito de `createdAt`, unicidade, índice adicional ou logo persistido.

Qualquer necessidade de alteração de schema que surja durante a implementação deve ser interrompida e reportada antes de ser executada, conforme `AGENTS.MD` e a skill `spec-task`.

---

## 5. Estrutura NestJS atual e convenções reutilizáveis

### 5.1 Estrutura

```text
backend/src/
├── app.module.ts
├── main.ts
├── modules/
│   ├── auth/
│   ├── clientes/
│   └── orcamentos/
└── shared/
    ├── database/
    ├── http/
    └── text/
```

Não existe `modules/dados-do-negocio/`.

### 5.2 Bootstrap

- `AppModule` importa `ThrottlerModule`, `PrismaModule`, `AuthModule`, `ClientesModule` e `OrcamentosModule`.
- Guards globais: `CsrfOriginGuard` e `LoggingThrottlerGuard`.
- `main.ts` aplica `ValidationPipe({ whitelist: true, transform: true })`.
- CORS é configurado com origens explícitas e `credentials: true`.
- `PrismaService` é o único ponto de acesso ao Prisma, com `@prisma/adapter-pg`.

Consequências para a Fase 10:

- `PUT /dados-do-negocio` será tratado pelo `CsrfOriginGuard` como método mutável; a origem precisa ser válida.
- DTOs podem usar `class-transformer` e `class-validator` normalmente.
- Campos desconhecidos no corpo serão removidos pelo `whitelist`; `id` e `updatedAt` não podem ser definidos pelo cliente.
- Nenhum filtro global de exceções existe; o controller mapeia erros conhecidos, como em Clientes.

### 5.3 Convenções já disponíveis

| Convenção | Onde está | Uso na Fase 10 |
|---|---|---|
| `AuthGuard` exportado | `AuthModule` | proteger o controller inteiro |
| `PrismaModule` / `PrismaService` | `shared/database` | store de infraestrutura |
| `normalizeEmail` compartilhado | `shared/text/normalize-email.ts` | normalizar `email` |
| Porta como classe abstrata | `UserStore`, `SessionStore` | modelo para `BusinessDataStore` |
| Store Prisma em `infrastructure/` | `PrismaUserStore`, `PrismaSessionStore` | modelo para `PrismaBusinessDataStore` |
| Controller fino + mapper de resposta | Clientes e Orçamentos | modelo para o controller |
| Mapper de erro na Presentation | `customer-error-mapper.ts` | mapear `404`/`400` |
| Testes Vitest + PostgreSQL real | specs de integração e E2E | testes do módulo |

Não há necessidade de criar `domain/`. `ARCHITECTURE.md` §2.1 e §19 colocam `dados-do-negocio/` apenas com `application/`, `infrastructure/`, `presentation/` e o módulo NestJS. O módulo é de suporte, não um Aggregate Root.

---

## 6. Lacunas

1. **Módulo NestJS:** criar `modules/dados-do-negocio/` e registrar no `AppModule`.
2. **Contrato de aplicação:** definir o record, a porta de persistência, os normalizadores e os erros.
3. **Persistência:** implementar `PrismaBusinessDataStore` com leitura e upsert da linha única.
4. **Leitura:** implementar `GetBusinessDataQuery` e o comportamento para configuração ausente.
5. **Escrita:** implementar `UpdateBusinessDataUseCase` com normalização, validação e upsert.
6. **Apresentação:** DTO de entrada, DTO de resposta, mapper de resposta, mapper de erros e controller.
7. **Contrato HTTP:** fechar `GET`/`PUT`, semântica de `PUT`, resposta e estado não configurado.
8. **Testes:** unitários, de integração e E2E, incluindo isolamento da tabela singleton.
9. **Seed:** decidir se existe dado inicial; a recomendação é não criar seed e permitir que o primeiro `PUT` crie a configuração.
10. **Frontend:** fora desta fase; a tela de configuração pertence à Fase 11.
11. **PDF:** fora desta fase; a integração pertence à Fase 8.

---

## 7. Inconsistências e pontos que exigem decisão

### 7.1 Unicidade lógica não é garantida pelo banco

`business_data` aceita múltiplas linhas. Não há constraint que impeça duas configurações. O produto fala em “configuração simples” no singular, mas o schema não materializa essa unicidade.

**Consequência:** a aplicação deve escolher um identificador fixo e sempre ler/gravar essa linha. Isso é suficiente para o MVP, mas a invariante fica na aplicação, não no banco.

**Decisão necessária:** confirmar o identificador fixo (proposta: `"business"`) e aceitar que o banco não impede linhas extras.

### 7.2 Sem default para `id` e `updated_at`

A migration não define `DEFAULT` para `id` nem para `updated_at`. O Prisma preenche `updated_at` via `@updatedAt`, mas `id` precisa ser fornecido explicitamente pelo código. Um `INSERT` SQL direto sem esses valores falha.

**Consequência:** o store deve fornecer o `id` fixo. Não é necessário alterar o schema.

### 7.3 Ausência de `createdAt`

Não é possível expor a data de criação da configuração. `PROJECT_SPEC` §2.7 não exige esse dado; `updatedAt` é suficiente para o contrato.

**Consequência:** a resposta expõe apenas `updatedAt`. Não criar `createdAt` por simetria.

### 7.4 Nenhuma validação no banco

`email`, `taxId`, `phone` e `commercialNameOrConsultant` são `TEXT` sem `CHECK`. Toda normalização e validação depende da aplicação.

**Consequência:** o contrato HTTP e a camada de aplicação precisam definir exatamente o que é aceito. Não há regra de banco a preservar.

### 7.5 Estado não configurado não está definido

`PROJECT_SPEC` §2.7 descreve os campos, mas não define o que `GET /dados-do-negocio` responde antes do primeiro cadastro. Como não há seed, esse estado é possível.

**Alternativas:**

- `404` até o primeiro `PUT` (recomendado);
- `200` com campos vazios ou `null`;
- seed com dados de ambiente;
- criação automática no primeiro `GET`.

**Decisão necessária:** é a principal decisão bloqueante da fase. Afeta o frontend (Fase 11) e a geração de PDF (Fase 8).

### 7.6 Semântica de `PUT` não está definida

`ARCHITECTURE.md` §14.2 define `PUT /dados-do-negocio`, mas não detalha:

- se o `PUT` substitui todos os campos ou faz atualização parcial;
- se campos opcionais omitidos são limpos;
- se o primeiro `PUT` cria a configuração;
- se a resposta é `200` ou `201`.

**Decisão necessária:** fechar a semântica antes da implementação. A recomendação é substituição completa, upsert e `200`.

### 7.7 Formato de `taxId` não está definido em `PROJECT_SPEC`

O produto exige apenas que `cpfCnpj` seja opcional. Não há regra de normalização ou validação em §2.7.

**Precedente:** Clientes (D51/D52) normaliza para dígitos e aceita 11 ou 14 caracteres, sem validar dígitos verificadores. Reutilizar essa regra em Dados do Negócio é coerente, mas **é uma proposta**, não uma regra explicitamente determinada para este módulo.

**Decisão necessária:** confirmar se o mesmo formato será aplicado.

### 7.8 Composição da “identidade do negócio” no PDF

`PROJECT_SPEC` §10.2 exige “identidade do negócio” no PDF, mas não enumera quais dos quatro campos aparecem. §2.7 diz apenas que campos opcionais vazios não devem ser exibidos.

**Consequência:** a Fase 10 expõe todos os campos; a decisão de quais entram no PDF pertence à Fase 8. Não inventar essa composição agora.

### 7.9 Seed ausente

Não há seed de `business_data`. O seed atual cria apenas o usuário administrativo. Criar um seed exigiria inventar valores ou introduzir novas variáveis de ambiente não previstas.

**Decisão necessária:** confirmar a ausência de seed e o primeiro `PUT` como ato de configuração.

### 7.10 Logo

Não existe campo de logo, upload ou gerenciamento. Isso está correto: `PROJECT_SPEC` §2.7 determina identidade visual e logo fixos no template.

**Consequência:** nenhuma alteração de schema ou endpoint de arquivo nesta fase.

### 7.11 PDF transferido para a Fase 8

`IMPLEMENTATION_PLAN.md` já registra que a integração dos dados ao PDF comercial foi transferida da Fase 10 para a Fase 8. A Fase 10 permanece responsável apenas por consultar e atualizar a configuração.

**Consequência:** não implementar geração de PDF, template ou biblioteca de PDF nesta fase.

---

## 8. Arquivos que provavelmente serão afetados

> Nenhum destes arquivos foi criado ou alterado nesta task. Lista prospectiva para as próximas tasks.

### Novos

```text
backend/src/modules/dados-do-negocio/
├── application/
│   ├── business-data-store.ts
│   ├── business-data-normalizers.ts
│   ├── business-data-not-found.error.ts
│   ├── business-data-validation.error.ts
│   ├── get-business-data.query.ts
│   └── update-business-data.use-case.ts
├── infrastructure/
│   └── prisma-business-data.store.ts
├── presentation/
│   ├── dados-do-negocio.controller.ts
│   ├── business-data-response.mapper.ts
│   ├── business-data-error-mapper.ts
│   └── dto/
│       ├── update-business-data.dto.ts
│       └── business-data-response.dto.ts
└── dados-do-negocio.module.ts
```

Testes correspondentes em `src/modules/dados-do-negocio/**/*.spec.ts` e `backend/test/dados-do-negocio.e2e-spec.ts`.

### Alterados

- `backend/src/app.module.ts` — importar `DadosDoNegocioModule`.

### Não alterados

- `backend/prisma/schema.prisma`;
- `backend/prisma/migrations/`;
- `backend/prisma/seed.ts`;
- `backend/src/modules/auth/`;
- `backend/src/modules/clientes/`;
- `backend/src/modules/orcamentos/`;
- `frontend/`;
- documentos de outras fases.

---

## 9. Conclusão

O estado atual é **schema-only**. A implementação pode começar sem migration, desde que as decisões de contrato sejam fechadas. As lacunas são de módulo e de código, não de modelagem de banco.

A arquitetura não pede uma camada `domain/` para este módulo. O caminho mais simples e compatível é:

```text
Controller fino
  → GetBusinessDataQuery / UpdateBusinessDataUseCase
    → BusinessDataStore (porta)
      → PrismaBusinessDataStore
        → business_data
```

A task `DADOS-DO-NEGOCIO-02` registra as decisões D125–D142. A implementação não deve começar antes da validação das decisões marcadas como propostas ou bloqueantes, em especial o comportamento de `GET` quando não há configuração.
