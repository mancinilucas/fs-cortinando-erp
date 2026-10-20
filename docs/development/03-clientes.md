# DEVELOPMENT SPEC 03 — Clientes

**Status:** CLIENTES-01 concluída; CLIENTES-02 concluída — decisões validadas em 2026-10-19; CLIENTES-03 concluída (remoção da unicidade de `taxId`). Fase 3 decomposta em tasks atômicas; demais tasks não iniciadas.
**Objetivo:** fixar o contrato de domínio, aplicação e HTTP do módulo Clientes antes de decompor a implementação em tasks atômicas.
**Fontes de verdade:**
1. `docs/PROJECT_SPEC.md` §2.1, §2.8, §3, §11, §12.4, §14 — comportamento do produto.
2. `docs/ARCHITECTURE.md` §3.1, §3.8, §5–§7, §9.3–§9.4, §14–§15, §17, §19 — fronteiras e decisões técnicas.
3. Esta development spec — decisões da fase Clientes.
4. `docs/IMPLEMENTATION_PLAN.md` Fase 3 — sequência.

**Auditoria de origem:** `docs/development/03-clientes-audit.md`.

> **Nomenclatura:** código e schema em inglês (`Customer`, `Quote`, `name`, `phone`, `taxId`); documentação e produto em português (`Cliente`, `Orçamento`, `nome`, `telefone`, `cpfCnpj`). Ver `01-prisma-naming.md`.

---

## 0. Como ler este documento

- As decisões continuam a série iniciada em `01-prisma-audit.md` §3.1. A última decisão existente é **D45** (`02-auth.md`); portanto esta spec começa em **D46**.
- **Proposta** significa recomendação técnica fundamentada nas fontes acima.
- **Requer validação humana** significa que a decisão envolve julgamento de produto, conflito entre documentos ou alteração de schema/arquitetura e **não deve ser implementada** antes de aprovação explícita.
- **Bloqueante** significa que a task de implementação correspondente não pode ser decomposta/executada com segurança antes da decisão.
- **Aprovada** significa que o responsável pelo produto validou explicitamente a decisão em 2026-10-19.
- **Vigente** significa decisão proposta que não foi contestada nem classificada como pendente; integra o contrato da fase.
- Nenhuma decisão abaixo foi implementada. Nenhum arquivo de código, schema, migration, endpoint, repository ou teste foi alterado.

**Validação de 2026-10-19:** foram aprovadas explicitamente **D49, D51, D52 (alternativa A), D54 (alternativa A), D58, D59, D62, D63, D67, D68, D73 e D75**. As demais permanecem como contrato vigente, sem pendência aberta.

### 0.1 Resumo das decisões

| # | Tema | Situação |
|---|---|---|
| D46 | Contrato do Aggregate `Customer` | vigente |
| D47 | Obrigatoriedade, validação e normalização por camada | vigente |
| D48 | Nome | vigente |
| D49 | Telefone | **aprovada** |
| D50 | E-mail | vigente |
| D51 | CPF/CNPJ — normalização e validação | **aprovada** |
| D52 | CPF/CNPJ — unicidade | **aprovada — alternativa A** |
| D53 | Endereço — estrutura e Value Object | vigente |
| D54 | Endereço — completude vs. parcialidade | **aprovada — alternativa A** |
| D55 | Endereço — normalização de CEP/UF | vigente |
| D56 | Soft delete — comportamento | vigente |
| D57 | Restauração e edição após soft delete | vigente |
| D58 | Busca e listagem | **aprovada** |
| D59 | Paginação | **aprovada** |
| D60 | `GET /clientes/:id` | vigente |
| D61 | `POST /clientes` | vigente |
| D62 | `PATCH /clientes/:id` | **aprovada** |
| D63 | `GET /clientes/:id/orcamentos` | **aprovada** (implementação na Fase 9) |
| D64 | `CustomerRepository` e queries | vigente |
| D65 | Use cases | vigente |
| D66 | DTOs e Presentation | vigente |
| D67 | Integração com `AuthGuard` | **aprovada** |
| D68 | `ValidationPipe` e DTO aninhado | **aprovada** |
| D69 | Erros | vigente |
| D70 | Transações | vigente |
| D71 | Testes | vigente |
| D72 | Índices | vigente |
| D73 | Linguagem dos campos HTTP | **aprovada** |
| D74 | Identidade e timestamps | vigente |
| D75 | Concorrência | **aprovada** |

---

## 1. Contrato do Aggregate Cliente — D46

### 1.1 Propriedades do aggregate

O aggregate `Customer` (Cliente) é dono de:

```text
Customer
- id: UUID
- name: string                 (obrigatório)
- phone: string                (obrigatório)
- email: string | null         (opcional, normalizado)
- taxId: string | null         (opcional, somente dígitos)
- address: CustomerAddress | null  (opcional como bloco)
- notes: string | null         (opcional)
- createdAt: Date              (técnico)
- updatedAt: Date              (técnico)
- deletedAt: Date | null       (soft delete; NULL = ativo)
```

Não há outros campos. `Orçamento`, histórico, coleções de orçamentos, dados de criação de orçamento e qualquer dado comercial **não pertencem** ao aggregate.

### 1.2 Obrigatórios na criação

- `name` não vazio após normalização.
- `phone` não vazio após normalização.

Todos os demais são opcionais e podem ser `null`.

### 1.3 Propriedades alteráveis

- `name`, `phone`, `email`, `taxId`, `address`, `notes`.

Não são alteráveis:

- `id`;
- `createdAt`;
- `updatedAt` (gerenciado pela persistência);
- `deletedAt` (alterado apenas pela operação de soft delete).

### 1.4 Invariantes de domínio

Pertencem ao domínio:

1. `name` e `phone` não vazios após `trim`.
2. Campos opcionais vazios ou somente com espaços são representados como `null`.
3. Se `taxId` estiver presente, contém somente dígitos e possui 11 (CPF) ou 14 (CNPJ) dígitos (D51).
4. Se `address` estiver presente, respeita a política de completude escolhida em D54.
5. Um cliente com `deletedAt != null` está logicamente excluído e não pode ser alterado.
6. Exclusão lógica não altera nem remove orçamentos históricos.

Não pertencem ao domínio:

- unicidade de `taxId` (é constraint de persistência; ver D52);
- unicidade de `email` (não existe);
- regras de orçamento;
- regras de apresentação HTTP.

### 1.5 Cliente excluído logicamente

- `deletedAt != null` representa cliente removido.
- Não é retornado por consultas normais.
- Não pode ser editado.
- Não pode ser usado para criar novo orçamento (regra aplicada na Fase 5).
- Continua associado aos orçamentos históricos por FK.

### 1.6 Restauração

`PROJECT_SPEC.md` **não prevê** restauração de cliente. D57 recomenda **não implementar** no MVP.

---

## 2. Campos obrigatórios e opcionais — D47

### 2.1 Matriz por campo

| Campo | Requisito funcional | Validação técnica de entrada | Normalização | Invariante de domínio |
|---|---|---|---|---|
| `name` | obrigatório (`PROJECT_SPEC` §2.1, §3.1) | string; não vazia após `trim` | `trim` + NFC, preservando caixa | não vazio |
| `phone` | obrigatório (§2.1, §3.1) | string; não vazia após `trim` | `trim` | não vazio |
| `email` | opcional (§2.1, §3.1) | se presente, formato de e-mail | `trim` + NFC + `toLowerCase` | `null` se vazio |
| `taxId` | opcional (§2.1, §3.1) | se presente, 11 ou 14 dígitos | remover tudo que não é dígito | `null` se vazio; 11/14 dígitos |
| `address` | opcional como bloco (§2.1, §2.8) | se presente, respeitar D54 | normalização por campo (D55) | D54 |
| `notes` | opcional (§2.1) | string | `trim`; vazio → `null` | `null` se vazio |

### 2.2 Separação de camadas

- **Requisito funcional:** definido pelo `PROJECT_SPEC`; não é redefinido aqui.
- **Validação técnica de entrada (Presentation/DTO):** tipos, formatos, campos desconhecidos, UUID de path. Não é fonte de verdade do negócio; existe para devolver `400` cedo e com mensagem clara.
- **Normalização:** autoritativa no domínio (factory/entidade), para que qualquer chamador da aplicação obtenha o mesmo resultado. O DTO pode aplicar a mesma normalização antes da validação de formato; a operação é idempotente.
- **Invariante de domínio:** condições que a aplicação/domínio sempre garantem, independentemente do transporte.

Nenhum campo opcional será transformado em obrigatório. A única restrição condicional é o bloco de endereço, quando presente (D54) — e essa decisão está aberta.

---

## 3. Nome — D48

**Decisão proposta:**

- `trim()`.
- Normalização Unicode **NFC**.
- Preservar maiúsculas/minúsculas e acentuação.
- String vazia ou somente espaços → inválido (`400`).
- Sem tamanho mínimo além de não vazio.
- Sem tamanho máximo arbitrário; a coluna é `TEXT`.
- Sem conversão para title case, sem remoção de acentos, sem regra de “nome completo”.

**Motivo:** o `PROJECT_SPEC` exige apenas nome obrigatório; não define formato, quantidade de palavras ou limite. Criar regras de nome seria inventar comportamento. NFC é normalização técnica de representação, sem alterar o conteúdo semântico.

---

## 4. Telefone — D49

**Decisão aprovada (2026-10-19):**

- Armazenar **como informado**, aplicando apenas `trim()`.
- Não remover formatação (`(11) 99999-9999`, espaços, `+55`) no MVP.
- Não validar DDD, tipo de linha (celular/fixo), comprimento ou formato brasileiro.
- Não adicionar biblioteca.
- Invariante: não vazio após `trim`.

**Motivo:** `PROJECT_SPEC.md` §2.1 exige telefone obrigatório, mas **não** exige normalização — diferente de CPF/CNPJ, que explicitamente deve ser armazenado somente com dígitos (§2.1). A validação de formato complexa bloquearia números válidos e não tem respaldo funcional. O telefone é usado para exibição e contato, não para busca no MVP.

**Alternativa considerada e não recomendada:** remover não-dígitos e validar 10–11 dígitos. Fica registrada para uma eventual integração com WhatsApp ou busca por telefone, que estão fora do escopo (`PROJECT_SPEC` §1.4).

**Situação: aprovada em 2026-10-19.** O telefone é armazenado como informado, aplicando apenas `trim()`.

---

## 5. E-mail — D50

**Decisão proposta:**

- Opcional.
- Quando presente: `trim()` + NFC + `toLowerCase()`, reutilizando a estratégia de D34 (Auth).
- Validação de formato na Presentation/DTO (`@IsEmail` ou equivalente).
- String vazia/somente espaços → `null`.
- **Sem `UNIQUE`.** O schema atual já não possui unicidade.
- Sem verificação de existência, sem envio de e-mail, sem confirmação.
- Sem lookup por e-mail de cliente no MVP.

**Reuso da normalização:** a função `normalizeEmail` existe em `modules/auth/application/normalize-email.ts`. Recomenda-se promovê-la para `src/shared/text/normalize-email.ts` e fazer Auth e Clientes importarem a mesma função, em vez de duplicar a regra. Essa pequena movimentação deve preservar o comportamento e os testes de Auth. Se a promoção for indesejada, a alternativa é uma função local em Clientes, mas isso duplica a normalização.

**Motivo:** consistência de representação e ausência de regra de unicidade inventada. O `PROJECT_SPEC` não exige unicidade de e-mail de cliente.

---

## 6. CPF/CNPJ — D51 e D52

### 6.1 D51 — Normalização e validação (APROVADA)

- Opcional.
- Armazenar **somente dígitos** (`PROJECT_SPEC` §2.1, D23).
- Normalização: remover tudo que não for dígito (`\D`), após `trim`.
- Validação estrutural: aceitar somente 11 dígitos (CPF) ou 14 dígitos (CNPJ).
- **Não validar os dígitos verificadores no MVP.**
- Não adicionar biblioteca externa.
- String vazia/somente espaços → `null`.
- Não armazenar máscara, tipo (`CPF`/`CNPJ`) ou formatação.
- Não distinguir CPF de CNPJ em coluna própria.

**Motivo:** o `PROJECT_SPEC` exige normalização, mas não exige validação algorítmica. A validação de comprimento evita lixo estrutural sem introduzir uma regra de negócio não documentada. A validação de dígitos verificadores pode ser adicionada depois, com testes próprios, se o produto desejar.

**Diferenciação explícita das camadas:**

| Camada | Responsabilidade |
|---|---|
| Normalização | remover não-dígitos; vazio → `null` |
| Validação de formato | 11 ou 14 dígitos; aplicada no DTO e revalidada no domínio |
| Validação algorítmica | dígitos verificadores — **não implementada no MVP** |

**Situação: aprovada em 2026-10-19.** CPF/CNPJ armazenado somente com dígitos, 11 ou 14 caracteres, sem validação de dígitos verificadores no MVP.

### 6.2 D52 — Unicidade (APROVADA — ALTERNATIVA A)

**Decisão aprovada:** remover a constraint `UNIQUE` de `customers.tax_id`. **CPF/CNPJ duplicado é permitido no MVP.**

**Consequências obrigatórias na implementação:**

1. Criar migration específica com `DROP INDEX "customers_tax_id_key"` (CLIENTES-03).
2. Remover `@unique` de `Customer.taxId` no schema Prisma, mantendo `tax_id TEXT NULL`.
3. Atualizar `ARCHITECTURE.md` §23 para eliminar a referência a “único em `clientes`”.
4. Registrar a substituição de D19/D23 e das demais referências documentais por D52.
5. `POST /clientes` e `PATCH /clientes/:id` **não** retornam `409` por CPF/CNPJ repetido.
6. Nenhum código de detecção de duplicidade (`findByTaxId`, `P2002 → 409`) é criado.

**Histórico do conflito (resolvido):**

- `PROJECT_SPEC.md` §2.1 exige normalização e não menciona unicidade.
- `ARCHITECTURE.md` §23 e D19/D23 previam unicidade; essa previsão foi **superada por D52**.
- Schema e migration iniciais continham `tax_id TEXT UNIQUE`.

**Nota técnica:** o PostgreSQL permite múltiplos `NULL` em coluna nullable; a opcionalidade não é afetada.

---

## 7. Endereço do Cliente — D53, D54 e D55

### 7.1 D53 — Estrutura e Value Object

**Decisão proposta:**

```text
CustomerAddress
- postalCode   (CEP)          opcional
- street       (logradouro)   central
- number       (número)       central, textual
- complement   (complemento)  opcional
- neighborhood (bairro)       central
- city         (cidade)       central
- state        (UF)           opcional
```

- O endereço inteiro é opcional (`address: null`).
- Value Object próprio do módulo `clientes`: `CustomerAddress` em `domain/value-objects/`.
- **Não** existe Value Object compartilhado com o endereço de instalação do orçamento.
- **Não** existe tabela, FK ou relação compartilhada entre os dois endereços.
- O orçamento copia os campos campo a campo para um snapshot próprio (Fases 5/6).
- Persistência achatada nas 7 colunas nullable já existentes; o mapper reconstrói o VO.
- Nenhum campo novo (país, referência, tipo) é criado.

**Motivo:** `PROJECT_SPEC` §2.8 e `ARCHITECTURE.md` §3.1/§3.8. O `ARCHITECTURE.md` §3.1 diz explicitamente que o endereço do cliente usa a mesma estrutura, como Value Object próprio do módulo `clientes`.

### 7.2 D54 — Completude vs. parcialidade (APROVADA — ALTERNATIVA A)

**Decisão aprovada:** o endereço é opcional como bloco. Se `address != null`:

| Campo | Obrigatório quando há endereço |
|---|---|
| `street` (logradouro) | **sim** |
| `number` (número) | **sim** |
| `neighborhood` (bairro) | **sim** |
| `city` (cidade) | **sim** |
| `postalCode` (CEP) | não |
| `complement` (complemento) | não |
| `state` (UF) | não |

- Endereço parcial é rejeitado com **`400`**.
- `address: null` significa “sem endereço”; é estado válido.
- A validação ocorre no DTO (mensagem clara) e é reafirmada no Value Object de domínio.
- Não existe `isComplete` nem estado intermediário: todo endereço persistido é completo nos quatro campos centrais.
- O endereço permanece copiável integralmente para o orçamento nas fases seguintes.

**Motivo:** o `PROJECT_SPEC` §2.8 define “preenchido” pelos quatro campos centrais e o cadastro de cliente não é rascunho (diferente do orçamento em `RASCUNHO`, cuja parcialidade é explicitamente permitida). Um endereço parcial não teria utilidade funcional no MVP.

**Situação: aprovada em 2026-10-19.** Não há mais ambiguidade para `POST`/`PATCH` nem para o Value Object.

### 7.3 D55 — Normalização de CEP e UF

**Decisão proposta:**

- `street`, `number`, `neighborhood`, `city`, `complement`: `trim()`; vazio → `null`. Sem validação de formato. `number` textual (`123A`, `s/n`) — `PROJECT_SPEC` §2.8.
- `postalCode`: remover não-dígitos; se presente, exigir exatamente 8 dígitos; armazenar sem máscara (D25).
- `state`: `trim()`, `toUpperCase()`, exigir exatamente 2 letras (`^[A-Z]{2}$`) se presente; armazenar em maiúsculas. **Não** validar contra a lista oficial de UFs (não exigido pelo produto; seria uma regra adicional).
- Não há consulta a API de CEP, não há dependência externa, não há extensão PostgreSQL.
- Não há normalização de acentos ou abreviação de logradouro.

**Motivo:** D25 já fixa CEP com 8 dígitos e UF em `CHAR(2)` maiúscula; a validação de formato evita o padding/truncamento do `CHAR(2)` e mantém a integridade sem inventar regra de negócio.

---

## 8. Soft delete — D56 e D57

### 8.1 D56 — Comportamento

**Decisão proposta:**

- `DELETE /clientes/:id` representa **soft delete**: grava `deletedAt = now()`; não executa `DELETE` físico.
- Resposta `204 No Content` em sucesso.
- Cliente já excluído: `204` idempotente (a operação não altera nada).
- Cliente nunca existente: `404`.
- Consultas normais (`GET`, lista, busca, `PATCH`) filtram `deletedAt: null`.
- `GET /clientes/:id` de cliente excluído → `404` (não revela que existiu).
- `PATCH /clientes/:id` de cliente excluído → `404`.
- Orçamentos históricos continuam associados; a FK `Restrict` não é alterada; nenhum orçamento é modificado.
- Criar novo orçamento a partir de cliente excluído é bloqueado na Fase 5 (regra de Orçamento).
- O filtro de soft delete deve ser centralizado no repository/query service, não repetido em controllers.

**Por que `204` idempotente para já excluído:** evita expor o estado interno e torna a operação repetível. O `404` fica reservado para IDs que nunca existiram. O comportamento pode ser revisto se o produto preferir `404` para ambos.

**Nota:** o `DELETE` físico de um cliente com orçamentos é bloqueado pela FK `Restrict`; como o fluxo nunca executa `DELETE` físico, isso é apenas uma salvaguarda.

### 8.2 D57 — Restauração e edição após exclusão

**Decisão proposta:**

- **Não implementar restauração no MVP.** O `PROJECT_SPEC` não prevê a operação.
- **Não permitir edição de cliente excluído** (`PATCH` → `404`).
- Não existe endpoint `POST /clientes/:id/restaurar`.
- Não existe campo de motivo/data de exclusão além de `deletedAt`.
- Se o produto vier a precisar de restauração, será uma decisão funcional explícita e uma nova task.

**Motivo:** não inventar comportamento; a exclusão lógica preserva o histórico, que é o requisito real do produto.

---

## 9. Busca e listagem — D58 e D59

### 9.1 D58 — `GET /clientes`

**Decisão aprovada (2026-10-19):**

```http
GET /clientes?search=<termo>
```

- `search` é opcional.
- Sem `search` (ou vazio/somente espaços): lista todos os clientes ativos.
- Busca **parcial** por `name`: `contains`.
- **Case-insensitive** (`mode: 'insensitive'`).
- **Sensível a acentos** no MVP: `ILIKE` não remove acentos; não será usada a extensão `unaccent` sem necessidade concreta.
- Termo é `trim()`-ado.
- Soft-deleted sempre excluídos.
- Ordenação padrão: `name ASC`, com `id ASC` como desempate determinístico.
- Resposta: array de resumos com `id`, `name`, `phone`, `email`.
- Não há busca por telefone, CPF/CNPJ, e-mail ou endereço no MVP (`PROJECT_SPEC` §3.3 exige apenas por nome).

**Nome do parâmetro:** `search`. Alternativas `q` e `name` foram consideradas; `search` descreve a intenção sem acoplar ao campo.

### 9.2 D59 — Paginação

**Decisão aprovada (2026-10-19):**

- **Sem paginação no MVP.**
- A listagem retorna todos os clientes ativos que correspondem à busca.
- Justificativa: o produto é operado por uma única consultoria; não há requisito de volume que justifique paginação desde já (`IMPLEMENTATION_PLAN.md` Fase 3 não a prevê). Paginação complexa seria especulativa.
- Risco registrado: listas crescem sem limite. Se o volume real justificar, adicionar `limit`/`offset` simples sem alterar o restante do contrato.

---

## 10. Consulta individual — D60

**Decisão proposta:**

```http
GET /clientes/:id
```

- `:id` validado com `ParseUUIDPipe`; UUID malformado → `400`.
- Cliente ativo → `200` com DTO de detalhe:

```json
{
  "id": "...",
  "name": "...",
  "phone": "...",
  "email": null,
  "taxId": null,
  "address": null,
  "notes": null,
  "createdAt": "2026-10-19T12:00:00.000Z",
  "updatedAt": "2026-10-19T12:00:00.000Z"
}
```

- Cliente inexistente → `404` `{ "statusCode": 404, "message": "Customer not found" }`.
- Cliente soft-deleted → `404` (mesma resposta).
- `deletedAt` **não** aparece no DTO público; é detalhe interno.
- `address`, quando presente, é um objeto com `postalCode`, `street`, `number`, `complement`, `neighborhood`, `city`, `state`; campos opcionais ausentes são `null`. Se D54-A for aprovada, os quatro campos centrais estão sempre presentes quando `address != null`.
- Nenhum dado interno (ex.: flags de persistência) é exposto.

---

## 11. Criação — D61

**Decisão proposta:**

```http
POST /clientes
```

- Status de sucesso: `201 Created`.
- Resposta: o mesmo DTO de detalhe de `GET /clientes/:id`.
- Corpo:

```json
{
  "name": "Maria Silva",
  "phone": "(11) 99999-9999",
  "email": "maria@example.com",
  "taxId": "12345678901",
  "address": {
    "postalCode": "01310100",
    "street": "Av. Paulista",
    "number": "1000",
    "complement": "Apto 10",
    "neighborhood": "Bela Vista",
    "city": "São Paulo",
    "state": "SP"
  },
  "notes": "Cliente preferencial"
}
```

- `name` e `phone` obrigatórios; os demais opcionais.
- Campos desconhecidos são descartados pelo `whitelist` do `ValidationPipe`.
- Normalizações aplicadas antes da persistência (D47–D55).
- Campos opcionais omitidos ou vazios são persistidos como `NULL` e retornados como `null`.
- `id`, `createdAt` e `updatedAt` são gerados pelo sistema; não são aceitos no corpo.
- E-mail repetido: **permitido** (sem `UNIQUE`).
- CPF/CNPJ repetido: **permitido** (D52-A). Não há `409` para duplicidade.
- Não criar `409` para e-mail nem para CPF/CNPJ.

---

## 12. Atualização — D62

**Decisão aprovada (2026-10-19):**

```http
PATCH /clientes/:id
```

- Atualização parcial. `PUT` não será usado: o recurso tem campos opcionais e o PATCH expressa melhor “alterar apenas o enviado”.
- Campos editáveis: `name`, `phone`, `email`, `taxId`, `address`, `notes`.
- Não editáveis: `id`, `createdAt`, `updatedAt`, `deletedAt`.
- **Campo omitido:** permanece inalterado.
- **Campo enviado como `null`:**
  - opcional (`email`, `taxId`, `address`, `notes`): limpa o valor (`null`);
  - obrigatório (`name`, `phone`): `400`.
- **String vazia ou somente espaços:**
  - opcional: tratada como `null` (limpa);
  - obrigatório: `400`.
- `address`:
  - omitido: inalterado;
  - `null`: limpa o endereço inteiro;
  - objeto: **substitui o bloco inteiro** (não faz merge campo a campo). Se D54-A for aprovada, o objeto precisa estar completo.
- Normalizações e validações iguais às da criação.
- Cliente soft-deleted → `404`.
- Corpo vazio → `200` com o recurso inalterado (no-op idempotente). Não será criado erro específico para “nada a alterar”.
- Resposta: `200` com o DTO de detalhe atualizado.
- CPF/CNPJ duplicado: permitido (D52-A), como em D61.
- `updatedAt` é atualizado pela persistência.

**Semântica escolhida:** trata-se de *JSON Merge Patch* conceitual para os campos de primeiro nível, com substituição integral do bloco `address`. Não há patch parcial dentro do endereço.

---

## 13. Histórico de orçamentos do cliente — D63

**Decisão aprovada (2026-10-19):**

```http
GET /clientes/:id/orcamentos
```

- É uma **query/projeção sobre `Quote`**, filtrando `customerId`; **não** pertence ao aggregate `Cliente`.
- Não carrega o agregado `Customer` com coleção de orçamentos.
- O cliente precisa existir. Cliente soft-deleted **continua retornando o histórico** (`200`), porque os orçamentos são registros históricos.
- Cliente nunca existente → `404`.
- Ordenação: `createdAt DESC`, desempate `id`.
- Resposta mínima por orçamento, conforme `PROJECT_SPEC` §12.4: `id`, `quoteNumber`, `createdAt`, `status`, `totalCents` (valor final derivado).
- `totalCents` não é persistido; a projeção deve calculá-lo com as regras do domínio na Fase 9.
- Não cria evento de histórico de cliente; alterações cadastrais do cliente não geram eventos (`PROJECT_SPEC` §11).
- **Implementação adiada para a Fase 9** (`IMPLEMENTATION_PLAN.md` → Consultas e dashboard). Esta spec apenas fixa o contrato; a Fase 3 não implementa o endpoint.

---

## 14. Repository — D64

**Decisão proposta:**

- Interface `CustomerRepository` em `modules/clientes/domain/repositories/customer.repository.ts`.
- Ela pertence ao limite arquitetural aprovado (`ARCHITECTURE.md` §7.1) e usa apenas tipos de domínio.
- Operações mínimas:

```ts
abstract class CustomerRepository {
  abstract findById(id: string): Promise<Customer | null>;                 // ativo apenas
  abstract findByIdIncludingDeleted(id: string): Promise<Customer | null>; // necessário ao DELETE idempotente
  abstract save(customer: Customer): Promise<void>;                        // insert/update por id
}
```

- `save` faz upsert por `id`; a criação usa um `id` novo gerado pela aplicação (D74), portanto não há risco de sobrescrever um cliente existente por acidente em um fluxo de criação.
- `findById` sempre aplica `deletedAt: null`.
- `findByIdIncludingDeleted` existe somente para o comportamento idempotente do `DELETE` e para a query de histórico; não deve ser usado em leituras normais.
- Busca/listagem **não** pertencem ao repository; serão um query service (D65), conforme `ARCHITECTURE.md` §7.3, porque não precisam reconstruir o agregado.
- `PrismaCustomerRepository` e `CustomerMapper` em `infrastructure/`.
- **Não** criar `GenericRepository<T>`.
- **Não** expor `Prisma.*`, `Prisma.Decimal` ou tipos gerados para `domain/`/`application/`.
- Não criar métodos especulativos (`findByEmail`, `findByTaxId`, `existsBy...`) sem contrato que os exija. D52-A não requer detecção de duplicidade.

---

## 15. Use cases — D65

**Decisão proposta:**

Use cases explícitos para as operações com comportamento:

```text
CreateCustomerUseCase
UpdateCustomerUseCase
DeleteCustomerUseCase
```

- `Create`: normaliza, valida invariantes, gera `id`, salva, retorna o resultado.
- `Update`: carrega cliente ativo, aplica o patch, valida, salva.
- `Delete`: carrega (incluindo excluídos para idempotência), marca `deletedAt`, salva; `404` se nunca existiu.

Leituras:

```text
GetCustomerUseCase
SearchCustomersQuery
```

- `GetCustomerUseCase` carrega o aggregate ativo e aplica `deletedAt: null`; a Presentation converte o aggregate no DTO de detalhe.
- `SearchCustomersQuery` é uma projeção em `application/` com implementação Prisma em `infrastructure/` e retorna a lista/resumos.
- Listagens não reconstroem aggregates (`ARCHITECTURE.md` §7.3); a consulta individual reconstrói o aggregate para reutilizar a validação do Value Object de endereço.

Deliberadamente fora:

- `ListCustomerQuotesQuery` — pertence à Fase 9 (D63).
- Domain Services, Domain Events, Unit of Work genérico.
- Um use case por campo ou “serviço genérico de CRUD”.

**Motivo:** CRUD simples não vira DDD cerimonial; os use cases existem porque há normalização, invariantes e soft delete a coordenar. Listagens usam projeções simples; a consulta individual reutiliza o aggregate.

---

## 16. DTOs e Presentation — D66, D67 e D68

### 16.1 D66 — Estrutura

- `modules/clientes/presentation/clientes.controller.ts`, fino, recebendo `AuthGuard`.
- DTOs em `presentation/dto/`:
  - `CreateCustomerDto`;
  - `UpdateCustomerDto` (todos os campos opcionais);
  - `CustomerAddressDto` (aninhado);
  - `CustomerDetailResponseDto`;
  - `CustomerSummaryResponseDto`;
  - `SearchCustomersQueryDto`.
- DTOs HTTP separados da entidade de domínio.
- Entidades de domínio **nunca** são retornadas diretamente.
- `ValidationPipe` global já existe com `whitelist: true`.
- Erros de domínio/aplicação são mapeados na Presentation; o controller não contém regra de negócio.
- Reutilizar convenções de Auth: módulo, DTO com `class-validator`, controller fino, imports `.js`, mensagens em inglês.

### 16.2 D67 — Integração com `AuthGuard` (APROVADA)

O `AuthGuard` existe em `modules/auth/presentation/auth.guard.ts`, mas o `AuthModule` **não o exporta**. Decisão aprovada:

1. Adicionar `exports: [AuthGuard]` ao `AuthModule`.
2. Importar `AuthModule` no `ClientesModule`.
3. Aplicar `@UseGuards(AuthGuard)` no controller de Clientes.
4. **Não exportar dependências internas do Auth preventivamente** (`SessionStore`, `SessionTokenService`, `UserStore`, etc.).
5. Validar a resolução de DI por teste/E2E. Se houver falha de resolução, tratá-la como achado concreto da task, ampliando o mínimo necessário — nunca por antecipação.

> **Nota de implementação (CLIENTES-22, 2026-10-19):** o E2E revelou que o Nest resolve o `AuthGuard` no contexto do módulo importador. Para manter uma única implementação do guard, o `AuthModule` exportou, além de `AuthGuard`, apenas suas dependências diretas: `SessionStore`, `SessionTokenService` e `UserStore`. Essa é a ampliação mínima prevista no item 5, não um export preventivo.

Nenhuma rota de Clientes pode ficar sem autenticação. Os guards globais `CsrfOriginGuard` e `LoggingThrottlerGuard` continuam aplicados automaticamente.

### 16.3 D68 — `ValidationPipe` e endereço aninhado (APROVADA)

O bootstrap atual usa `new ValidationPipe({ whitelist: true })`, sem `transform: true`. Para validar um DTO aninhado (`address`) com `@ValidateNested` + `@Type(() => CustomerAddressDto)`, o `class-transformer` precisa instanciar o objeto aninhado.

Decisão aprovada:

- Alterar `main.ts` para:

```ts
new ValidationPipe({ whitelist: true, transform: true })
```

- **Não habilitar `enableImplicitConversion`.**
- Não habilitar `forbidNonWhitelisted`; campos desconhecidos continuam sendo descartados.
- Replicar exatamente a mesma configuração nos testes E2E.
- Executar a **regressão completa da suíte de Auth** após a mudança global, além dos testes de Clientes.

A alteração é de bootstrap e afeta Auth no sentido de também transformar payloads em instâncias de DTO; a suíte existente deve continuar passando sem alteração de comportamento observável.

---

## 17. Erros — D69

**Decisão proposta:**

| Situação | Resposta |
|---|---|
| Cliente não encontrado | `404` — `Customer not found` |
| Cliente soft-deleted em `GET`/`PATCH` | `404` — mesma mensagem (não revela exclusão) |
| UUID de path malformado | `400` (`ParseUUIDPipe`) |
| Payload inválido / invariante violada | `400` com mensagem de validação |
| Não autenticado | `401` (`AuthGuard`) |
| CPF/CNPJ duplicado | não existe erro; duplicidade permitida (D52-A) |
| E-mail duplicado | não existe erro; não há unicidade |
| Erro interno inesperado | `500` genérico; sem stack trace/detalhe interno |

- Erros de domínio/aplicação não estendem exceções HTTP do NestJS.
- A Presentation traduz o erro para `NotFoundException`/`BadRequestException`/`ConflictException`.
- Nenhuma constraint de `Customer` gera `P2002` após D52-A; não é necessário mapear conflito de unicidade nesta fase.
- Nenhum erro é criado para duplicidade de e-mail ou de CPF/CNPJ.

**Observação:** Auth lança exceções HTTP diretamente na Presentation; Clientes segue a mesma convenção de mapeamento, sem criar um filtro global novo.

---

## 18. Transações — D70

**Decisão proposta:**

- **Não usar `$transaction` explícita** para as operações de Cliente.
- `Create`, `Update` e `Delete` alteram uma única tabela (`customers`); cada operação é uma única instrução.
- Não há gravação de histórico de cliente (`PROJECT_SPEC` §11: alterações cadastrais não geram evento).
- Não há operação de orçamento nesta fase; quando existir, a transação será decidida na spec de Orçamento (número + orçamento + histórico).
- Não criar Unit of Work genérico.

---

## 19. Testes — D71

### 19.1 Unitários

Cobrir comportamento real, sem testar getters triviais:

- normalização de nome (`trim`, NFC, vazio);
- normalização de telefone (`trim`, vazio);
- normalização de e-mail (`trim`, NFC, lowercase, vazio → null);
- normalização/validação de CPF/CNPJ (dígitos, 11/14, vazio → null);
- normalização/validação de endereço (CEP 8 dígitos, UF 2 letras maiúsculas, campos vazios);
- invariantes do aggregate: nome/telefone obrigatórios, campos opcionais nulos, soft delete;
- política de completude de endereço (conforme D54 aprovada);
- semântica de patch no domínio, se implementada no aggregate;
- mapper `Customer ↔ Prisma` (pode ser unitário com objeto de teste).

### 19.2 Integração (PostgreSQL real)

- `PrismaCustomerRepository`:
  - criação e leitura de todos os campos;
  - persistência e reconstrução do endereço;
  - campos opcionais `null`;
  - `findById` não retorna soft-deleted;
  - `findByIdIncludingDeleted` retorna soft-deleted;
  - `save` de soft delete grava `deleted_at`;
  - duplicidade de `taxId` permitida (D52-A);
  - FK `Restrict`: cliente com orçamento não pode ser fisicamente excluído.
- Query service:
  - busca parcial, case-insensitive;
  - exclusão de soft-deleted;
  - ordenação `name ASC`;
  - lista sem `search`.
- Limpeza obrigatória: orçamentos primeiro (FK `Restrict`), depois clientes. Dados únicos por teste (UUID).

### 19.3 E2E

Reutilizar a infraestrutura de autenticação existente (`test/auth.e2e-spec.ts`): `Test.createTestingModule`, login real, cookie de sessão, `Origin` válido.

Casos mínimos:

- todas as rotas sem sessão → `401`;
- `POST /clientes` → `201` e formato da resposta;
- `GET /clientes/:id` → `200`; ID inexistente → `404`; UUID malformado → `400`;
- `GET /clientes?search=` → resultado parcial, case-insensitive, sem soft-deleted;
- `PATCH /clientes/:id` → campo omitido inalterado, `null` limpa opcional, `null` em obrigatório → `400`;
- `DELETE /clientes/:id` → `204`; repetição → `204`; `GET` posterior → `404`;
- `PATCH` em cliente excluído → `404`;
- mutação sem `Origin` → `403` (CSRF global);
- payload inválido → `400`.

Não implementar E2E de `GET /clientes/:id/orcamentos` na Fase 3; pertence à Fase 9.

### 19.4 Configuração

- Testes de integração/E2E exigem `docker compose up -d` e `DATABASE_URL` válido.
- O ambiente atual estava com o PostgreSQL parado; a primeira task de implementação deve subir o banco e validar `npx prisma migrate status`.

---

## 20. Índices — D72

**Decisão proposta:**

- Manter `customers_name_idx` (`name`). O índice `customers_tax_id_key` é removido por D52-A.
- **Não adicionar índice neste momento.**
- `ILIKE '%termo%'` (busca parcial case-insensitive) **não aproveita** o índice B-tree de `name`; o PostgreSQL fará varredura sequencial na tabela `customers`.
- O índice de `name` ainda pode ajudar em ordenação e buscas por prefixo, mas não na busca `contains` exigida.
- Não criar índice em `deleted_at`, índice parcial `name WHERE deleted_at IS NULL`, índice GIN/trigram ou extensão `unaccent` sem necessidade concreta e sem medição de volume.
- O volume esperado (uma consultoria, cadastro manual) torna a varredura aceitável no MVP.
- A remoção do `UNIQUE` elimina `customers_tax_id_key`; nenhum índice substituto é necessário.

**Limitação registrada:** busca parcial case-insensitive pode degradar com volume alto. A revisão deve ocorrer na Fase 12 (hardening) ou quando houver dados reais.

---

## 21. Decisões transversais

### 21.1 D73 — Linguagem dos campos HTTP

**Decisão aprovada (2026-10-19):** nomes de campos JSON em **inglês**, alinhados ao código e ao schema:

```text
name, phone, email, taxId, address, notes,
createdAt, updatedAt
postalCode, street, number, complement, neighborhood, city, state
```

**Motivo:** `ARCHITECTURE.md` §1.2 exige código/schema em inglês; Auth já usa `email`/`password`. Um contrato em português exigiria uma camada de tradução sem benefício funcional. A documentação de produto permanece em português; a tradução ocorre apenas na UI (Fase 11).

### 21.2 D74 — Identidade e timestamps

**Decisão proposta:**

- `id` é UUID v4 gerado pela aplicação (`crypto.randomUUID()`) antes da persistência e passado ao `save`.
- O schema usa `@default(uuid())` no Prisma, mas a migration não possui `DEFAULT` no banco; gerar na aplicação elimina a dependência de o Prisma preencher o ID e permite que o aggregate tenha identidade antes do `save`.
- `createdAt`/`updatedAt` são gerenciados pela persistência (`DEFAULT now()` e `@updatedAt`).
- `deletedAt` é definido pela aplicação no soft delete.
- Respostas expõem `createdAt`/`updatedAt` em ISO 8601; `deletedAt` não é exposto.

### 21.3 D75 — Concorrência

**Decisão aprovada (2026-10-19):**

- Sem optimistic locking, sem campo `version`.
- Atualizações são last-write-wins.
- Justificativa: MVP de usuário único; `ARCHITECTURE.md` §22 adia optimistic locking até existir edição concorrente real.
- O risco residual é aceito e registrado.

---

## 22. Revisão obrigatória da CLIENTES-02

### 22.1 Tabela de decisões abertas ou materialmente relevantes

| Decisão | Alternativas | Decisão validada | Motivo | Status |
|---|---|---|---|---|
| **D52** — unicidade de CPF/CNPJ | A) remover `UNIQUE`; B) manter `UNIQUE` e mapear duplicidade para `409` | **A — remover `UNIQUE`; duplicidade permitida** | Alinha à diretriz do produto; evita regra de negócio inventada; exige migration e atualização da arquitetura | **Validada** |
| **D54** — endereço parcial no cliente | A) tudo ou nada; B) parcial permitido com `isComplete` | **A — tudo ou nada** | Cadastro de cliente não é rascunho; todo endereço armazenado é copiável | **Validada** |
| **D49** — telefone | A) como informado; B) normalizar para dígitos e validar 10–11 | **A — como informado, com `trim`** | `PROJECT_SPEC` não exige normalização | **Validada** |
| **D51** — dígitos verificadores de CPF/CNPJ | A) não validar; B) validar algoritmo | **A — não validar** | `PROJECT_SPEC` exige apenas normalização e 11/14 dígitos | **Validada** |
| **D58** — contrato de busca | `search` vs. `q` vs. `name`; resumo com/sem e-mail | **`search`; resumo com `id`, `name`, `phone`, `email`** | Descreve a intenção; e-mail ajuda a desambiguar homônimos | **Validada** |
| **D59** — paginação | A) sem paginação; B) `limit`/`offset` desde já | **A — sem paginação** | Sem requisito de volume; paginação seria especulativa | **Validada** |
| **D62** — semântica do PATCH | A) omitido inalterado / `null` limpa; B) substituição total do recurso | **A; `address` omitido mantém, `null` remove, objeto substitui integralmente** | PATCH é parcial por definição; `PUT` não se justifica | **Validada** |
| **D63** — histórico de orçamentos | A) implementar na Fase 3; B) contrato agora, implementação na Fase 9 | **B** | Depende do domínio de Orçamento e de totais derivados | **Validada** (implementação na Fase 9) |
| **D67** — `AuthGuard` | A) exportar do `AuthModule`; B) reimplementar/prover em Clientes | **A — exportar apenas o guard; sem exports preventivos** | Reutiliza a autenticação existente, sem duplicação | **Validada** |
| **D68** — `transform: true` | A) habilitar no bootstrap; B) campos de endereço achatados | **A — `whitelist` + `transform`, sem `enableImplicitConversion`** | Endereço aninhado natural; `@ValidateNested` exige transform | **Validada** |
| **D73** — linguagem do contrato HTTP | A) inglês; B) português | **A — inglês** | Alinha código/schema/Auth; evita camada de tradução | **Validada** |
| **D57** — restauração | A) fora do MVP; B) implementar | **A — fora do MVP** | Não prevista no `PROJECT_SPEC` | Vigente |
| **D70** — transações | A) sem `$transaction`; B) transação por padrão | **A** | Operações de uma única tabela | Vigente |
| **D74** — geração de `id` | A) aplicação; B) Prisma | **A** | Identidade antes do `save`; independe do comportamento do client | Vigente |
| **D75** — concorrência | A) last-write-wins; B) optimistic locking | **A — last-write-wins** | Usuário único no MVP; `ARCHITECTURE.md` §22 adia locking | **Validada** |

### 22.2 Revisão semântica

**1. Alguma regra foi inventada?**
Não. As regras rastreiam `PROJECT_SPEC`/`ARCHITECTURE`. As duas interpretações que exigiam validação — completude do endereço (D54) e telefone como informado (D49) — foram aprovadas em 2026-10-19, assim como a remoção da unicidade de CPF/CNPJ (D52).

**2. Cliente continua Aggregate Root independente?**
Sim (D46). O aggregate contém apenas dados cadastrais e soft delete; não contém orçamentos.

**3. Orçamento permaneceu fora do aggregate?**
Sim. `Quote` é Aggregate Root separado, referenciado por `customerId`; o histórico é query (D63).

**4. Soft delete preserva histórico?**
Sim (D56). É `UPDATE` em `deleted_at`; a FK `Restrict` não é alterada; orçamentos e histórico permanecem. A restauração não é implementada (D57).

**5. Prisma permaneceu detalhe de infraestrutura?**
Sim (D64). A interface do repository usa tipos de domínio; `PrismaCustomerRepository`, `PrismaSearchCustomersQuery` e `CustomerMapper` ficam em `infrastructure/`; nenhum tipo Prisma em `domain/`/`application/`.

**6. Foi criada alguma abstração especulativa?**
Não. Não há `GenericRepository`, Unit of Work, Domain Events, Domain Service, VO compartilhado entre módulos nem métodos especulativos no repository. `GetCustomerUseCase` (reconstrução do aggregate, exigida pela CLIENTES-15) e `SearchCustomersQuery` (projeção de leitura) são justificados por `ARCHITECTURE.md` §7.1/§7.3.

**7. Campos opcionais foram transformados em obrigatórios sem suporte do `PROJECT_SPEC`?**
Não. Apenas `name` e `phone` são obrigatórios. E-mail, CPF/CNPJ, endereço e observações permanecem opcionais. A exigência condicional dos quatro campos centrais do endereço, **quando o endereço é informado**, é a decisão validada D54 e foi aplicada no DTO e no Value Object.

**8. Foi adicionada alguma unicidade não prevista?**
Não. A decisão validada D52-A **remove** a unicidade existente de `taxId`; nenhuma unicidade nova foi proposta. E-mail permanece sem `UNIQUE`.

**9. As decisões são suficientes para decompor a implementação em tasks atômicas?**
Sim. D52, D54, D67 e D68 foram validadas em 2026-10-19; as demais decisões estão vigentes. A fase foi decomposta em **CLIENTES-03 a CLIENTES-24** (§26), cobrindo normalização, VO, entidade, repository/mapper, queries, use cases, presentation, testes de integração, E2E, revisão semântica e fechamento, sem decisões improvisadas.

---

## 23. Registro de validação (2026-10-19)

### 23.1 Decisões aprovadas explicitamente

| Decisão | Validação |
|---|---|
| D49 | telefone como informado, com `trim` |
| D51 | somente dígitos; 11/14; sem dígitos verificadores |
| D52 | alternativa A — remover `UNIQUE`; duplicidade permitida; sem `409` |
| D54 | alternativa A — endereço tudo ou nada; parcial → `400` |
| D58 | parâmetro `search` |
| D59 | sem paginação |
| D62 | PATCH parcial; `address` omitido mantém, `null` remove, objeto substitui integralmente |
| D63 | histórico somente na Fase 9 |
| D67 | exportar `AuthGuard`; dependências diretas somente após falha concreta de DI (CLIENTES-22) |
| D68 | `whitelist` + `transform`; sem `enableImplicitConversion`; regressão de Auth |
| D73 | contrato HTTP em inglês |
| D75 | last-write-wins |

### 23.2 Decisões vigentes

D46, D47, D48, D50, D53, D55, D56, D57, D60, D61, D64, D65, D66, D69, D70, D71, D72 e D74 permanecem como contrato da fase, sem pendência aberta.

### 23.3 Recomendações para a implementação

- CLIENTES-03 executa a migration D52-A e atualiza `ARCHITECTURE.md` §23/D19.
- D54-A deve ser verificada no DTO e no Value Object (parcial → `400`).
- Manter o filtro de soft delete centralizado no repository/query service.
- Subir o PostgreSQL (`docker compose up -d`) antes das tasks de integração/E2E.
- Não implementar `GET /clientes/:id/orcamentos` na Fase 3.

---

## 24. Riscos

| Risco | Origem | Mitigação |
|---|---|---|
| Referência residual à unicidade de CPF/CNPJ | Conflito histórico `PROJECT_SPEC` × `ARCHITECTURE` × diretriz | D52-A validada; CLIENTES-03 remove a constraint e atualiza a documentação; teste de integração confirma duplicidade permitida |
| Endereço parcial persistido sem política | Ambiguidade do `PROJECT_SPEC` | D54-A validada; validação no DTO e no VO; teste de rejeição com `400` |
| Filtro de soft delete esquecido | Ausência de filtro automático | Centralizar no repository/query; testes de integração/E2E |
| `AuthGuard` não resolve dependências | `AuthModule` sem `exports` | Exportar/importar e verificar em E2E |
| DTO aninhado não valida | `ValidationPipe` sem `transform` | D68; espelhar configuração no E2E |
| UF inválida no `CHAR(2)` | Tipo de coluna não valida conteúdo | Validação `^[A-Z]{2}$` antes de persistir |
| Busca lenta com volume alto | `ILIKE '%x%'` sem índice utilizável | Sem índice especulativo; revisar com dados reais |
| Lista sem paginação | Escopo do MVP | Adicionar paginação simples se necessário |
| CPF/CNPJ incorreto aceito | Sem validação de dígitos verificadores | Decisão D51; pode ser endurecido depois |
| Banco indisponível nos testes | Ambiente atual | Subir Docker antes das tasks de teste |
| Edição concorrente | Sem optimistic locking | Usuário único no MVP; risco aceito |

---

## 25. Resultado e stop condition

- CLIENTES-01 e CLIENTES-02 foram concluídas sem implementação de código.
- As decisões de CLIENTES-02 foram validadas em 2026-10-19.
- A fase foi decomposta em tasks atômicas (§26).
- **CLIENTES-03 a CLIENTES-22 foram executadas em 2026-10-19**, cobrindo a migration D52-A, normalização, Value Object de endereço, aggregate, repository/mapper, query service, use cases, DTOs, mapeamento de erros, controller, testes de integração e E2E.
- **CLIENTES-23 (revisão semântica) aprovou a fase sem achados bloqueantes**, registrando ressalvas não bloqueantes.
- **CLIENTES-24 reparou os achados**: PATCH vazio não reescreve a linha, curingas de `LIKE` são escapados na busca, cobertura E2E/integração complementada (PATCH nulo em campo obrigatório, PATCH em cliente excluído, CSRF, busca case-insensitive, FK `Restrict` e associação histórica). Esta spec e `IMPLEMENTATION_PLAN.md` foram atualizados.
- **Fase 3 concluída em 2026-10-19.**

**Próximo passo:** iniciar a Fase 4 — Núcleo de Orçamento, após autorização.

---

## 26. Tasks de implementação

### CLIENTES-03 — Corrigir unicidade de CPF/CNPJ

**Goal**  
Alinhar o schema e a arquitetura com a decisão D52-A: `taxId` não é único no MVP.

**Dependencies**
- CLIENTES-02 concluída
- D52-A aprovada

**Scope**
- remover `@unique` de `Customer.taxId`;
- criar migration específica para remover a constraint/índice único;
- atualizar `ARCHITECTURE.md` e registros de decisão que ainda afirmem unicidade;
- não alterar outros campos do model.

**Acceptance criteria**
- `taxId` continua opcional;
- valores duplicados são permitidos;
- nenhum `409` é associado a CPF/CNPJ duplicado;
- schema e documentação deixam de se contradizer.

**Verification**
- `pnpm exec prisma validate`
- aplicar migration com PostgreSQL ativo;
- confirmar ausência de `customers_tax_id_key`;
- `pnpm lint`
- `pnpm test`
- `pnpm build`

**Review**
- nenhuma outra constraint removida;
- nenhuma regra funcional nova;
- migration reproduzível.

**Commit sugerido**
`fix(CLIENTES-03): remove customer tax id uniqueness`

---

### CLIENTES-04 — Preparar integração do módulo Clientes

**Goal**  
Criar a estrutura mínima do módulo sem implementar CRUD ainda.

**Dependencies**
- CLIENTES-03

**Scope**
Criar:

```text
src/modules/clientes/
├── domain/
├── application/
├── infrastructure/
├── presentation/
└── clientes.module.ts
```

- importar `ClientesModule` no `AppModule`;
- exportar `AuthGuard` pelo `AuthModule`;
- importar `AuthModule` no `ClientesModule`.

**Acceptance criteria**
- aplicação inicializa;
- `AuthGuard` resolve suas dependências normalmente;
- nenhuma rota de Cliente criada ainda;
- providers internos de Auth não são exportados preventivamente.

**Verification**
- `pnpm lint`
- `pnpm test`
- `pnpm build`

**Review**
- nenhum código de domínio antecipado;
- nenhuma duplicação de AuthGuard;
- arquitetura modular preservada.

**Commit sugerido**
`chore(CLIENTES-04): scaffold customers module`

---

### CLIENTES-05 — Habilitar DTOs aninhados no ValidationPipe

**Goal**  
Preparar o bootstrap para validação correta de `CustomerAddressDto`.

**Dependencies**
- D68 aprovada

**Scope**
Alterar a configuração global para:

```ts
new ValidationPipe({
  whitelist: true,
  transform: true,
})
```

- replicar configuração nos E2E existentes;
- não habilitar `enableImplicitConversion`;
- não habilitar `forbidNonWhitelisted`.

**Acceptance criteria**
- Auth continua funcionando;
- DTOs aninhados podem ser instanciados por `class-transformer`;
- comportamento de whitelist permanece igual.

**Verification**
- suíte completa de Auth;
- `pnpm lint`
- `pnpm test`
- `pnpm build`

**Review**
- nenhuma regressão global de validação;
- nenhuma conversão implícita introduzida.

**Commit sugerido**
`chore(CLIENTES-05): enable nested dto transformation`

---

### CLIENTES-06 — Promover normalização compartilhada de e-mail

**Goal**  
Evitar duplicação entre Auth e Clientes.

**Dependencies**
- CLIENTES-04

**Scope**
- mover `normalizeEmail` para local compartilhado apropriado;
- atualizar Auth para utilizar a nova localização;
- preservar comportamento D34.

**Acceptance criteria**
- Auth e Clientes poderão reutilizar a mesma função;
- comportamento permanece:
  - `trim`;
  - NFC;
  - lowercase;
- testes existentes de Auth continuam passando.

**Verification**
- testes do normalizador;
- regressão Auth;
- `pnpm lint`
- `pnpm build`

**Review**
- nenhuma mudança semântica no login;
- `shared/` não vira dumping ground.

**Commit sugerido**
`refactor(CLIENTES-06): share email normalization`

---

### CLIENTES-07 — Implementar normalizadores de Cliente

**Goal**  
Centralizar transformações técnicas definidas em D47–D55.

**Dependencies**
- CLIENTES-06

**Scope**
Implementar funções simples para:

- nome: `trim + NFC`;
- telefone: `trim`;
- e-mail: normalizador compartilhado;
- CPF/CNPJ: somente dígitos;
- CEP: somente dígitos;
- UF: `trim + uppercase`;
- strings opcionais vazias → `null`.

**Acceptance criteria**
- funções determinísticas e idempotentes;
- sem acesso a HTTP/Prisma;
- sem validação de dígitos verificadores de CPF/CNPJ.

**Tests**
Cobrir entradas:
- vazias;
- formatadas;
- com espaços;
- caixa diferente;
- CPF/CNPJ mascarado;
- CEP mascarado.

**Verification**
- unit tests;
- `pnpm lint`
- `pnpm build`

**Commit sugerido**
`feat(CLIENTES-07): add customer normalization utilities`

---

### CLIENTES-08 — Implementar CustomerAddress Value Object

**Goal**  
Representar endereço do Cliente conforme D53–D55 e D54-A.

**Dependencies**
- CLIENTES-07

**Scope**
Criar `CustomerAddress`.

Regras:
- endereço é opcional como bloco;
- quando presente, obrigatórios:
  - `street`
  - `number`
  - `neighborhood`
  - `city`
- opcionais:
  - `postalCode`
  - `complement`
  - `state`
- CEP presente: exatamente 8 dígitos;
- UF presente: exatamente 2 letras maiúsculas;
- nenhuma validação contra lista oficial de UFs.

**Acceptance criteria**
- endereço parcial inválido não pode ser criado;
- `null` representa ausência completa;
- VO não depende de Nest ou Prisma.

**Tests**
- endereço completo válido;
- mínimos obrigatórios válidos;
- ausência total;
- cada campo central ausente;
- CEP inválido;
- UF inválida;
- normalizações.

**Verification**
- unit tests;
- `pnpm lint`
- `pnpm build`

**Commit sugerido**
`feat(CLIENTES-08): add customer address value object`

---

### CLIENTES-09 — Implementar Customer Aggregate

**Goal**  
Criar o Aggregate Root Cliente com invariantes aprovadas.

**Dependencies**
- CLIENTES-07
- CLIENTES-08

**Scope**
Propriedades:

```text
id
name
phone
email?
taxId?
address?
notes?
createdAt
updatedAt
deletedAt?
```

Comportamentos mínimos:
- criar;
- atualizar dados editáveis;
- soft delete;
- impedir alteração se excluído.

**Acceptance criteria**
- `name` e `phone` nunca vazios;
- opcionais vazios tornam-se `null`;
- CPF/CNPJ, se presente, possui 11 ou 14 dígitos;
- endereço respeita VO;
- Cliente excluído não pode ser atualizado;
- sem restore.

**Tests**
- criação válida;
- nome vazio;
- telefone vazio;
- opcionais;
- update parcial;
- soft delete;
- update após soft delete rejeitado.

**Verification**
- unit tests;
- `pnpm lint`
- `pnpm build`

**Review**
- nenhuma regra de Orçamento no aggregate;
- nenhum Prisma/Nest no domínio.

**Commit sugerido**
`feat(CLIENTES-09): implement customer aggregate`

---

### CLIENTES-10 — Definir CustomerRepository

**Goal**  
Criar a porta mínima de persistência do Aggregate Root.

**Dependencies**
- CLIENTES-09

**Scope**
Definir apenas operações necessárias aos use cases.

Candidatas:

```text
save(customer)
findActiveById(id)
```

Adicionar outro método somente se já houver consumidor concreto.

**Acceptance criteria**
- interface/porta na camada correta;
- nenhum `GenericRepository<T>`;
- nenhum tipo Prisma exposto.

**Verification**
- `pnpm lint`
- `pnpm test`
- `pnpm build`

**Review**
- nenhum método especulativo;
- queries de listagem não precisam ser forçadas para o repository do aggregate.

**Commit sugerido**
`feat(CLIENTES-10): define customer repository contract`

---

### CLIENTES-11 — Implementar CustomerMapper

**Goal**  
Mapear persistência Prisma ↔ domínio sem vazamento do ORM.

**Dependencies**
- CLIENTES-09

**Scope**
Implementar:
- `toDomain`;
- `toPersistence` ou equivalente necessário.

**Acceptance criteria**
- reconstrói `CustomerAddress`;
- preserva `null`;
- datas corretas;
- nenhum tipo Prisma sai da infraestrutura.

**Tests**
- round-trip com endereço;
- sem endereço;
- campos opcionais;
- soft deleted.

**Verification**
- unit tests;
- `pnpm lint`
- `pnpm build`

**Commit sugerido**
`feat(CLIENTES-11): add customer persistence mapper`

---

### CLIENTES-12 — Implementar PrismaCustomerRepository

**Goal**  
Persistir e recuperar clientes ativos.

**Dependencies**
- CLIENTES-10
- CLIENTES-11

**Scope**
- `save`;
- `findActiveById`;
- filtro central `deletedAt: null`.

**Acceptance criteria**
- cliente excluído não retorna em lookup normal;
- create/update persistem corretamente;
- endereço achatado é mapeado corretamente;
- sem transação explícita desnecessária.

**Tests**
- integração com PostgreSQL;
- create;
- update;
- lookup ativo;
- lookup de soft-deleted;
- endereço.

**Verification**
- PostgreSQL ativo;
- integration tests;
- `pnpm lint`
- `pnpm build`

**Commit sugerido**
`feat(CLIENTES-12): implement customer Prisma repository`

---

### CLIENTES-13 — Implementar query service de Clientes

**Goal**  
Implementar listagem e busca sem reconstruir aggregates.

**Dependencies**
- CLIENTES-04

**Scope**
`GET /clientes` precisará de projeção com:

- filtro `deletedAt: null`;
- `search` opcional;
- busca `contains` case-insensitive em `name`;
- ordenação:
  - `name ASC`
  - `id ASC`
- resposta:
  - `id`
  - `name`
  - `phone`
  - `email`

**Acceptance criteria**
- soft-deleted nunca aparecem;
- busca vazia equivale a listagem completa;
- sem paginação;
- sem busca por outros campos.

**Tests**
- sem search;
- busca parcial;
- case-insensitive;
- acento permanece sensível;
- soft-deleted excluídos;
- ordem determinística.

**Verification**
- integration tests;
- `pnpm lint`
- `pnpm build`

**Commit sugerido**
`feat(CLIENTES-13): add customer list query`

---

### CLIENTES-14 — Implementar CreateCustomerUseCase

**Goal**  
Criar Cliente respeitando normalizações e invariantes.

**Dependencies**
- CLIENTES-09
- CLIENTES-12

**Scope**
- receber input de aplicação;
- criar aggregate;
- persistir;
- retornar resultado simples.

**Acceptance criteria**
- name/phone obrigatórios;
- email/taxId/address/notes opcionais;
- CPF/CNPJ duplicado permitido;
- sem `$transaction` explícita;
- sem HTTP no use case.

**Tests**
- criação completa;
- mínima;
- CPF/CNPJ repetido;
- entrada inválida rejeitada pelo domínio.

**Verification**
- unit/integration;
- `pnpm lint`
- `pnpm build`

**Commit sugerido**
`feat(CLIENTES-14): implement create customer use case`

---

### CLIENTES-15 — Implementar GetCustomerUseCase

**Goal**  
Obter Cliente ativo por ID.

**Dependencies**
- CLIENTES-12

**Scope**
- lookup ativo;
- erro de aplicação quando não encontrado.

**Acceptance criteria**
- ativo retorna;
- inexistente e soft-deleted seguem comportamento indistinguível;
- nenhum HTTP exception na aplicação.

**Verification**
- tests;
- `pnpm lint`
- `pnpm build`

**Commit sugerido**
`feat(CLIENTES-15): implement get customer use case`

---

### CLIENTES-16 — Implementar UpdateCustomerUseCase

**Goal**  
Atualizar parcialmente Cliente ativo.

**Dependencies**
- CLIENTES-09
- CLIENTES-12

**Semântica**
- campo omitido → mantém;
- `null` em opcional → limpa;
- `address` omitido → mantém;
- `address: null` → remove;
- `address: {...}` → substitui bloco inteiro.

**Acceptance criteria**
- invariantes revalidadas;
- soft-deleted não atualiza;
- CPF/CNPJ duplicado permitido;
- timestamps atualizados pela persistência.

**Tests**
- patch de campo simples;
- limpar opcionais;
- manter omitidos;
- remover endereço;
- substituir endereço;
- endereço parcial rejeitado;
- soft-deleted rejeitado.

**Verification**
- tests;
- `pnpm lint`
- `pnpm build`

**Commit sugerido**
`feat(CLIENTES-16): implement update customer use case`

---

### CLIENTES-17 — Implementar DeleteCustomerUseCase

**Goal**  
Executar soft delete idempotente conforme D56.

**Dependencies**
- CLIENTES-09
- CLIENTES-12

**Scope**
- ativo → marca `deletedAt`;
- já excluído → sucesso idempotente;
- nunca existente → erro de not found.

**Observação**
Pode exigir lookup específico que diferencie inexistente de já excluído. Adicione operação ao repository apenas se necessário para este use case.

**Acceptance criteria**
- nunca executa `DELETE` físico;
- histórico/FKs intocados;
- nenhuma restauração.

**Tests**
- soft delete;
- segunda chamada;
- inexistente.

**Verification**
- integration tests;
- `pnpm lint`
- `pnpm build`

**Commit sugerido**
`feat(CLIENTES-17): implement customer soft delete`

---

### CLIENTES-18 — Implementar DTOs HTTP de Clientes

**Goal**  
Definir contratos de entrada e saída sem expor entidades.

**Dependencies**
- CLIENTES-05
- CLIENTES-08

**Scope**
Criar:
- `CustomerAddressDto`;
- `CreateCustomerDto`;
- `UpdateCustomerDto`;
- DTO/resposta de detalhe;
- DTO/resposta de resumo quando necessário.

**Acceptance criteria**
- `class-validator`;
- `@ValidateNested`;
- `@Type`;
- campos JSON em inglês;
- UUID/timestamps não aceitos nos DTOs de criação;
- `deletedAt` não exposto.

**Verification**
- DTO tests quando úteis;
- `pnpm lint`
- `pnpm build`

**Commit sugerido**
`feat(CLIENTES-18): add customer HTTP DTOs`

---

### CLIENTES-19 — Implementar mapeamento de erros de Clientes

**Goal**  
Traduzir erros de aplicação/domínio para HTTP apenas na Presentation.

**Dependencies**
- CLIENTES-15
- CLIENTES-16
- CLIENTES-17

**Escopo mínimo**
- cliente não encontrado → `404`;
- payload inválido → pipeline padrão `400`;
- não criar `409` para e-mail ou CPF/CNPJ.

**Acceptance criteria**
- Prisma errors não vazam;
- domínio não importa Nest;
- mensagens consistentes.

**Verification**
- tests;
- `pnpm lint`
- `pnpm build`

**Commit sugerido**
`feat(CLIENTES-19): map customer errors to HTTP`

---

### CLIENTES-20 — Implementar ClientesController

**Goal**  
Expor CRUD e busca de Clientes com controller fino.

**Dependencies**
- CLIENTES-13 a CLIENTES-19
- D67

**Endpoints**

```http
GET    /clientes
POST   /clientes
GET    /clientes/:id
PATCH  /clientes/:id
DELETE /clientes/:id
```

**Não implementar**
`GET /clientes/:id/orcamentos` nesta fase.

**Acceptance criteria**
- todas as rotas protegidas por `AuthGuard`;
- controller apenas valida/encaminha/mapeia;
- status:
  - POST → `201`
  - GET → `200`
  - PATCH → `200`
  - DELETE → `204`
- DELETE já excluído → `204`;
- ID inválido → `400`.

**Verification**
- controller tests;
- `pnpm lint`
- `pnpm build`

**Commit sugerido**
`feat(CLIENTES-20): expose customer REST endpoints`

---

### CLIENTES-21 — Testes de integração do módulo Clientes

**Goal**  
Validar domínio de persistência e casos de uso com PostgreSQL real.

**Dependencies**
- CLIENTES-12 a CLIENTES-20

**Cobertura mínima**
- criação;
- persistência de endereço;
- lookup;
- update;
- limpeza de opcionais;
- soft delete;
- filtro de excluídos;
- busca;
- CPF/CNPJ duplicado;
- ordenação.

**Acceptance criteria**
- testes independentes de ordem;
- dados limpos/isolados;
- nenhuma dependência de credencial real.

**Verification**
- `pnpm test`
- `pnpm lint`
- `pnpm build`

**Commit sugerido**
`test(CLIENTES-21): add customer integration coverage`

---

### CLIENTES-22 — E2E do fluxo de Clientes

**Goal**  
Validar HTTP + Auth + Clientes + Prisma.

**Dependencies**
- CLIENTES-21

**Fluxos obrigatórios**

```text
login
→ POST /clientes
→ GET /clientes/:id
→ GET /clientes?search=
→ PATCH /clientes/:id
→ DELETE /clientes/:id
→ GET após delete → 404
```

Também:
- acesso sem autenticação → `401`;
- endereço parcial → `400`;
- UUID inválido → `400`;
- CPF/CNPJ repetido permitido;
- DELETE repetido → `204`.

**Verification**
- E2E completo;
- regressão Auth;
- `pnpm lint`
- `pnpm test`
- `pnpm build`

**Commit sugerido**
`test(CLIENTES-22): cover customer e2e flow`

---

### CLIENTES-23 — Revisão semântica da fase

**Goal**  
Revisar a implementação completa sem alterar código inicialmente.

**Review against**
- `PROJECT_SPEC.md`;
- `ARCHITECTURE.md`;
- `03-clientes.md`;
- `AGENTS.md`.

**Checklist**
- [ ] Customer continua Aggregate Root independente;
- [ ] Quote não foi incorporado ao aggregate;
- [ ] nenhum endpoint de histórico foi antecipado;
- [ ] `taxId` não possui unicidade;
- [ ] e-mail não possui unicidade;
- [ ] endereço segue regra tudo-ou-nada;
- [ ] soft delete preserva histórico;
- [ ] consultas normais excluem soft-deleted;
- [ ] Cliente excluído não pode ser editado;
- [ ] não existe restore;
- [ ] controllers são finos;
- [ ] Prisma restrito à infraestrutura;
- [ ] nenhum `GenericRepository`;
- [ ] sem paginação especulativa;
- [ ] nenhuma transação desnecessária;
- [ ] AuthGuard protege todas as rotas;
- [ ] nenhum arquivo fora do escopo foi alterado.

**Deliverable**
Relatório com achados, severidade e reparos necessários.

**Commit**
Nenhum, salvo documentação.

---

### CLIENTES-24 — Repair, re-verificação e fechamento

**Goal**  
Corrigir achados da CLIENTES-23 e encerrar a Fase 3.

**Dependencies**
- CLIENTES-23

**Flow**

```text
REPAIR
→ UNIT/INTEGRATION TESTS
→ E2E
→ LINT
→ BUILD
→ SEMANTIC REVIEW
→ DONE
```

**Acceptance criteria**
- nenhum achado bloqueante;
- todos os testes passam;
- Auth sem regressão;
- migration consistente;
- documentação atualizada;
- `IMPLEMENTATION_PLAN.md` marca Fase 3 como concluída.

**Commit sugerido**
`docs(CLIENTES-24): close customers stage`