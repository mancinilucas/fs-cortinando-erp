# 10 — Dados do Negócio

**Status:** DADOS-DO-NEGOCIO-12 concluída em 2026-10-20. As decisões D125–D142 estão registradas e as decisões materiais aprovadas são normativas. As tasks DADOS-DO-NEGOCIO-03 a -12 foram implementadas, verificadas e encerradas; a Fase 10 está concluída.
**Task de origem:** `DADOS-DO-NEGOCIO-02 — Fechar decisões técnicas e de contrato`
**Auditoria de origem:** `docs/development/10-dados-negocio-audit.md` (DADOS-DO-NEGOCIO-01)
**Fontes de verdade:** `docs/PROJECT_SPEC.md` (§2.7, §10.2, §13–§14, §17), `docs/ARCHITECTURE.md` (§2.1, §5–§7, §14.2, §16, §19–§22), `docs/IMPLEMENTATION_PLAN.md` (Fase 10), decisões D1–D124

Este documento **não implementa** o módulo. Ele fecha as decisões necessárias para decompor a Fase 10 em tasks atômicas. Nenhum código, schema, migration, endpoint, store, use case, DTO ou teste foi alterado.

---

## 1. Como ler este documento

Cada decisão tem um identificador sequencial a partir de **D125** (a última decisão existente é D124, em `04-orcamentos.md`) e um marcador de origem:

| Marcador | Significado |
|---|---|
| **[F]** | Confirmada pelas fontes. A decisão já está determinada por `PROJECT_SPEC`, `ARCHITECTURE`, pelo schema ou por decisões D1–D124. Não requer validação humana; apenas registra o entendimento. |
| **[P]** | Proposta. As fontes não detalham o ponto; a recomendação preenche a lacuna com a alternativa mais simples compatível com elas. Requer validação humana, mas normalmente não bloqueia a decomposição. |
| **[V]** | Requer validação humana. Há ambiguidade material ou o ponto altera contrato de comportamento/API. **Bloqueia** a implementação correspondente até ser validado. |
| **[A]** | Aprovada na revisão humana. Passa a ser normativa e não bloqueia a implementação. |

Regras de leitura:

- uma decisão **[F]** não pode ser alterada sem antes atualizar a fonte que a determina;
- uma decisão **[P]** ou **[V]** passa a ser normativa somente após validação humana;
- propostas não podem ser tratadas como regra de negócio já aprovada;
- nenhuma decisão autoriza alterar o schema Prisma atual.

### 1.1 Nomenclatura

- Código, schema, campos JSON e nomes de classes de domínio/aplicação permanecem em inglês, conforme `ARCHITECTURE.md` §1.2.
- Rotas HTTP permanecem em português, seguindo `ARCHITECTURE.md` §14.2 e o padrão de `/clientes` e `/orcamentos`.
- Nomes de módulo e controller seguem o padrão existente (`ClientesModule`/`ClientesController`, `OrcamentosModule`/`OrcamentosController`): `DadosDoNegocioModule` e `DadosDoNegocioController`.
- Documentação de produto e de desenvolvimento permanece em português.

### 1.2 Fora do escopo desta spec

- geração, template ou biblioteca de PDF;
- integração dos dados ao PDF comercial (Fase 8);
- tela, formulário ou estado de frontend (Fase 11);
- upload, armazenamento ou gerenciamento de logo;
- múltiplas configurações de negócio;
- histórico de alterações, auditoria ou soft delete;
- autenticação, autorização, CSRF ou rate limiting novos;
- alteração de schema, migration ou seed.

---

## 2. Sumário das decisões

| ID | Tema | Status |
|---|---|---|
| D125 | Fronteira do módulo e ausência de `domain/` | [F] |
| D126 | Contrato de dados e nulabilidade | [F] |
| D127 | Identidade da configuração singleton | [A] |
| D128 | Rotas HTTP e autenticação | [F] |
| D129 | Estado não configurado | [A] |
| D130 | Semântica de `PUT` | [A] |
| D131 | Resposta HTTP | [A] |
| D132 | Normalização e validação | [A] |
| D133 | Ausência de regras adicionais | [F] |
| D134 | Porta de persistência e store Prisma | [A] |
| D135 | Atomicidade e concorrência | [A] |
| D136 | Erros e status HTTP | [A] |
| D137 | Privacidade e logs | [F] |
| D138 | Testes e isolamento da tabela singleton | [A] |
| D139 | Itens fora de escopo | [F] |
| D140 | Consumo pela Fase 8 | [F] |
| D141 | Nenhuma alteração de schema ou migration | [F] |
| D142 | Nomenclatura de arquivos e classes | [A] |

---

## 3. Decisões

### D125 — Fronteira do módulo e ausência de `domain/` [F]

`DadosDoNegocio` é um módulo de suporte, não um Aggregate Root.

Estrutura:

```text
backend/src/modules/dados-do-negocio/
├── application/
├── infrastructure/
├── presentation/
└── dados-do-negocio.module.ts
```

- **Não** criar `domain/`.
- **Não** criar entidade de domínio, Aggregate Root, Value Object, Domain Service ou Domain Event.
- **Não** criar repository genérico.
- A normalização/validação simples pertence à Application.
- A persistência pertence à Infrastructure.
- O controller e os DTOs pertencem à Presentation.

**Motivo:** `ARCHITECTURE.md` §2.1 afirma que `Auth` e `DadosDoNegocio` não recebem camada `domain/` artificial sem comportamento que a justifique; §19 mostra o módulo apenas com `application/`, `infrastructure/`, `presentation/` e o módulo NestJS. Não há invariante complexa, cálculo ou transição de estado que justifique um domínio tático.

---

### D126 — Contrato de dados e nulabilidade [F]

O contrato de produto tem exatamente quatro campos:

| Campo JSON | Tipo | Obrigatório | Origem |
|---|---|---|---|
| `commercialNameOrConsultant` | string | sim | `PROJECT_SPEC` §2.7 |
| `phone` | string | sim | `PROJECT_SPEC` §2.7 |
| `email` | string ou `null` | não | `PROJECT_SPEC` §2.7 |
| `taxId` | string ou `null` | não | `PROJECT_SPEC` §2.7 |

- `updatedAt` é técnico, somente leitura, e não é aceito na entrada.
- `id` é técnico, não é exposto e não é aceito na entrada.
- **Não** existe campo de logo, cor, imagem, endereço, redes sociais ou nome fantasia separado.
- **Não** criar `createdAt`.
- **Não** criar unicidade para `email` ou `taxId`.

**Motivo:** `PROJECT_SPEC` §2.7 lista apenas esses campos e determina identidade visual/logo fixos no template. O schema já corresponde à lista. Campos adicionais seriam invenção de produto.

---

### D127 — Identidade da configuração singleton [A]

A configuração é única. A aplicação usará um identificador fixo:

```text
BUSINESS_DATA_ID = "business"
```

- O identificador é detalhe de persistência e fica encapsulado em `PrismaBusinessDataStore`.
- `GET` e `PUT` não recebem `id`; o cliente nunca vê nem escolhe o identificador.
- Toda leitura e escrita usa esse identificador.
- Não criar endpoint para listar, criar ou excluir configurações.
- Não alterar o schema para adicionar default, `CHECK` ou constraint de linha única.

**Motivo:** o schema usa `id TEXT` sem default e não há chave natural. Um identificador fixo evita geração de UUID e torna o upsert determinístico. A unicidade lógica fica na aplicação; o banco não impede linhas extras, mas nenhum fluxo do produto as cria.

**Alternativa considerada:** UUID gerado no primeiro `PUT`. Não é recomendada porque exigiria persistir ou redescobrir o identificador e não traz benefício para uma linha única.

**Situação:** aprovada em 2026-10-20. O valor `"business"` e a ausência de alteração de schema passam a ser normativos.

---

### D128 — Rotas HTTP e autenticação [F]

Rotas:

```text
GET /dados-do-negocio
PUT /dados-do-negocio
```

- O controller inteiro usa `@UseGuards(AuthGuard)`.
- `GET` e `PUT` exigem sessão válida; sem sessão, `401`.
- Não criar `POST`, `PATCH` ou `DELETE`.
- `PUT` é método mutável e passa pelo `CsrfOriginGuard` global; origem inválida ou ausente resulta em `403`, conforme D31.
- Não criar rota pública, rota de health ou rota de seed.

**Motivo:** `ARCHITECTURE.md` §14.2 define exatamente `GET` e `PUT /dados-do-negocio`; `PROJECT_SPEC` §13 exige autenticação para funcionalidades privadas; o padrão de Clientes e Orçamentos protege o controller inteiro com `AuthGuard`.

---

### D129 — Estado não configurado [A]

**Decisão aprovada:** enquanto não existir linha em `business_data`, `GET /dados-do-negocio` responde:

```text
404 Not Found
```

com uma mensagem genérica em inglês, sem detalhes internos.

- Não criar seed de `business_data`.
- Não criar linha default no bootstrap.
- Não criar automaticamente no primeiro `GET`.
- O primeiro `PUT` válido cria a configuração (upsert).
- Depois de criada, `GET` responde `200`.

**Motivo:** não há identidade comercial default em `PROJECT_SPEC`; inventar nome, telefone ou e-mail seria criar dado de produto. Um `404` distingue claramente “ainda não configurado” de “configurado com campos vazios” e permite que a Fase 8 trate a ausência sem gerar PDF com identidade falsa.

**Alternativas consideradas:**

| Alternativa | Avaliação |
|---|---|
| `200` com objeto vazio ou campos `null` | Mistura “não configurado” com “configurado”; o frontend precisa de outra fonte para saber se há dados. |
| Seed com variáveis de ambiente | Introduz configuração e valores não previstos no produto; exige novas variáveis e decisão de deploy. |
| Criação automática no primeiro `GET` | Inventa um registro sem dados obrigatórios e antecipa escrita em um `GET`. |

**Impacto:** decisão aprovada e normativa para as tasks de leitura, apresentação, E2E e para o contrato da Fase 8. A alternativa `200` não foi adotada.

**Situação:** aprovada em 2026-10-20. O `404` para configuração ausente, a ausência de seed e a criação pelo primeiro `PUT` passam a ser normativos.

---

### D130 — Semântica de `PUT` [A]

`PUT /dados-do-negocio` é **substituição completa** e **create-or-update**:

- corpo contém `commercialNameOrConsultant`, `phone`, `email?` e `taxId?`;
- campos obrigatórios ausentes, `null` ou vazios após normalização → `400`;
- campos opcionais ausentes, `null` ou vazios após normalização → `null`;
- `id`, `updatedAt` e campos desconhecidos são descartados pelo `whitelist` global;
- se a configuração não existe, o `PUT` cria;
- se existe, substitui os quatro campos;
- resposta `200` com o registro persistido;
- não retorna `201`, mesmo quando cria;
- a operação é idempotente quanto ao estado; `updatedAt` pode mudar a cada `PUT`, inclusive com valores iguais.

**Motivo:** `PUT` é o verbo definido em `ARCHITECTURE.md` §14.2 e não existe `POST`. Sem `POST` e sem seed, o primeiro `PUT` precisa criar. A substituição completa evita a semântica ambígua de campos omitidos e é coerente com `PUT`, não com `PATCH`.

**Consequência:** não há atualização parcial nesta fase. Um cliente que queira preservar `email` ou `taxId` deve reenviá-los. Se o produto precisar de atualização parcial, isso deve ser decidido como um `PATCH` futuro, não simulado no `PUT`.

**Situação:** aprovada em 2026-10-20. Substituição completa, create-or-update e `200` em criação e atualização passam a ser normativos.

---

### D131 — Resposta HTTP [A]

`GET` e `PUT` respondem `200` com:

```json
{
  "commercialNameOrConsultant": "Cortinando",
  "phone": "(11) 99999-9999",
  "email": "contato@example.com",
  "taxId": "12345678901",
  "updatedAt": "2026-10-20T12:00:00.000Z"
}
```

- `id` não é exposto.
- `email` e `taxId` são `null` quando não configurados.
- `commercialNameOrConsultant` e `phone` nunca são `null`.
- `updatedAt` é ISO 8601 em UTC, como os demais recursos (`CustomerResponseMapper`).
- Não retornar `createdAt`.
- Não retornar objeto envelope (`data`, `businessData` etc.); a resposta é o próprio recurso.
- Não retornar mensagem de sucesso no `PUT`.

**Motivo:** o padrão de Clientes expõe campos JSON em inglês e timestamps ISO 8601; `ARCHITECTURE.md` §14.3 separa DTOs HTTP dos objetos internos. O `id` é detalhe de singleton e não agrega informação ao cliente.

**Situação:** aprovada em 2026-10-20. A resposta sem `id`, sem envelope e com `updatedAt` em ISO 8601 passa a ser normativa.

---

### D132 — Normalização e validação [A]

Normalização na Application, com validação estrutural também no DTO:

| Campo | Normalização | Validação |
|---|---|---|
| `commercialNameOrConsultant` | `trim()` + Unicode NFC; preservar caixa e acentos | não vazio após normalização; sem tamanho máximo arbitrário |
| `phone` | `trim()`; preservar formatação | não vazio após normalização; sem validação de DDD, comprimento ou tipo de linha |
| `email` | `trim()` + NFC + `toLowerCase()`, reutilizando `normalizeEmail` de `shared/text` | formato de e-mail; vazio → `null`; sem verificação de existência e sem unicidade |
| `taxId` | `trim()` + remoção de tudo que não for dígito | 11 ou 14 dígitos; vazio → `null`; sem validação de dígitos verificadores e sem unicidade |

- O DTO aplica `@Transform` e validadores para devolver `400` cedo.
- O use case reaplica a normalização e a validação para não depender da Presentation.
- **Não** importar `customer-normalizers.ts` de `clientes/domain`; o módulo de suporte não deve depender do domínio de Clientes.
- As normalizações locais são pequenas e ficam em `application/business-data-normalizers.ts`; `normalizeEmail` compartilhado é reutilizado.
- Não adicionar biblioteca de validação de CPF/CNPJ, telefone ou nome.

**Motivo:** D48–D51 já fixaram o comportamento análogo para Clientes. Para Dados do Negócio, `PROJECT_SPEC` §2.7 não detalha formato; por isso a regra foi explicitamente aprovada nesta revisão, sem ser automaticamente herdada. A normalização de e-mail já é compartilhada e evita duplicação.

**Situação:** aprovada em 2026-10-20. As normalizações e validações descritas passam a ser normativas.

---

### D133 — Ausência de regras adicionais [F]

Não criar, nesta fase:

- unicidade de `email` ou `taxId`;
- validação de dígitos verificadores de CPF/CNPJ;
- validação de DDD, operadora ou formato de telefone;
- tamanho mínimo ou máximo de nome, telefone ou e-mail além do necessário para validar o formato;
- conversão de nome para title case, remoção de acentos ou exigência de nome completo;
- normalização de telefone para apenas dígitos;
- múltiplos registros, filiais ou perfis;
- histórico de alterações, auditoria ou soft delete;
- cache ou invalidação de cache.

**Motivo:** `PROJECT_SPEC` §2.7 exige apenas os quatro campos e sua obrigatoriedade. Regras adicionais seriam invenção de produto e poderiam bloquear dados válidos.

---

### D134 — Porta de persistência e store Prisma [A]

Definir na Application:

```ts
export interface BusinessDataValues {
  commercialNameOrConsultant: string;
  phone: string;
  email: string | null;
  taxId: string | null;
}

export interface BusinessDataRecord extends BusinessDataValues {
  updatedAt: Date;
}

export abstract class BusinessDataStore {
  abstract find(): Promise<BusinessDataRecord | null>;
  abstract upsert(values: BusinessDataValues): Promise<BusinessDataRecord>;
}
```

Implementar em `infrastructure/prisma-business-data.store.ts`:

```ts
@Injectable()
export class PrismaBusinessDataStore implements BusinessDataStore {
  // encapsula BUSINESS_DATA_ID e o mapeamento Prisma → BusinessDataRecord
}
```

- `find()` usa o identificador fixo e retorna `null` se não existir.
- `upsert(values)` usa `prisma.businessData.upsert` com `where: { id: BUSINESS_DATA_ID }`.
- O store retorna apenas `BusinessDataRecord`; nenhum tipo Prisma vaza para Application ou Presentation.
- O mapeamento é inline no store; não criar `BusinessDataMapper` para uma única tabela sem comportamento.
- **Não** criar `BusinessDataRepository`; a entidade não é Aggregate Root e não há coleção/invariante que justifique repository.
- `PrismaModule` é importado no módulo NestJS.

**Motivo:** o padrão de Auth usa portas (`UserStore`, `SessionStore`) e stores Prisma em Infrastructure. `ARCHITECTURE.md` §5–§7 restringe repositories a Aggregate Roots e permite projeções/leitura direta para consultas simples. Um store de configuração é a fronteira mínima.

**Situação:** aprovada em 2026-10-20. `BusinessDataStore` na Application e `PrismaBusinessDataStore` na Infrastructure passam a ser normativos; Repository e Mapper desnecessários ficam vedados.

---

### D135 — Atomicidade e concorrência [A]

- Cada `PUT` executa um único `upsert`; não usar `$transaction` explícita.
- A política é **last-write-wins**, sem versão, `updatedAt` condicional ou lock otimista.
- Não há cache; toda leitura vai ao PostgreSQL.
- O `updatedAt` é gerenciado pelo Prisma; não definir manualmente.
- A configuração é operada por uma única conta administrativa; não há edição concorrente esperada.
- Se duas requisições concorrentes chegarem, a última persistida vence; não há `409` por concorrência.

**Motivo:** D70 e D75 já adotaram operações de tabela única sem transação e last-write-wins em Clientes. O mesmo raciocínio se aplica a uma linha única de configuração. Uma transação explícita não adicionaria atomicidade a um único `upsert`.

**Situação:** aprovada em 2026-10-20. Um único upsert, sem transação explícita, com last-write-wins e sem optimistic locking passa a ser normativo.

---

### D136 — Erros e status HTTP [A]

| Situação | Status | Origem |
|---|---|---|
| Sessão ausente/inválida | `401` | `AuthGuard` |
| Origem CSRF ausente/inválida no `PUT` | `403` | `CsrfOriginGuard` |
| Corpo inválido (tipo, campo obrigatório, e-mail, `taxId`) | `400` | `ValidationPipe` / DTO |
| Configuração ausente no `GET` | `404` | `BusinessDataNotFoundError` (conforme D129) |
| Violação de invariante na Application | `400` | `BusinessDataValidationError` |
| Erro inesperado | `500` genérico | NestJS; sem detalhes internos |

- `BusinessDataNotFoundError` e `BusinessDataValidationError` ficam na Application.
- `business-data-error-mapper.ts` na Presentation mapeia apenas esses erros; qualquer outro é relançado.
- Mensagens em inglês, sem dados pessoais, sem SQL, sem stack trace.
- Não usar `409` nem `422` nesta fase.

**Motivo:** `ARCHITECTURE.md` §15 define a taxonomia geral; o padrão de Clientes usa mapper de erro na Presentation. Não há conflito de unicidade nem regra de negócio que justifique `409`/`422`.

**Situação:** aprovada em 2026-10-20. Os status HTTP e o error mapping descritos passam a ser normativos.

---

### D137 — Privacidade e logs [F]

- Não registrar `email`, `taxId`, `phone` ou o corpo da requisição em logs.
- Não criar log de auditoria de alterações nesta fase.
- O `LoggingThrottlerGuard` existente pode registrar método, rota e status; não adicionar payload.
- Respostas de erro não devem repetir valores enviados.
- O acesso é privado e autenticado; não criar rota pública para depuração.

**Motivo:** `PROJECT_SPEC` §14 determina que logs não exponham dados pessoais. `taxId`, `email` e `phone` são dados pessoais/comerciais.

---

### D138 — Testes e isolamento da tabela singleton [A]

Cobertura mínima:

| Nível | Casos |
|---|---|
| Unitário | normalizadores; `UpdateBusinessDataUseCase` com campos obrigatórios, opcionais, vazios, `null`, e-mail inválido, `taxId` inválido; `GetBusinessDataQuery` com e sem registro; response mapper |
| Integração | `PrismaBusinessDataStore.find()` vazio e preenchido; `upsert` cria; `upsert` atualiza; `updatedAt` é gerado; leitura sempre usa a linha fixa |
| E2E | `401` sem sessão; `GET` `404` quando vazio; `PUT` cria; `GET` retorna; `PUT` atualiza; campos opcionais viram `null`; corpo inválido `400`; campos desconhecidos descartados; `PUT` sem `Origin` rejeitado pelo CSRF; resposta sem `id` |

Isolamento:

- `business_data` é singleton e não permite faixas de ano ou IDs únicos por teste.
- Todos os testes de banco deste módulo devem limpar `business_data` em `beforeEach`/`afterEach`.
- Manter os testes de banco deste módulo em **um único arquivo de integração** ou garantir execução serial; não criar múltiplos arquivos que escrevam na mesma linha em paralelo.
- Testes E2E usam configuração separada (`vitest.config.e2e.ts`) e também limpam a tabela.
- Não usar `test.concurrent` em testes que escrevem `business_data`.

**Motivo:** a suíte usa PostgreSQL real e arquivos de teste em paralelo. A tabela singleton não tem como isolar por identificador; a estratégia precisa ser explícita para evitar flakes, como já ocorreu no módulo Orçamento.

**Situação:** aprovada em 2026-10-20. A estratégia de um único arquivo de integração, execução não concorrente e limpeza explícita da tabela passa a ser normativa.

---

### D139 — Itens fora de escopo [F]

Não implementar nesta fase:

- upload, armazenamento, redimensionamento ou gerenciamento de logo;
- geração ou template de PDF;
- integração com o PDF comercial;
- tela, formulário, rota ou estado de frontend;
- `DELETE`, `PATCH`, `POST` ou listagem;
- múltiplas configurações;
- histórico, auditoria ou restauração;
- seed;
- cache;
- alteração de schema ou migration.

**Motivo:** `PROJECT_SPEC` §2.7 e §10.2, `ARCHITECTURE.md` §16 e `IMPLEMENTATION_PLAN.md` distribuem esses itens entre as Fases 8, 10 e 11. A Fase 10 é somente consulta e atualização da configuração.

---

### D140 — Consumo pela Fase 8 [F]

Quando a Fase 8 gerar o PDF comercial, ela deve consumir os dados do negócio pela Application deste módulo, preferencialmente por `GetBusinessDataQuery` ou por uma projeção equivalente.

- **Não** acessar `PrismaService.businessData` diretamente de `orcamentos/`.
- **Não** fazer chamada HTTP interna para `GET /dados-do-negocio`.
- **Não** duplicar normalização ou validação.
- Se a configuração estiver ausente, a Fase 8 decide como falhar; a Fase 10 não inventa um PDF sem identidade.

**Motivo:** `ARCHITECTURE.md` §5–§7 mantém Prisma na Infrastructure e chamadas entre módulos na Application; §16 define o PDF como projeção sob demanda. A dependência já está registrada em `IMPLEMENTATION_PLAN.md` §2.6.

---

### D141 — Nenhuma alteração de schema ou migration [F]

O schema atual é suficiente:

- `id TEXT` recebe o valor fixo da aplicação;
- `updated_at` é preenchido pelo `@updatedAt`;
- os quatro campos têm a nulabilidade correta;
- não há requisito de `createdAt`, unicidade, índice adicional ou logo persistido.

Portanto:

- não alterar `backend/prisma/schema.prisma`;
- não criar migration;
- não alterar `backend/prisma/seed.ts`;
- não rodar `prisma migrate dev` para esta fase;
- se a implementação revelar necessidade de alteração, **parar e reportar** antes de alterar.

**Motivo:** `AGENTS.MD` e a skill `spec-task` restringem schema/migrations a tasks Prisma autorizadas. A auditoria DADOS-DO-NEGOCIO-01 confirmou que a tabela atual atende ao contrato.

---

### D142 — Nomenclatura de arquivos e classes [A]

```text
dados-do-negocio.module.ts          → DadosDoNegocioModule
presentation/dados-do-negocio.controller.ts → DadosDoNegocioController
application/business-data-store.ts  → BusinessDataStore, BusinessDataValues, BusinessDataRecord
application/business-data-normalizers.ts
application/get-business-data.query.ts → GetBusinessDataQuery
application/update-business-data.use-case.ts → UpdateBusinessDataUseCase
infrastructure/prisma-business-data.store.ts → PrismaBusinessDataStore
presentation/business-data-response.mapper.ts
presentation/business-data-error-mapper.ts
presentation/dto/update-business-data.dto.ts
presentation/dto/business-data-response.dto.ts
```

- Rotas: `dados-do-negocio`.
- Campos JSON: inglês (`commercialNameOrConsultant`, `phone`, `email`, `taxId`, `updatedAt`).
- Comentários, mensagens de erro e nomes de testes: inglês.
- Documentação: português.

**Motivo:** segue o padrão existente de módulos com nome de pasta/rota em português (`clientes`, `orcamentos`) e classes internas em inglês (`Customer`, `Quote`). D73 fixou os campos HTTP em inglês.

**Situação:** aprovada em 2026-10-20. `DadosDoNegocioModule` e `DadosDoNegocioController` passam a ser normativos, com classes e contratos internos em inglês.

---

## 4. Decisões materialmente abertas

Não há bloqueios pendentes. Em 2026-10-20 foram aprovadas D127, D129, D130, D131, D132, D134, D135, D136, D138 e D142. As demais decisões já estavam determinadas pelas fontes.

| Decisão | Resultado |
|---|---|
| D127 | Aprovada — singleton lógico com `BUSINESS_DATA_ID = "business"`, encapsulado no store; sem alteração de schema. |
| D129 | Aprovada — `GET` responde `404` enquanto não houver configuração; sem seed, default ou escrita automática; o primeiro `PUT` cria. |
| D130 | Aprovada — `PUT` é substituição completa e create-or-update; responde `200` em criação e atualização. |
| D131 | Aprovada — resposta sem `id`, sem envelope e com `updatedAt` em ISO 8601. |
| D132 | Aprovada — normalizações e validações propostas, incluindo `taxId` com 11 ou 14 dígitos. |
| D134 | Aprovada — `BusinessDataStore` na Application e `PrismaBusinessDataStore` na Infrastructure; sem Repository ou Mapper desnecessário. |
| D135 | Aprovada — um único upsert, sem transação explícita, last-write-wins e sem optimistic locking. |
| D136 | Aprovada — status HTTP e error mapping propostos. |
| D138 | Aprovada — testes de integração do singleton em um único arquivo, sem concorrência, com limpeza explícita. |
| D142 | Aprovada — `DadosDoNegocioModule` e `DadosDoNegocioController`, com classes e contratos internos em inglês. |

A implementação foi executada nas tasks DADOS-DO-NEGOCIO-03 a -12, conforme o fechamento registrado na seção 10.

---

## 5. Respostas às perguntas obrigatórias

### 5.1 Toda decisão tem fonte?

Sim. D125, D126, D128, D133, D137, D139, D140 e D141 são determinadas por `PROJECT_SPEC`, `ARCHITECTURE`, schema ou decisões anteriores. D127, D129, D130, D131, D132, D134, D135, D136, D138 e D142 foram aprovadas em 2026-10-20 e passam a ser normativas.

### 5.2 Existe regra de negócio inventada?

Não. As propostas de normalização e validação foram aprovadas em 2026-10-20 e passam a ser normativas. Não foram criados campos, unicidade, limites, formatos de telefone, dígitos verificadores, seed, múltiplos registros, histórico ou logo persistido.

### 5.3 O schema precisa mudar?

Não. A auditoria e D141 concluem que o schema atual atende. Nenhuma migration será criada nesta fase.

### 5.4 Existe dependência de outra fase?

Sim:

- a Fase 8 consome a configuração para o PDF comercial (D140);
- a Fase 11 consome `GET`/`PUT` para a tela de configuração;
- nenhuma das duas é implementada aqui.

### 5.5 O que falta para implementar?

Nada bloqueia a implementação. As decisões materiais foram aprovadas em 2026-10-20 e as tasks DADOS-DO-NEGOCIO-03 a -12 foram concluídas.

---

## 6. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| `GET` `404` não previsto no frontend | tela de configuração precisa tratar ausência como estado normal | D129 aprovada; documentar o contrato para a Fase 11 |
| `PUT` tratado como parcial pelo cliente | campos opcionais omitidos são apagados | documentar substituição completa; o frontend deve enviar o objeto inteiro |
| Múltiplas linhas em `business_data` | leitura sempre usa a linha fixa e ignora outras | singleton lógico documentado; nenhum fluxo cria outras linhas |
| Testes concorrentes na tabela singleton | flakes | D138: um arquivo de integração serial e limpeza explícita |
| Validação de `taxId` bloquear valor válido para o produto | `400` inesperado | D132 aprovada; a regra espelha Clientes e não valida dígitos verificadores |
| PDF consumir Prisma diretamente na Fase 8 | violação de fronteira | D140: consumir a Application, não a Infrastructure |
| Alteração de schema por conveniência | migration não autorizada | D141 e stop condition |

---

## 7. Condição de parada

A implementação foi executada nas tasks **DADOS-DO-NEGOCIO-03 a -12**, conforme validação humana de 2026-10-20. As decisões D127, D129, D130, D131, D132, D134, D135, D136, D138 e D142 são normativas.

Continuam vedados nesta fase:

- alterar schema, migration ou seed;
- implementar PDF, frontend ou logo.

Se uma próxima alteração revelar necessidade de mudança de schema, ela deve parar e ser reportada antes de qualquer alteração.

Nenhum arquivo de código, schema, migration ou teste foi alterado na DADOS-DO-NEGOCIO-01 ou DADOS-DO-NEGOCIO-02.

---

## 8. Tasks atômicas

As tasks abaixo foram **executadas em 2026-10-20** com o workflow da skill `spec-task`.

### DADOS-DO-NEGOCIO-03 — Criar scaffold do módulo

**Goal**
Criar a estrutura mínima do módulo sem endpoints.

**Dependencies**
- DADOS-DO-NEGOCIO-02 validada em 2026-10-20.

**Scope**
- criar `modules/dados-do-negocio/` com `application/`, `infrastructure/`, `presentation/` e `dados-do-negocio.module.ts`;
- importar `AuthModule` e `PrismaModule` no módulo;
- importar `DadosDoNegocioModule` no `AppModule`;
- não criar controller, use case, store ou DTO ainda.

**Acceptance criteria**
- aplicação inicializa;
- nenhuma rota nova;
- `AuthGuard` resolve no contexto do novo módulo;
- nenhuma camada `domain/` criada.

**Verification**
- `pnpm lint`
- `pnpm test`
- `pnpm build`

**Commit sugerido**
`chore(DADOS-DO-NEGOCIO-03): scaffold business data module`

---

### DADOS-DO-NEGOCIO-04 — Definir contrato de aplicação e normalizadores

**Goal**
Materializar `BusinessDataValues`, `BusinessDataRecord`, `BusinessDataStore`, normalizadores e erros.

**Dependencies**
- DADOS-DO-NEGOCIO-03.

**Scope**
- `application/business-data-store.ts`;
- `application/business-data-normalizers.ts`;
- `application/business-data-not-found.error.ts`;
- `application/business-data-validation.error.ts`;
- testes unitários dos normalizadores e erros;
- sem Prisma, NestJS ou HTTP nos normalizadores.

**Acceptance criteria**
- campos obrigatórios não vazios após normalização;
- `email` normalizado e validado;
- `taxId` com 11 ou 14 dígitos;
- opcionais vazios viram `null`;
- nenhum tipo Prisma na Application.

**Verification**
- `pnpm lint`
- `pnpm test`
- `pnpm build`

**Commit sugerido**
`feat(DADOS-DO-NEGOCIO-04): define business data application contract`

---

### DADOS-DO-NEGOCIO-05 — Implementar store Prisma

**Goal**
Persistir e ler a configuração singleton.

**Dependencies**
- DADOS-DO-NEGOCIO-04.

**Scope**
- `infrastructure/prisma-business-data.store.ts`;
- identificador fixo `"business"`;
- `find()` e `upsert()`;
- mapeamento inline Prisma → `BusinessDataRecord`;
- testes de integração com PostgreSQL real;
- limpeza de `business_data` antes/depois.

**Acceptance criteria**
- `find()` retorna `null` quando vazio;
- `upsert()` cria e atualiza;
- `updatedAt` é gerado;
- nenhuma outra linha é criada;
- nenhum tipo Prisma vaza.

**Verification**
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `npx prisma validate`

**Commit sugerido**
`feat(DADOS-DO-NEGOCIO-05): add prisma business data store`

---

### DADOS-DO-NEGOCIO-06 — Implementar consulta

**Goal**
Expor a leitura da configuração na Application.

**Dependencies**
- DADOS-DO-NEGOCIO-05.

**Scope**
- `application/get-business-data.query.ts`;
- `execute(): Promise<BusinessDataRecord>`;
- lançar `BusinessDataNotFoundError` quando `find()` retornar `null`;
- testes unitários.

**Acceptance criteria**
- retorna o registro existente;
- lança o erro correto quando ausente;
- não acessa Prisma diretamente.

**Verification**
- `pnpm lint`
- `pnpm test`
- `pnpm build`

**Commit sugerido**
`feat(DADOS-DO-NEGOCIO-06): add business data query`

---

### DADOS-DO-NEGOCIO-07 — Implementar atualização

**Goal**
Validar, normalizar e persistir a configuração.

**Dependencies**
- DADOS-DO-NEGOCIO-05;
- DADOS-DO-NEGOCIO-04.

**Scope**
- `application/update-business-data.use-case.ts`;
- normalização e validação antes do `upsert`;
- retorno do `BusinessDataRecord`;
- testes unitários de todos os campos e erros.

**Acceptance criteria**
- campos obrigatórios inválidos → `BusinessDataValidationError`;
- opcionais vazios → `null`;
- `upsert` chamado uma vez;
- nenhum tipo Prisma na Application.

**Verification**
- `pnpm lint`
- `pnpm test`
- `pnpm build`

**Commit sugerido**
`feat(DADOS-DO-NEGOCIO-07): add update business data use case`

---

### DADOS-DO-NEGOCIO-08 — Implementar DTOs e mappers

**Goal**
Definir o contrato HTTP de entrada/saída.

**Dependencies**
- DADOS-DO-NEGOCIO-06;
- DADOS-DO-NEGOCIO-07.

**Scope**
- `presentation/dto/update-business-data.dto.ts`;
- `presentation/dto/business-data-response.dto.ts`;
- `presentation/business-data-response.mapper.ts`;
- `presentation/business-data-error-mapper.ts`;
- testes unitários.

**Acceptance criteria**
- DTO aceita apenas os quatro campos;
- `id` e `updatedAt` não são aceitos;
- `updatedAt` sai em ISO 8601;
- `id` não aparece na resposta;
- erros conhecidos mapeados para `404`/`400`.

**Verification**
- `pnpm lint`
- `pnpm test`
- `pnpm build`

**Commit sugerido**
`feat(DADOS-DO-NEGOCIO-08): add business data http contract`

---

### DADOS-DO-NEGOCIO-09 — Implementar controller e wiring

**Goal**
Expor `GET` e `PUT /dados-do-negocio`.

**Dependencies**
- DADOS-DO-NEGOCIO-08.

**Scope**
- `presentation/dados-do-negocio.controller.ts`;
- `@Controller('dados-do-negocio')` e `@UseGuards(AuthGuard)`;
- `GET` chama `GetBusinessDataQuery`;
- `PUT` chama `UpdateBusinessDataUseCase`;
- registrar controller e providers no módulo;
- sem `POST`, `PATCH` ou `DELETE`.

**Acceptance criteria**
- ambas as rotas exigem sessão;
- `PUT` passa pelo CSRF global;
- controller fino, sem regra de negócio;
- erros mapeados na Presentation.

**Verification**
- `pnpm lint`
- `pnpm test`
- `pnpm build`

**Commit sugerido**
`feat(DADOS-DO-NEGOCIO-09): expose business data endpoints`

---

### DADOS-DO-NEGOCIO-10 — Consolidar testes de integração

**Goal**
Cobrir store, query e use case contra PostgreSQL real.

**Dependencies**
- DADOS-DO-NEGOCIO-09.

**Scope**
- um único arquivo de integração para `business_data`;
- cenários de criação, leitura, atualização, ausência, normalização e validação;
- limpeza serial.

**Acceptance criteria**
- execução repetida sem flakes;
- nenhum outro arquivo de teste escreve em `business_data` em paralelo;
- cobertura dos caminhos de erro.

**Verification**
- `pnpm test`
- `pnpm lint`
- `pnpm build`

**Commit sugerido**
`test(DADOS-DO-NEGOCIO-10): cover business data integration`

---

### DADOS-DO-NEGOCIO-11 — E2E do fluxo

**Goal**
Validar o contrato HTTP completo.

**Dependencies**
- DADOS-DO-NEGOCIO-10.

**Scope**
- `backend/test/dados-do-negocio.e2e-spec.ts`;
- `401` sem sessão;
- `GET` `404` quando vazio;
- `PUT` cria e retorna `200`;
- `GET` retorna o registro;
- `PUT` atualiza;
- opcionais viram `null`;
- `400` para corpo inválido;
- `403` sem `Origin` no `PUT`;
- campos desconhecidos descartados;
- resposta sem `id`.

**Acceptance criteria**
- todos os cenários passam;
- limpeza de `business_data` antes/depois;
- nenhuma dependência de PDF ou frontend.

**Verification**
- `pnpm test:e2e`
- `pnpm lint`
- `pnpm build`

**Commit sugerido**
`test(DADOS-DO-NEGOCIO-11): add business data e2e`

---

### DADOS-DO-NEGOCIO-12 — Revisão semântica e fechamento

**Goal**
Revisar a implementação contra as fontes e fechar a fase.

**Dependencies**
- DADOS-DO-NEGOCIO-11.

**Scope**
- revisar `git diff` e `git status --short`;
- conferir D125–D142;
- rodar todos os gates;
- atualizar `docs/IMPLEMENTATION_PLAN.md` e o status desta spec;
- não alterar schema, PDF, frontend ou outros módulos.

**Acceptance criteria**
- nenhuma regra inventada;
- nenhuma alteração fora do escopo;
- todos os gates verdes;
- plano atualizado;
- fase marcada como concluída.

**Verification**
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- `npx prisma validate`

**Commit sugerido**
`docs(DADOS-DO-NEGOCIO-12): close business data phase`

---

## 9. Resultado e stop condition

A DADOS-DO-NEGOCIO-02 entrega:

- decisões D125–D142;
- decomposição em tasks atômicas 03–12;
- critérios de aceite e verificação;
- riscos e decisões aprovadas.

Não entrega código. A validação humana de 2026-10-20 aprovou D127, D129, D130, D131, D132, D134, D135, D136, D138 e D142. A implementação correspondente foi concluída nas tasks DADOS-DO-NEGOCIO-03 a -12 e está registrada na seção 10.

---

## 10. Fechamento da fase

A Fase 10 foi concluída em 2026-10-20.

**Entregue:**

- `DadosDoNegocioModule` importado no `AppModule`, sem camada `domain/`;
- `BusinessDataStore` na Application e `PrismaBusinessDataStore` na Infrastructure, com identificador singleton privado;
- `GetBusinessDataQuery` e `UpdateBusinessDataUseCase`, com normalização e validação reaplicadas na Application;
- `GET` e `PUT /dados-do-negocio` protegidos por `AuthGuard`, com `CsrfOriginGuard` global no `PUT`;
- DTOs, response mapper e error mapper na Presentation, com `updatedAt` em ISO 8601 e sem expor `id`;
- testes unitários, um arquivo de integração serial para `business_data` e E2E do contrato HTTP.

**Commits da implementação:** `ce85f66` (03), `a1cd932` (04), `ecebb33` (05), `e489aff` (06), `55ec1fd` (07), `2ac2582` (08), `d0ac450` (09), `199cc79` (10), `02d3360` (11).

**Gates finais:**

| Check | Resultado |
|---|---|
| `pnpm lint` | aprovado |
| `pnpm build` | aprovado |
| `pnpm test` | 931 testes em 78 arquivos, aprovado |
| `pnpm test:e2e` | 44 testes em 6 arquivos, aprovado |
| `npx prisma validate` | schema válido |

Nenhum schema, migration, seed, arquivo de frontend ou módulo fora do escopo foi alterado.
