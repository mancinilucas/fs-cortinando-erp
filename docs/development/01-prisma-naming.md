# Nomenclatura de código — migração para inglês

**Status:** concluída
**Data:** 2026-10-17
**Motivo:** `docs/ARCHITECTURE.md` §1.2 passou a exigir que todo o código-fonte — incluindo schema Prisma, identificadores, comentários, testes e mensagens de commit — seja escrito em inglês.
**Escopo:** renomear o schema Prisma implementado em PRISMA-05. Nenhuma migration existia; o banco ainda não havia sido criado. Nenhuma regra de negócio foi alterada.

A documentação de produto e de desenvolvimento permanece em português. Este documento registra o mapa entre a nomenclatura aprovada nas tasks anteriores (português) e a nomenclatura atual do código (inglês), substituindo os **identificadores** da decisão D15. A convenção de `PascalCase` para models, `camelCase` para campos e `snake_case` plural para tabelas permanece.

---

## 1. Models e tabelas

| PRISMA-02/05 (português) | Atual (inglês) | Tabela |
|---|---|---|
| `Usuario` | `User` | `users` |
| `Sessao` | `Session` | `sessions` |
| `Cliente` | `Customer` | `customers` |
| `Orcamento` | `Quote` | `quotes` |
| `Cortina` | `Curtain` | `curtains` |
| `ComponenteFinanceiro` | `FinancialComponent` | `financial_components` |
| `AdicionalGeral` | `GeneralAddOn` | `general_add_ons` |
| `HistoricoOrcamento` | `QuoteHistory` | `quote_history` |
| `OrcamentoSequence` | `QuoteSequence` | `quote_sequence` |
| `DadosDoNegocio` | `BusinessData` | `business_data` |

Escolhas semânticas: `Customer` (evita ambiguidade de “client” no código), `Quote` (orçamento comercial), `GeneralAddOn` (adicional geral) e `BusinessData` (dados do negócio).

## 2. Enums

| Anterior | Atual | Tabela |
|---|---|---|
| `StatusOrcamento` | `QuoteStatus` | `quote_status` |
| `TipoDesconto` | `DiscountType` | `discount_type` |
| `TipoEventoHistorico` | `HistoryEventType` | `history_event_type` |

| Anterior | Atual |
|---|---|
| `RASCUNHO` | `DRAFT` |
| `ENVIADO` | `SENT` |
| `CONFIRMADO` | `CONFIRMED` |
| `EM_PRODUCAO` | `IN_PRODUCTION` |
| `CONCLUIDO` | `COMPLETED` |
| `CANCELADO` | `CANCELLED` |
| `SEM_DESCONTO` | `NO_DISCOUNT` |
| `PERCENTUAL` | `PERCENTAGE` |
| `VALOR_FIXO` | `FIXED_AMOUNT` |
| `ORCAMENTO_CRIADO` | `QUOTE_CREATED` |
| `ORCAMENTO_ENVIADO` | `QUOTE_SENT` |
| `ORCAMENTO_EDITADO` | `QUOTE_EDITED` |
| `ORCAMENTO_CONFIRMADO` | `QUOTE_CONFIRMED` |
| `ORCAMENTO_REABERTO` | `QUOTE_REOPENED` |
| `ORCAMENTO_RENOVADO` | `QUOTE_RENEWED` |
| `ORCAMENTO_CANCELADO` | `QUOTE_CANCELLED` |
| `PRODUCAO_INICIADA` | `PRODUCTION_STARTED` |
| `INSTALACAO_AGENDADA` | `INSTALLATION_SCHEDULED` |
| `INSTALACAO_ALTERADA` | `INSTALLATION_CHANGED` |
| `INSTALACAO_REMOVIDA` | `INSTALLATION_REMOVED` |
| `SERVICO_CONCLUIDO` | `SERVICE_COMPLETED` |
| `PDF_COMERCIAL_GERADO` | `COMMERCIAL_PDF_GENERATED` |
| `ORDEM_PRODUCAO_GERADA` | `PRODUCTION_ORDER_GENERATED` |

## 3. Campos por model

### `users`

| Anterior | Atual |
|---|---|
| `senhaHash` / `senha_hash` | `passwordHash` / `password_hash` |
| `criadoEm` / `criado_em` | `createdAt` / `created_at` |
| `atualizadoEm` / `atualizado_em` | `updatedAt` / `updated_at` |
| `sessoes` (relação) | `sessions` |

### `sessions`

| Anterior | Atual |
|---|---|
| `tokenHash` / `token_hash` | sem alteração |
| `usuarioId` / `usuario_id` | `userId` / `user_id` |
| `expiraEm` / `expira_em` | `expiresAt` / `expires_at` |
| `criadoEm` / `criado_em` | `createdAt` / `created_at` |

### `customers`

| Anterior | Atual |
|---|---|
| `nome` | `name` |
| `telefone` | `phone` |
| `cpfCnpj` / `cpf_cnpj` | `taxId` / `tax_id` |
| `enderecoCep` / `endereco_cep` | `addressPostalCode` / `address_postal_code` |
| `enderecoLogradouro` / `endereco_logradouro` | `addressStreet` / `address_street` |
| `enderecoNumero` / `endereco_numero` | `addressNumber` / `address_number` |
| `enderecoComplemento` / `endereco_complemento` | `addressComplement` / `address_complement` |
| `enderecoBairro` / `endereco_bairro` | `addressNeighborhood` / `address_neighborhood` |
| `enderecoCidade` / `endereco_cidade` | `addressCity` / `address_city` |
| `enderecoUf` / `endereco_uf` | `addressState` / `address_state` |
| `observacoes` | `notes` |
| `criadoEm` / `criado_em` | `createdAt` / `created_at` |
| `atualizadoEm` / `atualizado_em` | `updatedAt` / `updated_at` |
| `deletedAt` / `deleted_at` | sem alteração |
| `orcamentos` (relação) | `quotes` |

### `quotes`

| Anterior | Atual |
|---|---|
| `numeroOrcamento` / `numero_orcamento` | `quoteNumber` / `quote_number` |
| `clienteId` / `cliente_id` | `customerId` / `customer_id` |
| `observacoes` | `notes` |
| `descontoTipo` / `desconto_tipo` | `discountType` / `discount_type` |
| `descontoPercentual` / `desconto_percentual` | `discountPercentage` / `discount_percentage` |
| `descontoValorFixoCentavos` / `desconto_valor_fixo_centavos` | `discountFixedAmountCents` / `discount_fixed_amount_cents` |
| `ajusteComercialCentavos` / `ajuste_comercial_centavos` | `commercialAdjustmentCents` / `commercial_adjustment_cents` |
| `enderecoInstalacaoCep` / `endereco_instalacao_cep` | `installationAddressPostalCode` / `installation_address_postal_code` |
| `enderecoInstalacaoLogradouro` / `endereco_instalacao_logradouro` | `installationAddressStreet` / `installation_address_street` |
| `enderecoInstalacaoNumero` / `endereco_instalacao_numero` | `installationAddressNumber` / `installation_address_number` |
| `enderecoInstalacaoComplemento` / `endereco_instalacao_complemento` | `installationAddressComplement` / `installation_address_complement` |
| `enderecoInstalacaoBairro` / `endereco_instalacao_bairro` | `installationAddressNeighborhood` / `installation_address_neighborhood` |
| `enderecoInstalacaoCidade` / `endereco_instalacao_cidade` | `installationAddressCity` / `installation_address_city` |
| `enderecoInstalacaoUf` / `endereco_instalacao_uf` | `installationAddressState` / `installation_address_state` |
| `dataCriacao` / `data_criacao` | `createdAt` / `created_at` |
| `atualizadoEm` / `atualizado_em` | `updatedAt` / `updated_at` |
| `dataPrimeiroEnvio` / `data_primeiro_envio` | `firstSentAt` / `first_sent_at` |
| `dataValidade` / `data_validade` | `validUntil` / `valid_until` |
| `dataConfirmacao` / `data_confirmacao` | `confirmedAt` / `confirmed_at` |
| `dataInicioProducao` / `data_inicio_producao` | `productionStartedAt` / `production_started_at` |
| `dataInstalacaoAgendada` / `data_instalacao_agendada` | `scheduledInstallationAt` / `scheduled_installation_at` |
| `dataConclusao` / `data_conclusao` | `completedAt` / `completed_at` |
| `cortinas`, `adicionaisGerais`, `historicos` (relações) | `curtains`, `generalAddOns`, `history` |

### `curtains`

| Anterior | Atual |
|---|---|
| `orcamentoId` / `orcamento_id` | `quoteId` / `quote_id` |
| `sequencia` | `sequence` |
| `ambiente` | `room` |
| `descricao` | `description` |
| `larguraVao` / `largura_vao` | `openingWidth` / `opening_width` |
| `valorBorda` / `valor_borda` | `borderValue` / `border_value` |
| `altura` | `height` |
| `fatorTecido` / `fator_tecido` | `fabricFactor` / `fabric_factor` |
| `observacoes` | `notes` |
| `componentes` (relação) | `components` |

### `financial_components`

| Anterior | Atual |
|---|---|
| `cortinaId` / `cortina_id` | `curtainId` / `curtain_id` |
| `nome` | `name` |
| `quantidade` | `quantity` |
| `unidade` | `unit` |
| `valorUnitarioCentavos` / `valor_unitario_centavos` | `unitPriceCents` / `unit_price_cents` |

### `general_add_ons`

| Anterior | Atual |
|---|---|
| `orcamentoId` / `orcamento_id` | `quoteId` / `quote_id` |
| `nome` | `name` |
| `quantidade` | `quantity` |
| `unidade` | `unit` |
| `valorUnitarioCentavos` / `valor_unitario_centavos` | `unitPriceCents` / `unit_price_cents` |

### `quote_history`

| Anterior | Atual |
|---|---|
| `orcamentoId` / `orcamento_id` | `quoteId` / `quote_id` |
| `tipoEvento` / `tipo_evento` | `eventType` / `event_type` |
| `ocorridoEm` / `ocorrido_em` | `occurredAt` / `occurred_at` |
| `detalhes` | `details` |

### `quote_sequence`

| Anterior | Atual |
|---|---|
| `ano` | `year` |
| `ultimoNumero` / `ultimo_numero` | `lastNumber` / `last_number` |

### `business_data`

| Anterior | Atual |
|---|---|
| `nomeComercialOuConsultor` / `nome_comercial_ou_consultor` | `commercialNameOrConsultant` / `commercial_name_or_consultant` |
| `telefone` | `phone` |
| `cpfCnpj` / `cpf_cnpj` | `taxId` / `tax_id` |
| `atualizadoEm` / `atualizado_em` | `updatedAt` / `updated_at` |

## 4. O que não mudou

- Tipos, precisão, nulabilidade, defaults, constraints, FKs, `onDelete` e índices.
- Decisões de domínio e comportamento de `PROJECT_SPEC`/`ARCHITECTURE`.
- Os nomes dos arquivos de migration e tabelas auxiliares futuras seguirão `snake_case` em inglês.
- Código, comentários, testes e mensagens de commit passam a ser em inglês a partir desta data.

## 5. Verificação

```bash
npx prisma format
# Formatted prisma/schema.prisma in 23ms 🚀

npx prisma validate
# The schema at prisma/schema.prisma is valid 🚀

npx prisma generate
# Generated Prisma Client (7.10.0) to ./generated/prisma
```
