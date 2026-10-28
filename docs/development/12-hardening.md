# 12 — Hardening e entrega

**Status:** especificação inicial; decisões de hospedagem e operação pendentes.
**Task de origem:** HARDENING-02 — Definir decisões, escopo e decomposição da Fase 12.
**Auditoria de origem:** `docs/development/12-hardening-audit.md` (HARDENING-01).
**Fontes de verdade:** `docs/PROJECT_SPEC.md` (§10.6, §13–§14, §17), `docs/ARCHITECTURE.md` (§13, §14, §17, §20–§22), `docs/IMPLEMENTATION_PLAN.md` (Fase 12), `AGENTS.MD`, decisões aprovadas D1–D334.

Esta spec organiza a última fase do MVP. O trabalho combina revisão do
software com decisões de operação e entrega. Nenhuma decisão sobre provedor,
domínio, região, retenção de backup ou topologia deve ser presumida: os itens
dependentes dessas escolhas permanecem bloqueados até que os valores reais
sejam registrados.

---

## 1. Como ler este documento

Cada decisão usa os marcadores do padrão das fases anteriores:

| Marcador | Significado |
|---|---|
| **[F]** | Determinada pelas fontes; registrar e implementar sem redefinir requisito. |
| **[P]** | Proposta compatível com as fontes; requer validação antes de se tornar normativa. |
| **[V]** | Decisão material pendente de validação humana; bloqueia somente o trabalho dependente. |
| **[A]** | Aprovada em revisão humana e normativa para esta fase. |

Decisões [P] e [V] não autorizam alterar silenciosamente requisitos de produto,
arquitetura, hospedagem ou tratamento de dados. Quando uma decisão aprovada
for tomada, registrar data, alternativa e responsável na seção 7, preservando
as demais fontes.

### 1.1 Nomenclatura

- Código, identificadores, configurações e commits permanecem em inglês.
- Documentação de produto e desenvolvimento permanece em português.
- IDs desta fase usam `HARDENING-XX`; decisões continuam a sequência após
  D334, sem reutilizar identificadores.

### 1.2 Fora do escopo

- Novas funcionalidades de produto, papéis/RBAC ou cadastro público.
- MFA/TOTP obrigatório: a arquitetura o classifica como melhoria recomendada,
  não requisito do MVP.
- Integração com WhatsApp, armazenamento/versionamento de PDFs ou mudanças de
  comportamento de negócio.
- Kubernetes, Redis, broker ou decomposição do monólito, não necessários na
  arquitetura atual.
- Refatorações sem vínculo demonstrável com segurança, confiabilidade,
  operação ou entrega.
- Alteração de dados reais, publicação em domínio ou criação de recursos
  pagos sem decisão explícita e credenciais do ambiente de produção.

---

## 2. Escopo e critérios de conclusão

A fase fecha quando:

1. os fluxos críticos e as fronteiras de segurança têm cobertura de teste
   compatível com o risco, incluindo E2E de navegador;
2. as revisões de autenticação/autorização, CSRF/XSS, logs, privacidade da
   ordem de produção e queries/índices foram concluídas e achados críticos
   corrigidos;
3. decisões de hosting, origem pública, proxy, TLS, secrets, banco e backup
   estão registradas e reproduzíveis;
4. há procedimento validado de backup e restauração, com acesso e retenção
   compatíveis com o ambiente escolhido;
5. configuração de produção não contém segredos no frontend nem defaults
   inseguros, migrations são aplicáveis de modo documentado e logs não expõem
   credenciais ou dados pessoais desnecessários;
6. a aplicação foi implantada no ambiente escolhido e os smoke tests pós-
   deploy passaram;
7. documentação de operação, evidências, limitações e rollback estão
   registradas.

Um deploy não pode ser marcado como concluído se o destino, as credenciais,
DNS ou permissões ainda não estiverem disponíveis. Nesse caso, concluir os
itens independentes e registrar o bloqueio concreto, sem declarar a fase
fechada.

---

## 3. Decisões confirmadas pelas fontes

### D335 — Segurança e privacidade existentes como baseline [F]

Preservar e revisar sessão server-side, cookie seguro em produção, expiração,
regeneração/invalidação, hash de senha, proteção CSRF, rate limiting no login,
mensagens que não facilitem enumeração e rotas privadas autenticadas.

**Fontes:** `ARCHITECTURE.md` §13; `PROJECT_SPEC.md` §13–§14; baseline da
Fase 2. A Fase 12 verifica comportamento e configuração; não substitui esses
controles por tokens ou credenciais fixas.

### D336 — Topologia e transporte [F]

O tráfego público deve usar HTTPS. O backend e o PostgreSQL não devem ser
expostos publicamente sem necessidade. A arquitetura mantém aplicação única
com PostgreSQL; não requer Redis, broker ou Kubernetes.

**Fontes:** `ARCHITECTURE.md` §20 e §13.2. O modo concreto de hosting continua
pendente de decisão.

### D337 — Privacidade dos documentos e dos logs [F]

A ordem de produção contém somente os dados técnicos permitidos em
`PROJECT_SPEC.md` §10.6. Logs técnicos não registram integralmente senhas,
tokens, cookies, CPF/CNPJ ou payloads pessoais sem necessidade. Histórico de
negócio permanece separado dos logs técnicos.

**Fontes:** `PROJECT_SPEC.md` §10.6 e §14.3; `ARCHITECTURE.md` §21.

### D338 — E2E de navegador nesta fase [F]

Avaliar e cobrir os fluxos críticos ponta a ponta no navegador. A decisão
D330 da Fase 11 reservou esta cobertura para a Fase 12. A ferramenta e o
escopo exato serão fixados após verificar o CI e o ambiente disponíveis; não
adicionar ferramenta antes dessa verificação.

**Fontes:** D330 em `11-frontend.md`; `ARCHITECTURE.md` §17; Fase 12 do
`IMPLEMENTATION_PLAN.md`.

### D339 — `trust proxy` depende da topologia comprovada [F]

Configurar apenas o número ou a lista exata de proxies confiáveis que o
deployment realmente utiliza. Nunca usar `trust proxy: true` indiscriminado.
Verificar IP real observado por rate limiting e logging com a cadeia de
proxies real. Nenhum número de hops será inferido a partir de configuração de
desenvolvimento ou de teste.

**Fonte:** item DEPLOY-SEC-01 em `IMPLEMENTATION_PLAN.md`.

### D340 — Backup e restauração são requisito de entrega [F]

Produção precisa de estratégia adequada de backup PostgreSQL, e a estratégia
precisa ser validada por restauração. A frequência, retenção, RPO/RTO e local
de armazenamento não estão definidos pelas fontes; não inventá-los.

**Fontes:** `PROJECT_SPEC.md` §14.4; `ARCHITECTURE.md` §20.

---

## 4. Decisões pendentes para validação

As decisões desta seção são gates da configuração de produção. A equipe pode
continuar auditorias locais e preparar artefatos independentes enquanto elas
estiverem pendentes.

### D341 — Provedor e topologia de produção [V]

Escolher onde serão executados frontend, API e PostgreSQL; registrar região,
exposição de rede, terminação TLS, origem pública e relação de mesma origem.
Considerar as alternativas compatíveis com monólito + PostgreSQL definido na
arquitetura. Não escolher um provedor por conveniência do template.

**Bloqueia:** `trust proxy`, configuração CORS/`APP_ORIGIN`, deploy e smoke
tests remotos.

### D342 — Domínio, origem pública e política de cookie [V]

Registrar domínio HTTPS real, origem da SPA e da API, política CORS e
`SameSite`/prefixo do cookie compatíveis com a topologia. O cookie deve
permanecer `HttpOnly` e `Secure` em produção; avaliar `__Host-` quando a
topologia permitir.

**Bloqueia:** configuração final de auth, CORS e testes remotos.

### D343 — Segredos e configuração de ambiente [V]

Definir armazenamento, provisionamento, rotação e acesso aos secrets de
produção, inclusive `DATABASE_URL` e credencial/hash inicial da conta
administrativa. Segredos não podem ser incluídos em `VITE_*`, imagem pública,
logs ou documentação versionada. Não registrar valores reais nos arquivos de
exemplo.

**Bloqueia:** bootstrap operacional e deploy.

### D344 — Política de backup e objetivos de recuperação [V]

Definir frequência, retenção, destino, criptografia/acesso, responsável e
objetivos de recuperação (RPO/RTO) adequados ao uso do negócio. Documentar e
executar restauração em ambiente controlado antes de considerar o backup
validado.

**Bloqueia:** aceite operacional de produção.

### D345 — Observabilidade mínima [V]

O plano menciona observabilidade, mas as fontes não definem produto, alertas
ou objetivos. Decidir o mínimo operacional necessário (logs, disponibilidade,
erros e alertas), retenção e acesso, sem registrar dados pessoais
desnecessários nem adotar uma plataforma por pressuposto.

**Bloqueia:** aceite de monitoramento, não a auditoria de código.

---

## 5. Auditorias e implementação

### HARDENING-01 — Auditoria do estado atual

Task de leitura, registrada em `12-hardening-audit.md`. Inventariar segurança,
testes, build, banco, índices, configuração, deploy, backup e lacunas com
referências verificáveis. Não alterar código ou infraestrutura durante a
auditoria.

### HARDENING-02 — Decisões e decomposição

Esta spec define decisões confirmadas, propostas e gates. Após a validação das
decisões [V], registrar as alternativas escolhidas como [A] e ajustar somente
as tasks dependentes.

### HARDENING-03 — E2E de navegador

- Escolher ferramenta compatível com versões e CI presentes, justificando a
  dependência e o custo operacional.
- Cobrir login/logout e proteção de rotas; jornada cliente → orçamento →
  envio → confirmação → produção → instalação opcional → conclusão.
- Cobrir documentos e falhas/transições inválidas relevantes sem usar dados
  reais.
- Isolar banco/dados de teste e garantir limpeza previsível, inclusive após
  falha de execução.
- Não tornar teste de navegador substituto para unitários, integração ou E2E
  HTTP existentes.

### HARDENING-04 — Revisão de segurança e privacidade

- Mapear endpoints públicos/privados e garantir auth em toda funcionalidade
  privada.
- Verificar sessão, cookie, login, enumeração, rate limit, CSRF e origens
  permitidas com casos positivos e negativos.
- Verificar XSS/reflexão e conteúdo da UI, cabeçalhos de segurança e a decisão
  sobre CSP segundo a topologia real.
- Inspecionar logs e erros retornados; não expor stack trace, segredo ou dado
  pessoal sem finalidade.
- Comparar PDF de produção e comercial com allowlist/denylist da spec; a
  ordem de produção não deve conter identificadores, contato ou valores.
- Registrar achados por severidade, evidência, impacto, correção e reteste.

### HARDENING-05 — Queries, índices e confiabilidade de dados

- Revisar queries operacionais e planos de execução com dados de teste
  representativos; evitar N+1 e leituras desnecessárias do aggregate.
- Comparar filtros/ordenações/joins relevantes com índices existentes.
- Só propor índice se query e plano demonstrarem necessidade; registrar
  custo de escrita e incluir migration reproduzível se aprovada.
- Confirmar migrations aplicadas e instruções de backup/restore antes de
  qualquer mudança no banco de produção.

### HARDENING-06 — Configuração de produção

- Implementar apenas após D341–D343 aprovadas.
- Definir modo production, binding/porta, health check se a plataforma exigir,
  CORS, cookie, HTTPS, cabeçalhos, proxy e limites de recursos conforme o
  deployment escolhido.
- Adicionar validação explícita de configuração necessária no startup; falhar
  com mensagem segura quando variável obrigatória estiver ausente ou inválida.
- Separar build do frontend e runtime da API; nenhum segredo pode integrar o
  bundle do frontend.
- Documentar comandos reproduzíveis de build, migration e execução, sem
  executar migrations destrutivas automaticamente no boot sem decisão.

### HARDENING-07 — Backup e recuperação

- Implementar a estratégia aprovada em D344.
- Restringir acesso e proteger backups conforme a sensibilidade dos dados.
- Executar restauração em banco/ambiente isolado e registrar tempo, resultado
  e limitações.
- Documentar execução, validação, restauração e responsabilidades.

### HARDENING-08 — HTTPS e deploy

- Dependente das decisões de hosting e domínio.
- Provisionar HTTPS e validar redirecionamento/headers na origem pública.
- Aplicar migrations em procedimento controlado e confirmar versão do schema.
- Configurar `trust proxy` exato e comprovar IP observado com requisição
  através da cadeia real.
- Deploy reproduzível, secrets provisionados fora do repositório e plano de
  rollback documentado.

### HARDENING-09 — Smoke tests e fechamento

- Verificar disponibilidade, login, sessão, rotas privadas e logout.
- Criar/consultar cliente e executar fluxo de orçamento representativo.
- Gerar PDF comercial e ordem de produção nos estados permitidos; validar
  que não houve vazamento de dados.
- Verificar dashboard, erros seguros, HTTPS e logs sem segredos.
- Registrar ambiente, commit/imagem implantada, horário, resultados e falhas.
- Atualizar `IMPLEMENTATION_PLAN.md` e fechar a fase só após todos os gates
  necessários.

---

## 6. Gates de verificação

Os checks devem ser executados no escopo afetado e seus resultados
registrados nas tasks. A lista não substitui testes orientados a risco:

```bash
cd backend
pnpm lint
pnpm build
pnpm test
pnpm test:e2e
npx prisma validate
npx prisma migrate status

cd ../frontend
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Quando houver E2E de navegador, executar separadamente com ambiente isolado e
registrar a ferramenta/versão. Checks de banco/deploy exigem ambiente
controlado; não usar produção para testes destrutivos.

---

## 7. Registro da validação humana

| Decisão | Status | Alternativa aprovada | Data/evidência |
|---|---|---|---|
| D341 — Provedor e topologia | Pendente | — | — |
| D342 — Domínio e cookie | Pendente | — | — |
| D343 — Segredos e configuração | Pendente | — | — |
| D344 — Backup e recuperação | Pendente | — | — |
| D345 — Observabilidade mínima | Pendente | — | — |

---

## 8. Fechamento da fase

**Estado:** não iniciada.

Após a conclusão, registrar aqui as tasks realizadas, achados e reparos,
comandos e resultados dos gates, ambiente efetivamente implantado, evidência
dos smoke tests, resultado de restauração de backup e limitações restantes.
Atualizar o status no `IMPLEMENTATION_PLAN.md`; a fase só será concluída
quando os critérios da seção 2 estiverem satisfeitos ou qualquer exceção
estiver explicitamente aceita e registrada.
