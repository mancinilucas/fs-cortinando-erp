# PRISMA-03 — Enums, nulabilidade e constraints

**Status:** concluída
**Data:** 2026-10-17
**Task de origem:** `docs/development/01-prisma-foundation.md` → PRISMA-03
**Fontes de verdade:** `docs/PROJECT_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/development/01-prisma-foundation.md`
**Modelo de referência:** `docs/development/01-prisma-audit.md` (Parte 2)

Esta task **define** enums, nulabilidade, unicidades e ações referenciais. Não implementa o schema: a implementação é escopo de PRISMA-04/05. Nenhum arquivo de código ou schema foi alterado.

> **Nota de nomenclatura (2026-10-17):** os identificadores em português deste documento registram as decisões da época. Após `ARCHITECTURE.md` §1.2 exigir código em inglês, o schema foi renomeado. O mapa completo está em `docs/development/01-prisma-naming.md`; os enums atuais são `QuoteStatus`, `DiscountType` e `HistoryEventType`.

---

## 1. Enums persistidos

### 1.1 `StatusOrcamento`

```prisma
enum StatusOrcamento {
  RASCUNHO
  ENVIADO
  CONFIRMADO
  EM_PRODUCAO
  CONCLUIDO
  CANCELADO

  @@map("status_orcamento")
}
```

| Item | Definição |
|---|---|
| Valores | exatamente os 6 status persistidos de `PROJECT_SPEC` §8.1 |
| `EXPIRADO` | **ausente** — condição derivada `status == ENVIADO && agora > dataValidade` (ARCHITECTURE §4.3) |
| `InstalacaoAtrasada` | **ausente** — condição derivada (`PROJECT_SPEC` §9.3) |
| Default de coluna | **nenhum**. O domínio cria o orçamento já em `RASCUNHO` (§4.2); um default no schema mascararia violação de transição |
| Transições | não são constraint: pertencem ao Aggregate Root (ARCHITECTURE §4.2) |

### 1.2 `TipoDesconto`

```prisma
enum TipoDesconto {
  SEM_DESCONTO
  PERCENTUAL
  VALOR_FIXO

  @@map("tipo_desconto")
}
```

| Item | Definição |
|---|---|
| Valores | `PROJECT_SPEC` §2.6 |
| Default de coluna | `SEM_DESCONTO` — valor zero do discriminador; não é regra de negócio |
| Combinações com `desconto_percentual` / `desconto_valor_fixo_centavos` | validadas pelo VO `Desconto`, **não** por constraint (ver 5) |

### 1.3 `TipoEventoHistorico`

```prisma
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

  @@map("tipo_evento_historico")
}
```

| Item | Definição |
|---|---|
| Valores | exatamente os 14 eventos de `PROJECT_SPEC` §11 — nenhum inventado |
| Eventos fora da lista | não são persistidos (navegação, prévia de PDF, alteração cadastral do cliente) |
| Evolução | evento novo exige migration explícita — custo aceito (D21) |

Convenção `@@map` em snake_case para os tipos enum no PostgreSQL, coerente com D15.

---

## 2. Nulabilidade

Princípio: `NOT NULL` apenas no que é **estrutural** (identidade, FKs, ordenação, discriminadores, timestamps e campos obrigatórios do cadastro). Todo campo que pode faltar em `RASCUNHO` ou que seja opcional por `PROJECT_SPEC` é nullable. Nenhum default artificial é usado para satisfazer o banco (D3/D4).

### 2.1 `usuarios`

| Campo | Null | Motivo |
|---|---|---|
| `id` | NOT NULL | PK |
| `email` | NOT NULL | login; obrigatório em `PROJECT_SPEC` §13 |
| `senha_hash` | NOT NULL | sem credencial não há autenticação |
| `criado_em` / `atualizado_em` | NOT NULL | timestamps técnicos |

Sem campos nullable.

### 2.2 `sessoes`

| Campo | Null | Motivo |
|---|---|---|
| `id` | NOT NULL | PK |
| `token_hash` | NOT NULL | identifica a sessão |
| `usuario_id` | NOT NULL | sessão sem usuário é inválida |
| `expira_em` | NOT NULL | toda sessão expira (ARCHITECTURE §13.3) |
| `criado_em` | NOT NULL | timestamp técnico |

Sem campos nullable.

### 2.3 `clientes`

| Campo | Null | Motivo |
|---|---|---|
| `id` | NOT NULL | PK |
| `nome` | NOT NULL | obrigatório (`PROJECT_SPEC` §2.1) |
| `telefone` | NOT NULL | obrigatório (§2.1) |
| `email` | NULL | opcional (§2.1) |
| `cpf_cnpj` | NULL | opcional (§2.1); sem UNIQUE desde D52 |
| `observacoes` | NULL | opcional (§2.1) |
| `criado_em` / `atualizado_em` | NOT NULL | timestamps |
| `deleted_at` | NULL | `NULL` = ativo (soft delete, ARCHITECTURE §9.4) |
| `endereco_cep` … `endereco_uf` (7) | NULL | o endereço é opcional como bloco (§2.8); cliente pode não ter endereço |

### 2.4 `orcamentos`

| Campo | Null | Motivo |
|---|---|---|
| `id` | NOT NULL | PK |
| `numero_orcamento` | NOT NULL | gerado no primeiro salvamento (§4.2) |
| `cliente_id` | NOT NULL | orçamento sempre nasce de um cliente (§3.4) |
| `status` | NOT NULL | todo orçamento persistido tem status |
| `desconto_tipo` | NOT NULL | discriminador com zero natural |
| `data_criacao` | NOT NULL | criado no primeiro salvamento (§4.2) |
| `atualizado_em` | NOT NULL | timestamp técnico |
| `observacoes` | NULL | opcional |
| `desconto_percentual` | NULL | preenchido apenas quando `PERCENTUAL` |
| `desconto_valor_fixo_centavos` | NULL | preenchido apenas quando `VALOR_FIXO` |
| `ajuste_comercial_centavos` | NULL | `NULL` = sem ajuste; positivo ou negativo quando existir |
| `endereco_instalacao_*` (7) | NULL | `RASCUNHO` pode estar sem endereço (§5) |
| `data_primeiro_envio` | NULL | até o envio não existe |
| `data_validade` | NULL | não obrigatória em rascunho (§8.5) |
| `data_confirmacao` | NULL | até a confirmação não existe |
| `data_inicio_producao` | NULL | até a produção não existe |
| `data_instalacao_agendada` | NULL | instalação é opcional (§9) |
| `data_conclusao` | NULL | até a conclusão não existe |

### 2.5 `cortinas`

| Campo | Null | Motivo |
|---|---|---|
| `id` | NOT NULL | PK; identidade da entidade |
| `orcamento_id` | NOT NULL | pertence a exatamente um orçamento |
| `sequencia` | NOT NULL | ordenação atribuída na criação |
| `ambiente` | NULL | exigido apenas no gate de envio (§8.5) |
| `descricao` | NULL | opcional (§2.3) |
| `material` | NULL | exigido apenas no gate de envio (§6.6) |
| `largura_vao` | NULL | gate exige `> 0` no envio (§6.2) |
| `valor_borda` | NULL | gate exige `>= 0`; default `0,15` pertence ao domínio (D4) |
| `altura` | NULL | gate exige `> 0` (§6.3) |
| `fator_tecido` | NULL | gate exige `> 0`; default `3,5` pertence ao domínio (D4) |
| `observacoes` | NULL | opcional e interno |

Todos os campos exigidos pelo gate de envio são nullable: nenhum `NOT NULL` impede rascunho incompleto.

### 2.6 `componentes_financeiros`

| Campo | Null | Motivo |
|---|---|---|
| `id` | NOT NULL | PK |
| `cortina_id` | NOT NULL | componente sem cortina seria órfão |
| `nome` | NOT NULL | identificação estrutural do item; a interface sempre fornece um nome (preset ou livre) e o nome não faz parte do gate de envio |
| `quantidade` | NULL | preenchida progressivamente; gate exige `> 0` (§7.2) |
| `unidade` | NULL | informada junto do componente |
| `valor_unitario_centavos` | NULL | gate exige `> 0` (§7.2) |

### 2.7 `adicionais_gerais`

Mesma malha de `componentes_financeiros`, com `orcamento_id` no lugar de `cortina_id`: `id`, `orcamento_id` e `nome` NOT NULL; `quantidade`, `unidade` e `valor_unitario_centavos` nullable.

### 2.8 `historico_orcamento`

| Campo | Null | Motivo |
|---|---|---|
| `id` | NOT NULL | PK |
| `orcamento_id` | NOT NULL | histórico sempre pertence a um orçamento |
| `tipo_evento` | NOT NULL | registro sem tipo não é evento |
| `ocorrido_em` | NOT NULL | todo evento tem data/hora (§11) |
| `detalhes` | NULL | eventos sem mudança de valor não precisam de payload |

### 2.9 `orcamento_sequence`

| Campo | Null | Motivo |
|---|---|---|
| `ano` | NOT NULL | PK |
| `ultimo_numero` | NOT NULL | `@default(0)`; contador |

### 2.10 `dados_do_negocio`

| Campo | Null | Motivo |
|---|---|---|
| `id` | NOT NULL | PK sentinela `"principal"` (D12) |
| `nome_comercial_ou_consultor` | NOT NULL | obrigatório (`PROJECT_SPEC` §2.7) |
| `telefone` | NOT NULL | obrigatório (§2.7) |
| `email` | NULL | opcional; não renderizado se vazio |
| `cpf_cnpj` | NULL | opcional; não renderizado se vazio |
| `atualizado_em` | NOT NULL | timestamp |

---

## 3. Unicidades e PKs

| Constraint | Model | Natureza | Justificativa |
|---|---|---|---|
| `PK id` (UUID) | `usuarios`, `sessoes`, `clientes`, `orcamentos`, `cortinas`, `componentes_financeiros`, `adicionais_gerais`, `historico_orcamento`, `dados_do_negocio` | técnica | dev spec §3, ARCHITECTURE §9.3 |
| `PK ano` | `orcamento_sequence` | funcional | ARCHITECTURE §12 |
| `UNIQUE numero_orcamento` | `orcamentos` | funcional | `PROJECT_SPEC` §4.3, §14.2; proteção adicional ao contador |
| `UNIQUE email` | `usuarios` | funcional | login por e-mail |
| `UNIQUE token_hash` | `sessoes` | técnica | lookup da sessão por hash |
| ~~`UNIQUE cpf_cnpj`~~ | `clientes` | — | **Removida por D52 (2026-10-19)**; CPF/CNPJ duplicado é permitido |
| `UNIQUE (orcamento_id, sequencia)` | `cortinas` | funcional | D11 — impede duas cortinas na mesma posição de apresentação |

Notas:

- `clientes.cpf_cnpj` é nullable e **não possui UNIQUE** desde D52 (2026-10-19); duplicidade e múltiplos `NULL` são permitidos.
- `dados_do_negocio` **não** tem unicidade que force linha única (PK sentinela não impede um segundo `id`). A garantia de singleton é da aplicação (upsert em `"principal"`). Risco aceito e registrado.
- `clientes.telefone` **não** é único — não há requisito; dois clientes podem compartilhar telefone.
- `orcamentos.numero_orcamento` é imutável por domínio, não por constraint (ver 5).

---

## 4. FKs e ações referenciais

| FK | Ação | Justificativa |
|---|---|---|
| `orcamentos.cliente_id → clientes.id` | **`Restrict`** | soft delete nunca apaga cliente; orçamentos históricos permanecem associados (ARCHITECTURE §9.4, `PROJECT_SPEC` §14.2). Um `DELETE` físico de cliente é bloqueado enquanto houver orçamentos |
| `cortinas.orcamento_id → orcamentos.id` | **`Cascade`** | `Cortina` é Entity interna; exclusão física só existe em `RASCUNHO` (§8.4) |
| `componentes_financeiros.cortina_id → cortinas.id` | **`Cascade`** | Entity interna; evita órfãos |
| `adicionais_gerais.orcamento_id → orcamentos.id` | **`Cascade`** | Entity interna do aggregate |
| `historico_orcamento.orcamento_id → orcamentos.id` | **`Cascade`** | D10 — histórico de rascunho não tem valor autônomo |
| `sessoes.usuario_id → usuarios.id` | **`Cascade`** | sessão não sobrevive à conta |

Regras complementares:

- Todas as FKs são `NOT NULL`: nenhuma relação opcional, nenhum filho órfão possível.
- `onUpdate` permanece no default do Prisma: todas as PKs são UUID imutáveis, então a ação nunca é acionada.
- O contador `orcamento_sequence` **não** possui FK para `orcamentos`: o número nunca é devolvido e lacunas são permitidas (`PROJECT_SPEC` §4.3). Uma FK impediria exatamente o comportamento exigido.
- Não há N:N, tabela de junção, herança ou polimorfismo.

---

## 5. Constraints deliberadamente ausentes

Prisma não expressa `CHECK` no schema. Adicionar `CHECK`/triggers via SQL manual agora criaria restrições não previstas pela arquitetura e duplicaria invariantes em dois lugares (ARCHITECTURE §1.2; dev spec PRISMA-03: "constraints não tentam substituir invariantes que pertencem ao domínio").

Ficam no domínio/aplicação:

| Invariante | Origem |
|---|---|
| Transições de status válidas e estados terminais imutáveis | `PROJECT_SPEC` §8, §15 |
| `status` coerente com as datas do ciclo | §8, §9 |
| `EXPIRADO` e `InstalacaoAtrasada` derivados | §8.2, §9.3 |
| `desconto_tipo` coerente com `desconto_percentual` / `desconto_valor_fixo_centavos` | §7.7 |
| `0 < percentual <= 100` e `0 < valor_fixo <= subtotal` | §7.7 |
| `largura_vao > 0`, `altura > 0`, `valor_borda >= 0`, `fator_tecido > 0` | §6 |
| `quantidade > 0` e `valor_unitario > 0` em itens financeiros | §7.2 |
| `total_orcamento > 0` para envio | §7.9 |
| Endereço preenchido no gate de envio; obrigatoriedade condicional dos 4 campos | §2.8, §5 |
| `sequencia > 0` e unicidade de ordenação | D11 |
| Formato `ORÇ-AAAA-NNN` | §4.3 |
| Imutabilidade de `numero_orcamento` e `cliente_id` | §3.4, §4.3 |
| Exclusão física apenas em `RASCUNHO` | §8.4, ARCHITECTURE §9.5 |
| Normalização de `cpf_cnpj`, `cep`, `uf` na entrada | D23, D25 |
| Singleton de `dados_do_negocio` | D12 |

Consequência aceita: o banco pode armazenar estados que o domínio rejeitaria (ex.: `CONFIRMADO` sem endereço, componente com quantidade zero durante rascunho). Isso é intencional — o banco precisa aceitar o rascunho incompleto e as guards pertencem ao backend.

---

## 6. Review

### 6.1 Algum `NOT NULL` impediria rascunho incompleto?

Não. Os campos exigidos pelo gate `RASCUNHO → ENVIADO` são exatamente os nullable:

- cortina: `ambiente`, `largura_vao`, `altura`, `valor_borda`, `fator_tecido`, `material`;
- itens financeiros: `quantidade`, `unidade`, `valor_unitario_centavos`;
- orçamento: `endereco_instalacao_*`, `desconto_percentual`, `desconto_valor_fixo_centavos`, `data_validade`.

`NOT NULL` ficou restrito a identidade, FKs, `sequencia`, discriminadores (`status`, `desconto_tipo`), número, timestamps e campos obrigatórios do cadastro (`nome`, `telefone`, `email`, `senha_hash`). Nenhum deles é condição de envio.

Verificação adicional: o orçamento é persistido no primeiro `Salvar rascunho` sem exigir cortinas (`PROJECT_SPEC` §4.2), e a tabela `cortinas` só é populada quando a consultora adiciona itens — não há `NOT NULL` que exija o inverso.

### 6.2 Algum `Cascade` pode apagar histórico indevidamente?

Único ponto de atenção: `historico_orcamento.orcamento_id` (`Cascade`, D10). Ele só é acionado se o orçamento for **fisicamente** excluído, e a exclusão física é permitida apenas em `RASCUNHO` (`PROJECT_SPEC` §8.4). Em orçamentos `ENVIADO` ou posteriores, nenhum fluxo do produto apaga o registro, logo o histórico é preservado.

Salvaguardas:

- a regra "excluir apenas rascunho" é aplicação/domínio; qualquer ampliação futura exige revisão explícita de D10;
- `clientes → orcamentos` é `Restrict`, então nem um `DELETE` indevido de cliente propaga para orçamentos ou histórico;
- o histórico não é filho carregado pelo aggregate, e sim lido por `orcamento_id`.

### 6.3 Critérios de aceite da task

| Critério | Situação |
|---|---|
| `EXPIRADO` não está no enum persistido | ✅ 1.1 |
| `numeroOrcamento` é único | ✅ 3 |
| Cliente com soft delete não provoca exclusão de orçamentos | ✅ 4 (`Restrict` + soft delete é `UPDATE`) |
| Exclusão de filhos internos não deixa órfãos | ✅ 4 (FKs `NOT NULL` + `Cascade`) |
| Nulabilidade respeita rascunho incompleto | ✅ 2.5–2.7, 6.1 |
| Constraints não substituem invariantes de domínio | ✅ 5 |

### 6.4 Revisão contra PROJECT_SPEC / ARCHITECTURE

- Nenhuma tabela ou coluna nova introduzida nesta task.
- Nenhum status, evento ou regra inventada.
- `Produção`, PDF, `EXPIRADO`, `Instalação atrasada`, Desconto e Endereço continuam sem tabela própria.
- Nenhuma constraint tenta codificar transição de estado.

---

## 7. Verificação executada

```bash
npx prisma validate
# The schema at prisma/schema.prisma is valid 🚀
```

O schema permanece o scaffold de PRISMA-01/02 (nenhum model, enum ou migration). A verificação desta task é a revisão manual exigida pela development spec — não há comando mecânico que valide uma definição que ainda não foi escrita no schema.

---

## 8. Próximo passo

**PRISMA-04 — precisão numérica e campos financeiros.** Os valores já estão decididos (D5–D7) e não há pendência estrutural:

```text
largura_vao, altura          Decimal(9,3)
valor_borda, fator_tecido    Decimal(6,3)
quantidade (itens)           Decimal(12,6)
dinheiro                     Int (centavos)
desconto_percentual          Decimal(5,2)
HALF_UP                      domínio/Money, fora do schema
```

Depois, PRISMA-05 implementa o schema completo e só então PRISMA-07 cria a migration.
