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

### Já concluído

- [x] Projeto backend NestJS criado.
- [x] Projeto frontend React + Vite + TypeScript criado.
- [x] `docker-compose` de desenvolvimento configurado.
- [x] PostgreSQL de desenvolvimento disponível via Docker.
- [x] `PROJECT_SPEC.md` consolidado.
- [x] `ARCHITECTURE.md` consolidado.
- [x] Fase 2 — Autenticação e sessão.
- [x] Fase 3 — Clientes.
- [x] Fases 4–7 — Núcleo de Orçamento (domínio, rascunho/edição, ciclo de vida/histórico e instalação), encerrado em 2026-10-20 (ORCAMENTO-48).

### Próxima etapa

- [ ] Implementar a Fase 8 — Documentos.

---

## 3. Ordem de implementação

### Fase 1 — Persistência e fundação técnica

**Objetivo:** estabelecer o modelo de persistência coerente com os aggregates e preparar a infraestrutura mínima do backend.

- [ ] Definir schema Prisma inicial.
- [ ] Modelar `User`, `Cliente`, `Orcamento`, `Cortina`, componentes financeiros, adicionais gerais, histórico e sequência anual.
- [ ] Definir tipos `Decimal`/inteiros conforme `ARCHITECTURE.md`.
- [ ] Criar primeira migration coerente com o modelo aprovado.
- [ ] Configurar/validar `PrismaService`.
- [ ] Criar seed mínimo para usuário administrativo, se adotado.
- [ ] Validar conexão e migrations em ambiente limpo.

**Spec:** `docs/development/01-prisma-foundation.md`

---

### Fase 2 — Autenticação e sessão

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

**Objetivo:** gerar documentos sob demanda sem introduzir estado redundante.

- [ ] Criar DTO/projeção do PDF comercial.
- [ ] Gerar PDF comercial sob demanda.
- [ ] Criar DTO/projeção da ordem de produção.
- [ ] Gerar ordem de produção sob demanda.
- [ ] Garantir ausência de dados proibidos em cada documento.
- [ ] Registrar geração no histórico.
- [ ] Não persistir arquivos PDF.

**Spec:** `docs/development/08-documentos.md`

---

### Fase 9 — Consultas e dashboard

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

**Spec:** `docs/development/09-queries-dashboard.md`

---

### Fase 10 — Dados do negócio

- [ ] Consultar configuração.
- [ ] Atualizar dados do negócio.
- [ ] Integrar dados ao PDF comercial.
- [ ] Manter logo como asset fixo.

**Spec:** `docs/development/10-dados-negocio.md`

---

### Fase 11 — Frontend

**Objetivo:** implementar os fluxos UI sobre contratos backend já estabilizados.

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

**Spec:** `docs/development/11-frontend.md`

---

### Fase 12 — Hardening e entrega

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

**Spec:** `docs/development/12-hardening-deploy.md`

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
