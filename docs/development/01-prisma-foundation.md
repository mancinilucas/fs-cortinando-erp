# DEVELOPMENT SPEC 01 — Prisma e Fundação de Persistência

**Status:** próxima etapa  
**Objetivo:** definir e implementar o primeiro schema Prisma coerente com o domínio aprovado, sem permitir que o ORM redefina as fronteiras arquiteturais.

---

## 1. Contexto atual

Já existem:

- backend NestJS;
- frontend React + Vite;
- PostgreSQL via `docker-compose` para desenvolvimento.

Esta etapa começa pela definição do schema Prisma e termina com migrations reproduzíveis e infraestrutura de acesso ao banco validada.

---

## 2. Fontes obrigatórias

Antes de implementar, consultar:

- `PROJECT_SPEC.md` — conceitos e regras funcionais;
- `ARCHITECTURE.md` — seções de modelo de domínio, persistência, precisão numérica, transações e numeração.

O schema Prisma é **modelo de persistência**, não modelo de domínio.

---

## 3. Escopo

O schema inicial deve suportar, no mínimo:

- usuário administrativo;
- sessões server-side;
- clientes com soft delete;
- orçamentos;
- cortinas;
- componentes financeiros das cortinas;
- adicionais gerais;
- histórico do orçamento;
- contador/sequência anual do número comercial;
- dados do negócio.

Não criar tabela para:

- ordem de produção;
- PDF comercial;
- `EXPIRADO`;
- `Instalação atrasada`;
- `Desconto` como entidade independente;
- `EnderecoInstalacao` como aggregate/tabela independente sem necessidade concreta.

---

## 4. Regras estruturais já aprovadas

### Cliente

- UUID como identificador técnico.
- soft delete via `deletedAt` ou equivalente.
- orçamentos históricos permanecem associados após soft delete.

### Orçamento

- UUID como PK.
- `numeroOrcamento` único.
- FK imutável para cliente após criação.
- status persistidos: `RASCUNHO`, `ENVIADO`, `CONFIRMADO`, `EM_PRODUCAO`, `CONCLUIDO`, `CANCELADO`.
- `EXPIRADO` não é persistido.
- endereço de instalação pertence ao orçamento.
- desconto é persistido como campos do orçamento, não tabela própria.
- ajuste comercial é persistido no orçamento.
- datas relevantes do ciclo são persistidas.

### Cortina

- UUID próprio.
- pertence a exatamente um orçamento.
- `sequencia` é posição/apresentação, não identidade.
- não possui repository próprio no domínio.

### Financeiro

- componentes financeiros e adicionais gerais compartilham modelo de domínio, mas usam tabelas relacionais distintas.
- `total` do item é derivado e não deve ser persistido inicialmente.
- totais do orçamento são derivados e não devem ser persistidos inicialmente.

### Precisão

- dinheiro: centavos inteiros.
- medidas de entrada/fatores: precisão de 3 casas decimais.
- cálculos derivados devem preservar precisão suficiente para não violar a regra de não arredondar metragem automaticamente.
- arredondamento monetário `HALF_UP` somente quando um resultado vira `Money`.

### Histórico

- persistência separada por `orcamentoId`.
- não é event sourcing.
- suporta `tipoEvento`, `ocorridoEm` e detalhes flexíveis das alterações.

### Numeração

- contador anual persistido.
- incremento atômico.
- geração do número e criação do orçamento na mesma transação.
- `UNIQUE(numeroOrcamento)` como proteção adicional.

---

## 5. Decisões que devem ser fechadas nesta etapa

Estas decisões ainda devem ser materializadas no schema durante a revisão técnica:

1. nomes finais dos models Prisma;
2. nomes finais dos enums persistidos;
3. representação relacional do endereço de instalação;
4. `Decimal(p,s)` exato para cada medida/quantidade;
5. índices necessários para buscas do MVP;
6. formato JSON do detalhe de histórico;
7. cascade/restrict apropriado das FKs;
8. estratégia de seed do usuário administrativo.

Nenhuma dessas decisões deve alterar comportamento já aprovado.

---

## 6. Índices mínimos a considerar

Avaliar pelo menos:

- `Cliente.nome` para busca;
- `Orcamento.numeroOrcamento` UNIQUE;
- `Orcamento.clienteId`;
- `Orcamento.status`;
- `Orcamento.dataValidade` para expirados;
- `Orcamento.dataInstalacaoAgendada` para dashboard;
- histórico por `orcamentoId + ocorridoEm`;
- sequência anual por `ano` UNIQUE/PK.

Os índices devem ser confirmados pelo padrão real das queries, evitando otimização prematura além desses casos evidentes.

---

## 7. Tasks

- [ ] Revisar schema Prisma atual, se existir.
- [ ] Propor diagrama/modelo relacional antes da migration.
- [ ] Validar models e relações contra `PROJECT_SPEC.md`.
- [ ] Validar precisão e constraints contra `ARCHITECTURE.md`.
- [ ] Implementar `schema.prisma`.
- [ ] Criar migration inicial.
- [ ] Aplicar migration em banco de desenvolvimento limpo.
- [ ] Gerar Prisma Client.
- [ ] Implementar/validar `PrismaService`.
- [ ] Criar seed administrativo se decidido.
- [ ] Criar teste simples de integração/conectividade.
- [ ] Documentar qualquer decisão de persistência nova em `ARCHITECTURE.md`.

---

## 8. Critérios de aceite

- `prisma validate` passa.
- migration sobe do zero em um banco vazio.
- Prisma Client é gerado sem erro.
- aplicação NestJS conecta no banco.
- relações principais refletem corretamente os aggregates aprovados.
- nenhuma tabela/enum contradiz o `PROJECT_SPEC.md`.
- nenhuma regra de domínio foi deslocada para o schema apenas por conveniência do ORM.
- precisão monetária e decimal está explícita no schema.

---

## 9. Fora do escopo desta etapa

- repositories completos;
- endpoints HTTP;
- autenticação funcional;
- implementação do aggregate `Orcamento`;
- geração de PDF;
- dashboard;
- frontend.
