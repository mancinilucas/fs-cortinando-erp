# 03 — Auditoria do módulo Clientes (CLIENTES-01)

**Status:** concluída em 2026-10-19
**Task de origem:** `docs/development/03-clientes.md` → CLIENTES-01
**Fontes de verdade:** `docs/PROJECT_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_PLAN.md`, `AGENTS.MD`, `CLAUDE.md`
**Escopo:** leitura e inspeção. Nenhum código, schema, migration, endpoint, repository ou teste foi criado ou alterado.

> **Nomenclatura:** o código e o schema usam inglês (`Customer`, `Quote`, `name`, `phone`, `taxId`). A documentação de produto permanece em português (`Cliente`, `Orçamento`, `nome`, `telefone`, `cpfCnpj`). O mapa completo está em `docs/development/01-prisma-naming.md`.

---

## 1. Estado atual

### 1.1 Resumo

O módulo Clientes **não existe em código**. O schema Prisma já contém o model `Customer` e a relação com `Quote`, e a migration inicial materializa o schema no PostgreSQL. A única feature implementada é `Auth`.

| Item | Estado |
|---|---|
| Model Prisma `Customer` | existe |
| Campos, nulabilidade, `deletedAt` | implementados |
| Relação `Customer 1:N Quote` | implementada com `onDelete: Restrict` |
| Migration inicial | existe (`20261018024309_init`) |
| `ClientesModule` | **não existe** |
| Entidade/VO de domínio | **não existem** |
| `CustomerRepository` / mapper | **não existem** |
| Controller / DTOs / use cases / queries | **não existem** |
| Testes de Clientes | **não existem** |
| Infraestrutura Prisma | existe (`PrismaService`/`PrismaModule`) |
| Convenções de Auth reutilizáveis | existem |

### 1.2 Confirmação do Aggregate

Confirmado contra `ARCHITECTURE.md` §3.1, §3.2 e §7.1:

- `Cliente` é **Aggregate Root independente**.
- `Orçamento` é **outro Aggregate Root** e **não pertence** ao aggregate `Cliente`.
- O vínculo é feito por `Quote.customerId` (`quotes.customer_id`), FK obrigatória.
- O histórico de orçamentos do cliente é uma **query sobre `quotes`**, não uma coleção interna do aggregate `Cliente`.
- O soft delete do cliente é um `UPDATE` em `customers.deleted_at`; **não altera** `quotes`, `curtains`, `general_add_ons` nem `quote_history`.
- A FK `Restrict` impede exclusão física de cliente que possua orçamentos; o fluxo do produto nunca executa essa exclusão física.

---

## 2. Comandos e checks executados

| Comando | Resultado |
|---|---|
| `npx prisma validate` | ✅ `The schema at prisma/schema.prisma is valid` |
| `npx prisma migrate status` | ⚠️ `P1001: Can't reach database server at localhost:5432` |
| `docker compose ps` (raiz) | ⚠️ nenhum container em execução |
| `pnpm lint` | ✅ exit 0 |
| `pnpm build` | ✅ exit 0 |
| `grep -rniE "customer\|cliente" backend/src --include="*.ts"` (exceto `src/generated`) | ✅ nenhuma ocorrência |
| `find backend/src/modules -maxdepth 1 -mindepth 1 -type d` | ✅ apenas `auth` |
| `git status --short` | ✅ árvore limpa |

**Limitação registrada:** como o PostgreSQL não estava em execução, não foi possível confirmar o estado aplicado das migrations no banco. A migration foi inspecionada estaticamente e corresponde ao schema. A verificação ao vivo deve ocorrer na primeira task de implementação que precisar de banco (ou antes, subindo o `docker compose`).

Nenhum código, schema, migration ou teste foi executado com efeito de alteração.

---

## 3. Schema e relações relevantes

### 3.1 Model `Customer` (`customers`)

Fonte: `backend/prisma/schema.prisma` linhas 76–98.

| Campo Prisma | Coluna | Tipo | Null | Constraint / observação |
|---|---|---|---|---|
| `id` | `id` | `UUID` | NOT NULL | PK; `@default(uuid())` gerado pelo Prisma Client (o SQL da migration **não** possui `DEFAULT` de coluna) |
| `name` | `name` | `TEXT` | NOT NULL | obrigatório (`PROJECT_SPEC` §2.1) |
| `phone` | `phone` | `TEXT` | NOT NULL | obrigatório (`PROJECT_SPEC` §2.1) |
| `email` | `email` | `TEXT` | NULL | opcional; **sem UNIQUE** |
| `taxId` | `tax_id` | `TEXT` | NULL | opcional; `UNIQUE` no estado auditado — removido em CLIENTES-03 (D52-A, §6.1) |
| `addressPostalCode` | `address_postal_code` | `TEXT` | NULL | CEP |
| `addressStreet` | `address_street` | `TEXT` | NULL | logradouro |
| `addressNumber` | `address_number` | `TEXT` | NULL | número textual (`123A`, `s/n`) |
| `addressComplement` | `address_complement` | `TEXT` | NULL | complemento |
| `addressNeighborhood` | `address_neighborhood` | `TEXT` | NULL | bairro |
| `addressCity` | `address_city` | `TEXT` | NULL | cidade |
| `addressState` | `address_state` | `CHAR(2)` | NULL | UF; alinhado a D25 |
| `notes` | `notes` | `TEXT` | NULL | observações |
| `createdAt` | `created_at` | `TIMESTAMPTZ(3)` | NOT NULL | `DEFAULT CURRENT_TIMESTAMP` |
| `updatedAt` | `updated_at` | `TIMESTAMPTZ(3)` | NOT NULL | `@updatedAt` (Prisma) |
| `deletedAt` | `deleted_at` | `TIMESTAMPTZ(3)` | NULL | soft delete; `NULL` = ativo |

### 3.2 Índices

| Índice | Coluna(s) | Origem |
|---|---|---|
| `customers_pkey` | `id` | PK |
| ~~`customers_tax_id_key`~~ | `tax_id` | `@unique` (D19/D23) — **removido em CLIENTES-03 (D52-A)** |
| `customers_name_idx` | `name` | busca por nome (`PROJECT_SPEC` §3.3) |

Não existe índice em `deleted_at`, nem índice parcial `name WHERE deleted_at IS NULL`.

### 3.3 Relação `Customer → Quote`

```prisma
model Quote {
  customerId String @map("customer_id") @db.Uuid
  customer   Customer @relation(fields: [customerId], references: [id], onDelete: Restrict)
  @@index([customerId])
}
```

Migration correspondente:

```sql
ALTER TABLE "quotes"
  ADD CONSTRAINT "quotes_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "quotes_customer_id_idx" ON "quotes"("customer_id");
```

Verificações:

- FK obrigatória (`customer_id NOT NULL`).
- `ON DELETE RESTRICT`: nenhum cascade destrutivo de Cliente para Orçamento.
- `ON UPDATE CASCADE`: default do Prisma; PKs são UUID imutáveis, então não é acionado.
- `quotes_customer_id_idx` atende a query de histórico por cliente.
- Filhos internos do orçamento (`curtains`, `general_add_ons`, `quote_history`) usam `Cascade` a partir de `quotes`, nunca a partir de `customers`.

### 3.4 Soft delete

- Implementado como coluna `deleted_at TIMESTAMPTZ(3) NULL`.
- **Não existe** filtro automático no banco, view, trigger ou Prisma middleware.
- Toda query de leitura/atualização normal precisa filtrar `deletedAt: null` explicitamente.
- `PROJECT_SPEC` §2.1 exige soft delete; `ARCHITECTURE.md` §9.4 confirma `deletedAt`.
- Orçamentos históricos permanecem associados porque o soft delete é `UPDATE` e a FK não é alterada.

### 3.5 Endereço

- Estrutura achatada em 7 colunas, coerente com `PROJECT_SPEC` §2.8 e D22/D24.
- Todas as colunas são nullable, coerente com D3/D22: o cliente pode não ter endereço.
- `address_state` é `CHAR(2)`, coerente com D25. **Atenção:** `CHAR(2)` faz padding com espaços e trunca/erro em entradas fora do formato; a aplicação deve validar e normalizar UF antes da persistência.
- A obrigatoriedade dos quatro campos centrais (`logradouro`, `numero`, `bairro`, `cidade`) é regra de domínio, não `NOT NULL`.
- Não há tabela, FK ou relação entre o endereço do cliente e o endereço de instalação do orçamento. O snapshot do orçamento é cópia campo a campo (Fases 5/6).

### 3.6 Matriz de conformidade (schema × documentação)

| Requisito | Fonte | Situação |
|---|---|---|
| `id` | `PROJECT_SPEC` §2.1 | ✅ UUID PK |
| `nome` obrigatório | §2.1, §3.1 | ✅ NOT NULL |
| `telefone` obrigatório | §2.1, §3.1 | ✅ NOT NULL |
| `email` opcional | §2.1, §3.1 | ✅ NULL, sem UNIQUE |
| CPF/CNPJ opcional | §2.1, §3.1 | ✅ NULL |
| CPF/CNPJ normalizado (somente dígitos) | §2.1 | ⚠️ coluna existe; normalização depende da aplicação (sem constraint) |
| CPF/CNPJ sem unicidade | CLIENTES-02 (diretriz) | ✅ `UNIQUE` removido em CLIENTES-03 (D52-A, §6.1) |
| Endereço estruturado | §2.8 | ✅ 7 colunas, todas nullable |
| Endereço preenchido = logradouro + número + bairro + cidade | §2.8 | ⚠️ regra de domínio ainda não implementada |
| `observacoes` opcional | §2.1 | ✅ NULL |
| `createdAt`/`updatedAt` | §2.1 | ✅ implementados |
| soft delete | §2.1, ARCHITECTURE §9.4 | ✅ `deleted_at` |
| histórico preservado após soft delete | §2.1, §14.2 | ✅ FK `Restrict`, soft delete é `UPDATE` |
| `Cliente` como Aggregate Root | ARCHITECTURE §3.1 | ✅ decisão documentada; sem código ainda |
| `Orcamento` fora do aggregate | ARCHITECTURE §3.1, §3.2 | ✅ `Quote` separado, FK por `customerId` |

---

## 4. Estrutura NestJS atual

```text
backend/src/
├── app.module.ts
├── app.controller.ts / app.service.ts
├── main.ts
├── modules/
│   └── auth/
│       ├── application/       (use cases, ports abstratos, normalização)
│       ├── infrastructure/    (Prisma stores, Argon2 hasher)
│       ├── presentation/      (controller, DTO, guard, cookie, CSRF-related)
│       └── auth.module.ts
└── shared/
    ├── database/              (PrismaModule, PrismaService)
    └── http/                  (CSRF, throttler, origin, client IP)
```

### 4.1 Bootstrap e configuração

- `AppModule` importa `ThrottlerModule`, `PrismaModule` e `AuthModule`.
- Guards globais: `CsrfOriginGuard` e `LoggingThrottlerGuard`.
- `main.ts` aplica `ValidationPipe({ whitelist: true })` — **sem `transform: true`** e sem `forbidNonWhitelisted`.
- CORS habilitado com `configuredOrigins()` e `credentials: true`.
- `PrismaService` é o único ponto de acesso ao Prisma, com driver adapter `@prisma/adapter-pg`.
- Não existe filtro global de exceções.

### 4.2 Convenções de Auth que devem ser preservadas

- Separação `application/`, `infrastructure/`, `presentation/`.
- Portas como classes abstratas (`UserStore`, `SessionStore`, `PasswordHasher`) e implementações `Prisma*` em `infrastructure/`.
- Prisma somente em `infrastructure/`; nenhum tipo Prisma em `application/` ou `domain/`.
- Controllers finos; exceções HTTP lançadas na Presentation.
- DTOs HTTP com `class-validator`.
- Identificadores, comentários e mensagens em inglês.
- Imports com extensão `.js` (NodeNext).
- Testes com Vitest:
  - `vitest.config.ts` → `**/*.spec.ts` (unit + integração);
  - `vitest.config.e2e.ts` → `**/*.e2e-spec.ts`;
  - testes de integração/E2E usam PostgreSQL real via `DATABASE_URL`;
  - E2E replicam a configuração do bootstrap (`ValidationPipe({ whitelist: true })`).
- `AuthGuard` existe, mas **não é exportado** pelo `AuthModule` (ver §5).

### 4.3 Ausências confirmadas

- Não existe `ClientesModule`, pasta `modules/clientes/`, domínio, repositório, mapper, controller, DTO, use case, query service ou teste de Clientes.
- Não existe utilitário compartilhado de normalização de texto além de `normalizeEmail` dentro de `modules/auth/application/`.
- Não existe mapeamento centralizado de erros de domínio/aplicação.

---

## 5. Lacunas

1. **Módulo e camadas:** criar `modules/clientes/` com `domain/`, `application/`, `infrastructure/`, `presentation/` e `clientes.module.ts`.
2. **Domínio:** entidade `Customer` e Value Object de endereço do cliente (próprio do módulo, sem compartilhamento com o orçamento).
3. **Persistência:** `CustomerRepository` (porta), `PrismaCustomerRepository` e `CustomerMapper`.
4. **Leitura:** query service/projeção para busca e listagem, com filtro explícito de `deletedAt`.
5. **Apresentação:** controller, DTOs de entrada/saída e mapeamento de erros.
6. **Integração com Auth:** `AuthGuard` não é exportado; `ClientesModule` não consegue reutilizá-lo sem ajuste no `AuthModule`.
7. **Validação aninhada:** `ValidationPipe` global não usa `transform: true`; um DTO com `address` aninhado exige essa opção (ou validação manual).
8. **Normalização:** não existem normalizadores de nome, telefone, CPF/CNPJ, CEP, UF ou endereço.
9. **Soft delete centralizado:** não existe nenhuma camada que garanta `deletedAt: null`; cada query futura precisa fazê-lo.
10. **Erros:** não existem erros de Cliente nem mapeamento para `404`/`400`/`409`.
11. **Testes:** não existem testes unitários, de integração ou E2E de Clientes.
12. **Contrato de histórico:** `GET /clientes/:id/orcamentos` pertence à Fase 9 (`IMPLEMENTATION_PLAN.md`), mas o contrato precisa ser fechado na CLIENTES-02.
13. **Verificação ao vivo do banco:** migrations não puderam ser validadas com o PostgreSQL em execução.

---

## 6. Inconsistências

### 6.1 `taxId` UNIQUE (resolvido por D52-A)

- `backend/prisma/schema.prisma`: `taxId String? @unique`.
- Migration: `CREATE UNIQUE INDEX "customers_tax_id_key" ON "customers"("tax_id")`.
- `ARCHITECTURE.md` §23 e D19/D23: CPF/CNPJ normalizado e **único** em `clientes`.
- `PROJECT_SPEC.md` §2.1: exige apenas armazenamento normalizado, **sem mencionar unicidade**.
- A diretriz de CLIENTES-02 registrada pelo solicitante exige **ausência de unicidade no MVP**.

**Conclusão:** não há como fechar o contrato de `POST`/`PATCH` (comportamento para CPF/CNPJ repetido) sem uma decisão humana. O schema atual contradiz a diretriz de CLIENTES-02, mas está alinhado a `ARCHITECTURE.md` §23/D19. Alterar a constraint exige migration e atualização da documentação de arquitetura; **nada foi alterado nesta task**.

> **Resolvido em 2026-10-19:** D52-A aprovada e aplicada em CLIENTES-03 — `@unique` removido do schema, migration `20261019191211_remove_customer_tax_id_uniqueness` criada (`DROP INDEX "customers_tax_id_key"`), `ARCHITECTURE.md` e registros D19/D23 atualizados. O schema e a migration acima refletem apenas o estado auditado.

### 6.2 Endereço parcial no cadastro do cliente

`PROJECT_SPEC.md` §2.8 define quando um endereço é considerado **preenchido** (logradouro, número, bairro e cidade), mas não afirma explicitamente se o cadastro do cliente pode armazenar um endereço **parcial**. Para o orçamento em `RASCUNHO` a parcialidade é explicitamente permitida; para o cliente, não há regra equivalente.

> **Resolvido em 2026-10-19:** D54-A aprovada — endereço é tudo ou nada; endereço parcial é rejeitado com `400`.

### 6.3 Divergência nominal entre arquitetura e schema

`ARCHITECTURE.md` §9.3 usa nomes conceituais em português (`endereco_*`, `clientes`), enquanto o schema usa `address_*` e `customers` por exigência de código em inglês (`ARCHITECTURE.md` §1.2). Já registrado em `01-prisma-naming.md`; **não é uma inconsistência funcional**.

### 6.4 CPF/CNPJ sem validação no banco

A coluna `tax_id TEXT` aceita qualquer string. A normalização (somente dígitos) e qualquer validação estrutural dependem da aplicação, como já previsto em D23/D25. Não é inconsistência, mas é uma lacuna de implementação.

### 6.5 `addressState CHAR(2)`

O tipo `CHAR(2)` não valida conteúdo. Entradas com menos de 2 caracteres são completadas com espaço e entradas com mais de 2 podem falhar/truncar conforme o PostgreSQL. A aplicação deve normalizar e validar antes da persistência.

### 6.6 Busca por nome × índice

`PROJECT_SPEC.md` §3.3 exige busca por nome. O índice existente é B-tree em `name`. Uma busca parcial case-insensitive (`ILIKE '%termo%'`) **não aproveita** esse índice. Não há inconsistência, mas há limitação de performance registrada em §8.

### 6.7 E-mail sem unicidade

O schema **não** possui `UNIQUE` em `email`, coerente com `PROJECT_SPEC.md` e com a diretriz de não introduzir unicidade. Nenhuma ação necessária.

### 6.8 Isolamento de Prisma

Nenhum tipo Prisma vazou para `application/`/`domain/`, porque essas camadas de Clientes ainda não existem. A regra permanece como critério de implementação.

---

## 7. Arquivos que provavelmente serão afetados

> Nenhum destes arquivos foi criado ou alterado nesta task. Lista prospectiva para as próximas tasks.

### Novos

```text
backend/src/modules/clientes/
├── domain/
│   ├── entities/customer.ts
│   ├── value-objects/customer-address.ts
│   ├── repositories/customer.repository.ts
│   └── errors/...
├── application/
│   ├── create-customer.use-case.ts
│   ├── update-customer.use-case.ts
│   ├── delete-customer.use-case.ts
│   └── queries/customer.queries.ts
├── infrastructure/
│   ├── prisma-customer.repository.ts
│   ├── prisma-customer.queries.ts
│   └── customer.mapper.ts
├── presentation/
│   ├── clientes.controller.ts
│   ├── dto/...
│   └── clientes-error-mapping.ts
└── clientes.module.ts

backend/test/clientes.e2e-spec.ts
backend/src/modules/clientes/**/*.spec.ts
```

### Existentes que podem precisar de ajuste

| Arquivo | Motivo provável |
|---|---|
| `backend/src/app.module.ts` | importar `ClientesModule` |
| `backend/src/modules/auth/auth.module.ts` | exportar `AuthGuard` (e dependências, se necessário) |
| `backend/src/main.ts` | `ValidationPipe({ whitelist: true, transform: true })`, se o endereço for aninhado |
| `backend/prisma/schema.prisma` | **somente** se a decisão de unicidade de `taxId` for alterada |
| `backend/prisma/migrations/**` | **somente** se a decisão de unicidade de `taxId` for alterada |
| `docs/ARCHITECTURE.md` | **somente** se a decisão de unicidade de `taxId` for alterada |
| `docs/IMPLEMENTATION_PLAN.md` | marcar progresso da Fase 3 quando as tasks forem concluídas |
| `backend/test/auth.e2e-spec.ts` / infraestrutura de teste | reutilização do padrão de login/sessão; não deve ser alterado sem necessidade |

### Fora do escopo desta fase

```text
frontend/src/features/clientes/**   → Fase 11
GET /clientes/:id/orcamentos       → Fase 9
```

---

## 8. Riscos

| Risco | Impacto | Mitigação sugerida |
|---|---|---|
| Remoção/alteração da constraint `taxId UNIQUE` | Migration pode falhar se houver duplicatas; contrato HTTP muda | Decidir antes da implementação; rodar migration em banco limpo/controlado; atualizar `ARCHITECTURE.md` §23 |
| Filtro de soft delete esquecido em alguma query | Cliente excluído aparece em busca/detalhe ou aceita atualização | Centralizar o filtro no repository/query service; testar integração e E2E |
| `AuthGuard` não exportado | Rotas de Clientes não conseguem reutilizar a autenticação | Exportar do `AuthModule` e importar no `ClientesModule`; validar em E2E |
| `ValidationPipe` sem `transform` | `@ValidateNested`/`@Transform` do endereço não funcionam | Habilitar `transform: true` em `main.ts` e nos testes E2E |
| Busca `contains` case-insensitive sem índice utilizável | Scan sequencial em `customers` | Volume esperado é baixo; registrar e revisar apenas com dados reais |
| Ausência de paginação | Lista cresce sem limite | Volume de uma única consultoria; adicionar paginação simples se necessário |
| `CHAR(2)` para UF | Padding com espaços ou erro em entrada inválida | Normalizar e validar `^[A-Z]{2}$` antes de persistir |
| Endereço parcial no cliente | Dados incompletos que não podem ser copiados para o orçamento | Fechar a política de completude na CLIENTES-02 |
| CPF/CNPJ sem dígitos verificadores | Cadastro com número estruturalmente válido mas incorreto | Decisão explícita; validação algorítmica pode ser adicionada depois |
| Banco indisponível no ambiente atual | Testes de integração/E2E não executam | Subir `docker compose up -d` antes da implementação |
| Concorrência de edição | Última escrita vence | MVP de usuário único; sem optimistic locking (ARCHITECTURE §22) |
| Cliente soft-deleted usado para novo orçamento | Orçamento novo vinculado a cliente removido | Bloquear na Fase 5, resolvendo apenas clientes ativos |

---

## 9. Decisões que precisam ser fechadas em CLIENTES-02

1. Contrato completo do aggregate `Customer` (propriedades, invariantes, soft delete, restauração).
2. Obrigatoriedade, validação e normalização por campo, com separação de camadas.
3. Normalização de nome (trim, NFC, vazio, limites).
4. Política de telefone (armazenar como informado vs. normalizar; validação de formato).
5. Política de e-mail (normalização, formato, ausência de unicidade).
6. CPF/CNPJ: normalização, validação estrutural, dígitos verificadores e **conflito de unicidade** (§6.1).
7. Endereço: estrutura, VO, completude/parcialidade, normalização de CEP/UF.
8. Soft delete: respostas HTTP, filtros, edição após exclusão, restauração.
9. Busca/listagem: query parameter, parcialidade, case sensitivity, ordenação, paginação.
10. `GET /clientes/:id`: resposta para existente, inexistente e excluído; campos públicos.
11. `POST /clientes`: DTO, status, normalizações, campos ausentes, duplicidade.
12. `PATCH /clientes/:id`: semântica de omitido vs. `null`, endereço, cliente excluído.
13. `GET /clientes/:id/orcamentos`: contrato de projeção e comportamento para cliente excluído.
14. `CustomerRepository`: interface, operações mínimas, separação de queries.
15. Use cases vs. query services.
16. DTOs, controllers, `AuthGuard` e `ValidationPipe`.
17. Mapeamento de erros (`404`, `400`, `409`).
18. Necessidade de transação explícita.
19. Estratégia de testes unitários, integração e E2E.
20. Índices vs. queries definidas.

---

## 10. Conclusão da CLIENTES-01

- Nenhum código de Cliente foi implementado.
- Nenhuma migration foi criada.
- Nenhum campo foi adicionado ou removido.
- Nenhum endpoint foi criado.
- Nenhum arquivo de aplicação, schema, migration ou teste foi alterado.

O schema atual suporta o cadastro de cliente descrito no `PROJECT_SPEC`, com **duas pendências relevantes**: a unicidade de `taxId` (conflito entre schema/ARCHITECTURE e a diretriz de CLIENTES-02) e a política de endereço parcial no cadastro do cliente. Ambas foram encaminhadas para decisão em `docs/development/03-clientes.md` e resolvidas em 2026-10-19 (D52-A e D54-A); a remoção da unicidade foi aplicada em CLIENTES-03.
