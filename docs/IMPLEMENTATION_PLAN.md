# IMPLEMENTATION PLAN — Sistema de Gestão de Orçamentos para Consultoria de Cortinas

**Status:** ativo  
**Fontes de verdade:** `PROJECT_SPEC.md` (funcional) e `ARCHITECTURE.md` (técnica)  
**Objetivo:** definir ordem de implementação, dependências, entregáveis e critérios de pronto para desenvolvimento assistido por Codex/agentes.

---

## 1. Regras para execução por agentes

1. `PROJECT_SPEC.md` é a fonte de verdade para comportamento e regras de negócio.
2. `ARCHITECTURE.md` é a fonte de verdade para decisões técnicas e limites arquiteturais.
3. Este documento define **ordem e decomposição do trabalho**, não substitui os dois documentos acima.
4. Cada task deve ser concluída com testes compatíveis com seu risco antes de avançar.
5. Não alterar requisitos, regras de negócio ou arquitetura silenciosamente.
6. Quando uma task revelar ambiguidade real, registrar a dúvida e interromper a decisão arquitetural específica em vez de inventar comportamento.
7. Evitar abstrações não previstas ou não justificadas pelo domínio.
8. Mudanças relevantes devem atualizar a documentação correspondente no mesmo PR/commit.

---

## 2. Estado atual do projeto

**Data da reconciliação:** 2026-10-20 (PLAN-01).

**Método:** conferência das fases contra código, schema, migrations, testes e specs de desenvolvimento; os documentos de fechamento foram usados como pista, não como prova isolada.

### 2.1 Já concluído

- [x] Projeto backend NestJS criado.
- [x] Projeto frontend React + Vite + TypeScript criado.
- [x] `docker-compose` de desenvolvimento configurado.
- [x] PostgreSQL de desenvolvimento disponível via Docker.
- [x] `PROJECT_SPEC.md` consolidado.
- [x] `ARCHITECTURE.md` consolidado.
- [x] Fase 1 — Persistência e fundação técnica.
- [x] Fase 2 — Autenticação e sessão.
- [x] Fase 3 — Clientes.
- [x] Fases 4–7 — Núcleo de Orçamento (domínio, rascunho/edição, ciclo de vida/histórico e instalação), absorvidas pela spec consolidada `docs/development/04-orcamentos.md` e encerradas em 2026-10-20 (ORCAMENTO-48).

### 2.2 Próxima etapa

A numeração histórica das fases é preservada; a ordem de execução recomendada está em §2.7.

- [ ] Fase 10 — Dados do Negócio.
- [ ] Fase 8 — Documentos.
- [ ] Fase 9 — Dashboard e consultas operacionais restantes.
- [ ] Fase 11 — Frontend.
- [ ] Fase 12 — Hardening e entrega.

**Próxima task esperada:** `DADOS-DO-NEGOCIO-03 — Criar scaffold do módulo`.

A auditoria `DADOS-DO-NEGOCIO-01` e a spec `DADOS-DO-NEGOCIO-02` foram produzidas em 2026-10-20. A spec foi validada em 2026-10-20 e as decisões materiais foram aprovadas; nenhuma implementação foi iniciada.

### 2.3 Classificação das fases

| Fase | Estado anterior no plano | Estado real | Motivo/evidência |
|---|---|---|---|
| 1 — Persistência e fundação técnica | Todos os itens `[ ]` | **CONCLUÍDA** | `01-prisma-foundation.md` concluída em 2026-10-18; models em `backend/prisma/schema.prisma`; migration inicial `20261018024309_init`; `PrismaService` com adapter PostgreSQL; seed administrativo em `backend/prisma/seed.ts`. A migration posterior de unicidade de `taxId` pertence à Fase 3. |
| 2 — Autenticação e sessão | Todos os itens `[x]` | **CONCLUÍDA** | `02-auth.md` registra AUTH-01 a AUTH-19 concluídas em 2026-10-18; módulo `auth/` completo; rotas `/auth/login`, `/auth/me` e `/auth/logout`; E2E em `backend/test/auth.e2e-spec.ts`. |
| 3 — Clientes | Todos os itens `[x]` | **CONCLUÍDA** | CLIENTES-04 a CLIENTES-22 foram implementadas em `backend/src/modules/clientes/` com testes unitários, de integração e E2E; CLIENTES-23/24 fizeram a revisão semântica, os reparos e o fechamento (commit `02a4a3c`). O cabeçalho de `03-clientes.md` está desatualizado (§2.8). |
| 4 — Núcleo de Orçamento | Todos os itens `[x]` | **ABSORVIDA POR OUTRA FASE** (trabalho concluído) | Implementação consolidada em `04-orcamentos.md` (D76–D95); aggregate, entidades internas e VOs em `backend/src/modules/orcamentos/domain/`. |
| 5 — Rascunho, numeração e edição | Todos os itens `[x]` | **ABSORVIDA POR OUTRA FASE** (trabalho concluído) | `04-orcamentos.md` (D79–D95, D110–D117, D119); criação, edição, numeração anual e exclusão de rascunho implementadas e testadas. |
| 6 — Ciclo de vida e histórico | Todos os itens `[x]` | **ABSORVIDA POR OUTRA FASE** (trabalho concluído) | `04-orcamentos.md` (D96–D109, D119); 12 use cases de escrita, máquina de estados e histórico transacional cobertos por testes. |
| 7 — Instalação | Todos os itens `[x]` | **ABSORVIDA POR OUTRA FASE** (trabalho concluído) | `04-orcamentos.md` (D104–D107); agendamento, alteração, remoção, bloqueio de conclusão e instalação atrasada implementados. |
| 8 — Documentos | Todos os itens `[ ]` | **PENDENTE** | `infrastructure/documents/` contém apenas `.gitkeep`; não há serviço ou rota de PDF/ordem de produção; não existe tabela nem aggregate `ProductionOrder`; os valores de enum de documentos não constituem implementação. |
| 9 — Consultas e dashboard | Cinco itens `[x]`, quatro `[ ]` | **REORGANIZADA** (parte concluída, parte pendente) | Consultas básicas implementadas em `04-orcamentos.md` (D113) e expostas nas rotas de orçamento; não existe `DashboardQuery` nem endpoints de dashboard/instalações operacionais. |
| 10 — Dados do negócio | Todos os itens `[ ]` | **PENDENTE** | Existem apenas o model `BusinessData` e a tabela `business_data`; não há módulo NestJS, use case, endpoint, seed ou teste de dados do negócio. |
| 11 — Frontend | Todos os itens `[ ]` | **PENDENTE** | `frontend/src` contém apenas `App.jsx`, `main.jsx`, CSS e assets do template Vite; nenhuma feature de Auth, Clientes, Orçamento, Documentos, Dashboard ou Dados do Negócio. |
| 12 — Hardening e entrega | Todos os itens `[ ]` | **PENDENTE** | Existe baseline de Auth (CSRF, rate limiting, cookie) e 5 arquivos E2E cobrindo Auth/Clientes/Orçamentos; revisão final, produção, `trust proxy`, HTTPS, deploy, backup e smoke tests continuam pendentes. |

### 2.4 Rastreabilidade das fases absorvidas

| Fase antiga | Objetivo original | Estado | Absorvida por | Evidência | Pendências restantes |
|---|---|---|---|---|---|
| Fase 4 — Núcleo de Orçamento | Implementar o modelo de domínio antes dos fluxos HTTP completos. | CONCLUÍDA | `04-orcamentos.md` (D76–D95) | `domain/entities/quote.ts`, `curtain.ts`, `financial-item.ts`; VOs `money`, `quote-number`, `installation-address`, `discount`; specs unitárias do domínio. | Nenhuma nesta fase. PDF, ordem de produção e dashboard pertencem às Fases 8 e 9. |
| Fase 5 — Rascunho, numeração e edição | Permitir a criação real do orçamento e sua edição enquanto permitido. | CONCLUÍDA | `04-orcamentos.md` (D79–D95, D110–D117, D119) | `CreateQuoteFromCustomerUseCase`, `UpdateQuoteUseCase`, `DeleteDraftQuoteUseCase`, `PrismaQuoteSequence`; 16 rotas no `OrcamentosController`; testes de integração e E2E. | Nenhuma nesta fase. Paginação e optimistic locking estão fora do MVP (D113, D120). |
| Fase 6 — Ciclo de vida e histórico | Implementar as transições de negócio com consistência transacional. | CONCLUÍDA | `04-orcamentos.md` (D96–D109, D119) | Use cases de envio, confirmação, reabertura, renovação, cancelamento, produção e conclusão; `quote-state-machine.spec.ts`; testes de transação e rollback de histórico. | Eventos de PDF/ordem de produção permanecem na Fase 8; o enum já os declara, mas não são emitidos. |
| Fase 7 — Instalação | Completar o fluxo operacional após confirmação. | CONCLUÍDA | `04-orcamentos.md` (D104–D107) | `ScheduleInstallationUseCase`, `RemoveInstallationUseCase`, `CompleteServiceUseCase`; testes de instalação e de conclusão bloqueada por instalação futura. | Listas operacionais de instalação pertencem à Fase 9. |
| Fase 9 — Consultas e dashboard (parte de consultas) | Implementar leitura eficiente sem reconstruir aggregates desnecessariamente. | PARCIALMENTE CONCLUÍDA | `04-orcamentos.md` (D113) | `SearchQuotesQuery`, `GetQuoteQuery`, `ListCustomerQuotesQuery`, `ListQuoteHistoryQuery`; `GET /orcamentos?search=&status=`; filtro virtual `EXPIRED` e separação de enviados válidos. | Dashboard por status; próximas instalações; instalações da semana; instalações atrasadas. |

### 2.5 Itens realmente pendentes

| Fase | Itens pendentes |
|---|---|
| 8 — Documentos | Projeção e geração do PDF comercial sob demanda; projeção e geração da ordem de produção; uso dos dados do negócio no PDF; ausência de dados proibidos; registro dos eventos de geração no histórico; não persistir arquivos PDF. |
| 9 — Dashboard e consultas operacionais | Dashboard por status (com `EXPIRED` separado de `SENT` válido); próximas instalações; instalações da semana; instalações atrasadas. |
| 10 — Dados do Negócio | Consultar configuração; atualizar dados do negócio; manter logo como asset fixo. A integração ao PDF comercial foi transferida para a Fase 8. |
| 11 — Frontend | Login e sessão; clientes; detalhes do cliente e histórico; formulário de orçamento mobile-first; cortinas e composição financeira; ciclo de estados; instalação; prévia/geração de documentos; dashboard; dados do negócio; tratamento uniforme de loading, sucesso e erro. |
| 12 — Hardening e entrega | E2E dos fluxos críticos; revisão de autorização/autenticação; revisão CSRF/XSS/logging; validação de dados sensíveis na ordem de produção; revisão de índices e queries; backup; configuração de produção; `trust proxy` com hops confiáveis; HTTPS; deploy; smoke tests pós-deploy. |

### 2.6 Matriz de dependências

| Próxima fase | Depende de | Já disponível? | Bloqueio |
|---|---|---|---|
| Dados do Negócio (Fase 10) | Fase 1 (Prisma), `AuthGuard`, model/tabela `BusinessData` | Parcialmente: schema e tabela existem; auditoria e spec produzidas e validadas; não há módulo, use case, endpoint, seed ou teste. | Decisões materiais aprovadas em `10-dados-negocio.md` em 2026-10-20; implementação não iniciada. |
| PDF comercial (Fase 8) | Fase 10 (identidade do negócio), aggregate e queries de Orçamento, enum de histórico | Parcialmente: Orçamento e `COMMERCIAL_PDF_GENERATED` existem; não há API de dados do negócio nem geração de PDF. | Conclusão da Fase 10; spec `08-documentos.md`; escolha da biblioteca de PDF (decisão adiada em `ARCHITECTURE.md` §22). |
| Ordem de produção (Fase 8) | Aggregate de Orçamento, status `CONFIRMED`/`IN_PRODUCTION`/`COMPLETED`, dados técnicos da cortina, enum de histórico | Sim para os dados e transições; não há `ProductionOrder` por decisão de arquitetura. | Spec `08-documentos.md`; definição do formato de entrega do documento. Não depende de Dados do Negócio. |
| Dashboard (Fase 9 restante) | `QuoteStatus`, condições derivadas `EXPIRED`/instalação atrasada, `scheduledInstallationAt`, queries de leitura | Sim para os dados e para as projeções de D113; não existe `DashboardQuery`. | Spec `09-queries-dashboard.md`; definição dos contadores e listas operacionais. Sem bloqueio estrutural. |
| Frontend (Fase 11) | Contratos HTTP de Auth, Clientes, Orçamento, Documentos, Dashboard e Dados do Negócio | Parcialmente: Auth, Clientes e Orçamento estão disponíveis; Documentos, Dashboard e Dados do Negócio não. | Conclusão das Fases 8, 9 e 10; spec `11-frontend.md`. |
| Hardening e entrega (Fase 12) | Escopo funcional completo (Fases 8–11), topologia de produção, decisões de backup e hosting | Parcialmente: Auth, CSRF, rate limiting, cookie, migrations e 5 arquivos E2E existem. | Conclusão das Fases 8–11; definição de hosting/topologia/backup (`ARCHITECTURE.md` §20 e §22); número de hops confiáveis para `trust proxy`. |

### 2.7 Ordem de execução recomendada

| Ordem | Fase | Justificativa |
|---|---|---|
| 1 | Fase 10 — Dados do Negócio | O PDF comercial exige a identidade do negócio (`PROJECT_SPEC` §10.2). O schema/tabela já existem; é a menor dependência pendente e não depende de documentos. |
| 2 | Fase 8 — Documentos | O PDF comercial consome os dados da Fase 10; a ordem de produção depende apenas do núcleo de Orçamento. Ambos são gerados sob demanda e não persistidos (`ARCHITECTURE.md` §16). |
| 3 | Fase 9 — Dashboard e consultas restantes | Lê dados já produzidos pelo núcleo de Orçamento e não depende de documentos. A posição após a Fase 8 segue a ordem de entrega definida neste plano; não há dependência técnica. |
| 4 | Fase 11 — Frontend | Deve ser construído sobre contratos backend estáveis, incluindo documentos, dashboard e dados do negócio. |
| 5 | Fase 12 — Hardening e entrega | Revisão final, configuração de produção, backup, deploy e smoke tests exigem o escopo funcional e o frontend concluídos. |

Esta ordem não conflita com `PROJECT_SPEC` nem com `ARCHITECTURE`: as fontes não fixam sequência de implementação, e a antecipação da Fase 10 apenas satisfaz a exigência de identidade do negócio no PDF. A numeração histórica das fases permanece inalterada.

### 2.8 Dívidas técnicas e inconsistências documentais registradas

**Dívidas técnicas já registradas** (detalhes em `04-orcamentos.md`, seção “Fechamento da fase”):

- D112 não lista o método transacional `mutate`; o comportamento é autorizado por D119.
- A mensagem fixa de `QuoteValidationError` também acompanha violações de faixa monetária (`TOTAL_OUT_OF_RANGE`).
- A projeção resumida de D113 duplica as fórmulas de D91/D93 em SQL por decisão explícita.
- O risco de sobrescrita em edições simultâneas é aceito em D120 (last-write-wins).

**Inconsistências documentais encontradas nesta reconciliação:**

- `docs/development/03-clientes.md` mantém no cabeçalho “demais tasks não iniciadas”, embora CLIENTES-04 a CLIENTES-22 tenham implementação e testes no repositório e CLIENTES-23/24 tenham concluído a revisão e o fechamento. A Fase 3 foi classificada pelo código; a correção do cabeçalho fica registrada para atualização documental futura.
- As specs `08-documentos.md`, `09-queries-dashboard.md`, `10-dados-negocio.md`, `11-frontend.md` e `12-hardening-deploy.md` ainda não existem. As referências nas fases foram marcadas como “a criar na abertura da fase”.
- O plano anterior previa specs de `04-orcamento-domain.md` a `09-queries-dashboard.md`; a implementação consolidou as Fases 4–7 em `04-orcamentos.md`, e as referências correspondentes já foram ajustadas em ORCAMENTO-48.

---

## 3. Ordem de implementação

### Fase 1 — Persistência e fundação técnica

**Estado:** CONCLUÍDA (2026-10-18).

**Objetivo:** estabelecer o modelo de persistência coerente com os aggregates e preparar a infraestrutura mínima do backend.

- [x] Definir schema Prisma inicial.
- [x] Modelar `User`, `Cliente`, `Orcamento`, `Cortina`, componentes financeiros, adicionais gerais, histórico e sequência anual.
- [x] Definir tipos `Decimal`/inteiros conforme `ARCHITECTURE.md`.
- [x] Criar primeira migration coerente com o modelo aprovado.
- [x] Configurar/validar `PrismaService`.
- [x] Criar seed mínimo para usuário administrativo, se adotado.
- [x] Validar conexão e migrations em ambiente limpo.

**Spec:** `docs/development/01-prisma-foundation.md`

---

### Fase 2 — Autenticação e sessão

**Estado:** CONCLUÍDA (2026-10-18).

**Objetivo:** proteger toda a aplicação antes de implementar dados reais do negócio.

- [x] Modelar usuário administrativo.
- [x] Implementar hash seguro de senha.
- [x] Implementar login.
- [x] Implementar sessão server-side.
- [x] Configurar cookie seguro.
- [x] Implementar guard das rotas privadas.
- [x] Implementar logout/invalidação de sessão.
- [x] Implementar `/auth/me`.
- [x] Adicionar rate limiting no login.
- [x] Adicionar proteção CSRF nas operações mutáveis.

**Spec:** `docs/development/02-auth.md`

---

### Fase 3 — Clientes

**Estado:** CONCLUÍDA.

**Observação:** o cabeçalho de `03-clientes.md` ainda diz “demais tasks não iniciadas”; a classificação se baseia na implementação e nos testes existentes de CLIENTES-04 a CLIENTES-24 (§2.8).

**Objetivo:** implementar o aggregate `Cliente` e disponibilizar o primeiro fluxo de negócio completo.

- [x] Implementar entidade de domínio `Cliente`.
- [x] Implementar `ClienteRepository`.
- [x] Implementar mapper Domain ↔ Prisma.
- [x] Criar cliente.
- [x] Buscar cliente por ID.
- [x] Listar/buscar clientes por nome.
- [x] Atualizar cliente.
- [x] Implementar soft delete.
- [x] Garantir associação histórica dos orçamentos após soft delete.

**Spec:** `docs/development/03-clientes.md`

---

### Fase 4 — Núcleo de Orçamento

**Estado:** ABSORVIDA POR OUTRA FASE — trabalho concluído na spec consolidada de Orçamento.

> A implementação das Fases 4–7 foi consolidada em uma única development spec, `docs/development/04-orcamentos.md` (D76–D124), e encerrada em 2026-10-20 (ORCAMENTO-48). A numeração original é mantida apenas para rastreabilidade; não há trabalho pendente nestas fases.

**Objetivo:** implementar o modelo de domínio antes dos fluxos HTTP completos.

- [x] `Money`.
- [x] `NumeroOrcamento`.
- [x] `EnderecoInstalacao`.
- [x] `Desconto`.
- [x] `ItemFinanceiro`.
- [x] `Cortina`.
- [x] Aggregate Root `Orcamento`.
- [x] Regras de cálculo de medidas.
- [x] Regras monetárias e `HALF_UP`.
- [x] Ajuste comercial global.
- [x] Invariantes de edição e estados terminais.

**Spec:** `docs/development/04-orcamentos.md` (fases 4–7 consolidadas)

---

### Fase 5 — Rascunho, numeração e edição

**Estado:** ABSORVIDA POR OUTRA FASE — trabalho concluído na spec consolidada de Orçamento.

**Objetivo:** permitir a criação real do orçamento e sua edição enquanto permitido.

- [x] Implementar contador anual transacional.
- [x] `POST /clientes/:clienteId/orcamentos`.
- [x] Criar orçamento apenas no primeiro `Salvar rascunho`.
- [x] Adicionar/editar/remover cortinas.
- [x] Adicionar/editar/remover componentes financeiros.
- [x] Adicionar/editar/remover adicionais gerais.
- [x] Definir desconto.
- [x] Definir valor final desejado/ajuste comercial.
- [x] Definir endereço de instalação.
- [x] Excluir fisicamente apenas rascunhos.

**Spec:** `docs/development/04-orcamentos.md` (fases 4–7 consolidadas)

---

### Fase 6 — Ciclo de vida e histórico

**Estado:** ABSORVIDA POR OUTRA FASE — trabalho concluído na spec consolidada de Orçamento.

**Objetivo:** implementar as transições de negócio com consistência transacional.

- [x] Marcar como enviado.
- [x] Validar gate completo de envio.
- [x] Confirmar.
- [x] Renovar.
- [x] Reabrir.
- [x] Cancelar.
- [x] Iniciar produção.
- [x] Concluir serviço.
- [x] Persistir datas do ciclo.
- [x] Derivar `EXPIRADO`.
- [x] Registrar histórico na mesma transação das mudanças relevantes.
- [x] Agrupar alterações de uma edição em um único registro de histórico.

**Spec:** `docs/development/04-orcamentos.md` (fases 4–7 consolidadas)

---

### Fase 7 — Instalação

**Estado:** ABSORVIDA POR OUTRA FASE — trabalho concluído na spec consolidada de Orçamento.

**Objetivo:** completar o fluxo operacional após confirmação.

- [x] Agendar instalação.
- [x] Alterar instalação.
- [x] Remover instalação.
- [x] Bloquear conclusão quando houver instalação futura.
- [x] Derivar condição `Instalação atrasada`.
- [x] Registrar histórico das mudanças.

**Spec:** `docs/development/04-orcamentos.md` (fases 4–7 consolidadas)

---

### Fase 8 — Documentos

**Estado:** PENDENTE.

**Objetivo:** gerar documentos sob demanda sem introduzir estado redundante.

- [ ] Criar DTO/projeção do PDF comercial.
- [ ] Gerar PDF comercial sob demanda.
- [ ] Integrar os dados do negócio à projeção do PDF comercial (item transferido da Fase 10).
- [ ] Criar DTO/projeção da ordem de produção.
- [ ] Gerar ordem de produção sob demanda.
- [ ] Garantir ausência de dados proibidos em cada documento.
- [ ] Registrar geração no histórico.
- [ ] Não persistir arquivos PDF.

**Evidência do estado atual:** `backend/src/modules/orcamentos/infrastructure/documents/` contém apenas `.gitkeep`; não há serviço ou rota de PDF/ordem de produção; não existe tabela nem aggregate `ProductionOrder` (`ARCHITECTURE.md` §16.2). Os valores `COMMERCIAL_PDF_GENERATED` e `PRODUCTION_ORDER_GENERATED` existem no enum `HistoryEventType` e no tipo de leitura do histórico, mas não há geração implementada.

**Dependência:** a geração do PDF comercial depende da Fase 10 (identidade do negócio). A ordem de produção depende apenas do núcleo de Orçamento.

**Spec:** `docs/development/08-documentos.md` (a criar na abertura da fase).

---

### Fase 9 — Consultas e dashboard

**Estado:** REORGANIZADA — parte concluída, parte pendente.

**Objetivo:** implementar leitura eficiente sem reconstruir aggregates desnecessariamente.

- [x] Histórico de orçamentos por cliente.
- [x] Busca por número de orçamento.
- [x] Busca por nome do cliente.
- [x] Filtros de situação.
- [ ] Dashboard por status.
- [x] Separar expirados de enviados válidos.
- [ ] Próximas instalações.
- [ ] Instalações da semana.
- [ ] Instalações atrasadas.

**Observação:** os itens marcados foram implementados no módulo Orçamento (`04-orcamentos.md`, D113: `SearchQuotesQuery`, `ListCustomerQuotesQuery`, `GetQuoteQuery` e `ListQuoteHistoryQuery`) e não devem ser reabertos como trabalho da Fase 9. Permanecem apenas o dashboard e as listas operacionais de instalação.

**Evidência do estado atual:** não existe `DashboardQuery` nem endpoint de dashboard/instalações; as rotas existentes cobrem busca/listagem, detalhe, histórico do orçamento e histórico por cliente.

**Spec:** `docs/development/09-queries-dashboard.md` (a criar na abertura da parte pendente).

---

### Fase 10 — Dados do negócio

**Estado:** PENDENTE — schema/tabela e documentação existem; implementação não iniciada.

**Objetivo:** disponibilizar a configuração comercial usada na apresentação e nos documentos, sem upload ou gerenciamento de logo.

- [ ] Consultar configuração.
- [ ] Atualizar dados do negócio.
- [ ] Manter logo como asset fixo.

**Evidência do estado atual:** existem apenas o model `BusinessData` em `backend/prisma/schema.prisma` e a tabela `business_data` na migration inicial; não há módulo NestJS, use case, endpoint, seed ou teste de dados do negócio. A auditoria `10-dados-negocio-audit.md` e a spec `10-dados-negocio.md` foram produzidas em 2026-10-20, mas a implementação não foi iniciada.

**Reorganização:** o item “Integrar dados ao PDF comercial” foi transferido para a Fase 8, pois a integração pertence à geração do documento e criaria dependência circular se permanecesse aqui.

**Spec:** `docs/development/10-dados-negocio.md` (criada em 2026-10-20 e validada na mesma data; tasks 03–12 planejadas; implementação não iniciada).

---

### Fase 11 — Frontend

**Estado:** PENDENTE — somente boilerplate Vite/React.

**Objetivo:** implementar os fluxos UI sobre contratos backend já estabilizados.

| Área | Estado atual |
|---|---|
| Autenticação (login, sessão, logout) | inexistente |
| Clientes | inexistente |
| Orçamento (formulário, cortinas, composição financeira) | inexistente |
| Ciclo de estados | inexistente |
| Instalação | inexistente |
| Documentos (prévia, PDF, ordem de produção) | inexistente |
| Dashboard | inexistente |
| Dados do negócio (settings) | inexistente |

- [ ] Login e sessão.
- [ ] Clientes.
- [ ] Detalhes do cliente e histórico.
- [ ] Formulário de orçamento mobile-first.
- [ ] Cortinas e composição financeira.
- [ ] Ciclo de estados.
- [ ] Instalação.
- [ ] Prévia/geração de documentos.
- [ ] Dashboard.
- [ ] Dados do negócio.
- [ ] Tratamento uniforme de loading, sucesso e erro.

**Evidência do estado atual:** `frontend/src` contém apenas `App.jsx`, `main.jsx`, CSS e assets do template; não há features, rotas ou cliente HTTP de domínio.

**Dependência:** contratos backend das Fases 8, 9 e 10; Auth, Clientes e Orçamento já estão disponíveis.

**Spec:** `docs/development/11-frontend.md` (a criar na abertura da fase).

---

### Fase 12 — Hardening e entrega

**Estado:** PENDENTE — hardening e entrega permanecem separados das fases funcionais.

**Objetivo:** revisar segurança, observabilidade, configuração de produção, deploy, backup e operação após o escopo funcional estar completo.

- [ ] E2E dos fluxos críticos.
- [ ] Revisão de autorização/autenticação.
- [ ] Revisão CSRF/XSS/logging.
- [ ] Validar ausência de dados sensíveis na ordem de produção.
- [ ] Revisar índices e queries relevantes.
- [ ] Estratégia de backup.
- [ ] Configuração de produção.
- [ ] DEPLOY-SEC-01 — Configurar `trust proxy` com o número exato de hops confiáveis quando a topologia de produção for definida; nunca `trust proxy: true` indiscriminadamente; validar que rate limiting e logs recebem o IP real do cliente.
- [ ] HTTPS.
- [ ] Deploy.
- [ ] Smoke tests pós-deploy.

**Evidência do estado atual:** a Fase 2 já entrega baseline de autenticação, CSRF por `Origin`/`Referer`, rate limiting e cookie; existem 5 arquivos E2E cobrindo Auth, Clientes e Orçamentos. A revisão final, a configuração de produção, `trust proxy`, HTTPS, deploy, backup e smoke tests continuam pendentes.

**Spec:** `docs/development/12-hardening-deploy.md` (a criar na abertura da fase).

---

## 4. Definition of Done por task

Uma task só deve ser marcada como concluída quando, quando aplicável:

- implementação respeita `PROJECT_SPEC.md` e `ARCHITECTURE.md`;
- testes relevantes passam;
- lint/typecheck passam;
- migration é reproduzível quando houver alteração de banco;
- erros esperados possuem tratamento explícito;
- nenhum dado sensível é logado;
- documentação é atualizada quando a decisão implementada muda contrato, schema ou comportamento;
- não existem TODOs críticos escondendo regra incompleta.

---

## 5. Uso recomendado com Codex

Para cada rodada de implementação, fornecer ao agente:

1. a task atual deste plano;
2. a development spec correspondente;
3. trechos relevantes do `PROJECT_SPEC.md`;
4. trechos relevantes do `ARCHITECTURE.md`;
5. estado atual do código/testes.

Evitar solicitar várias fases em um único prompt. O agente deve implementar uma unidade pequena, executar os testes e apresentar o diff/resultado antes da próxima task.
