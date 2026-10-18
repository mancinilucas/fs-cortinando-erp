# 01 — Auditoria do Prisma e modelo relacional proposto

**Status:** PRISMA-01, PRISMA-02 e PRISMA-03 concluídas; modelo pronto para PRISMA-04
**Data:** 2026-10-15
**Tasks de origem:** `docs/development/01-prisma-foundation.md` → PRISMA-01, PRISMA-02
**Fontes de verdade:** `docs/PROJECT_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_PLAN.md`, `AGENTS.MD`

Escopo deste documento: registrar o estado do Prisma antes de qualquer alteração de schema e registrar o modelo relacional proposto para o MVP, já com as decisões estruturais validadas pelo autor da especificação.

**Nenhum arquivo de código ou schema foi alterado.** `prisma/schema.prisma` permanece no estado do scaffold e nenhuma migration foi criada.

> **Nota de nomenclatura (2026-10-17):** os identificadores em português deste documento registram as decisões da época. Após `ARCHITECTURE.md` §1.2 exigir código em inglês, o schema foi renomeado. O mapa completo está em `docs/development/01-prisma-naming.md`; onde este documento diz `Orcamento`, `Cliente`, `Cortina` etc., leia `Quote`, `Customer`, `Curtain`.

---

# Parte 1 — PRISMA-01: auditoria do estado atual

## 1.1 Verificação executada

| Comando | Resultado |
|---|---|
| `npx prisma validate` | ✅ `The schema at prisma/schema.prisma is valid` |
| `npx prisma --version` | `prisma 7.10.0` · `@prisma/client 7.10.0` |
| `npx prisma migrate status` | `No migration found in prisma/migrations` · `The current database is not managed by Prisma Migrate` |
| `npm run build` | ✅ exit 0 |
| `npm run lint` | ✅ sem erros |
| `docker compose ps` | `postgres:15-alpine` · `Up (healthy)` · `0.0.0.0:5432->5432/tcp` |
| `psql`: `\dt` + `pg_tables` | 0 tabelas no schema `public` |
| `psql`: `_prisma_migrations` | 0 ocorrências |
| `git status` (raiz e `backend/`) | árvores limpas |

## 1.2 Estado atual

### Tooling

- Prisma **7.10.0** (não 6.x).
- Gerenciador de pacotes: **pnpm** (`pnpm-lock.yaml`, `pnpm-workspace.yaml` com `allowBuilds` para `@prisma/engines` e `prisma`).
- `backend/` é um **repositório git próprio**, separado do repositório da raiz (commit `b48df60 feat: scaffold nestjs + prisma created`). Relevante apenas para o escopo de commits das próximas tasks.
- Dependências instaladas e ainda não utilizadas: `@prisma/client`, `@prisma/adapter-pg`, `pg`, `@types/pg`. Em Prisma 7 o **driver adapter é obrigatório**; esses pacotes serão exigidos pelo `PrismaService` (PRISMA-08).

### `prisma/schema.prisma`

Scaffold intacto (13 linhas), sem nenhum model, enum ou atributo:

```prisma
generator client {
  provider = "prisma-client"        // generator novo do Prisma 7 (não prisma-client-js)
  output   = "../generated/prisma"  // → backend/generated/prisma (gitignored)
}

datasource db {
  provider = "postgresql"           // sem campo `url`: vem do config file (padrão Prisma 7)
}
```

- `backend/generated/prisma` **não existe** → Prisma Client ainda não foi gerado.

### Configuração

- O arquivo de configuração é **`prisma7.config.ts`** (a development spec citava `prisma.config.ts`). O CLI carrega corretamente: `Loaded Prisma config from prisma7.config.ts`. Não é problema — apenas registro.
- `prisma7.config.ts`: `schema: "prisma/schema.prisma"`, `migrations.path: "prisma/migrations"`, `datasource.url: process.env["DATABASE_URL"]`, com `import "dotenv/config"`. Coerente com Prisma 7.
- `.env`: `DATABASE_URL="postgresql://cortinas_user:cortinas_password@localhost:5432/cortinas_db"`, `NODE_ENV=development`. `.env` e `/generated/prisma` estão no `.gitignore` — nenhum secret commitado.

### Migrations e banco

- `prisma/migrations/` **não existe**.
- Banco `cortinas_db` sem tabelas e sem `_prisma_migrations`. Banco vazio, pronto para a migration inicial.

### Integração NestJS

- `src/` contém apenas `main.ts`, `app.module.ts`, `app.controller.ts`, `app.service.ts` (+1 spec). **Não existe `PrismaService`**; `AppModule` não importa nada.
- Nenhuma referência a Prisma em `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json` ou `src/`. Prisma hoje é 100% CLI, zero código de aplicação.

## 1.3 Inconsistências e lacunas em relação a PROJECT_SPEC e ARCHITECTURE

| # | Lacuna | Referência | Task que resolve |
|---|---|---|---|
| 1 | Nenhum model implementado (`Usuario`, `Sessao`, `Cliente`, `Orcamento`, `Cortina`, financeiros, histórico, sequência, dados do negócio) | ARCHITECTURE §9.3, §12, §13 | PRISMA-05 |
| 2 | Nenhum enum (`StatusOrcamento`, tipo de desconto, tipo de evento) | ARCHITECTURE §4.1, §3.6, §8 | PRISMA-03/05 |
| 3 | Sem migrations; banco não gerenciado pelo Prisma Migrate | dev spec §6 | PRISMA-07 |
| 4 | Prisma Client não gerado | dev spec §6 | PRISMA-08 |
| 5 | Sem `PrismaService`; NestJS não conecta ao banco | ARCHITECTURE §5.3, §9.1 | PRISMA-08 |
| 6 | Seed administrativo inexistente | ARCHITECTURE §13.4 | PRISMA-09 |
| 7 | Nome do config (`prisma7.config.ts`) diverge do citado na spec (`prisma.config.ts`) — apenas registro | dev spec §6 (PRISMA-01) | — |

Nenhuma inconsistência funcional: nada modelado ainda, portanto nada contrário a `PROJECT_SPEC`/`ARCHITECTURE`.

## 1.4 Decisões antigas a descartar

**Nenhuma.** O schema é o scaffold do `prisma init`, sem modelagem prévia, campo ou enum legado. Não há histórico de migrations nem tabelas a abandonar.

## 1.5 Arquivos afetados nas próximas tasks

```text
backend/prisma/schema.prisma        PRISMA-03..06  (enums, nulabilidade, precisão, models, índices)
backend/prisma/migrations/**        PRISMA-07      (criar)
backend/src/generated/prisma/**     PRISMA-08      (gerado, gitignored)
backend/src/shared/database/        PRISMA-08      (PrismaService — caminho de ARCHITECTURE §19)
backend/prisma7.config.ts           PRISMA-09      (seed, se adotado)
backend/package.json                PRISMA-09      (script de seed; hash em 02-auth)
```

---

# Parte 2 — PRISMA-02: modelo relacional proposto

> O schema Prisma é modelo de persistência, não modelo de domínio. Nenhum comportamento de domínio, nenhum campo derivado persistido.
> Nenhuma tabela para: ordem de produção, PDF comercial, `EXPIRADO`, instalação atrasada, desconto, endereço de instalação.

## 2.1 Convenções

- Models Prisma em PascalCase; tabelas em `snake_case` plural via `@@map` **onde fizer sentido**; campos camelCase com `@map` para `snake_case`.
- Exceção de nomenclatura herdada de ARCHITECTURE §12: tabela `orcamento_sequence` (singular, conforme já fixado na arquitetura).
- PKs: UUID `v4` via `@default(uuid())`, coluna `@db.Uuid`.
- Datas: `@db.Timestamptz(3)`.
- Dinheiro: `Int` em centavos.
- Medidas/fatores: `Decimal(p,3)`. Quantidades: `Decimal(p,6)`.
- Endereço: campos estruturados, achatados por falta de composite types em PostgreSQL; mesmo conjunto de colunas em `clientes` e `orcamentos` (ver 2.3.1).
- `EXPIRADO` e `InstalacaoAtrasada` são condições derivadas, nunca colunas ou linhas.

## 2.2 Diagrama de relações

```text
usuarios ──1:N──> sessoes

clientes ──1:N──> orcamentos          [FK Restrict; soft delete preserva histórico]
                     ├──1:N──> cortinas                     [Cascade]
                     │            └──1:N──> componentes_financeiros  [Cascade]
                     ├──1:N──> adicionais_gerais             [Cascade]
                     └──1:N──> historico_orcamento           [Cascade]

orcamento_sequence (ano PK)     ← sem FK: contador anual independente; sobrevive à
                                  exclusão física de rascunhos
dados_do_negocio (singleton)    ← sem FK
```

Todas as relações são 1:N com FK obrigatória no lado "muitos". Não há N:N, tabela de junção, herança ou polimorfismo.

## 2.3 Models

### `usuarios` — conta administrativa única

| Campo | Tipo | Null | Constraint / nota |
|---|---|---|---|
| `id` | `String @db.Uuid` | PK | `@default(uuid())` |
| `email` | `String` | NOT NULL | **UNIQUE**; usado no login |
| `senhaHash` → `senha_hash` | `String` | NOT NULL | hash Argon2id/bcrypt — algoritmo em `02-auth.md` (D20) |
| `criadoEm` → `criado_em` | `DateTime @db.Timestamptz(3)` | NOT NULL | `@default(now())` |
| `atualizadoEm` → `atualizado_em` | `DateTime @db.Timestamptz(3)` | NOT NULL | `@updatedAt` |

Sem nome (D14), sem papéis, sem flag de ativo, sem soft delete — fora do escopo (`PROJECT_SPEC` §1.4; ARCHITECTURE §13.4).

### `sessoes` — sessão server-side

| Campo | Tipo | Null | Constraint / nota |
|---|---|---|---|
| `id` | `String @db.Uuid` | PK | `@default(uuid())` |
| `tokenHash` → `token_hash` | `String` | NOT NULL | **UNIQUE**; lookup da sessão; somente o hash é persistido (ARCHITECTURE §13.1) |
| `usuarioId` → `usuario_id` | `String @db.Uuid` | NOT NULL | FK → `usuarios.id` `onDelete: Cascade` |
| `expiraEm` → `expira_em` | `DateTime @db.Timestamptz(3)` | NOT NULL | expiração de sessão (§13.3) |
| `criadoEm` → `criado_em` | `DateTime @db.Timestamptz(3)` | NOT NULL | `@default(now())` |

Sem `ultimoUsoEm` (D13), sem `userAgent`/`ip` (minimização — ARCHITECTURE §21.2). Regeneração pós-login = nova linha; logout = delete da linha.

### `clientes` — Aggregate Root

| Campo | Tipo | Null | Constraint / nota |
|---|---|---|---|
| `id` | `String @db.Uuid` | PK | `@default(uuid())` |
| `nome` | `String` | NOT NULL | obrigatório (`PROJECT_SPEC` §2.1); busca do MVP é por nome |
| `telefone` | `String` | NOT NULL | obrigatório |
| `email` | `String?` | NULL | opcional |
| `cpfCnpj` → `cpf_cnpj` | `String?` | NULL | opcional; **UNIQUE**; normalizado, somente dígitos (D19/D23) |
| `endereco*` → `endereco_*` | 7 colunas `String?` (ver 2.3.1) | NULL | endereço estruturado; bloco opcional (D22) |
| `observacoes` | `String?` | NULL | opcional |
| `criadoEm` → `criado_em` | `DateTime @db.Timestamptz(3)` | NOT NULL | `@default(now())` |
| `atualizadoEm` → `atualizado_em` | `DateTime @db.Timestamptz(3)` | NOT NULL | `@updatedAt` |
| `deletedAt` → `deleted_at` | `DateTime @db.Timestamptz(3)?` | NULL | **soft delete** (ARCHITECTURE §9.4); NULL = ativo |

### `orcamentos` — Aggregate Root

| Campo | Tipo | Null | Constraint / nota |
|---|---|---|---|
| `id` | `String @db.Uuid` | PK | `@default(uuid())` |
| `numeroOrcamento` → `numero_orcamento` | `String` | NOT NULL | **UNIQUE** — `ORÇ-AAAA-NNN` (`PROJECT_SPEC` §4.3) |
| `clienteId` → `cliente_id` | `String @db.Uuid` | NOT NULL | FK → `clientes.id` **`onDelete: Restrict`**; imutável por domínio |
| `status` | `StatusOrcamento` | NOT NULL | enum persistido (ARCHITECTURE §4.1) |
| `observacoes` | `String?` | NULL | interno; nunca em PDF/ordem de produção |
| `descontoTipo` → `desconto_tipo` | `TipoDesconto` | NOT NULL | `@default(SEM_DESCONTO)` |
| `descontoPercentual` → `desconto_percentual` | `Decimal @db.Decimal(5,2)?` | NULL | apenas quando `PERCENTUAL` (D7) |
| `descontoValorFixoCentavos` → `..._centavos` | `Int?` | NULL | apenas quando `VALOR_FIXO` |
| `ajusteComercialCentavos` → `..._centavos` | `Int?` | NULL | positivo ou negativo (ARCHITECTURE §3.7) |
| `enderecoInstalacao*` → `endereco_instalacao_*` | `String?` (ver 2.3.1) | NULL | snapshot estruturado no orçamento (D2) |
| `dataCriacao` → `data_criacao` | `DateTime @db.Timestamptz(3)` | NOT NULL | `@default(now())`; primeiro "Salvar rascunho" (§4.2) |
| `atualizadoEm` → `atualizado_em` | `DateTime @db.Timestamptz(3)` | NOT NULL | `@updatedAt` (D16) |
| `dataPrimeiroEnvio` → `data_primeiro_envio` | `DateTime @db.Timestamptz(3)?` | NULL | |
| `dataValidade` → `data_validade` | `DateTime @db.Timestamptz(3)?` | NULL | não obrigatória em rascunho (§8.5) |
| `dataConfirmacao` → `data_confirmacao` | `DateTime @db.Timestamptz(3)?` | NULL | |
| `dataInicioProducao` → `data_inicio_producao` | `DateTime @db.Timestamptz(3)?` | NULL | |
| `dataInstalacaoAgendada` → `data_instalacao_agendada` | `DateTime @db.Timestamptz(3)?` | NULL | ausência de valor ≠ status de instalação |
| `dataConclusao` → `data_conclusao` | `DateTime @db.Timestamptz(3)?` | NULL | |

Datas exatamente conforme ARCHITECTURE §4.4. Reabertura, renovação e cancelamento **não** originam colunas: ficam no histórico (D1 — nenhum campo `motivoCancelamento`).

Totais derivados (`subtotalCortinas`, `totalAdicionaisGerais`, `subtotalOrcamento`, `valorDesconto`, `totalCalculado`, `totalOrcamento`) **não** são persistidos.

#### 2.3.1 Estrutura de endereço (compartilhada entre `clientes` e `orcamentos`)

Prisma não possui composite types em PostgreSQL, portanto o Value Object de endereço é achatado em colunas, com prefixo diferente em cada tabela. As duas tabelas usam **o mesmo conjunto de campos, com a mesma nulabilidade** (D22): um cliente pode não ter endereço cadastrado e um orçamento em `RASCUNHO` pode não ter endereço de instalação, então nenhuma coluna é `NOT NULL` (D3).

| Campo | Coluna em `clientes` | Coluna em `orcamentos` | Tipo | Null |
|---|---|---|---|---|
| cep | `endereco_cep` | `endereco_instalacao_cep` | `String?` (8 dígitos) | NULL |
| logradouro | `endereco_logradouro` | `endereco_instalacao_logradouro` | `String?` | NULL |
| numero | `endereco_numero` | `endereco_instalacao_numero` | `String?` | NULL |
| complemento | `endereco_complemento` | `endereco_instalacao_complemento` | `String?` | NULL |
| bairro | `endereco_bairro` | `endereco_instalacao_bairro` | `String?` | NULL |
| cidade | `endereco_cidade` | `endereco_instalacao_cidade` | `String?` | NULL |
| uf | `endereco_uf` | `endereco_instalacao_uf` | `String? @db.Char(2)` | NULL |

Regras de preenchimento (D24), aplicadas no domínio/aplicação:

- `logradouro`, `numero`, `bairro` e `cidade` definem um endereço **preenchido**;
- `complemento`, `cep` e `uf` são sempre opcionais;
- no orçamento, o endereço pode estar vazio ou incompleto durante `RASCUNHO`; o gate `RASCUNHO → ENVIADO` exige endereço preenchido;
- as colunas permanecem nullable no banco pelos dois casos acima — "obrigatório" é regra de domínio, não `NOT NULL` (ver risco aceito 3 em 2.8 deste documento).

`numero` é texto (`"123A"`, `"s/n"`). Não há flag indicando se o endereço foi copiado do cliente: o resultado é sempre um endereço próprio do orçamento (`PROJECT_SPEC` §5). Sufixo opcional como `referencia` não foi incluído por não estar previsto na especificação.

Formato (D25): `uf` em `@db.Char(2)` maiúsculo; `cep` com 8 dígitos, sem máscara. Ambos normalizados na entrada, mesma lógica de CPF/CNPJ (D23).

### `cortinas` — Entity interna do aggregate

| Campo | Tipo | Null | Constraint / nota |
|---|---|---|---|
| `id` | `String @db.Uuid` | PK | `@default(uuid())`; identidade própria (dev spec §3) |
| `orcamentoId` → `orcamento_id` | `String @db.Uuid` | NOT NULL | FK → `orcamentos.id` **`onDelete: Cascade`** |
| `sequencia` | `Int` | NOT NULL | ordenação/apresentação; **UNIQUE junto de `orcamento_id`** (D11) |
| `ambiente` | `String?` | NULL | gate exige preenchido só no envio (D3) |
| `descricao` | `String?` | NULL | opcional |
| `material` | `String?` | NULL | texto livre; sem catálogo no MVP (D3) |
| `larguraVao` → `largura_vao` | `Decimal @db.Decimal(9,3)?` | NULL | D3/D6 |
| `valorBorda` → `valor_borda` | `Decimal @db.Decimal(6,3)?` | NULL | default `0,15` aplicado pelo domínio, **sem default de coluna** (D4) |
| `altura` | `Decimal @db.Decimal(9,3)?` | NULL | D3/D6 |
| `fatorTecido` → `fator_tecido` | `Decimal @db.Decimal(6,3)?` | NULL | default `3,5` no domínio, sem default de coluna (D4) |
| `observacoes` | `String?` | NULL | interno; nunca em documento |

Não persistidos (determinísticos): `larguraFinal = larguraVao + (2 × valorBorda)` e `quantidadeTecido = larguraFinal × fatorTecido` (ARCHITECTURE §9.3).

### `componentes_financeiros` — Entity interna da cortina

| Campo | Tipo | Null | Constraint / nota |
|---|---|---|---|
| `id` | `String @db.Uuid` | PK | `@default(uuid())` |
| `cortinaId` → `cortina_id` | `String @db.Uuid` | NOT NULL | FK → `cortinas.id` **`onDelete: Cascade`** |
| `nome` | `String` | NOT NULL | preset de UX, não enum (ARCHITECTURE §3.4) |
| `quantidade` | `Decimal @db.Decimal(12,6)?` | NULL | 6 casas para receber `quantidadeTecido` sem arredondar metragem (D5/D6) |
| `unidade` | `String?` | NULL | texto livre (`m`, `un`) |
| `valorUnitarioCentavos` → `..._centavos` | `Int?` | NULL | `total` **não** persistido |

### `adicionais_gerais` — Entity interna do orçamento

| Campo | Tipo | Null | Constraint / nota |
|---|---|---|---|
| `id` | `String @db.Uuid` | PK | `@default(uuid())` |
| `orcamentoId` → `orcamento_id` | `String @db.Uuid` | NOT NULL | FK → `orcamentos.id` **`onDelete: Cascade`** |
| `nome` | `String` | NOT NULL | |
| `quantidade` | `Decimal @db.Decimal(12,6)?` | NULL | idêntico ao componente financeiro |
| `unidade` | `String?` | NULL | |
| `valorUnitarioCentavos` → `..._centavos` | `Int?` | NULL | `total` **não** persistido |

Mesma tipagem de `componentes_financeiros` porque o modelo de domínio é compartilhado (`ItemFinanceiro`, ARCHITECTURE §3.4); as tabelas são distintas por clareza referencial (ARCHITECTURE §9.3), não por diferença semântica.

### `historico_orcamento` — log de eventos de negócio

| Campo | Tipo | Null | Constraint / nota |
|---|---|---|---|
| `id` | `String @db.Uuid` | PK | `@default(uuid())` |
| `orcamentoId` → `orcamento_id` | `String @db.Uuid` | NOT NULL | FK → `orcamentos.id` **`onDelete: Cascade`** (D10) |
| `tipoEvento` → `tipo_evento` | `TipoEventoHistorico` | NOT NULL | enum Prisma (D21) |
| `ocorridoEm` → `ocorrido_em` | `DateTime @db.Timestamptz(3)` | NOT NULL | `@default(now())` |
| `detalhes` | `Json?` | NULL | jsonb livre: valores anteriores/novos, validade antiga/nova (D18; ARCHITECTURE §8) |

Fora do aggregate: não é carregado com `Orcamento`, não reconstrói estado, não é event sourcing. Nenhum `usuarioId` (usuário único no MVP).

### `orcamento_sequence` — contador anual

| Campo | Tipo | Null | Constraint / nota |
|---|---|---|---|
| `ano` | `Int` | **PK** | 2026, 2027… (ARCHITECTURE §12) |
| `ultimoNumero` → `ultimo_numero` | `Int` | NOT NULL | `@default(0)`; incremento atômico na mesma transação do `create` |

**Sem FK para `orcamentos`** — deliberado: o contador não pode regredir nem ser afetado pela exclusão física de rascunhos ("número nunca é reutilizado", "lacunas são aceitáveis").

### `dados_do_negocio` — configuração singleton

| Campo | Tipo | Null | Constraint / nota |
|---|---|---|---|
| `id` | `String` | PK | valor fixo `"principal"` (D12) |
| `nomeComercialOuConsultor` → `nome_comercial_ou_consultor` | `String` | NOT NULL | obrigatório (`PROJECT_SPEC` §2.7) |
| `telefone` | `String` | NOT NULL | obrigatório |
| `email` | `String?` | NULL | não renderizado se vazio |
| `cpfCnpj` → `cpf_cnpj` | `String?` | NULL | não renderizado se vazio |
| `atualizadoEm` → `atualizado_em` | `DateTime @db.Timestamptz(3)` | NOT NULL | `@updatedAt` |

Sem logo (asset fixo no template) e sem histórico de configuração.

## 2.4 Enums

```prisma
enum StatusOrcamento {
  RASCUNHO
  ENVIADO
  CONFIRMADO
  EM_PRODUCAO
  CONCLUIDO
  CANCELADO
  // EXPIRADO ausente: condição derivada (ARCHITECTURE §4.3)
}

enum TipoDesconto {
  SEM_DESCONTO
  PERCENTUAL
  VALOR_FIXO
}

enum TipoEventoHistorico {
  ORCAMENTO_CRIADO
  ORCAMENTO_ENVIADO
  ORCAMENTO_EDITADO
  ORCAMENTO_CONFIRMADO
  ORCAMENTO_REABERTO
  ORCAMENTO_RENOVADO
  ORCAMENTO_CANCELADO
  PRODUCAO_INICIADA
  INSTALACAO_AGENDADA
  INSTALACAO_ALTERADA
  INSTALACAO_REMOVIDA
  SERVICO_CONCLUIDO
  PDF_COMERCIAL_GERADO
  ORDEM_PRODUCAO_GERADA
}
```

`TipoEventoHistorico` cobre exatamente os 14 eventos de `PROJECT_SPEC` §11. `StatusOrcamento` cobre os 6 status persistidos de §8.1.

## 2.5 PKs, FKs e unicidades

| Constraint | Onde | Justificativa |
|---|---|---|
| PK `id` (UUID v4) | todas exceto `orcamento_sequence` (PK `ano`) | ARCHITECTURE §9.3; dev spec §3; D9 |
| FK `cliente_id → clientes.id` **Restrict** | `orcamentos` | orçamento histórico nunca perde o cliente; soft delete não apaga nada (§9.4, §14.2) |
| FK `orcamento_id → orcamentos.id` **Cascade** | `cortinas`, `adicionais_gerais`, `historico_orcamento` | filhos internos do aggregate; exclusão física só existe em RASCUNHO (§9.5); D10 |
| FK `cortina_id → cortinas.id` **Cascade** | `componentes_financeiros` | idem; evita órfãos |
| FK `usuario_id → usuarios.id` **Cascade** | `sessoes` | sessão não sobrevive à conta |
| UNIQUE `numero_orcamento` | `orcamentos` | proteção adicional ao contador (§12) |
| UNIQUE `email` | `usuarios` | login |
| UNIQUE `token_hash` | `sessoes` | lookup da sessão |
| UNIQUE `cpf_cnpj` | `clientes` | D19 + D23 — valor normalizado (somente dígitos) |
| UNIQUE `(orcamento_id, sequencia)` | `cortinas` | D11 — impede duas cortinas na mesma posição de apresentação |
| PK `ano` | `orcamento_sequence` | §12 |

## 2.6 Precisão numérica

| Categoria | Tipo | Nota |
|---|---|---|
| `largura_vao`, `altura` | `Decimal(9,3)` | escala 3 = precisão de milímetros (D6) |
| `valor_borda`, `fator_tecido` | `Decimal(6,3)` | (D6) |
| `quantidade` (itens financeiros) | `Decimal(12,6)` | recebe `quantidadeTecido` sem arredondar metragem (D5/D6) |
| Dinheiro (`*_centavos`, `ajuste_comercial_centavos`) | `Int` | centavos inteiros; teto R$ 21.474.836,47 |
| `desconto_percentual` | `Decimal(5,2)` | limite `0 < x ≤ 100` é invariante de domínio, sem CHECK (D7) |
| Arredondamento `HALF_UP` | **fora do schema** | política de `Money` em domínio/aplicação (ARCHITECTURE §10.3) |

Nenhum `Float` em medida, quantidade ou dinheiro. Nenhum total persistido. Nenhum default de coluna para borda/fator (D4).

## 2.7 Índices

| Índice | Model | Query do MVP que justifica |
|---|---|---|
| `@unique numero_orcamento` | `orcamentos` | unicidade funcional + busca por número (§12.2) |
| `@@index([nome])` | `clientes` | busca de clientes por nome (§3.3) |
| `@unique cpf_cnpj` | `clientes` | D19 (constraint, gera índice) |
| `@@index([cliente_id])` | `orcamentos` | histórico de orçamentos do cliente (§3.2, §12.4) |
| `@@index([status])` | `orcamentos` | dashboard e filtros de situação (§12.1, §12.3) |
| `@@index([data_validade])` | `orcamentos` | derivar `EXPIRADO` (§8.2) |
| `@@index([data_instalacao_agendada])` | `orcamentos` | próximas instalações, semana, atrasadas (§12.1) |
| `@@unique([orcamento_id, sequencia])` | `cortinas` | D11 (constraint, gera índice) |
| `@@index([orcamento_id])` | `cortinas` | carregar o aggregate por orçamento |
| `@@index([cortina_id])` | `componentes_financeiros` | carregar componentes da cortina |
| `@@index([orcamento_id])` | `adicionais_gerais` | carregar adicionais do orçamento |
| `@@index([orcamento_id, ocorrido_em])` | `historico_orcamento` | `GET /orcamentos/:id/historico` ordenado |
| `@unique token_hash` + `@@index([usuario_id])` | `sessoes` | validar sessão na requisição; invalidar sessões do usuário |
| `@unique email` | `usuarios` | login |

Deliberadamente **não** incluídos: compostos `status+data_validade` e `status+data_instalacao_agendada`, parcial em `deleted_at`, `expira_em` para limpeza de sessões (D17; PRISMA-06 proíbe índice sem query concreta).

Também sem índice: `endereco_cidade` / `endereco_instalacao_cidade`. Filtro por cidade está explicitamente fora do escopo inicial (`PROJECT_SPEC` §12.3), logo não há query que o justifique.

Nota PostgreSQL: UNIQUE em coluna nullable permite múltiplos `NULL` — comportamento desejado para `clientes.cpf_cnpj` (vários clientes sem CPF/CNPJ).

## 2.8 Revisão semântica

**Algum model existe apenas porque o Prisma torna isso conveniente?**
Não. `sessoes` (ARCHITECTURE §13.1 exige sessão persistida), `orcamento_sequence` (§12 exige contador anual persistido e atômico), `usuarios` (§13.4 exige usuário persistido em vez de credencial em `.env`) e `dados_do_negocio` (`PROJECT_SPEC` §2.7) têm requisito explícito.

**Algum conceito de domínio foi transformado em tabela sem necessidade?**
Não. Desconto = colunas em `orcamentos`; endereço de instalação = colunas no orçamento; `EnderecoInstalacao` e `Desconto` permanecem Value Objects sem tabela. Sem `ordem_producao`, sem `pdf`, sem linha de `EXPIRADO`, sem `instalacao_atrasada`.

**Alguma relação permitiria estado inválido?**
Sim — invariantes de domínio que o schema **não deve** tentar substituir (dev spec §6, PRISMA-03), documentadas como risco aceito:

1. Estado incompleto em rascunho: campos técnicos nulos e itens financeiros parcialmente preenchidos são graváveis; o gate de envio é validado em domínio/aplicação.
2. Orçamento em `CONFIRMADO` sem endereço de instalação: o banco não expressa NOT NULL por status.
3. Endereço parcial — no cliente ou no orçamento — com algum dos campos obrigatórios ausente: o banco não expressa "obrigatório apenas quando o endereço existe". A definição de endereço preenchido e a exigência no gate de envio são regras de domínio (2.3.1).
4. `numero_orcamento` e `cliente_id` são imutáveis por regra de domínio, mas o schema não impede `UPDATE` — nenhum trigger será criado (não previsto na arquitetura).

---

# Parte 3 — Registro de decisões

## 3.1 Decisões resolvidas

| # | Tema | Decisão | Efeito no schema |
|---|---|---|---|
| D1 | `motivoCancelamento` | Apenas no histórico; sem coluna em `orcamentos` | Nenhum campo adicional; motivo fica em `historico_orcamento.detalhes` |
| D2 | Endereço de instalação | Campos estruturados; o orçamento carrega snapshot estruturado | 7 colunas `endereco_instalacao_*` em `orcamentos`; sem tabela |
| D3 | Nulabilidade | Nullable nos campos que podem faltar em RASCUNHO; sem defaults artificiais | Campos técnicos de `cortinas` e itens financeiros nullable |
| D4 | Defaults de borda/fator | Domínio/aplicação; não default de coluna | Sem `@default` em `valor_borda`/`fator_tecido` |
| D5 | Quantidade | 6 casas decimais para quantidade derivada | `Decimal(12,6)` em itens financeiros e adicionais |
| D6 | Precisão | `(9,3)` largura/altura; `(6,3)` borda/fator; `(12,6)` quantidade | Conforme tabela 2.6 |
| D7 | Desconto percentual | `Decimal(5,2)` | `desconto_percentual` |
| D8 | Datas | `Timestamptz(3)` | Todas as colunas de data |
| D9 | UUID | v4 com `@default(uuid())` | PKs das tabelas com `id` |
| D10 | Histórico `onDelete` | `Cascade` | `historico_orcamento.orcamento_id` |
| D11 | `(orcamento_id, sequencia)` | **Criar UNIQUE** (decisão do autor, contrária à recomendação inicial) | `@@unique([orcamentoId, sequencia])` em `cortinas` |
| D12 | `dados_do_negocio` singleton | `String @id` com valor fixo, ex. `"principal"` | PK sentinela |
| D13 | `ultimoUsoEm` | Omitir no MVP | Coluna ausente |
| D14 | `usuarios.nome` | Omitir | Coluna ausente |
| D15 | Nomenclatura | Models PascalCase, banco `snake_case`, tabelas plurais onde fizer sentido | `@@map`/`@map` |
| D16 | `orcamentos.atualizadoEm` | Adicionar | `atualizado_em` com `@updatedAt` |
| D17 | Índices compostos | Adiar | Não incluídos |
| D18 | Detalhes do histórico | `Json` livre | `detalhes Json?` |
| D19 | `cpf_cnpj` | Criar UNIQUE | `@unique` em `clientes.cpf_cnpj` (ver D23) |
| D20 | Hash de senha | Decidir em `02-auth.md` | `senha_hash String` não bloqueia |
| D21 | Tipo de evento | Enum Prisma | `TipoEventoHistorico` |
| D22 | Endereço do **Cliente** | Documentação normalizada: endereço é dado estruturado no cliente e no orçamento, com nulabilidade compatível | 7 colunas `endereco_*` em `clientes`, mesmas de `orcamentos` |
| D23 | Normalização de CPF/CNPJ | Persistir somente dígitos, sem máscara | `cpf_cnpj` normalizado; UNIQUE passa a proteger de fato |
| D24 | Campos do endereço | `logradouro`, `numero`, `bairro`, `cidade` obrigatórios; `complemento`, `cep`, `uf` opcionais | Nullability no banco inalterada (D3); regra de preenchimento no domínio — confirmada, sem `NOT NULL` |
| D25 | Formato de `cep`/`uf` | `uf` em `@db.Char(2)` maiúsculo; `cep` com 8 dígitos, sem máscara; normalizados na entrada | Tipos finos definidos; nenhuma constraint adicional |

## 3.2 Pendências abertas

Nenhuma pendência estrutural em aberto. D25 foi fechada e registrada em 3.1.

## 3.3 Consequências a tratar nas fases seguintes

- **Reordenação de cortinas com UNIQUE `(orcamento_id, sequencia)` (D11):** o índice UNIQUE gerado pelo Prisma no PostgreSQL é verificado imediatamente (não há `DEFERRABLE` na DSL do Prisma). Reordenar precisa ser feito transacionalmente em duas passadas — valores temporários (ex.: `sequencia + offset`) e depois os valores finais — ou reescrevendo todas as posições do orçamento de uma só vez. Tratar na Fase 5.
- **Imutabilidade de `numero_orcamento` e `cliente_id`:** garantida por domínio/aplicação, sem trigger no banco.
- **`HALF_UP`:** exclusivamente em `Money` (domínio/aplicação), nunca no schema nem no Prisma.
- **`historico_orcamento` com `Cascade` (D10):** seguro porque a exclusão física só é permitida em `RASCUNHO`; qualquer futura ampliação da regra de exclusão exige revisão desta decisão.
- **PrismaService (PRISMA-08):** Prisma 7 exige driver adapter — `@prisma/adapter-pg` + `pg` já estão instalados, ainda não utilizados.
- **Seed (PRISMA-09):** depende do algoritmo de hash definido em `02-auth.md` (D20).

---

# Parte 4 — Próximo passo

PRISMA-03 (enums, nulabilidade e constraints) foi concluída em `docs/development/01-prisma-constraints.md`.

PRISMA-04 (precisão numérica) pode ser executada com os valores já decididos em D5–D7, e PRISMA-05 implementa o schema. A normalização de CPF/CNPJ (D23), `cep` e `uf` (D25) será implementada junto do cadastro de clientes e dos formulários (Fases 3 e 11), com as constraints já presentes no schema desde a primeira migration.

Documentação normalizada para endereço estruturado e CPF/CNPJ normalizado:

```text
PROJECT_SPEC.md   §2.1, §2.8 (nova), §2.2, §3.1, §3.5, §5, §8.5
ARCHITECTURE.md   §3.1, §3.8, §9.3, §23
```
