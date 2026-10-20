# PRISMA-06 — Índices das queries do MVP

**Status:** concluída
**Data:** 2026-10-17
**Task de origem:** `docs/development/01-prisma-foundation.md` → PRISMA-06
**Fontes de verdade:** `docs/PROJECT_SPEC.md` (§3.3, §8.2, §12), `docs/ARCHITECTURE.md` (§9.3, §13.3), `docs/development/01-prisma-foundation.md`
**Modelo de referência:** `docs/development/01-prisma-audit.md` (§2.7)
**Nomenclatura:** identificadores em inglês conforme `docs/development/01-prisma-naming.md`.

Esta task adiciona ao `schema.prisma` apenas índices sustentados por uma consulta concreta do MVP. Nenhuma migration foi criada (escopo de PRISMA-07), nenhuma query ou código de aplicação foi implementado e nenhuma constraint de unicidade nova foi introduzida.

---

## 1. Itens exigidos pela task

| Item avaliado | Situação | Justificativa concreta |
|---|---|---|
| `Customer.name` | `@@index([name])` adicionado | Busca de clientes por nome (`PROJECT_SPEC` §3.3) |
| `Quote.quoteNumber` (UNIQUE) | já existente desde PRISMA-05 | Busca por número (`PROJECT_SPEC` §12.2) + unicidade funcional |
| `Quote.customerId` | `@@index([customerId])` adicionado | Histórico do cliente (`PROJECT_SPEC` §3.2/§12.4) |
| `Quote.status` | `@@index([status])` adicionado | Dashboard e filtros de situação (`PROJECT_SPEC` §12.1/§12.3) |
| `Quote.validUntil` | `@@index([validUntil])` adicionado | Derivar `EXPIRED`: `status = SENT AND validUntil < now` (`PROJECT_SPEC` §8.2) |
| `Quote.scheduledInstallationAt` | `@@index([scheduledInstallationAt])` adicionado | Próximas instalações, instalações da semana e atrasadas (`PROJECT_SPEC` §12.1/§9.3) |
| histórico por `quoteId + occurredAt` | `@@index([quoteId, occurredAt])` adicionado | Carregar o histórico de um orçamento ordenado por ocorrência (`PROJECT_SPEC` §11) |
| sequência anual por `year` | **nenhum índice novo** | `year` já é PK de `QuoteSequence`; a PK cria o índice necessário |

---

## 2. Índices adicionais justificados

| Índice | Model | Query do MVP |
|---|---|---|
| `@@index([curtainId])` | `FinancialComponent` | Carregar os componentes financeiros de uma cortina ao reconstruir o aggregate (ARCHITECTURE §9.3) |
| `@@index([quoteId])` | `GeneralAddOn` | Carregar os adicionais gerais de um orçamento (ARCHITECTURE §9.3) |
| `@@index([userId])` | `Session` | Invalidação/regeneração das sessões do usuário após login/logout (ARCHITECTURE §13.3) |

---

## 3. Unicidades funcionais já protegidas

| Constraint | Model | Requisito |
|---|---|---|
| `@unique email` | `User` | login |
| `@unique tokenHash` | `Session` | lookup da sessão |
| ~~`@unique taxId`~~ | `Customer` | **Removido por D52 (2026-10-19)** — CPF/CNPJ duplicado é permitido no MVP |
| `@unique quoteNumber` | `Quote` | `PROJECT_SPEC` §4.3/§12.2 |
| `@@unique([quoteId, sequence])` | `Curtain` | D11 — posição de apresentação única por orçamento |
| PK `year` | `QuoteSequence` | contador anual (ARCHITECTURE §12) |

Todas já estavam no schema desde PRISMA-05; nenhuma foi alterada nesta task.

---

## 4. Avaliados e deliberadamente não incluídos

| Candidato | Motivo da exclusão |
|---|---|
| `@@index([quoteId])` em `Curtain` | Redundante: o índice UNIQUE `(quoteId, sequence)` atende consultas por `quoteId` como prefixo à esquerda no PostgreSQL |
| `@@index([status, validUntil])` | Nenhuma query do MVP exige o composto; os índices simples de `status` e `validUntil` cobrem os filtros previstos (D17) |
| `@@index([status, scheduledInstallationAt])` | idem — dashboard usa os filtros separadamente (D17) |
| Índice parcial em `Customer.deletedAt` | Consultas do MVP ainda não foram implementadas; nenhuma query concreta o justifica |
| `@@index([expiresAt])` em `Session` | Não há rotina de limpeza/varredura de sessões expiradas no MVP |
| Índices de cidade (`addressCity` / `installationAddressCity`) | Filtro por cidade está fora do escopo inicial (`PROJECT_SPEC` §12.3) |

Nenhum índice especulativo foi mantido.

---

## 5. Review — resposta exigida por índice novo

```text
@@index([name]) em customers
→ Qual query do MVP justifica? Busca de clientes por nome (PROJECT_SPEC §3.3).

@@index([customerId]) em quotes
→ Qual query do MVP justifica? Listar o histórico de orçamentos de um cliente (PROJECT_SPEC §12.4).

@@index([status]) em quotes
→ Qual query do MVP justifica? Cards/filtros de situação do dashboard (PROJECT_SPEC §12.1/§12.3).

@@index([validUntil]) em quotes
→ Qual query do MVP justifica? Separar EXPIRED de SENT válido (PROJECT_SPEC §8.2/§12.1).

@@index([scheduledInstallationAt]) em quotes
→ Qual query do MVP justifica? Próximas instalações, semana e atrasadas (PROJECT_SPEC §12.1/§9.3).

@@index([quoteId, occurredAt]) em quote_history
→ Qual query do MVP justifica? Carregar o histórico do orçamento em ordem cronológica (PROJECT_SPEC §11).

@@index([curtainId]) em financial_components
→ Qual query do MVP justifica? Carregar os componentes de cada cortina do aggregate (ARCHITECTURE §9.3).

@@index([quoteId]) em general_add_ons
→ Qual query do MVP justifica? Carregar os adicionais gerais do orçamento (ARCHITECTURE §9.3).

@@index([userId]) em sessions
→ Qual query do MVP justifica? Invalidar/regenerar as sessões do usuário no login/logout (ARCHITECTURE §13.3).
```

---

## 6. Critérios de aceite

| Critério | Evidência |
|---|---|
| todos os índices possuem query/requisito que os justifique | §1, §2 e §5 |
| nenhum índice especulativo incluído | §3 e §4 |
| unicidades funcionais necessárias protegidas | §3 |

---

## 7. Verificação executada

```bash
npx prisma format
# Formatted prisma/schema.prisma in 24ms 🚀

npx prisma validate
# The schema at prisma/schema.prisma is valid 🚀
```

Nenhuma migration foi gerada ou aplicada; a materialização dos índices no banco ocorre na migration de PRISMA-07. Os identificadores foram posteriormente migrados para inglês (ver `01-prisma-naming.md`).

---

## 8. Próximo passo

**PRISMA-07 — criar e validar a migration inicial** correspondente ao schema consolidado (models, enums, constraints e índices).
