# DEVELOPMENT SPEC 01 — Prisma e Fundação de Persistência

**Status:** concluída em 2026-10-18  
**Objetivo:** definir e implementar o primeiro schema Prisma coerente com o domínio aprovado, em tasks atômicas e verificáveis, sem permitir que o ORM redefina as fronteiras arquiteturais.

---

## 1. Contexto atual

Já existem:

- backend NestJS;
- frontend React + Vite;
- PostgreSQL via `docker-compose` para desenvolvimento.

Esta etapa começa pela revisão/modelagem do schema Prisma e termina com migrations reproduzíveis, Prisma Client gerado e conectividade com o banco validada.

---

## 2. Fontes de verdade

Antes de executar qualquer task desta spec, consultar:

- `docs/PROJECT_SPEC.md` — comportamento e regras funcionais;
- `docs/ARCHITECTURE.md` — decisões arquiteturais e técnicas;
- `docs/IMPLEMENTATION_PLAN.md` — sequência global de implementação;
- `AGENTS.md` — regras de execução para agentes.

Regras de precedência:

1. `PROJECT_SPEC.md` define comportamento do produto.
2. `ARCHITECTURE.md` define fronteiras e decisões técnicas.
3. Esta development spec detalha somente a execução da etapa Prisma.
4. `IMPLEMENTATION_PLAN.md` define sequência e progresso.

Em caso de conflito ou ambiguidade, não inventar solução silenciosamente.

> O schema Prisma é modelo de persistência, não modelo de domínio.

---

## 3. Regras já aprovadas que impactam o schema

### Cliente

- UUID como identificador técnico.
- soft delete via `deletedAt` ou equivalente.
- orçamentos históricos permanecem associados após soft delete.

### Orçamento

- UUID como PK.
- `numeroOrcamento` único.
- FK para cliente definida na criação e imutável no domínio.
- status persistidos: `RASCUNHO`, `ENVIADO`, `CONFIRMADO`, `EM_PRODUCAO`, `CONCLUIDO`, `CANCELADO`.
- `EXPIRADO` não é persistido.
- endereço de instalação pertence ao orçamento.
- desconto é persistido como campos do orçamento, não tabela própria.
- ajuste comercial pertence ao orçamento.
- datas relevantes do ciclo são persistidas.

### Cortina

- UUID próprio.
- pertence a exatamente um orçamento.
- `sequencia` representa ordenação/apresentação, não identidade.
- não possui repository próprio no domínio.

### Financeiro

- componentes financeiros da cortina e adicionais gerais compartilham o mesmo modelo de domínio, mas usam tabelas relacionais distintas.
- `total` de item é derivado e não deve ser persistido inicialmente.
- totais do orçamento são derivados e não devem ser persistidos inicialmente.

### Precisão

- valores monetários persistidos em centavos inteiros.
- medidas de entrada, fatores e quantidades informadas usam 3 casas decimais.
- cálculos derivados de metragem devem preservar precisão suficiente para não aplicar arredondamento automático indevido.
- arredondamento monetário usa `HALF_UP` apenas quando um resultado se torna `Money`.

### Histórico

- persistência separada por `orcamentoId`.
- não é event sourcing.
- deve suportar `tipoEvento`, `ocorridoEm` e detalhes flexíveis de alterações.

### Numeração

- contador anual persistido.
- incremento atômico.
- reserva do número e criação do orçamento ocorrem na mesma transação.
- `UNIQUE(numeroOrcamento)` como proteção adicional.

### Autenticação

- usuário administrativo persistido.
- sessões server-side persistidas.
- não há signup público, RBAC ou gestão de usuários no MVP.

### Dados do negócio

- configuração simples persistida para os dados comerciais usados nos documentos.

---

## 4. Fora do escopo desta etapa

Não implementar nesta spec:

- repositories completos de domínio;
- endpoints HTTP;
- autenticação funcional;
- Aggregate `Orcamento` em código;
- casos de uso;
- geração de PDF;
- dashboard;
- frontend;
- regra de negócio dentro de models Prisma.

---

# 5. Workflow obrigatório para cada task

Cada task deve seguir este ciclo:

```text
READ
→ IMPLEMENT
→ VERIFY
→ REVIEW
→ REPAIR (se necessário)
→ RE-VERIFY
→ DONE
```

Uma task só pode ser marcada como concluída quando passar pelos dois gates abaixo.

### Gate 1 — Verificação mecânica

Executar apenas os checks aplicáveis à task, por exemplo:

```bash
npx prisma format
npx prisma validate
npm run lint
npm run build
npm test
```

Quando houver migration:

- aplicar em banco de desenvolvimento;
- validar que sobe em banco vazio quando aplicável.

### Gate 2 — Revisão semântica

Revisar a implementação contra:

- critérios de aceite da própria task;
- `PROJECT_SPEC.md`;
- `ARCHITECTURE.md`;
- esta development spec;
- escopo de arquivos esperado.

A revisão deve procurar especificamente:

- regra de negócio inventada;
- alteração fora do escopo;
- modelagem Prisma contaminando o domínio;
- constraint incompatível com o produto;
- entidade/tabela criada sem necessidade;
- campo derivado persistido sem justificativa;
- inconsistência de precisão ou nulabilidade.

---

# 6. Tasks atômicas

## PRISMA-01 — Auditar estado atual do Prisma

**Goal**  
Entender exatamente o estado atual de Prisma, migrations e integração com o NestJS antes de alterar o schema.

**Scope**

- `prisma/schema.prisma`;
- `prisma/migrations/`, se existir;
- `prisma.config.ts`, se existir;
- `PrismaService`, se existir;
- configuração de banco relacionada ao Prisma.

**Não alterar** o schema nesta task, salvo correção mínima necessária apenas para permitir sua leitura/validação e explicitamente reportada.

**Acceptance criteria**

- estado atual documentado;
- models, enums e migrations existentes identificados;
- inconsistências com `PROJECT_SPEC`/`ARCHITECTURE` listadas;
- decisões antigas que devem ser descartadas identificadas;
- nenhuma regra nova inventada.

**Verification**

- `npx prisma validate`, se o schema atual permitir;
- registrar erros existentes caso não permita.

**Review**

- confirmar que a análise cobre apenas persistência;
- confirmar que nenhuma mudança funcional foi introduzida.

**Deliverable**

Resumo curto com:

```text
estado atual
inconsistências
arquivos afetados nas próximas tasks
```

---

## PRISMA-02 — Propor modelo relacional do MVP

**Goal**  
Definir os models e relacionamentos necessários antes de escrever a migration.

**Scope**

Propor models para, no mínimo:

- usuário administrativo;
- sessão;
- cliente;
- orçamento;
- cortina;
- componente financeiro da cortina;
- adicional geral;
- histórico do orçamento;
- sequência anual de orçamento;
- dados do negócio.

Não criar models para:

- ordem de produção;
- PDF comercial;
- `EXPIRADO`;
- instalação atrasada;
- desconto como entidade própria;
- endereço de instalação como tabela independente sem nova justificativa aprovada.

**Acceptance criteria**

- cada model tem responsabilidade clara;
- cardinalidades estão explícitas;
- ownership das FKs está definido;
- não há duplicação de aggregate por conveniência do ORM;
- campos derivados permanecem fora da persistência, salvo exceção aprovada.

**Verification**

- comparar o modelo proposto com as seções correspondentes do `PROJECT_SPEC` e `ARCHITECTURE`.

**Review**

Responder explicitamente:

- algum model existe apenas porque o Prisma torna isso conveniente?
- algum conceito de domínio foi transformado em tabela sem necessidade?
- alguma relação permitiria estado inválido?

**Deliverable**

Diagrama textual ou tabela com:

```text
Model
Campos principais
FKs
Cardinalidade
Constraints relevantes
```

**Stop condition**  
Não criar migration antes desta task ser validada.

---

## PRISMA-03 — Definir enums, nulabilidade e constraints

**Goal**  
Fechar constraints estruturais antes de implementar o schema completo.

**Scope**

Definir:

- enum de status de orçamento;
- enum/tipo persistido de desconto, se adotado no schema;
- nulabilidade dos campos;
- unicidades;
- regras FK `Restrict`, `Cascade` ou equivalentes;
- unicidade/PK da sequência anual.

**Acceptance criteria**

- `EXPIRADO` não está no enum persistido;
- `numeroOrcamento` é único;
- cliente com soft delete não provoca exclusão de orçamentos;
- exclusão de filhos internos do aggregate não deixa registros órfãos;
- nulabilidade respeita o fato de que `RASCUNHO` pode estar incompleto;
- constraints não tentam substituir invariantes que pertencem ao domínio.

**Verification**

- revisão manual contra regras de ciclo e criação do rascunho.

**Review**

- verificar se algum `NOT NULL` impediria rascunho incompleto;
- verificar se algum `Cascade` pode apagar histórico indevidamente.

---

## PRISMA-04 — Definir precisão numérica e campos financeiros

**Goal**  
Materializar a estratégia de precisão aprovada no schema.

**Scope**

Definir tipos para:

- medidas de entrada;
- fatores;
- quantidades informadas;
- valores monetários;
- desconto percentual;
- ajuste comercial.

**Acceptance criteria**

- dinheiro usa centavos inteiros;
- medidas/fatores de entrada suportam 3 casas decimais;
- nenhuma medida monetária usa `Float`;
- nenhum valor monetário usa `Float`;
- precisão escolhida para campos derivados/persistidos não força arredondamento de metragem;
- política `HALF_UP` permanece responsabilidade de domínio/aplicação, não do Prisma.

**Verification**

- `npx prisma format`;
- `npx prisma validate`.

**Review**

- confirmar que o schema não introduz arredondamento funcional não aprovado.

---

## PRISMA-05 — Implementar models principais no `schema.prisma`

**Goal**  
Implementar no Prisma o modelo relacional aprovado nas tasks anteriores.

**Scope**

Alterar somente o schema e arquivos estritamente necessários à validação do Prisma.

**Acceptance criteria**

O schema suporta:

- `User`/usuário administrativo;
- sessão server-side;
- `Cliente` com soft delete;
- `Orcamento`;
- `Cortina`;
- componentes financeiros;
- adicionais gerais;
- histórico;
- sequência anual;
- dados do negócio.

E não contém:

- tabela de ordem de produção;
- tabela de PDF;
- status `EXPIRADO`;
- totais derivados persistidos sem justificativa;
- comportamento de domínio.

**Verification**

```bash
npx prisma format
npx prisma validate
```

Se houver geração disponível nesta fase:

```bash
npx prisma generate
```

**Review**

Comparar model por model contra `PROJECT_SPEC` e `ARCHITECTURE`.

---

## PRISMA-06 — Definir índices das queries do MVP

**Goal**  
Adicionar apenas índices sustentados pelas consultas já previstas.

**Scope**

Avaliar pelo menos:

- `Cliente.nome`;
- `Orcamento.numeroOrcamento` (`UNIQUE`);
- `Orcamento.clienteId`;
- `Orcamento.status`;
- `Orcamento.dataValidade`;
- `Orcamento.dataInstalacaoAgendada`;
- histórico por `orcamentoId + ocorridoEm`;
- sequência anual por `ano`.

**Acceptance criteria**

- todos os índices possuem uma query/requisito que os justifique;
- nenhum índice especulativo é incluído;
- unicidades funcionais necessárias estão protegidas.

**Verification**

```bash
npx prisma format
npx prisma validate
```

**Review**

Para cada índice novo, responder:

```text
Qual query do MVP justifica este índice?
```

Se não houver resposta concreta, remover.

---

## PRISMA-07 — Criar e validar migration inicial desta modelagem

**Goal**  
Gerar uma migration reproduzível para o schema aprovado.

**Scope**

- migration correspondente ao schema consolidado;
- nenhuma implementação de repository ou endpoint.

**Acceptance criteria**

- migration é gerada sem erro;
- aplica corretamente no banco de desenvolvimento;
- banco vazio consegue chegar ao estado esperado;
- constraints e relações geradas correspondem ao schema revisado;
- nenhuma alteração destrutiva inesperada passa sem revisão.

**Verification**

Executar os comandos Prisma adequados ao projeto, incluindo:

```bash
npx prisma validate
```

E aplicar a migration no ambiente de desenvolvimento.

Quando viável, validar também em banco limpo/recriado.

**Review**

Revisar SQL gerado procurando:

- cascades inesperados;
- tipos incorretos;
- colunas nullable incorretas;
- índices ausentes;
- constraints não previstas.

**Stop condition**  
Não corrigir manualmente comportamento funcional no SQL sem primeiro ajustar a fonte correta (`schema.prisma` ou decisão arquitetural).

---

## PRISMA-08 — Validar Prisma Client e PrismaService

**Goal**  
Garantir que o NestJS consegue acessar o banco através da infraestrutura Prisma existente.

**Scope**

- geração do Prisma Client;
- `PrismaService` existente ou implementação mínima necessária;
- configuração de conexão.

**Acceptance criteria**

- Prisma Client é gerado;
- NestJS inicia com conexão válida ao banco;
- `PrismaService` permanece infraestrutura, sem regras de domínio;
- não há repository de negócio sendo implementado nesta task.

**Verification**

```bash
npx prisma generate
npm run build
```

Executar teste de conectividade ou teste de integração mínimo, se já houver infraestrutura de testes preparada.

**Review**

- confirmar que tipos Prisma não vazaram para `domain/`;
- confirmar que esta task não implementou casos de uso prematuramente.

---

## PRISMA-09 — Definir e implementar seed administrativo mínimo

**Status:** adiada para `02-auth.md` em 2026-10-18.

**Motivo**  
O algoritmo de hash de senha é a decisão D20, adiada explicitamente para `02-auth.md` (`01-prisma-audit.md` §3.1). Não há dependência de hash instalada, e a task condiciona o hash à infraestrutura já disponível. Criar hash temporário ou armazenar senha em texto puro violaria `PROJECT_SPEC.md` §14.3 e `ARCHITECTURE.md` §13.3.

Nenhuma implementação temporária foi criada e nenhum arquivo de código, schema ou migration foi alterado.

**Ao criar `02-auth.md`, preservar:** seed idempotente da única conta administrativa, credenciais fora do repositório, sem signup público, sem RBAC e sem implementar login/sessão nesta etapa.

**Goal**  
Disponibilizar a única conta administrativa necessária para desenvolvimento, sem implementar o fluxo completo de autenticação.

**Scope**

- estratégia de seed;
- criação idempotente do usuário administrativo de desenvolvimento;
- hash de senha conforme decisão arquitetural, se a dependência/infraestrutura já estiver disponível.

**Acceptance criteria**

- seed pode ser executado mais de uma vez sem duplicar o usuário;
- credenciais não são hardcoded de forma insegura no repositório;
- não existe signup público;
- não há RBAC ou gestão de usuários;
- esta task não implementa login/sessão.

**Verification**

- executar seed no ambiente de desenvolvimento;
- consultar o registro criado;
- confirmar idempotência.

**Review**

- verificar exposição de senha/secret;
- verificar se a implementação antecipou funcionalidades da spec de autenticação.

**Note**  
Se a estratégia de hash depender da próxima development spec de autenticação, esta task pode ser adiada explicitamente para `02-auth.md` em vez de criar implementação temporária.

---

## PRISMA-10 — Fechamento da etapa de persistência

**Goal**  
Executar a revisão final da foundation Prisma antes de iniciar a próxima development spec.

**Scope**

Nenhuma feature nova. Apenas validação final, correções estritamente necessárias e atualização documental de decisões técnicas novas.

**Acceptance criteria**

- todas as tasks anteriores aplicáveis estão concluídas;
- `schema.prisma` está formatado e válido;
- migration sobe corretamente;
- Prisma Client é gerado;
- NestJS conecta ao banco;
- não há inconsistências conhecidas com `PROJECT_SPEC` ou `ARCHITECTURE`;
- nenhuma tabela ou campo fora do escopo foi introduzido;
- decisões técnicas novas relevantes foram documentadas no `ARCHITECTURE.md` quando necessário.

**Verification**

Executar o conjunto final aplicável:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npm run lint
npm run build
```

Executar testes de integração relacionados à persistência, caso existam.

**Review**

Fazer uma segunda passada **sem modificar arquivos inicialmente** e responder:

1. O schema implementa apenas requisitos aprovados?
2. Há models ou campos especulativos?
3. Há dados derivados persistidos desnecessariamente?
4. Há constraints que quebram rascunhos incompletos?
5. Há `Cascade` perigoso para histórico?
6. Há tipos Prisma vazando para o domínio?
7. A precisão decimal está coerente?
8. A migration é reproduzível?
9. Há mudanças fora do escopo da etapa?

Se houver achados:

```text
REVIEW
→ REPAIR
→ RE-VERIFY
```

Somente depois marcar a development spec como concluída.

---

# 7. Definition of Done da Development Spec 01

A etapa Prisma/Fundação de Persistência está concluída somente quando:

- [x] estado anterior do Prisma foi auditado;
- [x] modelo relacional foi revisado antes da migration;
- [x] enums, nulabilidade, FKs e constraints foram validados;
- [x] precisão numérica foi materializada corretamente;
- [x] schema Prisma está implementado;
- [x] índices do MVP estão justificados;
- [x] migration foi aplicada com sucesso;
- [x] Prisma Client é gerado sem erro;
- [x] NestJS conecta ao banco;
- [x] seed administrativo adiado explicitamente para `02-auth.md` (ver PRISMA-09);
- [x] verificação mecânica final passou;
- [x] revisão semântica final passou;
- [x] nenhum requisito funcional foi inventado ou alterado silenciosamente.

---

# 8. Próxima etapa

Após a conclusão desta spec, seguir a ordem definida em `IMPLEMENTATION_PLAN.md`.

Antes de iniciar a próxima feature:

1. revisar/criar a development spec correspondente;
2. decompor em tasks atômicas;
3. definir critérios de aceite e verificações;
4. implementar uma task por vez.
