# PRISMA-04 — Precisão numérica e campos financeiros

**Status:** concluída
**Data:** 2026-10-17
**Task de origem:** `docs/development/01-prisma-foundation.md` → PRISMA-04
**Fontes de verdade:** `docs/PROJECT_SPEC.md`, `docs/ARCHITECTURE.md` (§10), `docs/development/01-prisma-foundation.md`
**Modelo de referência:** `docs/development/01-prisma-audit.md` (§2.3, §2.6, D5–D7)
**Nomenclatura:** identificadores em inglês conforme `docs/development/01-prisma-naming.md`.

Esta task **define** o tipo Prisma de cada medida, fator, quantidade e valor financeiro. Ela não implementa os models: o schema continua sendo o scaffold de PRISMA-01/02, e a materialização dos tipos ocorre em PRISMA-05, que escreve o schema completo. Nenhum arquivo de código ou schema foi alterado.

---

## 1. Princípios

1. O schema é modelo de persistência, não de domínio (dev spec §2).
2. Nenhum `Float` é usado para medida, fator, quantidade ou dinheiro (ARCHITECTURE §10.1/§10.2).
3. Dinheiro é persistido em **centavos inteiros** (`Int`), nunca como decimal ou ponto flutuante (ARCHITECTURE §10.2).
4. Medidas e fatores de entrada usam escala **3** (precisão de milímetros, ARCHITECTURE §10.1).
5. Quantidades que recebem metragem derivada usam escala **6**, para não arredondar `fabricQuantity` (ARCHITECTURE §10.1, D5).
6. `HALF_UP` é política de `Money`, aplicada no domínio/aplicação — nunca no schema nem no Prisma (ARCHITECTURE §10.3).
7. Totais derivados não são persistidos (dev spec §3, PRISMA-02).

---

## 2. Mapa campo → tipo Prisma

### 2.1 Medidas de entrada, fatores e quantidades

| Model | Campo Prisma → coluna | Tipo Prisma | Null | Origem |
|---|---|---|---|---|
| `Curtain` | `openingWidth` → `opening_width` | `Decimal @db.Decimal(9,3)` | sim | medida de entrada (ARCHITECTURE §10.1) |
| `Curtain` | `height` | `Decimal @db.Decimal(9,3)` | sim | medida de entrada (ARCHITECTURE §10.1) |
| `Curtain` | `borderValue` → `border_value` | `Decimal @db.Decimal(6,3)` | sim | medida de entrada (D4/D6) |
| `Curtain` | `fabricFactor` → `fabric_factor` | `Decimal @db.Decimal(6,3)` | sim | fator (ARCHITECTURE §10.1, D4) |
| `FinancialComponent` | `quantity` | `Decimal @db.Decimal(12,6)` | sim | quantidade informada ou derivada (D5) |
| `GeneralAddOn` | `quantity` | `Decimal @db.Decimal(12,6)` | sim | mesmo `FinancialItem` (ARCHITECTURE §3.4) |

Nulabilidade herdada de PRISMA-03: `DRAFT` pode estar incompleto, então nenhum desses campos é `NOT NULL`.

### 2.2 Valores monetários

| Model | Campo Prisma → coluna | Tipo Prisma | Null | Origem |
|---|---|---|---|---|
| `FinancialComponent` | `unitPriceCents` → `unit_price_cents` | `Int` | sim | dinheiro em centavos (ARCHITECTURE §10.2) |
| `GeneralAddOn` | `unitPriceCents` → `unit_price_cents` | `Int` | sim | dinheiro em centavos |
| `Quote` | `discountFixedAmountCents` → `discount_fixed_amount_cents` | `Int` | sim | desconto `FIXED_AMOUNT` (PROJECT_SPEC §2.6) |
| `Quote` | `commercialAdjustmentCents` → `commercial_adjustment_cents` | `Int` | sim | ajuste positivo ou negativo (ARCHITECTURE §3.7) |

### 2.3 Percentual

| Model | Campo Prisma → coluna | Tipo Prisma | Null | Origem |
|---|---|---|---|---|
| `Quote` | `discountPercentage` → `discount_percentage` | `Decimal @db.Decimal(5,2)` | sim | desconto `PERCENTAGE` (D7) |

### 2.4 Derivados — não persistidos

| Valor | Regra | Tratamento |
|---|---|---|
| `finalWidth` | `openingWidth + (2 × borderValue)` | derivado no domínio |
| `fabricQuantity` | `finalWidth × fabricFactor` | derivado no domínio; precisão preservada durante o cálculo |
| `itemTotal` | `quantity × unitPrice` com `HALF_UP` para centavos | derivado; não há coluna |
| `curtainsSubtotal`, `generalAddOnsTotal`, `quoteSubtotal` | somas | derivados; não há coluna |
| `discountValue`, `calculatedTotal`, `quoteTotal` | aplicação sucessiva de desconto e ajuste | derivados; não há coluna |

Um valor persistido em centavos representa apenas valores **finais/unitários** já monetários fornecidos ao orçamento; somas e totais permanecem em memória.

---

## 3. Dimensionamento

| Tipo | Faixa máxima | Uso |
|---|---|---|
| `Decimal(9,3)` | `999.999,999` (6 dígitos inteiros) | largura e altura em metros |
| `Decimal(6,3)` | `999,999` (3 dígitos inteiros) | borda em metros e fator de tecido adimensional |
| `Decimal(12,6)` | `999.999,999999` (6 dígitos inteiros, 6 decimais) | quantidade informada ou derivada |
| `Decimal(5,2)` | `999,99` (3 dígitos inteiros, 2 decimais) | percentual de desconto |
| `Int` (PostgreSQL `integer`) | `2.147.483.647` centavos = `R$ 21.474.836,47` | valores monetários unitários, desconto fixo e ajuste |

Justificativas:

- **`Decimal(9,3)`**: 3 casas dão precisão de milímetro; 6 dígitos inteiros cobrem qualquer vão residencial/comercial com folga, sem aproximar-se do limite.
- **`Decimal(6,3)`**: `borderValue` (padrão funcional `0,15`) e `fabricFactor` (padrão funcional `3,5`) nunca se aproximam de `999,999`; 3 casas preservam a mesma escala de entrada. Não há default de coluna (D4).
- **`Decimal(12,6)`**: o produto de duas entradas com escala 3 produz até 6 casas exatas (`3 + 3`). A escala 6 evita truncar `fabricQuantity` ao copiá-la como quantidade de um item financeiro (D5). Quantidades **informadas** continuam limitadas a 3 casas pela validação de domínio; a coluna apenas comporta as derivadas.
- **`Decimal(5,2)`**: comporta percentuais de até `999,99`; o limite funcional `0 < x ≤ 100` é invariante do VO `Discount`, sem `CHECK` (D7, PRISMA-03 §5).
- **`Int`**: exatamente a decisão da ARCHITECTURE §10.2. O teto de `R$ 21.474.836,47` por valor armazenado é aceito para o MVP; totais derivados não são persistidos e não consomem essa faixa.

---

## 4. O que o schema deliberadamente não faz

| Item | Motivo |
|---|---|
| `@default` em `borderValue` / `fabricFactor` | defaults `0,15`/`3,5` pertencem ao domínio (D4) |
| `CHECK` para percentual, fator `> 0` ou escala | invariantes de domínio (PRISMA-03 §5) |
| Arredondamento, colunas geradas ou triggers | `HALF_UP` é política de `Money` (ARCHITECTURE §10.3) |
| Colunas de totais | derivados não são persistidos (dev spec §3) |
| `Float`/`Double` em qualquer campo numérico | proibido por ARCHITECTURE §10.1/§10.2 |
| `DECIMAL` para dinheiro | dinheiro é `Int` em centavos (ARCHITECTURE §10.2) |
| Tipos `Decimal` no domínio | o domínio usa VO `Money`/valores próprios; a conversão fica no mapper (ARCHITECTURE §9.2) |

---

## 5. Review exigida pela task

**O schema introduz arredondamento funcional não aprovado?**
Não. Nenhum tipo, default, `CHECK` ou coluna gerada arredonda valores. A escala da coluna apenas delimita o que pode ser persistido; o arredondamento monetário `HALF_UP` permanece exclusivamente em `Money` (ARCHITECTURE §10.3). A escala 6 de `quantity` existe justamente para **não** arredondar metragem derivada.

**Alguma medida monetária ou valor monetário usa `Float`?**
Não. Não há `Float` no modelo proposto; dinheiro é `Int` e percentual é `Decimal`.

**A precisão dos campos derivados/persistidos força arredondamento de metragem?**
Não. `Decimal(12,6)` comporta exatamente o produto de duas entradas com escala 3.

**Há campo derivado persistido?**
Não. Todos os totais e `fabricQuantity` permanecem derivados (PRISMA-02 §2.3).

---

## 6. Critérios de aceite

| Critério | Evidência |
|---|---|
| dinheiro usa centavos inteiros | todos os `*_cents` são `Int` (§2.2) |
| medidas/fatores de entrada suportam 3 casas | `Decimal(9,3)` e `Decimal(6,3)` (§2.1) |
| nenhuma medida monetária usa `Float` | nenhum `Float` no mapa (§2) |
| nenhum valor monetário usa `Float` | `Int` em centavos (§2.2) |
| precisão de campos derivados/persistidos não força arredondamento de metragem | `Decimal(12,6)` (§3) |
| política `HALF_UP` permanece em domínio/aplicação | §4 e §5 |

---

## 7. Verificação executada

```bash
npx prisma format
# Formatted prisma/schema.prisma in 11ms 🚀

npx prisma validate
# The schema at prisma/schema.prisma is valid 🚀
```

`prisma format` não alterou `prisma/schema.prisma` na época da task. O schema permanecia o scaffold de PRISMA-01/02 — a verificação desta task é a definição de tipos documentada acima, pois os models só foram escritos em PRISMA-05. Os identificadores foram posteriormente migrados para inglês (ver `01-prisma-naming.md`).

---

## 8. Próximo passo

**PRISMA-05 — implementar os models no `schema.prisma`**, aplicando os tipos definidos aqui. Depois, PRISMA-06 adiciona os índices justificados e PRISMA-07 cria a migration inicial.
