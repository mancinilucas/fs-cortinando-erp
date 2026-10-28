# Fase 12 — Auditoria de hardening e entrega (HARDENING-01)

**Task:** HARDENING-01 — Auditar o estado atual antes da implementação.
**Data:** 2026-10-27.
**Natureza:** inspeção documental e de código; nenhum código, configuração,
schema, migration, segredo ou infraestrutura foi alterado.
**Spec que consome esta auditoria:** `docs/development/12-hardening.md`.
**Fontes:** `AGENTS.MD`; `docs/PROJECT_SPEC.md` (§10.6, §13–§14, §17);
`docs/ARCHITECTURE.md` (§13–§14, §17, §20–§22); `docs/IMPLEMENTATION_PLAN.md`
(Fases 11–12); specs e fechamento das Fases 2, 8, 9, 10 e 11; código atual.

---

## 1. Objetivo

Estabelecer o baseline real da Fase 12 após a conclusão da Fase 11, distinguir
controles já existentes de tarefas ainda necessárias e localizar decisões
externas que bloqueiam produção. Esta auditoria é somente leitura: não instala
dependências, não executa deploy, não revela valores de arquivos de ambiente
e não altera código ou banco.

---

## 2. Método e hierarquia das fontes

Precedência aplicada, conforme `AGENTS.MD`:

1. `PROJECT_SPEC.md` para privacidade, autenticação e critérios de produto.
2. `ARCHITECTURE.md` para limites técnicos, segurança, infraestrutura e testes.
3. Decisões aprovadas das specs anteriores.
4. Código e configuração efetivamente presentes.
5. `IMPLEMENTATION_PLAN.md` para sequência e estado.

Os documentos de fechamento são referências; o código é usado para
confirmar implementação. A existência de testes é evidência de cobertura
automatizada, mas não substitui a inspeção das assertions nem uma validação
de ambiente de produção.

---

## 3. Estado de partida

- O plano registra Fases 8–11 concluídas e Fase 12 pendente.
- A árvore de trabalho estava limpa antes da criação destes documentos.
- `docs/development/12-hardening.md` ainda não existia.
- As decisões de hosting, topologia, número de proxies confiáveis e backup
  não estão definidas.
- A spec detalhada está criada junto desta auditoria; não foi feita
  implementação de produto.

---

## 4. Baseline de segurança no backend

### 4.1 Autenticação, sessão e proteção

O repositório já possui módulo de autenticação e testes para login, sessão,
logout, rotas protegidas, throttling e cookie. A aplicação registra
`CsrfOriginGuard` globalmente (`backend/src/app.module.ts`) e habilita CORS
com origens configuradas (`backend/src/main.ts`). O `ValidationPipe` global
usa `whitelist` e `transform`.

Isso confirma uma baseline funcional das Fases 1–2, não a aprovação de
produção. Na inicialização atual, `main.ts` não configura `trust proxy`, não
há decisão observável de cabeçalhos/CSP e o valor de `APP_ORIGIN` do exemplo
é somente o endereço de desenvolvimento. Cookies e rate limit ainda devem
ser verificados sob a topologia real.

Há teste HTTP específico de rate limit que configura `trust proxy` no app de
teste para simular `X-Forwarded-For`; isso não comprova a configuração de
produção. O próprio teste comenta que o valor de produção depende do proxy.

### 4.2 Logs e erros

Existem logs estruturados de eventos de rate limit e logs de falhas de
autenticação. `ARCHITECTURE.md` §21.1 proíbe registrar credenciais, tokens,
cookies e payloads pessoais sem necessidade; erros internos não devem
expor stack traces ao cliente em produção. A fase deve verificar todos os
caminhos relevantes, incluindo filtros globais, falhas de documentos e
logging do provedor escolhido.

### 4.3 Cabeçalhos, XSS e CSP

O backend inicializa Nest/Express, CORS e validação. A configuração
inspecionada não evidencia Helmet nem política CSP/cabeçalhos de segurança
definida. A Fase 11 deixou explicitamente topologia, mesma origem, CSP e
cabeçalhos para esta fase (D328). A escolha deve considerar PDFs inline,
assets/fontes e domínio real; não fixar uma política sem testar o frontend.

---

## 5. Frontend e exposição de configuração

- `frontend/.env.example` e o README informam que `VITE_*` é público e que
  caminhos relativos são padrão; a topologia final foi adiada para a Fase 12.
- O cliente usa paths relativos por padrão, o que permite mesma origem, mas
  não prova que o deployment deva ser same-origin.
- D328 em `11-frontend.md` reserva topologia, CSP e headers para a Fase 12.
- D330 reservou E2E de navegador para esta fase; D329 cobre testes unitários,
  hooks e componentes críticos, não substituindo a jornada integrada real.
- O README de backend ainda contém texto de template NestJS sobre serviços de
  deployment e observabilidade. Não é procedimento operacional específico do
  Cortinando ERP e deve ser substituído/documentado na task pertinente.

Não foi feita inspeção ou divulgação de valores de `backend/.env`; a auditoria
deve verificar apenas nomes/requisitos de configuração e estado de tracking,
nunca copiar segredos para esta documentação.

---

## 6. Cobertura de testes existente

No repositório há testes unitários/integração nove arquivos E2E HTTP do
backend: Auth, Clientes, Orçamentos, Dados do Negócio, Dashboard e documentos
(incluindo lifecycle alternativo). A spec de fechamento da Fase 11 registra
52 arquivos e 702 testes de frontend, com typecheck, lint, build e
`git diff --check` aprovados naquela rodada.

Esses registros são baseline documental, não uma execução nesta auditoria.
Não foram rodados testes conforme o escopo de leitura. Antes do fechamento
de hardening, rodar os gates atuais e reconciliar contagens/saídas. Lacuna
confirmada: não há teste E2E de navegador definido no projeto até a criação
desta fase. Cobrir fluxo integrado, isolamento de dados e limpeza sob falha.

---

## 7. Banco, migrations, índices e queries

- O schema é Prisma/PostgreSQL e migrations são versionadas.
- As Fases 8–10 registraram validação de schema, status de migration e testes
  de integração; a Fase 12 deve confirmar o estado atual em ambiente
  controlado antes do deploy.
- Há índices definidos no schema e nas migrations; a existência deles não
  demonstra adequação para workload de produção. Revisar queries relevantes
  com plano de execução e dados representativos antes de adicionar índices.
- Nenhuma evidência documental ou configuração encontrada define backup
  automático, retenção, criptografia, RPO/RTO, restore test ou responsável.
- Não alterar schema ou criar índices apenas como hardening preventivo sem
  evidência de query, plano e benefício/custo.

---

## 8. Deploy, proxy e operação

`ARCHITECTURE.md` §20 define apenas React → HTTPS → NestJS → PostgreSQL e
permite Docker Compose conforme o provedor. §22 adia hosting e ferramenta de
observabilidade. Não foram encontrados artefatos específicos de produção que
definam provedor, domínio, DNS, terminação TLS, health check, secrets, pipeline
de deploy, migrations de release, rollback ou smoke test.

`backend/src/main.ts` ouve `PORT` (default 3000) e não define `trust proxy`.
Não existe valor justificável para hops antes de escolher e inspecionar a
cadeia de proxies. A task DEPLOY-SEC-01 do plano é um gate explícito.

Há `docker-compose.yml` de desenvolvimento. Ele não deve ser tomado como
topologia de produção sem auditoria de segurança, persistência, rede, secrets,
backup e atualização.

---

## 9. Lacunas confirmadas e dependências

| Lacuna | Estado | Dependência |
|---|---|---|
| E2E no navegador | Pendente | escolher ferramenta/ambiente e isolar dados de teste |
| Auditoria final Auth/CSRF/CORS/rate limit | Pendente | teste com origem e proxy reais após decisão de topologia |
| CSP e headers de segurança | Pendente | origem, assets, fonts e fluxo de PDF conhecidos |
| Política de log/erro em produção | Revisão pendente | confirmar logging e plataforma |
| Privacidade da ordem de produção | Implementada na Fase 8; verificação final pendente | comparar PDF gerado contra §10.6 |
| Queries e índices | Revisão pendente | plano e volume representativo |
| Hosting e domínio | Não decidido | validação humana/operacional |
| Segredos/bootstrap | Não documentado para produção | provedor e gestão de secrets escolhidos |
| `trust proxy` | Não configurado | topologia e hops exatos |
| Backup/restore | Não documentado | decisão de RPO/RTO, frequência e retenção |
| HTTPS e deploy | Não configurados | domínio, DNS, credenciais e provedor |
| Smoke tests remotos | Não executados | deploy de produção acessível |
| Observabilidade | Ambígua | definir mínimo e retenção sem exceder o produto |

---

## 10. Ambiguidades a resolver antes do deploy

1. **Topologia:** uma origem para SPA/API é compatível com paths relativos,
   mas não está aprovada. Duas origens exigem política CORS e cookie
   correspondente.
2. **Proxy confiável:** o número de hops não pode ser inferido antes de
   conhecer load balancer/CDN/proxy e a forma como cada camada substitui ou
   acrescenta `X-Forwarded-For`.
3. **Headers/CSP:** política estrita pode bloquear fontes, assets ou PDFs; a
   política precisa ser verificada contra o build real.
4. **Dados de conta inicial:** o mecanismo seguro para seed/bootstrap em
   produção deve ser definido sem credenciais permanentes em `.env` ou logs.
5. **Recuperação:** `PROJECT_SPEC` exige backup adequado, mas não fixa
   objetivos nem frequência. Esses valores são decisão do negócio/operador.
6. **Deploy:** não existe provedor escolhido e portanto não há ação remota
   autorizada ou executável nesta auditoria.

---

## 11. Ordem recomendada

1. Validar D341–D345 da spec, começando por provedor/topologia e domínio.
2. Fechar auditoria técnica de segurança, privacidade, queries e logs;
   corrigir achados com maior risco.
3. Implementar e estabilizar E2E de navegador com banco isolado.
4. Implementar configuração de produção e validação de env conforme a
   topologia aprovada.
5. Implementar backup e provar restauração em ambiente isolado.
6. Configurar TLS, proxy e deploy; verificar IP e cookie reais.
7. Rodar smoke tests, registrar evidências e atualizar os documentos de
   operação e plano.

Auditorias e testes locais independentes podem avançar antes das decisões
externas; nenhuma configuração remota deve ser inventada para desbloquear o
trabalho.

---

## 12. Conclusão

A aplicação possui baseline funcional de autenticação, CSRF, rate limiting,
testes HTTP e frontend concluído. A lacuna central da Fase 12 é a ausência de
decisões e artefatos de operação de produção, além de E2E no navegador e
revisão final de segurança/privacidade. Hosting, domínio, proxy, gestão de
secrets, backup e objetivos de recuperação precisam de decisão antes do
deployment. Esta auditoria não executou checks nem alterou implementação;
as tarefas estão decompostas em `12-hardening.md`.
