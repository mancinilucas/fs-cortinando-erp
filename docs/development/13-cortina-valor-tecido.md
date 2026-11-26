# Fase complementar — Valor do tecido no bloco da cortina

**Status:** CONCLUÍDA em 2026-11-26.
**Fontes de verdade:** `PROJECT_SPEC.md` §2.3, §2.4, §6.6, §7.3; `ARCHITECTURE.md` §3.4 e §10.1.
**Relação com a UFIN:** esta iniciativa não faz parte da UFIN. A UFIN unificou a coleção financeira; aqui se completa um requisito de produto anterior à UFIN que havia sido implementado apenas parcialmente na Fase 11.

---

## 1. Problema

O `PROJECT_SPEC.md` §2.3 determina que medidas, material, quantidade calculada de tecido, preço por metro e total do tecido sejam apresentados juntos no bloco da cortina. O §2.4 permite que a interface sugira o lançamento `Tecido` ao criar uma cortina, e o §7.3 define a quantidade sugerida como a quantidade de tecido calculada, unidade `m` e valor unitário informado manualmente.

Antes desta fase, o formulário já tinha o campo textual `Material`, mas o tecido só podia ser lançado como componente financeiro genérico. O usuário precisava salvar a cortina, adicionar um componente, copiar a quantidade calculada pelo servidor, preencher o preço e salvar novamente. O primeiro salvamento não produzia o valor base da cortina.

## 2. Decisões

### D346 — Preço do tecido como conveniência de criação

**Decisão:** o contrato de criação e de edição aceita `fabricUnitPriceCents` em uma cortina **nova**. Quando informado, a Application Layer cria um `FinancialItem` comum com:

```text
name = "Tecido"
unit = "m"
quantity = fabricQuantity calculada pelo domínio
unitPriceCents = fabricUnitPriceCents informado
curtainId = cortina criada
```

A criação do item ocorre na mesma transação do orçamento, da cortina e do histórico. O domínio continua sem conhecer `Tecido` como tipo, enum ou regra especial: o nome é apenas o rótulo sugerido do preset, e o item é a fonte de verdade da composição financeira única.

**Justificativa:** é o único caminho que entrega o valor base no primeiro salvamento sem cálculo local no frontend e sem estado financeiro duplicado na cortina.

**Limites:**

- o campo é aceito apenas para cortina sem `id`; em cortina existente a edição do item ocorre pela coleção `financialItems`;
- no PATCH, a coleção `financialItems` completa deve acompanhar o campo, pois uma coleção enviada representa o estado final;
- sem `openingWidth` ou `fabricFactor` não há `fabricQuantity`; a request é rejeitada com `QuoteValidationError` (`CURTAIN_FABRIC_QUANTITY_REQUIRED`);
- o campo não é persistido na cortina e não aparece em respostas; a resposta expõe o item e os totais já recalculados.

### D347 — Campo no bloco da cortina (frontend)

**Decisão:** o formulário de cortina exibe `Preço do tecido (R$/m)` apenas para cortina nova. Ao salvar, o frontend envia `fabricUnitPriceCents` junto com a cortina e força o envio da coleção financeira completa. Não há cálculo local de `fabricQuantity`, `finalWidth` ou totais.

Quando o preço está preenchido, a validação de formulário exige largura do vão e fator de tecido. Após o salvamento, a cortina passa a ter identidade de servidor, o campo dedicado deixa de aparecer, o item `Tecido` aparece na composição financeira da cortina e o total salvo da cortina reflete o valor base. Edições posteriores do tecido são feitas no mesmo item, como qualquer outro lançamento.

**Justificativa:** mantém a UX de uma única operação sem reabrir D303-B (proibição de cálculo local) e sem transformar o preset em tipo de domínio.

## 3. Implementação

| Camada | Alteração |
|---|---|
| DTO | `fabricUnitPriceCents` opcional, inteiro positivo em centavos, aceito em `CreateQuoteCurtainDto`/`UpdateQuoteCurtainDto`. |
| Mapper | `QuoteRequestMapper` encaminha o campo para os inputs de criação e atualização. |
| Criação | `CreateQuoteFromCustomerUseCase` acrescenta o item `Tecido` com `quantity = curtain.fabricQuantity`. |
| Atualização | `UpdateQuoteUseCase` acrescenta o item com `curtainRef` para cortina nova e exige a coleção financeira completa. |
| Frontend contrato | `fabricUnitPriceCents` nos schemas de criação/edição de cortina. |
| Frontend formulário | `fabricPrice` em `CurtainFormValues`, validação de medidas, campo monetário no bloco da cortina e envio forçado de `financialItems`. |

## 4. Fora de escopo

- catálogo de materiais ou tecidos;
- preço automático a partir do material (PROJECT_SPEC §6.6);
- campo de preço de tecido em cortina já persistida no bloco da cortina;
- cálculo local de medidas, quantidade de tecido ou totais;
- persistência de `fabricUnitPriceCents` na cortina;
- alteração das regras de cálculo, desconto, ajuste ou gate de envio.

## 5. Verificação

- `backend`: build, lint, 1095 testes unitários/integração e 86 testes E2E em PostgreSQL limpo; `prisma validate` e `prisma migrate status` sem alteração de schema.
- `frontend`: `typecheck`, `lint`, 713 testes, build e `git diff --check`.
- Testes novos cobrem: criação do item na mesma transação, quantidade derivada pelo servidor, rejeição sem medidas, rejeição em cortina existente, exigência da coleção completa no PATCH, envio do campo apenas para cortina nova, validação de medidas e força da coleção financeira.
