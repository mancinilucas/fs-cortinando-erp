# Fase 11 — Frontend

**Task de origem:** FRONTEND-02 — Fechar arquitetura, UX, navegação e
contratos da Fase 11
**Data:** 2026-10-20
**Branch:** `feat/11-frontend`
**Auditoria:** `docs/development/11-frontend-audit.md`
**Natureza:** decisões de arquitetura, UX e contrato; decomposição definitiva e registro da execução de FRONTEND-03 em 2026-10-21.
**Estado:** VALIDADA — implementação da Fase 11 autorizada.

Esta spec fecha a fundação técnica, a navegação, os contratos consumidos e as
decisões de UX da Fase 11. Ela **não** implementa telas, componentes, cliente
HTTP ou testes. A fundação de dependências foi executada em FRONTEND-03, conforme registro em §23. As treze decisões antes marcadas `[V]` foram
validadas em 2026-10-20 e estão registradas como `[A]`. Não há `[V]`
pendente. A implementação está autorizada; a decomposição atômica definitiva está consolidada em §23 (FRONTEND-03 a FRONTEND-32).

As decisões `[P]` só foram promovidas a `[A]` quando eram consequência direta
e necessária das decisões aprovadas; as que ainda representam escolha
material de UX ou arquitetura permanecem `[P]` e estão destacadas em §21.

---

## 1. Marcadores

- `[F]` — determinado pelas fontes (`PROJECT_SPEC.md`, `ARCHITECTURE.md`,
  decisões aprovadas D1–D259 ou código implementado).
- `[P]` — proposta desta spec; pode ser implementada salvo objeção. As
  escolhas materiais de UX ou arquitetura ainda abertas estão destacadas em
  §21.3.
- `[V]` — requer validação humana antes da implementação. Não há decisão
  nesta classificação.
- `[A]` — aprovada pelo responsável do produto; validações originais em 2026-10-20; D334, D322, D272 e D281 em 2026-10-21.

### 1.1 Sumário das decisões

| Classificação | Quantidade | Decisões |
| --- | --- | --- |
| `[F]` | 30 | D260, D261, D262, D266, D274, D275, D276, D280, D285, D287, D290, D293, D295, D297, D302, D306, D307, D308, D313, D315, D316, D318, D319, D320, D327, D328, D330, D331, D332, D333 |
| `[P]` | 22 | D277, D278, D279, D283, D284, D286, D288, D291, D292, D294, D296, D301, D304, D305, D309, D310, D311, D312, D317, D321, D323, D329 |
| `[V]` | 0 | — |
| `[A]` | 23 | D263, D264, D265, D267, D268, D269, D270, D271, D272, D273, D281, D282, D289, D298, D299, D300, D303, D314, D322, D324, D325, D326, D334 |

A faixa D260–D333 continua imediatamente após D259, a última decisão da Fase
9.

---

## 2. Escopo e fontes

### D260 — Idioma da interface e do código `[F]`

**Decisão:** toda a interface e todo o texto visível ao usuário são em
português do Brasil. Identificadores de código, tipos, campos JSON, testes,
comentários e mensagens de commit permanecem em inglês.

**Justificativa:** `docs/PROJECT_SPEC.md` está integralmente em português e
descreve uma consultora brasileira; `AGENTS.MD` (General rules) exige código,
comentários, testes e identificadores Prisma em inglês; D77 fixa identificadores
HTTP e enums em inglês.

**Impacto:** centralizar rótulos em `src/shared/format/labels.ts` e mensagens
de erro em `src/shared/errors/error-messages.ts`. Nenhuma string de produto
em inglês deve chegar à tela, mesmo que o backend responda em inglês.

### D261 — Mobile-first e responsivo `[F]`

**Decisão:** a interface é mobile-first, responsiva e adequada ao toque. O
layout nasce para largura de telefone e progride para tablet e desktop. Não
há premissa desktop-first.

**Justificativa:** `docs/PROJECT_SPEC.md` §1.3, item 12 (“operar adequadamente
em dispositivos móveis”), §14.1 (“Interface mobile-first; responsiva e
adequada para uso por toque; formulários adequados ao uso durante
atendimento”) e §17 (“interface deve funcionar adequadamente em mobile e
desktop”); `docs/ARCHITECTURE.md` §18 (“mobile-first”).

**Conflito registrado:** a solicitação original desta fase mencionava uma
abordagem inicial desktop-first. Essa sugestão não pode sobrepor as fontes de
prioridade superior. A decisão adotada é mobile-first. Nenhuma tela deve ser
desenhada primeiro para desktop e depois reduzida.

**Impacto:** shell com navegação inferior no telefone, formulários em coluna
única, alvos de toque de pelo menos 44 px, diálogos em tela cheia no telefone,
tabelas convertidas em cartões ou listas.

### D262 — Backend é a fonte de verdade `[F]`

**Decisão:** o frontend não é autoridade sobre cálculos, transições, gates,
condições derivadas, numeração ou normalização. A UI pode validar formato e
campos obrigatórios para feedback imediato, mas deve aceitar a resposta do
backend como definitiva.

**Justificativa:** `docs/ARCHITECTURE.md` §18 (“frontend não replica regras
críticas como fonte de verdade; validações de UX podem existir, mas o backend
continua responsável pela integridade”); `docs/PROJECT_SPEC.md` §14.2;
`AGENTS.MD` (Frontend: “Follow backend contracts rather than duplicating
business rules”).

**Impacto:** totais, `expired`, `lateInstallation`, `sequence`, números e
transições vêm do servidor. Erros `409` e `422` são tratados como resultado
normal de negócio, não como falha inesperada.

### D263 — Migração para TypeScript `[A]`

**Decisão aprovada:** alternativa A. Migrar o template de JavaScript para
TypeScript antes de implementar qualquer feature, com `strict: true`, alias
`@/` e scripts separados de `typecheck`, `lint`, `test` e `build`.

**Condições aprovadas:**

- `strict: true`.
- `.ts` para código sem JSX e `.tsx` para React.
- `typecheck` é gate separado e obrigatório.
- Evitar `any`.
- Não usar casts para mascarar contratos incorretos.
- Não importar tipos do backend por filesystem.
- Não criar pacote compartilhado de tipos nesta fase.
- Não introduzir OpenAPI nem codegen.

**Alternativas registradas:**

- **A (aprovada):** migrar agora, como primeira etapa da Fase 11.
- **B:** permanecer em JavaScript e documentar tipos apenas com JSDoc.
- **C:** implementar as features em JavaScript e migrar ao final da fase.

**Motivo:** o backend expõe contratos ricos (dezenas de campos aninhados,
enums, uniões e campos derivados); o formulário de orçamento é o maior do
produto; `docs/IMPLEMENTATION_PLAN.md` linha 31 já declara TypeScript como
estado esperado. Migrar antes é mais barato do que migrar depois de dezenas de
componentes. A alternativa B perde a verificação de contratos; a C espalha o
retrabalho e mistura dois escopos.

**Impacto:** renomear os arquivos do template, criar `tsconfig.json` e
`tsconfig.node.json`, adicionar `typescript` e `typescript-eslint`, ajustar o
ESLint e o script de build (`tsc -b && vite build`). É a decisão mais
estrutural da fase.

### D264 — Biblioteca de rotas `[A]`

**Decisão aprovada:** alternativa A. Adotar `react-router` em modo
declarativo, com o mapa de rotas centralizado em `src/app/router.tsx`. Não
implementar roteamento manual.

**Alternativas registradas:**

- **A (aprovada):** `react-router` 7 (`createBrowserRouter` ou
  `<BrowserRouter>` com `<Routes>`).
- **B:** `wouter`, roteador minimalista.
- **C:** roteamento manual por `window.history` e estado local.

**Motivo:** são necessários deep links (`/orcamentos/:id`), botão voltar,
rotas protegidas, parâmetros de busca na URL e layouts aninhados. React Router
é o padrão do ecossistema, tem documentação madura e não exige abstração
própria. Wouter reduz dependência, mas cobre menos casos; a alternativa C
reinventa comportamento do navegador e cria dívida.

**Impacto:** nova dependência de produção; `src/app/router.tsx`; layout de
rota protegida; navegação programática após ações.

### D265 — Estado de servidor `[A]`

**Decisão aprovada:** alternativa A. Adotar `@tanstack/react-query` para
queries, mutations, estados de carregamento/erro, invalidação e refetch após
ações. Não persistir o cache em storage. Não adicionar Redux ou Zustand para
estado de produto.

**Alternativas registradas:**

- **A (aprovada):** TanStack Query 5.
- **B:** hooks manuais com `fetch` + `useEffect` + estado local.
- **C:** SWR.

**Motivo:** a aplicação lê e muta muitos recursos relacionados (dashboard,
clientes, orçamentos, histórico, dados do negócio) e precisa de invalidação
consistente após cada mutação. Hooks manuais duplicariam loading, erro,
cancelamento, deduplicação e refetch em cada tela. SWR é menor, mas tem menos
suporte a mutações e invalidação estruturada.

**Impacto:** dependência de produção; `QueryClientProvider`; convenção de
query keys; nenhuma persistência de cache em storage.

### D266 — Sem biblioteca global de estado de cliente `[F]`

**Decisão:** não usar Zustand, Redux ou equivalente para estado de produto no
MVP. Estado local de componente, cache do TanStack Query e um contexto de
sessão (apenas o usuário autenticado, em memória) são suficientes.

**Justificativa:** `docs/ARCHITECTURE.md` §18 (“estado local e form state por
padrão; biblioteca global de estado somente quando surgir necessidade
concreta”); `AGENTS.MD` (Frontend: “Do not introduce global state management
unless there is a concrete need”). Não há requisito de estado global
compartilhado entre features.

**Impacto:** remover `zustand` do manifesto. O contexto de sessão não é estado
de negócio e não é persistido.

### D267 — Cliente HTTP `[A]`

**Decisão aprovada:** alternativa A. Encapsular `fetch` nativo em um client
estreito em `src/shared/api/http-client.ts`, com `credentials: 'include'`,
JSON, resposta binária, parser defensivo de erros e tratamento central dos
status HTTP relevantes. Remover Axios na task de fundação.

**Alternativas registradas:**

- **A (aprovada):** `fetch` nativo encapsulado.
- **B:** `axios` (já declarado no manifesto).
- **C:** `ky` ou outra biblioteca fina.

**Motivo:** o requisito central é enviar o cookie de sessão, não armazenar
token e interpretar corpos de erro heterogêneos. `fetch` cobre isso sem
dependência nova. `axios` não elimina nenhuma complexidade relevante e
adicionaria mais uma dependência a manter. A alternativa C é desnecessária.

**Impacto:** remover `axios`; centralizar `401`, `403`, `409`, `422` e `429`;
suporte a resposta binária (PDF) no mesmo cliente; nenhuma tentativa
automática de retry.

### D268 — Formulários e validação de UX `[A]`

**Decisão aprovada:** alternativa A. Usar `react-hook-form` para os
formulários e `zod` para schemas de validação de UX. O Zod não é fonte das
regras de negócio: valida apenas o necessário para feedback e formato da
interface. O backend continua sendo a autoridade.

**Alternativas registradas:**

- **A (aprovada):** react-hook-form + zod, ambos já declarados.
- **B:** react-hook-form com validação manual, sem zod.
- **C:** estado controlado manualmente em todos os formulários.

**Motivo:** o formulário de orçamento tem coleções aninhadas, reordenação,
campos condicionais e dezenas de entradas; RHF evita re-render por campo. Zod
permite schemas declarativos e mensagens em português. Os dois pacotes já
estão no manifesto, portanto não há dependência nova. A alternativa C não
escala para o formulário de orçamento.

**Impacto:** schemas por formulário; mensagens em português; erros do servidor
(`400`, `422`) continuam sendo exibidos mesmo quando o schema local passa.

### D269 — Estilização, primitivas e ícones `[A]`

**Decisão aprovada:** alternativa A. Adotar Tailwind CSS v4 via plugin
oficial do Vite, primitivas próprias sobre HTML acessível e `lucide-react`
para ícones, com `clsx`. Não adotar shadcn/ui nesta fase e remover o pacote
`shadcn-ui` depreciado na task de fundação. Radix ou outra primitive externa
só poderá ser adicionada diante de necessidade concreta de
acessibilidade/comportamento que o HTML nativo não resolva adequadamente.

**Alternativas registradas:**

- **A (aprovada):** Tailwind CSS v4 + primitivas próprias (`<dialog>`,
  `<details>`, botões, campos e cartões) + `lucide-react` + `clsx`.
- **B:** Tailwind + shadcn/ui copiado para o repositório, com Radix.
- **C:** CSS Modules sem utilitários.

**Motivo:** Tailwind já está declarado e resolve responsividade mobile-first
com pouco CSS próprio. O produto tem uma superfície pequena de componentes
(botão, campo, seleção, diálogo, cartão, badge, toast); uma biblioteca inteira
de componentes seria uma abstração maior do que a necessidade. O pacote
`shadcn-ui` declarado está depreciado e não deve ser usado. `<dialog>` nativo
cobre confirmações; se um combobox acessível se mostrar necessário, Radix pode
ser adicionado pontualmente em etapa posterior, com justificativa.

**Impacto:** remover `shadcn-ui`; adicionar `lucide-react` e `clsx`; criar
tokens de cor, espaçamento e tipografia; documentar foco, teclado e contraste.
Radix não entra nesta fase; só poderá ser adicionado depois, com
justificativa concreta de acessibilidade ou comportamento.

### D270 — Testes de frontend `[A]`

**Decisão aprovada:** alternativa A. Adotar Vitest + jsdom + Testing Library
+ `user-event` + MSW. Playwright continua fora da Fase 11 (D330).

**Alternativas registradas:**

- **A (aprovada):** Vitest + jsdom + `@testing-library/react` +
  `@testing-library/user-event` + `msw`.
- **B:** Vitest + Testing Library, mockando o módulo de API diretamente.
- **C:** nenhum teste automatizado de frontend na Fase 11.

**Motivo:** as regras mais arriscadas do frontend são formatação de
dinheiro/medidas, parsing de erros, schemas de formulário e reconciliação de
coleções. Testes de componente com MSW exercitam o cliente HTTP e os hooks
sem servidor real. A alternativa C deixa esses pontos sem rede de proteção; a
B é viável, mas perde a fidelidade do contrato HTTP.

**Impacto:** dependências de desenvolvimento; `vitest.config.ts`; setup de
MSW; script `npm test`. Playwright não entra nesta fase (D330).

### D271 — Estrutura de pastas `[A]`

**Decisão aprovada por consequência:** organizar por feature, sem DDD no
frontend, conforme a estrutura implicada por D264 (`src/app/router.tsx`),
D265 (providers/query client), D269 (componentes compartilhados) e pelas
fontes de arquitetura.

```text
src/app        bootstrap, router, providers e estilos globais
src/shared     api, auth, componentes, formatação, erros e tipos comuns
src/features  auth, customers, quotes, dashboard, business-data
```

Cada feature contém `api.ts`, `hooks.ts`, `types.ts`, `schemas.ts`, páginas e
componentes próprios. Não criar camadas `domain`, `application` ou
`infrastructure` no frontend.

**Justificativa:** `docs/ARCHITECTURE.md` §18 (“organizado preferencialmente
por features alinhadas ao produto”); `AGENTS.MD` (Frontend: “Organize code by
feature”).

**Impacto:** todos os arquivos novos seguem essa estrutura. Documentos são
ações da feature `quotes`, não uma feature separada.

### D272 — Ambiente e proxy de desenvolvimento `[A]`

**Aprovação humana registrada em 2026-10-21.** Paths relativos por padrão; `VITE_API_BASE_URL` opcional; nenhuma credencial/segredo em `VITE_*`; não misturar `127.0.0.1` com `localhost`; backend intocado; topologia de produção continua na Fase 12.

**Decisão:**

- `VITE_API_BASE_URL` é opcional; quando ausente, o cliente usa caminhos
  relativos (mesma origem).
- Em desenvolvimento, o Vite faz proxy de `/auth`, `/clientes`, `/orcamentos`,
  `/dashboard` e `/dados-do-negocio` para `http://localhost:3000`, sem alterar
  o cabeçalho `Origin`.
- Nenhum segredo, token ou credencial vai para variáveis `VITE_*`.
- A origem de desenvolvimento continua `http://localhost:5173`, compatível com
  `APP_ORIGIN` do backend.

**Justificativa:** evita CORS e diferença de host no desenvolvimento, mantém o
cookie `SameSite=Strict` funcionando e prepara a paridade com a produção, onde
a topologia de mesma origem ainda será decidida na Fase 12.

**Impacto:** `vite.config.js` (ou `.ts`), `.env.example` do frontend e
documentação de execução. O backend não é alterado.

### D273 — Limpeza de dependências `[A]`

**Decisão aprovada por consequência:** remover do manifesto as dependências
não usadas e sem decisão de adoção: `axios` (D267), `shadcn-ui` (D269) e
`zustand` (D266). Manter `react-hook-form` e `zod` porque D268 os adota;
manter `tailwindcss`/`postcss`/`autoprefixer` somente conforme D269.

**Justificativa:** `AGENTS.MD` (“Do not introduce dependencies without
justification”); o manifesto atual não reflete decisão arquitetural e inclui
pacote depreciado.

**Impacto:** `package.json` e `package-lock.json`. As decisões
correspondentes estão aprovadas; a remoção ocorre na task de fundação.

---

## 3. Autenticação e sessão

### D274 — Bootstrap da sessão `[F]`

**Decisão:** na inicialização da aplicação, chamar `GET /auth/me` uma única
vez, com `credentials: 'include'`. `200` autentica e popula o usuário em
memória; `401` significa não autenticado e leva ao login; erro de rede ou
`500` mostra estado de erro com nova tentativa, sem assumir logout.

**Justificativa:** `GET /auth/me` existe, é protegido por `AuthGuard` e
retorna `{ id, email }`; D30/D33 e AUTH-11. O cookie é `HttpOnly`, portanto
JavaScript não pode inspecioná-lo.

**Impacto:** `AuthProvider`, estado de bootstrap (`loading`,
`authenticated`, `anonymous`, `error`) e `RequireAuth`.

### D275 — Cookie, credenciais e armazenamento `[F]`

**Decisão:** todas as requisições usam `credentials: 'include'`. O frontend
nunca lê, escreve ou inspeciona o cookie de sessão e nunca armazena sessão,
token, senha ou credenciais em `localStorage`, `sessionStorage`, IndexedDB ou
estado persistido. O cache do TanStack Query não é persistido.

**Justificativa:** D30 (cookie `HttpOnly`), D29/D42 (sem refresh token), e a
restrição explícita da fase. A sessão é reidratada por `GET /auth/me` após
qualquer recarga.

**Impacto:** nenhum middleware de persistência; nenhuma leitura de
`document.cookie`; o usuário em memória pode ser perdido a cada reload e é
recuperado pelo bootstrap.

### D276 — CSRF por origem `[F]`

**Decisão:** não criar, ler ou enviar CSRF token. O navegador envia `Origin`
automaticamente; o frontend nunca define esse cabeçalho manualmente. `403
Invalid origin` é tratado como erro de configuração de ambiente, com mensagem
própria, não como erro do usuário.

**Justificativa:** D31/AUTH-13 e `csrf-origin.guard.ts`: `POST`, `PUT`,
`PATCH` e `DELETE` exigem origem permitida; `GET` não passa pelo guard. Não
existe CSRF token no backend.

**Impacto:** cliente HTTP sem lógica de token; mapeamento específico de
`403`.

### D277 — Tratamento global de `401` e `429` `[P]`

**Decisão:**

- `401` em rota protegida: limpar o estado de sessão, cancelar queries em voo,
  guardar a rota atual e redirecionar para `/login?returnTo=<rota>`; não
  repetir a requisição.
- `401` em `POST /auth/login`: significa credencial inválida, não expiração de
  sessão; exibir a mensagem genérica do login.
- `429`: exibir mensagem genérica de excesso de tentativas, sem retry
  automático e sem revelar se a conta existe. No login, manter o botão
  desabilitado por alguns segundos.

**Justificativa:** D33 (todo `401` protegido é sessão ausente/inválida) e D41
(limite global de 60/min e login de 5/min). Não há refresh nem retry
automático no contrato.

**Impacto:** interceptor no cliente HTTP e/ou handler global de erro do
TanStack Query; o `returnTo` só aceita caminho interno.

### D278 — Tela de login `[P]`

**Decisão:** rota pública `/login`, com email e senha, `autocomplete`
adequado, botão desabilitado durante o envio e mensagem genérica para `401`.
Em sucesso, guardar `{ id, email }` em memória e navegar para `returnTo` ou
`/dashboard`. Usuário já autenticado que acessa `/login` é redirecionado para
o dashboard.

**Justificativa:** D35/D37/D38 (mensagem única, sem enumeração) e AUTH-09.
Não há “lembrar-me”, recuperação de senha ou cadastro de usuário no MVP.

**Impacto:** `LoginPage`; nenhum link de “esqueci a senha”.

### D279 — Logout `[P]`

**Decisão:** ação no shell; `POST /auth/logout`; em `204`, limpar todo o cache
de queries, limpar o estado de sessão e navegar para `/login`. Em falha de
rede ou `500`, manter a sessão e mostrar erro, porque o cookie pode continuar
válido no servidor. Não exigir confirmação.

**Justificativa:** D32 (logout idempotente, sempre `204`) e AUTH-12.

**Impacto:** shell e `useLogout`.

### D280 — Sem renovação de sessão `[F]`

**Decisão:** não implementar refresh token, renovação silenciosa, timer de
renovação ou “manter conectado”. A sessão tem TTL absoluto de 12 horas e
expira no servidor; o próximo `401` leva ao login.

**Justificativa:** D29/D42; `session-ttl.ts`.

**Impacto:** nenhum timer de refresh; formulários devem avisar sobre
alterações não salvas (D301), pois a expiração pode ocorrer durante o
preenchimento.

---

## 4. Navegação e shell

### D281 — Mapa de rotas `[A]`

**Aprovação humana registrada em 2026-10-21.** Preservar exatamente o mapa documentado, sem rotas adicionais por conveniência. Todas as rotas de produto são protegidas; `/login` é pública; `/` redireciona para `/dashboard` quando autenticado. Criação de orçamento exclusivamente por `/clientes/:customerId/orcamentos/novo`; lifecycle, instalação e documentos permanecem dentro do detalhe do orçamento.

**Decisão:** adotar o mapa abaixo. Todas as rotas de produto exigem sessão;
`/login` é pública e `*` é a página de não encontrado.

| Rota | Tela | Observações |
| --- | --- | --- |
| `/login` | `LoginPage` | pública; redireciona se autenticado |
| `/` | redireciona | para `/dashboard` se autenticado; senão `/login` |
| `/dashboard` | `DashboardPage` | home operacional |
| `/clientes` | `CustomersListPage` | busca em `?search=` |
| `/clientes/novo` | `CustomerFormPage` | criação |
| `/clientes/:customerId` | `CustomerDetailPage` | dados + histórico + “Novo orçamento” |
| `/clientes/:customerId/editar` | `CustomerFormPage` | edição |
| `/clientes/:customerId/orcamentos/novo` | `QuoteCreatePage` | criação de orçamento no contexto do cliente |
| `/orcamentos` | `QuotesListPage` | `?search=` e `?status=` |
| `/orcamentos/:quoteId` | `QuoteDetailPage` | detalhe, ações, histórico e documentos |
| `/orcamentos/:quoteId/editar` | `QuoteEditPage` | formulário de edição |
| `/configuracoes/dados-do-negocio` | `BusinessDataPage` | configuração única |
| `*` | `NotFoundPage` | pública |

**Justificativa:** `ARCHITECTURE.md` §14.2; `PROJECT_SPEC.md` §3.2 (cliente
como ponto de entrada), §12.4 (histórico na página do cliente) e §17 (fluxo
consolidado).

**Impacto:** `src/app/router.tsx`; links e navegação programática devem usar
esses caminhos.

### D282 — Shell de navegação `[A]`

**Decisão aprovada:** alternativa A. Shell responsivo com quatro destinos
principais — Dashboard, Clientes, Orçamentos e Configurações — usando
navegação inferior fixa no telefone, com alvos adequados ao toque, e barra
lateral no desktop, com cabeçalho contendo título da página e ação de logout.
O projeto permanece mobile-first conforme D261.

**Alternativas registradas:**

- **A (aprovada):** navegação inferior fixa no telefone + barra lateral no
  desktop.
- **B:** apenas barra superior com menu hambúrguer/drawer.
- **C:** barra lateral em todas as larguras, colapsável no telefone.

**Motivo:** a operação principal acontece no telefone, durante o atendimento;
quatro destinos cabem em uma navegação inferior com alvos de toque
confortáveis. A alternativa B esconde a navegação atrás de um toque extra; a
C ocupa largura preciosa em telas pequenas.

**Impacto:** `AppShell`, ícones, estados ativos, acessibilidade por teclado e
área segura inferior (`env(safe-area-inset-bottom)`). O conteúdo principal
precisa de espaço reservado para a barra inferior.

### D283 — Raiz, títulos e metadados `[P]`

**Decisão:** `/` redireciona para `/dashboard`; cada rota define
`document.title` com o nome da página; `index.html` usa `lang="pt-BR"`,
título “Cortinando ERP”, `viewport` com `width=device-width` e
`theme-color`.

**Justificativa:** usabilidade e acessibilidade; `PROJECT_SPEC.md` §14.1.

**Impacto:** `index.html`, layout e um hook de título por rota.

### D284 — Não encontrado, voltar e foco `[P]`

**Decisão:** criar `NotFoundPage` em português, com link para o dashboard;
preservar o botão voltar do navegador; oferecer link explícito de voltar em
detalhes e formulários; rolar ao topo e mover o foco para o título principal
em cada mudança de rota. Conteúdo principal fica em páginas; diálogos são
reservados a confirmações e ações curtas.

**Justificativa:** `PROJECT_SPEC.md` §14.1 (feedback claro e uso por toque);
acessibilidade básica.

**Impacto:** layout de rota e componentes de página.

---

## 5. Dashboard

### D285 — Uma única leitura, sem recomputação `[F]`

**Decisão:** o dashboard consome exclusivamente `GET /dashboard`, em uma
chamada. Não recalcular contadores, não derivar `SENT`/`EXPIRED`, não
reclassificar instalações, não usar o tamanho das listas como contador, não
aplicar limite diferente de 5 em `upcomingInstallations` e não buscar cada
lista em separado.

**Justificativa:** D214–D230, D238, D240, D243, D249 e D259; o backend já
entrega os contadores e as três listas prontos. A semana é civil em
`America/Sao_Paulo` e não deve ser recalculada no cliente.

**Impacto:** uma query key `['dashboard']`; nenhuma fórmula de status ou
semana no frontend.

### D286 — Cards, navegação e estados `[P]`

**Decisão:** exibir sempre os cinco cards (`draft`, `sent`, `expired`,
`confirmed`, `inProduction`), inclusive com valor zero, em português. Cada
card navega para `/orcamentos` com o filtro correspondente:

| Card | Filtro |
| --- | --- |
| Rascunhos | `status=DRAFT` |
| Enviados | `status=SENT` |
| Expirados | `status=EXPIRED` |
| Confirmados | `status=CONFIRMED` |
| Em produção | `status=IN_PRODUCTION` |

Exibir skeleton durante o carregamento e estado de erro com botão de nova
tentativa. Listas vazias mostram estado vazio próprio, não erro.

**Justificativa:** `PROJECT_SPEC.md` §12.1 (“cards e estágios podem funcionar
como atalhos/filtros”); D257. Os cinco contadores são fixos (D214).

**Impacto:** `DashboardPage`, `StatusCountCard` e link para a lista.

### D287 — `SENT` válido e `EXPIRED` separados `[F]`

**Decisão:** o card “Enviados” usa `status=SENT`; o card “Expirados” usa
`status=EXPIRED`. O backend aplica `validSentQuoteCondition` em `SENT` e
`expiredQuoteCondition` em `EXPIRED`, de modo que os dois conjuntos são
disjuntos. O frontend não refaz essa distinção.

**Justificativa:** D106, D215, D257 e código de `PrismaSearchQuotesQuery`.
Esta auditoria confirmou que `status=SENT` exclui SENT expirados; a dúvida
registrada na Fase 9 está encerrada.

**Impacto:** os contadores e as listas filtradas concordam; não há badge
“expirado” dentro do filtro `SENT`.

### D288 — Listas de instalação `[P]`

**Decisão:** renderizar `upcomingInstallations`, `weeklyInstallations` e
`overdueInstallations` na ordem recebida, sem reordenar nem reclassificar.
Exibir número, nome do cliente, data/hora no fuso local e situação. Clique
abre `/orcamentos/:quoteId`. Não exibir telefone, email, documento, endereço
ou valores. Na lista semanal, agrupamento visual por dia é permitido; a
pertinência à semana continua sendo do backend. “Atrasada” é indicado pela
lista de origem, não por cálculo local.

**Justificativa:** D219–D226, D233–D236, D259. Agrupar visualmente é
apresentação; mover um item entre listas seria reclassificação.

**Impacto:** `InstallationList` e formatação de data (D326).

### D289 — Destino de “ver todas as instalações” `[A]`

**Decisão aprovada:** alternativa A. Não oferecer “ver todas” para as listas
de instalações na Fase 11. Cada item abre o orçamento; os cards levam às
listas filtradas de orçamentos. Não criar destino incorreto usando apenas
`CONFIRMED` e não alterar o backend. Se futuramente houver necessidade
operacional de uma lista completa, isso será especificado separadamente.

**Alternativas registradas:**

- **A (aprovada):** omitir a ação nesta fase.
- **B:** “ver todas” navega para `/orcamentos?status=CONFIRMED`.
- **C:** criar um endpoint de listagem completa de instalações.

**Motivo:** não existe endpoint para listar todas as instalações (D238 e D249
rejeitam endpoints por lista e paginação); `upcomingInstallations` é limitada
a 5 e as outras listas não têm paginação. A alternativa B é enganosa: a lista
de orçamentos confirmados inclui orçamentos sem instalação e exclui
`IN_PRODUCTION`. A alternativa C viola o escopo desta fase (nenhuma alteração
de backend).

**Impacto:** a UI não mostra “ver todas”; o dashboard continua correto. Se o
produto quiser a ação, ela exige uma decisão de backend na Fase 12.

---

## 6. Clientes

### D290 — Lista e busca server-side `[F]`

**Decisão:** `GET /clientes?search=` é a única fonte da lista. A busca é por
nome, substring literal, case-insensitive e sensível a acento; não buscar por
telefone, email, documento ou endereço. Não paginar no cliente, não filtrar
excluídos e não reordenar: usar a ordem `name ASC, id ASC` devolvida.

**Justificativa:** D58/D59; `PROJECT_SPEC.md` §3.3 (“a busca necessária é por
nome”). A normalização e a exclusão lógica são do backend (D303).

**Impacto:** `CustomersListPage`; nenhuma duplicação de regra de busca.

### D291 — Busca com debounce e estados `[P]`

**Decisão:** campo de busca com debounce de aproximadamente 300 ms,
sincronizado com `?search=` na URL. Termo vazio lista todos. Exibir
carregamento, resultado vazio e erro com nova tentativa. Não disparar busca
por tecla sem debounce, para não consumir o limite global de 60 req/min.

**Justificativa:** usabilidade mobile e D41 (throttle global).

**Impacto:** `useDebouncedValue`, estado da URL e query key.

### D292 — Formulário de cliente e endereço `[P]`

**Decisão:** campos `name` e `phone` obrigatórios; `email`, `taxId` e `notes`
opcionais. Endereço entra por um interruptor “Adicionar endereço”; quando
ligado, `street`, `number`, `neighborhood` e `city` são obrigatórios e
`postalCode`, `complement` e `state` opcionais. O bloco é tudo-ou-nada.
“Remover endereço” envia `address: null`. Máscaras de CEP/UF são apenas
visuais; o backend normaliza.

**Justificativa:** `PROJECT_SPEC.md` §2.8 e §3.1; D53–D55. Não há atualização
parcial de endereço.

**Impacto:** `CustomerFormPage`, `AddressFields` e schema zod.

### D293 — PATCH parcial `[F]`

**Decisão:** no `PATCH`, enviar somente os campos alterados. `null` limpa
campo opcional; campo obrigatório nunca é enviado como `null`; `address` é
enviado como bloco completo quando alterado. Corpo vazio não é enviado. Após
a resposta, usar o detalhe retornado como estado atual.

**Justificativa:** D62 e código de `UpdateCustomerDto`/mapper. O backend não
faz merge de endereço campo a campo.

**Impacto:** formulário com dirty tracking; endereço tratado como um único
valor.

### D294 — Exclusão, detalhe e histórico `[P]`

**Decisão:**

- Excluir cliente exige confirmação com o nome; `DELETE`; em `204`, invalidar
  listas e navegar para `/clientes`; `404` é tratado como já removido.
- Detalhe mostra dados cadastrais, ação “Novo orçamento” e histórico.
- Histórico usa `GET /clientes/:id/orcamentos` e exibe número, data, situação
  e total; clique abre o orçamento.
- Cliente excluído não pode ser aberto (`GET` → `404`), mas seus orçamentos
  continuam acessíveis pela lista de orçamentos e pelo dashboard.
- Não existe restauração nem lixeira na UI.

**Justificativa:** D56/D57/D63; `PROJECT_SPEC.md` §3.2 e §12.4; D111 (o
histórico sobrevive à exclusão do cliente).

**Impacto:** `CustomerDetailPage`, `CustomerDeleteDialog` e `CustomerQuoteHistory`.

---

## 7. Orçamentos: lista e criação

### D295 — Lista, busca e filtro `[F]`

**Decisão:** consumir `GET /orcamentos?search=&status=`. `search` busca nome
do cliente ou número; `status` aceita os seis valores persistidos mais
`EXPIRED`. Não inventar filtros por data, material, cidade ou valor. Não
paginar e não reordenar: usar `createdAt DESC, id DESC`.

**Justificativa:** `PROJECT_SPEC.md` §12.2/§12.3; D106, D113, D115.

**Impacto:** `QuotesListPage`; filtros apenas os documentados.

### D296 — Filtros na URL, linhas e estados `[P]`

**Decisão:** `search` e `status` ficam na query string, preservando voltar e
deep link. A busca é debounced (D291). O filtro de situação é um seletor ou
conjunto de chips em português. Cada linha exibe número, cliente, situação
(com “expirado” separado), total, data de criação e, quando houver, data de
instalação. Clique abre o detalhe. Exibir carregamento, vazio, erro e limpar
filtros.

**Justificativa:** `PROJECT_SPEC.md` §12.2/§12.3; D257.

**Impacto:** `QuotesListPage`, `StatusFilter` e `QuoteRow`.

### D297 — Criação somente a partir do cliente `[F]`

**Decisão:** o cliente é definido pela rota
`/clientes/:customerId/orcamentos/novo` e é imutável. Não há seletor de
cliente no formulário. Se o rascunho foi criado para o cliente errado, deve
ser excluído e recriado. O corpo aceita `{}`, mas ver D298.

**Justificativa:** `PROJECT_SPEC.md` §3.4; D78. O backend não oferece troca de
cliente nem criação fora da rota de cliente.

**Impacto:** `QuoteCreatePage`; link “Novo orçamento” apenas no detalhe do
cliente.

### D298 — Momento da criação do orçamento `[A]`

**Decisão aprovada:** alternativa A. A página de criação mantém um rascunho
local e só executa `POST /clientes/:customerId/orcamentos` no primeiro
“Salvar rascunho”. Antes disso o formulário permanece local. Depois do `201`,
usar o `id` retornado e navegar para a edição; os salvamentos seguintes usam
`PATCH`. Não criar orçamento vazio apenas por abrir a tela.

**Alternativas registradas:**

- **A (aprovada):** criar no primeiro salvamento.
- **B:** `POST` imediato com corpo `{}` ao abrir a página, seguido de `PATCH`.

**Motivo:** o número comercial é consumido na criação e nunca é reutilizado
(D80/D110); abrir e abandonar a página com a alternativa B criaria rascunhos
vazios e queimaria números. D79 descreve a criação como o primeiro
salvamento. A alternativa A também evita uma tela de edição sem dados.

**Impacto:** a página de criação precisa funcionar sem `id`; o botão de salvar
decide entre `POST` e `PATCH`; não há link para o detalhe antes do primeiro
salvamento. Sair da página com dados não salvos segue D301 (confirmar
descarte).

### D299 — Contexto do cliente na criação `[A]`

**Decisão aprovada por consequência:** a página de criação exibe nome e
telefone do cliente a partir do cache de clientes ou de `GET /clientes/:id`,
sem permitir edição. Se o cliente não existir ou estiver excluído, mostrar
erro e link para a lista. Não criar uma cópia editável do cadastro dentro do
orçamento. A decisão decorre de D297 (cliente imutável) e D298 (criação
local até o primeiro salvamento); a origem exata do dado (cache ou nova
consulta) é detalhe de implementação.

**Justificativa:** `PROJECT_SPEC.md` §3.5 (dados do cliente são lidos do
cadastro atual; apenas o endereço de instalação é snapshot).

**Impacto:** carregamento do cliente antes do formulário; estado de cliente
inexistente.

---

## 8. Formulário de orçamento

### D300 — Modelo do formulário `[A]`

**Decisão aprovada:** alternativa A. Uma única página com seções:

1. Dados gerais (observações).
2. Endereço de instalação.
3. Cortinas (editor por cortina).
4. Adicionais gerais.
5. Desconto e ajuste comercial.
6. Totais do servidor e ações de salvamento.

No telefone, o fluxo é vertical e as seções podem ser recolhíveis; no
desktop, aproveitar a maior largura, com o resumo podendo ficar lateral. Não
usar wizard nem abas como estrutura principal. O mesmo `QuoteForm` serve de
base para criação e edição quando isso não gerar acoplamento artificial.

**Alternativas registradas:**

- **A (aprovada):** página única com seções.
- **B:** wizard com uma seção por etapa.
- **C:** abas por seção.

**Motivo:** o orçamento é um único aggregate salvo atomicamente; um wizard
sugere salvamentos parciais que não existem e esconde erros de outras etapas.
Seções recolhíveis mantêm o contexto e permitem rolar até o erro. Abas
dificultam a visão do conjunto e o resumo de totais.

**Impacto:** `QuoteForm` e componentes de seção; o mesmo formulário serve
criação e edição. A navegação para o primeiro erro deve abrir a seção
correspondente. A seção de totais exibe apenas valores retornados pelo
servidor; não há cálculo local (D303-B).

### D301 — Salvamento explícito e alterações não salvas `[P]`

**Decisão:** não usar autosave. O botão “Salvar rascunho” envia o formulário.
Rastrear alterações pendentes e pedir confirmação ao navegar para fora, ao
voltar pelo navegador e ao recarregar (`beforeunload`). Após sucesso, limpar
o estado “sujo” e substituir os valores pelos do detalhe retornado.

**Justificativa:** D79 (primeiro salvamento cria; salvamentos seguintes são
explícitos) e D280 (sessão pode expirar em 12h). Autosave não existe no
contrato.

**Impacto:** `useUnsavedChanges`, estado do formulário e feedback de sucesso.

### D302 — Reconciliação de coleções `[F]`

**Decisão:** preservar os `id` recebidos do servidor para cortinas,
componentes e adicionais. Ao salvar uma coleção alterada, enviar a coleção
completa na ordem desejada. Item novo não envia `id`; item removido
simplesmente não é enviado; `sequence` nunca é enviado. Reordenar significa
reordenar o array. `components` segue a mesma regra dentro de cada cortina.
Nunca excluir e recriar filhos apenas para salvar.

**Justificativa:** D83, D116, D117. O backend reconcilia por `id` e rejeita
`id` desconhecido ou estrangeiro com `422`.

**Impacto:** modelo de estado do formulário mantém ids; após cada salvamento,
substituir o estado local pela resposta do servidor.

### D303 — Cálculo local `[A]`

**Decisão aprovada:** alternativa **B**, com alteração em relação à
recomendação original. Não há prévia local de cálculos no MVP.

O frontend não recalcula localmente:

- total de item;
- subtotal;
- desconto;
- ajuste comercial;
- total final;
- `finalWidth`;
- `fabricQuantity`;
- qualquer outro valor derivado do domínio.

Durante a edição, os inputs representam somente dados editáveis. Após
salvar:

1. o backend processa o orçamento;
2. a resposta do backend substitui/atualiza o estado confirmado;
3. os valores derivados retornados pelo servidor são exibidos.

Pode ser exibido o texto “Salve o rascunho para atualizar os valores
calculados.” Não criar `calc-preview.ts` nesta fase. Não duplicar `HALF_UP`,
fórmulas monetárias ou técnicas no frontend.

**Alternativas registradas:**

- **A:** prévia monetária limitada, marcada como “prévia” (não aprovada).
- **B (aprovada):** nenhuma prévia; totais só aparecem depois de salvar.
- **C:** replicar todas as fórmulas, incluindo medidas e quantidade de tecido
  (não aprovada).

**Motivo:** mantém uma única fonte de verdade, evita divergência silenciosa,
reduz a complexidade do MVP e permite avaliar posteriormente, com uso real,
se feedback financeiro instantâneo é necessário. Uma futura prévia local
exigirá nova decisão e testes de paridade com o backend.

**Impacto:** nenhum arquivo de cálculo local; `TotalsSummary` exibe apenas
valores do servidor; o formulário de criação não mostra totais antes do
primeiro salvamento. O preset “Mão de obra” (D307) só pode usar
`fabricQuantity` retornado pelo servidor.

### D304 — Entrada de medidas, quantidades e dinheiro `[P]`

**Decisão:** campos decimais aceitam vírgula ou ponto e exibem no máximo 3
casas para medidas e 6 para quantidades. Dinheiro é digitado em reais e
convertido para centavos por parsing de string, nunca por aritmética de
ponto flutuante. Campos opcionais vazios viram `null`. Valores zero ou
negativos são bloqueados na UX quando o campo os proíbe. Usar `inputmode`
adequado (`decimal`/`numeric`). Não usar separador de milhar no valor editável.

**Justificativa:** D86/D87; `PROJECT_SPEC.md` §6.1 e §7. Evita erros de
arredondamento e facilita o uso no telefone.

**Impacto:** `DecimalInput`, `MoneyInput` e normalizadores compartilhados.

### D305 — Desconto e ajuste comercial `[P]`

**Decisão:** seletor com “Sem desconto”, “Percentual” e “Valor fixo”; somente
o campo correspondente fica habilitado. Percentual aceita até 2 casas e no
máximo 100; valor fixo é positivo. Ajuste comercial é assinado e pode ser
negativo. Não calcular localmente um ajuste a partir de “total desejado”: o
usuário informa diretamente o percentual, o valor fixo ou o ajuste. O valor
calculado do desconto e os totais só são exibidos após o salvamento,
conforme D303-B. Enviar somente `discount` e `commercialAdjustmentCents`.

**Justificativa:** D90–D92 e D303-B. O backend não recebe “total desejado” e
é a única fonte dos valores calculados.

**Impacto:** `DiscountEditor` e `TotalsSummary` sem aritmética local.

### D306 — Endereço de instalação `[F]`

**Decisão:** o botão “Usar endereço do cliente” copia os campos do cadastro
atual do cliente para o formulário do orçamento, no cliente. Não existe
endpoint de cópia. A cópia fica independente após o preenchimento: mudanças
posteriores no cliente não alteram o orçamento. Se o cliente não tiver
endereço, o botão fica indisponível. Em `DRAFT`, o endereço pode estar vazio
ou parcial; no envio, precisa estar completo.

**Justificativa:** `PROJECT_SPEC.md` §5; D94/D95; D78.

**Impacto:** `InstallationAddressEditor`; cópia a partir do cliente carregado
em D299.

### D307 — Preset “Mão de obra” `[F]`

**Decisão:** oferecer um botão que insere um componente com nome “Mão de
obra”, unidade `m`, preço unitário de R$ 30,00 e quantidade igual ao
`fabricQuantity` atual do servidor. O usuário pode editar o componente depois.
O backend não cria, reconhece ou recalcula esse preset.

**Justificativa:** D84/D89 (preset de UI). Não há regra de negócio no backend
para “mão de obra”.

**Impacto:** helper de preset no editor de componentes. Se o servidor ainda
não retornou `fabricQuantity` (rascunho novo), o preset fica desabilitado com
explicação, pois D303-B proíbe calcular o valor localmente.

---

## 9. Ciclo de vida e instalação

### D308 — Matriz de ações por situação `[F]`

**Decisão:** as ações exibidas seguem a tabela abaixo. Nunca existe seletor
livre de status nem `PATCH` de `status`; cada ação usa a rota explícita.

| Situação | Ações |
| --- | --- |
| `DRAFT` | Salvar, Excluir, Cancelar, Prévia do PDF, Enviar |
| `SENT` válido | Salvar, Cancelar, Renovar, Confirmar, PDF |
| `SENT` expirado (`expired`) | Salvar, Cancelar, Renovar, PDF |
| `CONFIRMED` | Reabrir, Cancelar, Agendar instalação, Iniciar produção, Ordem de produção, PDF |
| `IN_PRODUCTION` | Agendar/alterar/remover instalação, Concluir, Ordem de produção, PDF |
| `COMPLETED` | PDF, Ordem de produção |
| `CANCELLED` | Nenhuma ação de ciclo; sem documentos |

**Justificativa:** `PROJECT_SPEC.md` §8, §15; D96–D107, D115.

**Impacto:** `QuoteActions` derivando a matriz de `status` + `expired`.

### D309 — Envio com validade e violações `[P]`

**Decisão:** o envio abre um diálogo com validade opcional; o texto explica
que, se vazia, o backend aplica 30 dias. Ao confirmar, `POST /enviar`,
desabilitando o botão. `422` exibe as violações agrupadas por cortina/campo
com os códigos conhecidos traduzidos. `409` recarrega o orçamento e explica o
estado atual. Em sucesso, atualizar o detalhe e o histórico.

**Justificativa:** D96–D98; o gate é do backend.

**Impacto:** `SendQuoteDialog` e mapa de códigos (D322).

### D310 — Confirmar, reabrir, renovar e cancelar `[P]`

**Decisão:**

- Confirmar: diálogo simples; indisponível quando `expired`.
- Reabrir: diálogo que explica a perda de `confirmedAt` e do agendamento e o
  risco de o orçamento voltar expirado.
- Renovar: campo de nova validade obrigatório e estritamente futuro.
- Cancelar: diálogo com motivo opcional, limite de 500 caracteres.

**Justificativa:** D99–D102; `PROJECT_SPEC.md` §8.8/§8.10/§8.11.

**Impacto:** diálogos e validação de data.

### D311 — Iniciar produção e concluir `[P]`

**Decisão:** ambas as ações pedem confirmação. “Concluir” fica desabilitado
com explicação quando existe instalação futura agendada; se o backend
responder `409`, recarregar e mostrar o motivo. “Iniciar produção” avisa que a
ação é irreversível e bloqueia cancelamento posterior.

**Justificativa:** D103/D105; `PROJECT_SPEC.md` §8.12/§8.13.

**Impacto:** `ConfirmActionDialog` e estado desabilitado explicado.

### D312 — Instalação `[P]`

**Decisão:** diálogo com data e hora; enviar `scheduledInstallationAt` em ISO
UTC. Datas passadas são aceitas. “Remover instalação” pede confirmação. Exibir
a data agendada no detalhe e o indicador de atraso quando `lateInstallation`
for `true`. Não existe status de instalação.

**Justificativa:** D104/D107; `PROJECT_SPEC.md` §9.

**Impacto:** `InstallationDialog` e `InstallationSummary`.

### D313 — Condições derivadas, `409` e confirmações `[F]`

**Decisão:** usar `expired` e `lateInstallation` como vieram do servidor;
nunca recalculá-los. Em qualquer `409`, recarregar o orçamento e apresentar a
mensagem traduzida, porque o estado mudou ou a ação não é permitida. Ações
destrutivas ou irreversíveis exigem confirmação: excluir rascunho, cancelar,
reabrir, iniciar produção, concluir e remover instalação.

**Justificativa:** D106/D107; `PROJECT_SPEC.md` §14.1 (“confirmação antes de
ações destrutivas ou irreversíveis”); D118.

**Impacto:** `useQuoteActions` e `ConfirmDialog`.

---

## 10. Documentos e histórico

### D314 — Abertura dos PDFs `[A]`

**Decisão aprovada:** alternativa A. Usar `fetch → Blob → object URL`.
Tratar respostas JSON de erro antes de tentar abrir o arquivo; abrir ou
baixar o PDF somente após resposta bem-sucedida; revogar object URLs;
desabilitar a ação enquanto estiver em andamento; não fazer prefetch nem
retry automático. Isso é especialmente importante porque geração/reemissão
pode registrar evento de histórico (D179).

**Alternativas registradas:**

- **A (aprovada):** `fetch` + blob.
- **B:** `window.open` direto na rota do PDF.
- **C:** iframe oculto.

**Motivo:** a rota pode responder `409` com JSON (`Document is not available`,
`Business data is not configured`, `Document data is incomplete`); com B, o
usuário veria uma página de erro JSON ou uma aba vazia. A também permite
forçar download e manter o erro dentro da aplicação. C não permite tratar
erros. Nenhuma alternativa deve fazer prefetch ou retry, porque cada geração
grava histórico (D179).

**Impacto:** `useQuoteDocument`; `URL.revokeObjectURL`; sem cache de PDF.

### D315 — Prévia versus geração `[F]`

**Decisão:** em `DRAFT`, o botão se chama “Prévia do PDF” e não grava
histórico. Nas demais situações permitidas, chama-se “Gerar PDF” e grava
`COMMERCIAL_PDF_GENERATED`. O frontend não consegue distinguir prévia de
geração pela resposta; usa `status`. Cliques repetidos geram novos eventos.

**Justificativa:** D174/D178/D179/D190.

**Impacto:** rótulo e confirmação dependem de `quote.status`.

### D316 — Sem lista ou armazenamento de documentos `[F]`

**Decisão:** documentos são ações dentro do detalhe do orçamento. Não criar
tela de documentos, lista de PDFs, cache local, “último PDF”, versionamento ou
URL permanente. Cada clique gera novamente.

**Justificativa:** D143/D144/D177/D208.

**Impacto:** nenhuma feature `documents`; componente `QuoteDocuments` dentro de
`quotes`.

### D317 — Ordem de produção e `409` de documentos `[P]`

**Decisão:** exibir “Ordem de produção” apenas em `CONFIRMED`,
`IN_PRODUCTION` e `COMPLETED`. Mapear os `409`:

| Mensagem | Ação na UI |
| --- | --- |
| `Business data is not configured` | oferecer link para `/configuracoes/dados-do-negocio` (somente PDF comercial) |
| `Document data is incomplete` | explicar que faltam dados e indicar a seção provável |
| `Document is not available in the current status` | recarregar o orçamento e atualizar as ações |
| `Could not generate the document` (`500`) | mensagem genérica e nova tentativa manual |

**Justificativa:** D186/D187/D193. A ordem de produção não depende dos dados
do negócio e não deve exibir o mesmo bloqueio.

**Impacto:** `QuoteDocuments` e `error-messages.ts`.

### D318 — Histórico somente leitura `[F]`

**Decisão:** consumir `GET /orcamentos/:id/historico` e exibir os eventos na
ordem recebida (`occurredAt ASC`), com data/hora local e rótulo em português.
O `details` é opaco; renderizar apenas os campos conhecidos e ignorar o
restante. O frontend nunca cria, altera ou remove eventos.

**Justificativa:** D108/D109. A ordem e a autoria são do backend.

**Impacto:** `QuoteHistory`; mapa de `eventType` para rótulo (D326).

---

## 11. Dados do negócio

### D319 — `404` significa não configurado `[F]`

**Decisão:** na tela de dados do negócio, `404` em `GET /dados-do-negocio`
abre o formulário vazio de criação, com texto explicando que os dados ainda
não foram configurados. Não é erro, não é falta de permissão e não gera
redirecionamento.

**Justificativa:** D129.

**Impacto:** `BusinessDataPage`.

### D320 — `PUT` é substituição completa `[F]`

**Decisão:** o formulário carrega o objeto atual, permite editar os quatro
campos e envia sempre todos os quatro no `PUT`. Campo opcional vazio é
enviado como `null` (ou omitido, que o backend trata como `null`), nunca
preservado por omissão. Não há `PATCH`, exclusão, versão ou concorrência
otimista.

**Justificativa:** D130/D131/D135.

**Impacto:** um único submit; estado inicial obrigatório antes de editar.

### D321 — Formulário e feedback `[P]`

**Decisão:** campos `commercialNameOrConsultant` e `phone` obrigatórios;
`email` e `taxId` opcionais. Mostrar `updatedAt` quando existir. Após salvar,
exibir confirmação e atualizar o objeto com a resposta. Não exibir ou aceitar
`id`. Não expor o payload em logs.

**Justificativa:** D126/D131/D137.

**Impacto:** `BusinessDataPage` e schema zod.

---

## 12. Feedback, erros e estados

### D322 — Taxonomia, tradução e parsing de erros `[A]`

**Aprovação humana registrada em 2026-10-21.** D277 permanece sujeita à sua própria confirmação.

**Decisão:** centralizar o tratamento em `ApiError` + `error-messages.ts`:

| Status | Comportamento |
| --- | --- |
| `400` | erros de formulário; `message` pode ser array |
| `401` | sessão: D277; no login, credencial inválida |
| `403` | erro de configuração de origem (D276) |
| `404` | recurso ausente; em dados do negócio, não configurado (D319) |
| `409` | conflito de estado; traduzir mensagem e recarregar (D313) |
| `422` | violações de negócio; exibir `errors[]` quando existir e `message` caso contrário |
| `429` | excesso de requisições; mensagem genérica |
| `500` | mensagem genérica com nova tentativa |

O parser aceita `message` como string ou array e `errors[]` opcional; nunca
exibe HTML, stack trace ou texto interno. Códigos conhecidos de gate e de
documentos têm tradução própria; desconhecidos caem em mensagem genérica.

**Justificativa:** auditoria 4.9; D118/D196.

**Impacto:** `parse-api-error.ts`, `error-messages.ts` e componentes de erro.

### D323 — Carregamento, sucesso e duplo envio `[P]`

**Decisão:** usar skeletons em listas e dashboard, spinner em botões de ação e
toasts para sucesso/erro. Desabilitar qualquer mutação enquanto estiver em
voo. Não usar atualização otimista em transições de estado nem em exclusões.
Confirmar ações destrutivas (D313). Exibir estados vazios com texto útil.

**Justificativa:** `PROJECT_SPEC.md` §14.1 (feedback claro); ausência de
idempotência nas ações e nos documentos.

**Impacto:** componentes compartilhados de loading/toast/empty.

### D324 — Invalidação de cache `[A]`

**Decisão aprovada por consequência:** usar query keys por recurso e
invalidar após mutações, conforme D265 (queries, mutations, invalidação e
refetch após ações):

- cliente criado/editado/excluído → lista e detalhe de clientes, resumos de
  orçamento (nome do cliente) e dashboard;
- orçamento criado/editado/ação → detalhe, lista, histórico e dashboard;
- instalação → detalhe, dashboard;
- PDF/ordem de produção → histórico e detalhe (o documento pode não alterar o
  detalhe, mas o histórico muda);
- dados do negócio → recurso e nenhum outro.

Não fazer polling. Refetch ao focar a janela é permitido para o dashboard e
listas, respeitando o limite global.

**Justificativa:** consistência após mutações; D41 (throttle).

**Impacto:** `query-keys.ts` e hooks de mutação.

---

## 13. Formatação e apresentação

### D325 — Dinheiro e decimais `[A]`

**Decisão aprovada por consequência:** dinheiro é sempre inteiro de centavos
na API; na tela, usar `Intl.NumberFormat('pt-BR', { style: 'currency',
currency: 'BRL' })`. Entradas monetárias convertem reais para centavos por
parsing de string. Medidas exibem até 3 casas e quantidades até 6, com
vírgula decimal e sem zero decimal desnecessário. Não há soma de dinheiro no
cliente (D303-B); a formatação parte de centavos inteiros e nunca de
aritmética de ponto flutuante.

**Justificativa:** D86; `PROJECT_SPEC.md` §6/§7.

**Impacto:** `money.ts`, `decimals.ts` e testes.

### D326 — Datas, fusos e rótulos `[A]`

**Decisão aprovada por consequência:** datas chegam em ISO 8601 UTC e são
exibidas no fuso local com `Intl.DateTimeFormat('pt-BR')`. Datas sem hora
(expirada, criação) podem ser exibidas apenas como data; instalação sempre
com data e hora. O frontend não recalcula a semana do dashboard. Situações,
tipos de desconto, eventos de histórico e ações têm mapa único de rótulos em
português, conforme D260.

**Justificativa:** D116, D231, D237, D259.

**Impacto:** `dates.ts` e `labels.ts`.

---

## 14. Segurança e privacidade

### D327 — Segredos, armazenamento e HTML `[F]`

**Decisão:** não armazenar sessão, senha, token ou credencial no navegador;
não registrar payloads com dados pessoais ou financeiros; não usar
`dangerouslySetInnerHTML` com dados da API; não persistir o cache de queries.
Nenhum token em URL ou query string.

**Justificativa:** D30/D137/D198; restrição explícita da fase.

**Impacto:** nenhum logger de produção com corpo de requisição; sanitização
padrão do React.

### D328 — Privacidade da ordem de produção e topologia `[F]`

**Decisão:** a ordem de produção é apenas o PDF gerado pelo backend; o
frontend não cria uma visão alternativa com dados pessoais ou financeiros. A
topologia de produção, a política de mesma origem, CSP e cabeçalhos de
segurança ficam para a Fase 12. Até lá, o cliente usa caminhos relativos por
padrão.

**Justificativa:** `PROJECT_SPEC.md` §10.5/§10.6 e §14.3; D150; `ARCHITECTURE.md`
§22 (hospedagem adiada).

**Impacto:** nenhuma tela de ordem de produção; configuração de produção não
é antecipada.

---

## 15. Testes e qualidade

### D329 — Escopo dos testes de frontend `[P]`

**Decisão:** cobrir com Vitest:

- formatadores de dinheiro, decimal e data;
- parser de erros e mapa de mensagens;
- schemas de formulário;
- hooks de API com MSW (login, bootstrap, lista, detalhe, mutações principais);
- componentes críticos: login, formulário de cliente, seções do formulário de
  orçamento, diálogos de ciclo de vida e dashboard.

Usar consultas por papel e rótulo (Testing Library), verificar foco e teclado
nos diálogos e não usar testes apenas de snapshot. Não perseguir cobertura
percentual.

**Justificativa:** `AGENTS.MD` (testar o risco, não a porcentagem);
`ARCHITECTURE.md` §17.

**Impacto:** arquivos `*.test.ts(x)`, setup do MSW e script `test`.

### D330 — E2E de navegador na Fase 12 `[F]`

**Decisão:** não adicionar Playwright/Cypress nesta fase. Os fluxos críticos
são cobertos por testes de componente/integração; o E2E de navegador entra na
Fase 12, conforme `IMPLEMENTATION_PLAN.md`.

**Justificativa:** `docs/IMPLEMENTATION_PLAN.md`, Fase 12 (“E2E dos fluxos
críticos”).

**Impacto:** nenhuma dependência de E2E nesta fase.

### D331 — Gates de verificação `[F]`

**Decisão:** cada etapa só é concluída quando passam:

```bash
cd frontend
npm run lint
npm run typecheck
npm test
npm run build
```

O backend não é alterado; os gates de backend permanecem os já definidos.
Nenhuma etapa é considerada concluída apenas porque compila.

**Justificativa:** `AGENTS.MD` (Task completion).

**Impacto:** scripts no `package.json`; execução obrigatória antes de commit.

---

## 16. Escopo e limites

### D332 — Fora de escopo da Fase 11 `[F]`

**Decisão:** não implementar:

- upload ou gestão de logo;
- compartilhamento por WhatsApp/Web Share ou link público;
- filtros avançados, paginação ou BI;
- modo escuro, PWA ou funcionamento offline;
- múltiplos usuários, papéis ou permissões;
- restauração de cliente excluído;
- lista, armazenamento ou versionamento de documentos;
- troca de cliente em orçamento;
- qualquer endpoint ou alteração de backend.

**Justificativa:** `PROJECT_SPEC.md` §1.4, §10.7, §12.3; D139/D150/D209;
`IMPLEMENTATION_PLAN.md`.

**Impacto:** nenhuma tela ou dependência para esses itens.

### D333 — Sem alterações de backend ou abstrações especulativas `[F]`

**Decisão:** a Fase 11 consome os contratos existentes. Qualquer lacuna é
registrada, não contornada com endpoint novo, proxy de negócio ou duplicação
de regra. Não criar repositório Git aninhado, camadas DDD no frontend,
gerenciador de estado global ou abstração para necessidade hipotética.

**Justificativa:** `AGENTS.MD` (General rules, Backend, Frontend);
`CLAUDE.md` (single repository); D271/D266.

**Impacto:** mudanças restritas a `frontend/`; commits atômicos por etapa
macro.

---

### D334 — Package manager do frontend `[A]`

**Decisão aprovada:** o frontend usa pnpm, assim como o backend. Remover `frontend/package-lock.json`, gerar `frontend/pnpm-lock.yaml` por instalação real e registrar `packageManager` com a versão efetivamente usada. Todos os comandos futuros do frontend usam pnpm.

Não criar `pnpm-workspace.yaml` nem converter o repositório em workspace/monorepo pnpm nesta fase. Backend e frontend continuam instaláveis separadamente; não mover dependências ou lockfiles para a raiz, centralizar `node_modules` ou criar scripts root-level de orquestração.

**Justificativa:** backend já usa pnpm; um único gerenciador reduz variação operacional. O frontend ainda não possui features, e manter npm não traz benefício concreto. Workspace agora ampliaria escopo sem benefício proporcional.

**Impacto:** manifesto e lockfile do frontend. As referências históricas a npm/package-lock nas decisões anteriores passam a ser executadas com pnpm/pnpm-lock, preservando seu conteúdo semântico. Typecheck e testes passam a ser exigíveis quando a infraestrutura de FRONTEND-04/05 estiver disponível; nenhuma verificação fictícia em FRONTEND-03.

---

## 17. Dependências propostas

FRONTEND-03 instalou somente a fundação aprovada. A tabela consolida as decisões aprovadas e as propostas restantes; tooling de teste fica em FRONTEND-05 e notificações continuam dependentes de D323.

| Categoria | Pacote | Estado | Decisão |
| --- | --- | --- | --- |
| Tipagem | `typescript`, `typescript-eslint` | instalado (dev), FRONTEND-03 | D263 `[A]` |
| Rotas | `react-router` | instalado, FRONTEND-03 | D264 `[A]` |
| Estado de servidor | `@tanstack/react-query` | instalado, FRONTEND-03 | D265 `[A]` |
| HTTP | `fetch` nativo | sem dependência | D267 `[A]` |
| Formulários | `react-hook-form` | já declarado | D268 `[A]` |
| Validação | `zod` | já declarado | D268 `[A]` |
| Estilo | `tailwindcss`, `@tailwindcss/vite` | instalados (dev), integração em FRONTEND-06 | D269 `[A]` |
| Ícones | `lucide-react` | instalado, FRONTEND-03 | D269 `[A]` |
| Classes | `clsx` | instalado, FRONTEND-03 | D269 `[A]` |
| Testes | `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `msw` | novo (dev) | D270 `[A]` |
| Notificações | `sonner` | novo | D323 `[P]` |
| Datas | `Intl` nativo | sem dependência | D326 `[A]` |
| Dinheiro | `Intl` nativo | sem dependência | D325 `[A]` |

Remoções executadas em FRONTEND-03: `axios` (D267), `shadcn-ui` (D269), `zustand` (D266), além de `postcss`/`autoprefixer` diretos, pois D269 usa o plugin Vite. Dependências transitivas de ferramentas não representam adoção direta de PostCSS.

---

## 18. Arquitetura final de pastas

```text
frontend/
├── index.html
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── vitest.config.ts
├── eslint.config.js
└── src/
    ├── main.tsx
    ├── app/
    │   ├── App.tsx
    │   ├── router.tsx
    │   ├── providers.tsx
    │   ├── query-client.ts
    │   └── styles/
    │       └── index.css
    ├── shared/
    │   ├── api/
    │   │   ├── http-client.ts
    │   │   ├── api-error.ts
    │   │   └── query-keys.ts
    │   ├── auth/
    │   │   ├── auth-context.tsx
    │   │   ├── use-session.ts
    │   │   └── require-auth.tsx
    │   ├── components/
    │   │   ├── AppShell.tsx
    │   │   ├── PageHeader.tsx
    │   │   ├── Button.tsx
    │   │   ├── FormField.tsx
    │   │   ├── ConfirmDialog.tsx
    │   │   ├── EmptyState.tsx
    │   │   ├── ErrorState.tsx
    │   │   ├── LoadingState.tsx
    │   │   ├── StatusBadge.tsx
    │   │   ├── MoneyInput.tsx
    │   │   ├── DecimalInput.tsx
    │   │   └── Toast.tsx
    │   ├── errors/
    │   │   ├── error-messages.ts
    │   │   └── parse-api-error.ts
    │   └── format/
    │       ├── money.ts
    │       ├── decimals.ts
    │       ├── dates.ts
    │       └── labels.ts
    └── features/
        ├── auth/
        │   ├── api.ts
        │   ├── hooks.ts
        │   ├── schemas.ts
        │   └── LoginPage.tsx
        ├── customers/
        │   ├── api.ts
        │   ├── hooks.ts
        │   ├── types.ts
        │   ├── schemas.ts
        │   ├── CustomersListPage.tsx
        │   ├── CustomerDetailPage.tsx
        │   ├── CustomerFormPage.tsx
        │   └── components/
        │       ├── CustomerForm.tsx
        │       ├── AddressFields.tsx
        │       ├── CustomerQuoteHistory.tsx
        │       └── CustomerDeleteDialog.tsx
        ├── quotes/
        │   ├── api.ts
        │   ├── hooks.ts
        │   ├── types.ts
        │   ├── schemas.ts
        │   ├── QuotesListPage.tsx
        │   ├── QuoteCreatePage.tsx
        │   ├── QuoteDetailPage.tsx
        │   ├── QuoteEditPage.tsx
        │   └── components/
        │       ├── QuoteForm.tsx
        │       ├── QuoteSection.tsx
        │       ├── CurtainEditor.tsx
        │       ├── FinancialItemsEditor.tsx
        │       ├── DiscountEditor.tsx
        │       ├── InstallationAddressEditor.tsx
        │       ├── TotalsSummary.tsx
        │       ├── QuoteActions.tsx
        │       ├── SendQuoteDialog.tsx
        │       ├── RenewQuoteDialog.tsx
        │       ├── CancelQuoteDialog.tsx
        │       ├── InstallationDialog.tsx
        │       ├── QuoteHistory.tsx
        │       └── QuoteDocuments.tsx
        ├── dashboard/
        │   ├── api.ts
        │   ├── hooks.ts
        │   ├── DashboardPage.tsx
        │   └── components/
        │       ├── StatusCountCard.tsx
        │       └── InstallationList.tsx
        └── business-data/
            ├── api.ts
            ├── hooks.ts
            ├── schemas.ts
            └── BusinessDataPage.tsx
```

Arquivos de teste ficam ao lado do arquivo testado
(`money.test.ts`, `QuoteForm.test.tsx`). Não há `src/modules`, `domain`,
`application` ou `infrastructure` no frontend.

---

## 19. Mapa final de rotas

| Rota | Componente | Proteção | Fonte de dados |
| --- | --- | --- | --- |
| `/login` | `LoginPage` | pública | `POST /auth/login` |
| `/` | redirecionamento | — | `GET /auth/me` |
| `/dashboard` | `DashboardPage` | sessão | `GET /dashboard` |
| `/clientes` | `CustomersListPage` | sessão | `GET /clientes?search=` |
| `/clientes/novo` | `CustomerFormPage` | sessão | `POST /clientes` |
| `/clientes/:customerId` | `CustomerDetailPage` | sessão | `GET /clientes/:id`, `GET /clientes/:id/orcamentos` |
| `/clientes/:customerId/editar` | `CustomerFormPage` | sessão | `GET/PATCH /clientes/:id` |
| `/clientes/:customerId/orcamentos/novo` | `QuoteCreatePage` | sessão | `GET /clientes/:id`, `POST /clientes/:id/orcamentos` |
| `/orcamentos` | `QuotesListPage` | sessão | `GET /orcamentos?search=&status=` |
| `/orcamentos/:quoteId` | `QuoteDetailPage` | sessão | `GET /orcamentos/:id`, `GET /historico` |
| `/orcamentos/:quoteId/editar` | `QuoteEditPage` | sessão | `GET/PATCH /orcamentos/:id` |
| `/configuracoes/dados-do-negocio` | `BusinessDataPage` | sessão | `GET/PUT /dados-do-negocio` |
| `*` | `NotFoundPage` | pública | — |

Ações de ciclo de vida, instalação e documentos não têm rota própria; são
diálogos/ações dentro de `/orcamentos/:quoteId`.

---

## 20. Cobertura dos temas obrigatórios

| Tema | Decisões |
| --- | --- |
| Fundação, tipagem e dependências | D260–D273 |
| Autenticação e sessão | D274–D280 |
| Navegação, shell e rotas | D281–D284 |
| Dashboard | D285–D289 |
| Clientes | D290–D294 |
| Orçamentos: lista e criação | D295–D299 |
| Formulário de orçamento | D300–D307 |
| Dados técnicos e composição financeira | D302–D307, D325 |
| Ciclo de vida | D308–D311, D313 |
| Instalação | D312, D313 |
| Documentos | D314–D317 |
| Histórico | D318 |
| Dados do negócio | D319–D321 |
| Feedback, erros e estados | D322–D324 |
| Formatação | D325–D326 |
| Segurança e privacidade | D327–D328 |
| Testes e qualidade | D329–D331 |
| Escopo e limites | D332–D333 |

---

## 21. Validação humana registrada

As treze decisões antes marcadas `[V]` foram validadas pelo responsável do
produto em 2026-10-20. **Não há decisão `[V]` pendente.**

| Decisão | Alternativa aprovada | Observação |
| --- | --- | --- |
| D263 — TypeScript | A | migração antes das features, com as condições da §2 |
| D264 — Router | A | React Router com mapa em `src/app/router.tsx` |
| D265 — Server state | A | TanStack Query, sem persistência de cache |
| D267 — Cliente HTTP | A | `fetch` encapsulado; Axios removido |
| D268 — Formulários | A | RHF + Zod para UX; backend autoridade |
| D269 — Estilização | A | Tailwind + primitivas nativas + lucide + clsx; sem shadcn/ui |
| D270 — Testes | A | Vitest + jsdom + Testing Library + user-event + MSW |
| D282 — Shell | A | navegação inferior no telefone + sidebar no desktop |
| D289 — “Ver todas” | A | ação omitida nesta fase |
| D298 — Criação | A | criar no primeiro “Salvar rascunho” |
| D300 — Formulário | A | página única com seções |
| D303 — Cálculo local | **B** | **nenhuma prévia local no MVP** |
| D314 — PDFs | A | `fetch` → Blob → object URL |

### 21.1 D303 — decisão com alteração

A recomendação original era a alternativa A (prévia monetária limitada). O
responsável do produto aprovou a **alternativa B**: nenhuma prévia local de
cálculos no MVP. O frontend não recalcula total de item, subtotal, desconto,
ajuste comercial, total final, `finalWidth`, `fabricQuantity` nem qualquer
outro derivado do domínio. Os valores são exibidos somente após o salvamento,
a partir da resposta do backend. Não criar `calc-preview.ts`. Uma futura
prévia exigirá nova decisão e testes de paridade.

### 21.2 `[P]` promovidas por consequência direta

| Decisão | Promovida por | Motivo |
| --- | --- | --- |
| D271 — Estrutura de pastas | D264, D265, D269 | realização direta do router centralizado, dos providers e dos componentes compartilhados aprovados |
| D273 — Limpeza de dependências | D267, D269, D266 | remoção de Axios, `shadcn-ui` e zustand foi explicitamente aprovada |
| D299 — Contexto do cliente | D297, D298 | a criação a partir do cliente exige contexto somente leitura; a origem do dado é implementação |
| D324 — Invalidação de cache | D265 | invalidação e refetch após ações fazem parte da decisão aprovada |
| D325 — Dinheiro e decimais | D260, D303-B | formatação pt-BR a partir de centavos inteiros, sem cálculo local |
| D326 — Datas e rótulos | D260 | apresentação em pt-BR e fuso local a partir do contrato ISO |

Nenhuma dessas promoções introduz comportamento novo além do já aprovado nem
reabre regra de produto ou backend.

**Aprovação adicional (2026-10-21):** D322 — Taxonomia, tradução e parsing de erros `[A]`, explicitamente confirmada pelo responsável do produto antes de FRONTEND-07. Não promove D277/D323/D329.

**Aprovações adicionais (2026-10-21):** D272 e D281 `[A]`, confirmadas explicitamente com as condições registradas nas próprias decisões. O mapa de rotas permanece idêntico. Isso libera essas pré-condições de FRONTEND-09; a task ainda não foi iniciada. As demais `[P]` permanecem inalteradas.

### 21.3 `[P]` ainda abertas

As decisões abaixo permanecem propostas e podem ser implementadas salvo
objeção. As marcadas como materiais devem ser confirmadas ou ajustadas antes
da etapa correspondente.

| Decisão | Tema | Material? |
| --- | --- | --- |
| D277 | Detalhes de `401`/`429` | sim (UX) |
| D278 | Composição e mensagens do login | sim (UX) |
| D279 | Logout sem confirmação | não |
| D283 | Raiz, títulos e metadados | não |
| D284 | NotFound, voltar e foco | não |
| D286 | Cards do dashboard | sim (UX) |
| D288 | Listas de instalação | sim (UX) |
| D291 | Debounce da busca | não |
| D292 | Formulário de cliente e endereço | sim (UX) |
| D294 | Exclusão, detalhe e histórico | sim (fluxo) |
| D296 | Filtros e linhas de orçamento | sim (UX) |
| D301 | Alterações não salvas | sim (UX) |
| D304 | Inputs de medidas e dinheiro | sim (UX) |
| D305 | Desconto e ajuste | sim (UX) |
| D309 | Diálogo de envio | sim (UX) |
| D310 | Confirmar/reabrir/renovar/cancelar | sim (UX) |
| D311 | Iniciar produção/concluir | sim (UX) |
| D312 | Instalação | sim (UX) |
| D317 | Ordem de produção e `409` | sim (UX) |
| D321 | Formulário de dados do negócio | sim (UX) |
| D323 | Loading, sucesso e duplo envio | sim (UX) |
| D329 | Escopo dos testes | sim (qualidade) |

---

## 22. Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| Origem/CSRF mal configurada em desenvolvimento | proxy do Vite e um único host (`localhost`) |
| `SameSite=Strict` com hosts misturados | não usar `127.0.0.1` junto de `localhost` |
| Limite global de 60 req/min | debounce, cache, sem polling |
| Duplo envio | botões desabilitados; sem optimistic update |
| Sessão de 12h sem refresh | aviso de alterações não salvas; salvar com frequência |
| Concorrência sem versão | recarregar após `409` |
| Fórmulas duplicadas | D303-B não calcula nada localmente; valores só após salvar |
| Feedback financeiro só após salvar | aceito no MVP; texto orienta a salvar; reavaliar com uso real |
| Float em dinheiro | inteiros de centavos e parsing de string |
| PATCH de coleções apaga filhos | preservar ids; enviar coleção completa só quando alterada |
| Cliques repetidos em PDF | desabilitar durante a geração |
| Listas grandes | busca no servidor e renderização simples |
| Migração de TypeScript no meio | D263-A faz a migração primeiro |
| `shadcn-ui` depreciado | remover; não usar |

---

## 23. Decomposição atômica definitiva da implementação

A decomposição definitiva foi consolidada em FRONTEND-03 a FRONTEND-32.
FRONTEND-03 é a primeira task de implementação; a fase só será concluída em FRONTEND-32.
Executar em ordem, uma task por vez, com no máximo um commit atômico por task.

Fluxo obrigatório: `READ → PRECONDITION CHECK → IMPLEMENT → VERIFY → REVIEW → REPAIR → RE-VERIFY → DONE`.
Ler as fontes, conferir as decisões consumidas em §21.3 e interromper a task antes de implementar qualquer escolha material ainda não aprovada. Propostas não materiais podem seguir salvo objeção.
Essa regra vale também para dependências transversais consumidas antes da task de revisão final; a indicação de D322/D323/D329 em FRONTEND-31 não adia sua aprovação quando usadas antes.

Depois de disponível a infraestrutura correspondente, rodar `pnpm typecheck`, `pnpm lint`, `pnpm test` e `pnpm build` em cada task conforme aplicável. Não mascarar falhas com `|| true` ou scripts que sempre passam. Typecheck será disponibilizado em FRONTEND-04; test/test:watch em FRONTEND-05.
Usar somente pnpm em `frontend/`. As referências históricas a npm em D260–D333 são operacionalmente substituídas por D334, sem mudança dos gates ou da semântica dessas decisões.
Antes de commit: `git diff --check`, `git status --short`; preferir `git add -p`.

### FRONTEND-03 — Padronizar package manager, dependências e scripts

#### Goal

Normalizar a fundação de dependências do frontend antes de qualquer feature.

Esta task inclui:

1. migrar package manager de npm para pnpm;
2. remover dependências já rejeitadas;
3. adicionar dependências aprovadas de fundação;
4. preparar scripts da Fase 11.

Não migrar ainda o código JS para TypeScript.

---

#### Estado inicial conhecido

O `frontend/package.json` atual é aproximadamente:

```json
{
  "name": "frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.20.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "react-hook-form": "^7.88.0",
    "shadcn-ui": "^0.9.5",
    "zod": "^4.6.5",
    "zustand": "^5.0.15"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.7",
    "@vitejs/plugin-react": "^6.1.1",
    "autoprefixer": "^10.6.1",
    "eslint": "^10.10.0",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.6",
    "globals": "^17.12.0",
    "postcss": "^8.5.28",
    "tailwindcss": "^4.3.3",
    "vite": "^8.3.0"
  }
}
```

Antes de editar, conferir o arquivo real.

O estado real prevalece.

---

#### Package manager

Migrar o frontend para pnpm.

##### Remover

```text
frontend/package-lock.json
```

##### Criar

```text
frontend/pnpm-lock.yaml
```

via instalação real com pnpm.

##### packageManager

Adicionar em `frontend/package.json`:

```json
"packageManager": "pnpm@<versao-real>"
```

Usar a versão de pnpm efetivamente instalada/usada.

Não inventar versão.

##### Proibições

Não criar:

```text
pnpm-workspace.yaml
```

Não:

- mover lockfile para raiz;
- compartilhar lockfile backend/frontend;
- mover dependências para raiz;
- alterar estrutura do backend;
- converter o repositório para workspace.

---

#### Dependências a remover

Remover:

```text
axios
zustand
shadcn-ui
```

Justificativas:

- `fetch` aprovado;
- sem state manager global;
- shadcn-ui depreciado/não adotado.

---

#### Dependências a manter

Manter:

```text
react
react-dom
react-hook-form
zod
```

Tailwind será mantido/normalizado conforme a versão 4 e a integração aprovada.

---

#### Dependências de produção a adicionar

Adicionar versões compatíveis com React 19/Vite 8:

```text
react-router
@tanstack/react-query
lucide-react
clsx
```

Não pinçar versões arbitrárias se houver incompatibilidade conhecida.

Usar versões estáveis compatíveis no momento da execução.

---

#### Dependências de desenvolvimento a adicionar

Adicionar foundation necessária para TypeScript:

```text
typescript
typescript-eslint
```

Tipos React já existem, mas verificar compatibilidade.

Não adicionar ainda tooling de teste que pertence à FRONTEND-05, salvo se o gerenciador exigir uma dependência técnica mínima para scripts.

---

#### Tailwind v4

Revisar:

```text
tailwindcss
postcss
autoprefixer
```

A decisão é usar Tailwind CSS v4 via integração moderna com Vite.

Não manter `postcss` ou `autoprefixer` apenas por herança do template.

Verificar o mecanismo recomendado pela versão instalada.

Se a integração Vite exigir pacote específico, adicioná-lo somente com justificativa.

Não criar configuração Tailwind completa nesta task; isso pertence à FRONTEND-06.

---

#### Scripts

A meta final da Fase 11 é:

```text
dev
build
lint
typecheck
test
test:watch
preview
```

Nesta task:

- preservar scripts existentes válidos;
- adicionar os scripts que possam existir sem fingir infraestrutura ainda não criada;
- `typecheck` pode ser preparado para FRONTEND-04;
- `test`/`test:watch` podem ser concluídos em FRONTEND-05.

Não usar:

```text
|| true
```

Não criar scripts que sempre passam.

Se algum script estiver propositalmente indisponível até a próxima task, documentar isso.

---

#### README

Não reescrever o README inteiro nesta task.

Pode atualizar somente instruções estritamente necessárias sobre:

```text
pnpm install
pnpm dev
```

se já houver seção de execução que ficaria incorreta.

A limpeza completa do README pode acontecer no fechamento.

---

#### Scope técnico

Arquivos esperados:

```text
frontend/package.json
frontend/pnpm-lock.yaml
frontend/package-lock.json   # removido
```

Possivelmente README, somente se necessário.

Não alterar ainda:

```text
frontend/src/
frontend/vite.config.*
frontend/eslint.config.*
frontend/tsconfig*
```

salvo necessidade estrita imposta pela mudança de package manager.

---

#### Verification

Executar dentro de `frontend/`:

```bash
pnpm install
pnpm --version
pnpm list --depth=0
pnpm lint
pnpm build
```

Se `lint` ou `build` falharem por estado preexistente do template ou por dependerem explicitamente da FRONTEND-04:

- classificar;
- não mascarar;
- não realizar a migração TypeScript antecipadamente nesta task.

Também:

```bash
git diff --check
git status --short
```

---

#### Semantic review

Confirmar:

1. frontend usa pnpm;
2. backend continua independente;
3. não existe workspace;
4. `package-lock.json` foi removido;
5. `pnpm-lock.yaml` existe;
6. packageManager foi registrado;
7. Axios removido;
8. Zustand removido;
9. shadcn-ui removido;
10. React Hook Form/Zod mantidos;
11. dependências novas têm justificativa;
12. nenhuma feature foi criada;
13. nenhum arquivo backend mudou.

---

#### Acceptance criteria

- `pnpm install` reproduz a instalação;
- apenas `pnpm-lock.yaml` representa o frontend;
- manifesto não contém dependências rejeitadas;
- dependencies refletem as decisões aprovadas;
- não existe workspace;
- nenhum código de feature foi implementado.

---

#### Commit sugerido

```text
chore(FRONTEND-03): standardize frontend package management
```

#### Decisions

D263–D269, D273, D334. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Tests

Instalação reproduzível, lint e build do template; sem criar testes de feature ou tooling de FRONTEND-05.

#### Registro de execução — 2026-10-21

**Estado: DONE.** READ e PRECONDITION CHECK concluídos com `AGENTS.MD` (grafia real no repositório), fontes obrigatórias e manifesto real. As decisões consumidas são aprovadas; nenhuma `[P]` material foi promovida. IMPLEMENT, VERIFY, REVIEW, REPAIR e RE-VERIFY concluídos. FRONTEND-04 não iniciado.

- pnpm efetivamente usado: **12.11.2**; `packageManager: pnpm@12.11.2`.
- `package-lock.json` removido; `pnpm-lock.yaml` gerado por instalação real e validado com `pnpm install --frozen-lockfile`.
- Removidos: Axios, Zustand, shadcn-ui, PostCSS e Autoprefixer diretos.
- Adicionados em produção: React Router **7.18.4** (major aprovada em D264), TanStack React Query **5.104.5** (D265), Lucide React **1.60.0** e clsx **2.1.1** (D269).
- Adicionados em desenvolvimento: TypeScript **6.0.3**, typescript-eslint **8.72.0** (D263) e `@tailwindcss/vite` **4.3.3** (D269).
- TypeScript usa faixa `~6.0.3`: a versão estável mais recente do compilador era 7.0.2, mas typescript-eslint 8.72.0 aceita `>=4.8.4 <6.1.0`; não instalar combinação incompatível.
- Lucide usa `~1.60.0`: a release 1.61.0 tinha poucas horas e provocou uma exceção automática de idade de release do pnpm. A versão 1.60.0 é estável, compatível com React 19 e não exige essa exceção.
- Mantidos React/React DOM, RHF e Zod, resolvidos pelo lock em **19.3.1 / 19.3.1 / 7.90.0 / 4.6.7**. Tipos React/DOM resolvidos em **19.3.0**. Vite resolvido em **8.3.4**, Tailwind em **4.3.3**.
- Integração moderna oficial: [Tailwind via Vite](https://tailwindcss.com/docs/installation/using-vite). O plugin é dependência de build; sua ativação e tokens ficam em FRONTEND-06. PostCSS e Autoprefixer não têm uso direto no template e foram removidos do manifesto.
- Scripts preservados: `dev: vite`, `build: vite build`, `lint: eslint .`, `preview: vite preview`. `typecheck` deliberadamente indisponível até FRONTEND-04; `test`/`test:watch` até FRONTEND-05. Nenhum script fictício.
- README mantido: não possui instruções de execução npm que precisem de correção nesta task.

**Verificação:** `pnpm install`, `pnpm install --frozen-lockfile`, `pnpm --version`, `pnpm list --depth=0` (21 pacotes diretos), `pnpm lint` e `pnpm build` passaram. `git diff --check` passou. `git status --short` revisado: somente os arquivos esperados da rodada e a auditoria documental já não rastreada antes dela.

**Falhas/intercorrências classificadas:** consulta inicial ao registry não respondeu no sandbox; a primeira tentativa de instalação, executada por engano na raiz, falhou no acesso ao store em filesystem somente leitura. Reexecutado no diretório correto com acesso autorizado. Um `package.json` transitório na raiz foi removido. A primeira instalação também gerou automaticamente `frontend/pnpm-workspace.yaml` para a exceção de idade do Lucide; esse arquivo foi removido e a versão ajustada. Instalação posterior e reprodução congelada passaram sem recriá-los. Nenhuma falha de lint/build.

**Review semântico e reparos:** D260–D333 preservadas literalmente; removida a menção residual a decomposição futura; corrigida a permissão visual residual de Playfair em números; dependências têm decisões e compatibilidade registradas; scripts futuros indisponíveis estão explícitos. Nenhuma feature, migração TS ou arquivo backend alterado. Não há workspace na raiz nem no frontend; a configuração preexistente do backend permanece intocada. Backend e frontend continuam instaláveis separadamente.

**Git:** alterações deixadas para revisão, sem commit. Sugestão: `chore(FRONTEND-03): standardize frontend package management`. A auditoria `11-frontend-audit.md` já estava não rastreada e não foi alterada nesta rodada.

---

### FRONTEND-04 — Migrar React/Vite para TypeScript

#### Goal

Concluir D263 antes de qualquer feature.

#### Scope

- criar configuração TypeScript adequada ao Vite atual;
- `strict: true`;
- configurar alias `@/`;
- converter `main.jsx` → `main.tsx`;
- converter bootstrap necessário;
- converter `vite.config.js` → `.ts` quando apropriado;
- ajustar ESLint para TypeScript + React;
- remover JS/JSX do template que não será utilizado;
- limpar assets/template sem uso;
- ajustar `index.html` para `pt-BR` e identidade mínima;
- fazer `pnpm typecheck` funcionar.

Não criar feature de produto.

Não usar:

```text
any
@ts-ignore
@ts-nocheck
```

como solução padrão.

#### Gates

```bash
pnpm typecheck
pnpm lint
pnpm build
```

#### Commit sugerido

```text
chore(FRONTEND-04): migrate frontend to TypeScript
```

#### Decisions

D263, D271, D283. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

#### Registro de execução — 2026-10-21

**Estado: DONE.** FRONTEND-04 executada exclusivamente. READ → PRECONDITION CHECK → IMPLEMENT → VERIFY → REVIEW → REPAIR → RE-VERIFY → DONE.

**Pré-condições:** `AGENTS.MD` é a grafia real das instruções do repositório. Fontes obrigatórias e estado real conferidos; FRONTEND-03 DONE; pnpm 12.11.2; lockfile pnpm presente e lockfile npm ausente; D263, D271 e D334 `[A]`. D283 é `[P]` não material; nenhum comportamento dependente de `[P]` material foi consumido ou aprovado implicitamente.

**Arquivos migrados/criados:** `src/main.jsx` → `src/main.tsx`; `vite.config.js` → `vite.config.ts`; `src/app/App.tsx` mínimo (somente título, sem feature); `tsconfig.json`, `tsconfig.app.json` e `tsconfig.node.json`. Atualizados `eslint.config.js`, `index.html`, `src/index.css`, `package.json` e `pnpm-lock.yaml`.

**Template removido:** `src/App.jsx`, `src/App.css`, `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg`, `public/icons.svg` e `public/favicon.svg`, após conferir suas referências. Removido o link do favicon do template; nenhum asset de marca foi removido ou inventado. Diretórios que ficaram vazios foram removidos.

**TypeScript final:** solution config com referências para app e Node; target/lib ES2022, `module: ESNext`, `moduleResolution: bundler`, `noEmit`, `strict`, `isolatedModules`, `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` e `noUncheckedSideEffectImports`. `skipLibCheck` restringe a verificação aos fontes do projeto sem revalidar declarações das dependências; não reduz strict nos fontes. App com DOM/DOM.Iterable, `vite/client`, `jsx: react-jsx` e `paths: { "@/*": ["./src/*"] }`, sem `baseUrl` depreciado. Node com `types: ["node"]`, incluindo somente `vite.config.ts`; caches de build ficam em `node_modules/.tmp`, sem emissão de JS. Alias Vite `@` aponta para `src` por `fileURLToPath(new URL('./src', import.meta.url))`. O import real `@/app/App` é verificado pelo typecheck e pelo build.

**Dependência técnica:** `@types/node` 26.6.5 (dev), necessária para tipar `node:url`, `import.meta` e a configuração Vite no runtime Node 26 disponível. Nenhuma biblioteca de produto ou teste adicionada.

**ESLint final:** flat config com `defineConfig` e `typescript-eslint.configs.recommended`, conforme [guia oficial](https://typescript-eslint.io/getting-started/). Linta `.ts`/`.tsx`, mantém React Hooks e React Refresh nos fontes da aplicação, globals browser em `src` e globals Node na configuração. Config JS lintada pelas regras recomendadas do ESLint; `dist` permanece ignorado. Sem regras estilísticas adicionais ou Prettier.

**Scripts finais:** `dev: vite`; `typecheck: tsc -b`; `lint: eslint .`; `build: tsc -b && vite build`; `preview: vite preview`. Typecheck independente e obrigatório; build executa o mesmo gate incremental antes do bundle, conforme D263. `test` e `test:watch` continuam ausentes, como esperado até FRONTEND-05. Vite apenas transpila TypeScript; a checagem real é feita por `tsc`, conforme [documentação oficial](https://vite.dev/guide/features.html#typescript).

**HTML/CSS:** `lang="pt-BR"`, título Cortinando ERP, viewport preservado e entrada TSX. CSS reduzido a margem zero e fonte de sistema neutra; sem tokens, paleta, fontes Cortinando ou plugin Tailwind ativo.

**Verificação:** `pnpm typecheck`, `pnpm lint`, `pnpm build` e `git diff --check` passaram. `git status --short` revisado. Prova negativa temporária: atribuir número a string em fonte TS fez `pnpm typecheck` falhar com TS2322/exit 2; probe removido. Prova negativa por stdin `.tsx`: `any` explícito fez ESLint falhar com `@typescript-eslint/no-explicit-any`/exit 1. São falhas esperadas de verificação dos gates, não findings pendentes. Após limpeza, todos os gates completos foram repetidos e passaram. Nenhuma infraestrutura de testes criada.

**Review/findings e reparos:** o elemento root potencialmente nulo agora é validado com guard explícito antes de `createRoot`, sem cast/non-null assertion. Não há `any`, suppression directive ou cast nos fontes; nenhuma referência a JSX/template removido permanece. Estrutura mínima sem DDD ou pastas vazias. Sem router, QueryClient, HTTP client, sessão, feature, proxy ou foundation visual. Backend, decisões de produto, spec visual e IMPLEMENTATION_PLAN intocados. O repositório continua monorepo Git com dois projetos pnpm independentes; sem workspace na raiz/frontend, sem alteração na configuração preexistente do backend.

**Git:** sem commit nesta rodada. Commit sugerido: `chore(FRONTEND-04): migrate frontend to TypeScript`.

**Stop:** FRONTEND-05 não iniciado.

---

### FRONTEND-05 — Configurar testes frontend

#### Goal

Materializar D270.

#### Scope

Instalar/configurar:

```text
vitest
jsdom
@testing-library/react
@testing-library/user-event
@testing-library/jest-dom
msw
```

Criar:

- configuração Vitest;
- setup global;
- MSW foundation;
- render helper mínimo se necessário;
- smoke test real;
- scripts `test` e `test:watch`.

Não instalar Playwright.

#### Gates

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

#### Commit sugerido

```text
test(FRONTEND-05): establish frontend test foundation
```

#### Decisions

D270, D330, D331; D329 material antes de ampliar cobertura de produto. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

#### Registro de execução — 2026-10-21

**Estado: DONE.** READ → PRECONDITION CHECK → IMPLEMENT → VERIFY → REVIEW → REPAIR → RE-VERIFY → DONE. FRONTEND-04 DONE e árvore limpa no início. D270 `[A]`, D330 e D331 autorizam a fundação; D329 continua `[P]` material e não foi promovida. Esta task não amplia cobertura de produto nem cria features.

**Dependências dev instaladas por pnpm 12.11.2:** Vitest 5.0.5, jsdom 30.1.3, Testing Library React 16.3.3, user-event 14.6.8, jest-dom 7.0.1 e MSW 3.0.3. Versões resolvidas em instalação real, compatíveis com React 19/Vite 8/Node 26; lockfile atualizado, sem workspace raiz/frontend.

**Implementação:** `vitest.config.ts` herda plugins e alias da configuração Vite por `mergeConfig`, usa ambiente jsdom, setup global, `clearMocks` e `restoreMocks`. Configuração incluída no tsconfig Node e ESLint; import explícito `.ts` com `allowImportingTsExtensions` (config Node já usa `noEmit`). `.vitest/` ignorado. Scripts `test: vitest run` e `test:watch: vitest --watch`, sem flags de sucesso vazio ou supressão de falhas.

**Setup/MSW:** `src/shared/test/setup.ts` importa matchers jest-dom/Vitest, registra cleanup DOM explícito e lifecycle beforeAll/afterEach/afterAll. `server.ts` exporta `setupServer()` sem handlers de produto; requisições sem handler falham (`onUnhandledFrame: 'error'` no MSW 3), handlers locais são resetados após cada teste e interceptação encerrada ao final. Nenhum service worker no browser ou backend necessário. Não foi criado render helper: o bootstrap atual não possui providers e o `render` nativo é suficiente.

**Testes:** `src/app/App.test.tsx` renderiza o App real e consulta heading/landmark por papel. `src/shared/test/foundation.test.tsx` verifica foco/Enter com user-event, fetch interceptado em URL reservada `.test`, limpeza de DOM/handlers e rejeição de requisição sem handler. Total: **2 arquivos, 5 testes**, sem snapshots e sem mockar contratos de produto. Fixtures de infraestrutura existem somente nos testes.

**Verificação:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` e `git diff --check` passaram após reparos. `pnpm test:watch` executou os cinco testes, entrou em “Waiting for file changes” e foi encerrado com `q`. `pnpm install --frozen-lockfile` passou com acesso autorizado ao store (tentativa no sandbox falhou por filesystem somente leitura). `git status --short` revisado. O bundle de produção mantém os mesmos arquivos/hash da FRONTEND-04: nenhuma ferramenta de teste importada pelo bootstrap.

**Findings e reparos:** a opção histórica `onUnhandledRequest` não existe no MSW 3 e foi rejeitada por typecheck/build; substituída por `onUnhandledFrame`, confirmada nos tipos/fontes instalados e pelo teste de requisição não tratada. Corrigido aviso do loader Vite com extensão explícita no import de configuração. Nesta execução, `vitest` sem flag encerrou após uma rodada; o script watch foi tornado explícito com `--watch` e validado. Gates completos repetidos após os reparos; sem finding pendente.

**Review semântico:** somente fundação de testes, sem antecipar cobertura material de D329, Tailwind, router, HTTP client, providers, feature ou testes E2E. Sem Playwright/Cypress. Backend, decisões D260–D334, spec visual e IMPLEMENTATION_PLAN intactos. Monorepo Git preservado com frontend/backend pnpm independentes.

**Git:** sem commit; sugerido `test(FRONTEND-05): establish frontend test foundation`.

**Stop:** FRONTEND-06 não iniciado.

---

### FRONTEND-06 — Configurar Tailwind e tokens visuais

#### Goal

Transformar `11-frontend-visual.md` em foundation visual técnica.

#### Scope

Configurar Tailwind v4 usando a integração adequada à versão real instalada.

Materializar tokens:

- `#203864` brand navy;
- `#EC7C30` brand orange;
- surfaces;
- text;
- borders;
- focus;
- semantic colors;
- radius 0/4/6;
- spacing;
- typography.

Fontes:

- Montserrat UI;
- Playfair Display apenas display.

Escolher carregamento simples e estável.

Não compartilhar arquivos de fonte privados.

Não criar visual de feature.

Remover CSS do template.

#### Branding

Se o asset oficial completo estiver disponível no repositório, organizá-lo sem alteração.

Se não estiver:

- não fabricar;
- não recortar;
- não redesenhar;
- não base64;
- registrar pendência.

#### Commit sugerido

```text
feat(FRONTEND-06): establish visual foundation
```

#### Decisions

D269, UI-01–UI-04. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

#### Registro de execução — 2026-10-21

**Estado: DONE.** READ → PRECONDITION CHECK → IMPLEMENT → VERIFY → REVIEW → REPAIR → RE-VERIFY → DONE. FRONTEND-05 DONE e árvore limpa no início. D269 e UI-01–UI-04 aprovadas; nenhuma `[P]` material consumida ou promovida.

**Implementação:** ativado `@tailwindcss/vite` 4.3.3 no Vite 8, sem PostCSS/Autoprefixer diretos ou configuração Tailwind legada. CSS neutro de `src/index.css` substituído por `src/app/styles/index.css`, importado pelo bootstrap. `@import "tailwindcss"` + `@theme static` disponibilizam tokens e utilitários conforme o [mecanismo oficial](https://tailwindcss.com/docs/theme). Não há visual de feature ou componente criado.

**Tokens:** namespace curto de marca (`brand-navy: #203864`, `brand-orange: #EC7C30` e tints), surfaces, texto, bordas, foco e famílias success/warning/error/info com fg/bg/border. Defaults cromáticos, famílias de fonte, tamanhos, pesos, raios e sombras substituídos pelos valores aprovados; sem escala 50–900 de marca. Raios `none/sm/md` = 0/4/6 px; espaçamento em base 4 px e tokens 1/2/3/4/5/6/8/10/12/16. Tipografia sem pesos 300 ou 700/800 como padrão. Títulos mobile-first: page-title 24 → 32 px, display 30 → 40 px e section-title 18 → 20 px no breakpoint desktop 1024 px. Corpo/inputs 16 px, label 13, caption 12, button 14 e números 16/32. Tokens adicionais para layout, safe area, touch target 44 px, foco 2 px/offset 2 px, sombra somente overlay e motion 120/160/200 ms.

**Base:** Montserrat em html/UI operacional; Playfair somente no h1 por padrão (uso futuro de `font-display` restrito a títulos de página/grandes headings). Inputs, botões, selects, textareas, tabelas e labels mantêm Montserrat. Canvas off-white, texto principal e título navy. `:focus-visible` tem outline; foco em superfície navy poderá usar `--focus-color: var(--color-focus-ring-inverse)`. Reduced motion reduz animações/transições e desativa smooth scroll. Primárias futuras usam navy/texto inverso; laranja segue assinatura/acento, distinto de warning/error. Primitivas e estados concretos ficam nas tasks correspondentes.

**Fontes:** adicionados `@fontsource-variable/montserrat` e `@fontsource-variable/playfair-display`, ambos 5.3.0, dependências públicas de assets (OFL-1.1). Dois WOFF2 variáveis normais, subset latin com suporte a pt-BR, servidos localmente pelo Vite com `font-display: swap` e fallbacks de sistema/Georgia; sem serviço externo em runtime, fontes privadas, itálicos ou arquivos base64. Montserrat disponibiliza pesos operacionais 400–600; Playfair 400–500. Licenças redistribuídas intactas em `public/fonts/montserrat-OFL.txt` e `public/fonts/playfair-display-OFL.txt`. Build final emite dois WOFF2, ~37,95 e 38,40 kB, e CSS ~7,53 kB.

**Branding:** inventário de arquivos do repositório não encontrou assets oficiais completos ou símbolo isolado. Pendência de lockup completo disponível para implementação, símbolo, inversa transparente/manual e horizontal se existir permanece registrada. Não foi fabricado, recortado, redesenhado ou incorporado substituto, logo ou favicon. Ausência não bloqueia esta task.

**Verificação:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (2 arquivos/5 testes), `pnpm build`, `pnpm install --frozen-lockfile` e `git diff --check` passaram; `git status --short` revisado. Probe temporário com `@source inline` confirmou emissão de `bg-brand-navy`, `text-text-inverse`, `rounded-sm`, `rounded-md`, `p-4` e `font-sans`; probe removido e todos os gates completos repetidos. Bundle final inspecionado: tokens compilados, URLs WOFF2 locais, sem diretivas `@theme` residuais. Nenhum teste de CSS que replique implementação ou teste de produto antecipado foi criado. Não houve validação visual em navegador nesta rodada.

**Review/findings e reparos:** conferidos os nomes/exports reais dos pacotes de fontes antes de criar os imports; usados URLs dos dois arquivos latin em vez de importar subsets desnecessários. Uma primeira cópia de licenças usou caminho relativo duplicado e falhou; corrigida, diretórios vazios transitórios removidos e licenças finais conferidas. Sem finding pendente. Nenhuma regra de negócio, feature, router, cliente HTTP, provider ou cálculo introduzido. D260–D334, spec visual, backend e IMPLEMENTATION_PLAN intocados. pnpm 12.11.2 preservado; monorepo Git com projetos frontend/backend independentes, sem workspace raiz/frontend.

**Git:** sem commit; sugerido `feat(FRONTEND-06): establish visual foundation`.

**Stop:** FRONTEND-07 não iniciado.

---

### FRONTEND-07 — Formatadores, labels e utilitários compartilhados

#### Goal

Centralizar apresentação transversal antes das features.

#### Scope

Criar utilitários para:

- BRL a partir de cents;
- datas ISO → pt-BR;
- date/time em `America/Sao_Paulo`;
- números/decimais de apresentação;
- status labels;
- metadata visual de status;
- mensagens conhecidas;
- helpers pequenos compartilhados.

Não recalcular:

- `expired`;
- `lateInstallation`;
- totals;
- medidas derivadas.

#### Tests

Cobertura forte de formatters.

#### Commit sugerido

```text
feat(FRONTEND-07): add shared presentation utilities
```

#### Decisions

D260, D262, D325, D326; D322 material antes de mensagens de erro de produto. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

#### Registro de execução — 2026-10-21

**Estado: DONE.** READ → PRECONDITION CHECK → IMPLEMENT → VERIFY → REVIEW → REPAIR → RE-VERIFY → DONE. FRONTEND-06 DONE; árvore limpa antes da rodada. A execução foi interrompida no precondition check enquanto D322 era `[P]` material. Após confirmação explícita do responsável do produto, D322 foi registrada `[A]`, com atualização do sumário e da lista de pendências. D277/D323/D329 não foram promovidas.

**Arquivos:** `src/shared/format/money.ts`, `decimals.ts`, `dates.ts`, `labels.ts`, `status.ts`, testes colocalizados de money/decimals/dates/labels e `src/shared/errors/error-messages.ts` com seu teste. Nenhuma dependência, script ou configuração adicional.

**Formatadores:** `formatMoney` recebe somente inteiro seguro de centavos e usa `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`/`formatToParts`, com divisão e resto BigInt para separar reais/centavos sem perda de precisão ou aritmética monetária float. Inclui negativos menores que um real. `formatMeasure` limita apresentação a 3 casas e `formatQuantity` a 6, sem zeros desnecessários; `formatInteger` exige inteiro seguro. Não há parsing de entrada, pois inputs de D304 ficam na task correspondente. Valores não finitos e centavos fracionários/inseguros são rejeitados com RangeError; zero negativo decimal normalizado. Arredondamento de exibição Intl não altera dados nem replica HALF_UP de negócio.

**Datas:** `formatDate`, `formatTime` e `formatDateTime` usam Intl pt-BR com `America/Sao_Paulo` explícito, relógio 00–23 e saída combinada `dd/mm/aaaa às hh:mm`. Aceitam instantes ISO com Z/offset, rejeitam strings sem fuso, datas de calendário inexistentes e valores inválidos. Datas opcionais ausentes devem ser tratadas pelo consumidor, sem inventar instante. Testes cobrem virada de dia/ano, offsets, ano bissexto e meia-noite. Sem relógio atual, classificação de instalações, cálculo de semana ou expiração.

**Labels/metadata:** mapas centralizados para seis status persistidos e EXPIRED somente como apresentação, três tipos de desconto, 14 eventos reais de histórico e ações. Tipos locais sem importar DTOs/backend. Metadata visual dos sete estados segue §16 da spec visual, com classes Tailwind e nomes de ícones funcionais (componente futuro resolve o ícone); cancelado neutro, expirado warning, confirmado/concluído diferenciados por label/ícone. Nenhuma função deriva status por data nem recalcula `expired`/`lateInstallation`. `getLabel` usa somente chaves próprias e fallback explícito para códigos desconhecidos, sem exibir código cru.

**Mensagens:** textos seguros por HTTP e allowlist de mensagens conhecidas do backend (documentos, origem, recursos, edição e transições), além dos 16 códigos reais do gate. Consultado código backend somente para confirmar strings/códigos; nenhum import ou alteração. Strings desconhecidas, HTML, stack trace, arrays, objetos e chaves herdadas recebem fallback genérico. Não há exposição de erro bruto, enumeração de conta, ação de navegação, retry, recarga ou efeito de sessão. ApiError/parser de corpo HTTP e integração com cliente continuam em FRONTEND-10; aqui foi criada somente a apresentação pura pedida em FRONTEND-07. D277 permanece pendente antes dos comportamentos de sessão.

**Verificação:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (**7 arquivos / 88 testes**), `pnpm build` e `git diff --check` passaram. Os 10 testes de datas também passaram com TZ do processo `Pacific/Honolulu` e `Asia/Tokyo`, confirmando saída independente do host. `git status --short` revisado: apenas spec e novos utilitários/testes. Sem snapshots. Revisão manual comparou os 16 códigos reais do backend com o mapa, sem gerar contratos compartilhados. Limites monetários testados inclusive ±MAX_SAFE_INTEGER; entradas inválidas, casas decimais, mensagens desconhecidas e protótipos cobertos.

**Review/findings e reparos:** protegida a conversão de datas contra normalização silenciosa de calendário inválido; preservado sinal em valores monetários negativos entre -1 e -99 cents sem converter para float; usadas chaves próprias para impedir que `__proto__`/`toString` sejam mensagens/rótulos. Todos os gates passaram; sem finding pendente. Nenhum total, desconto, ajuste, medida derivada, expiração ou atraso calculado. Sem feature, componente, HTTP client, parser, provider ou estado global. Backend, fontes superiores, IMPLEMENTATION_PLAN, visual spec, pacote/lockfile e projetos pnpm independentes intactos. Testes limitados aos utilitários autorizados em D325/D326/FRONTEND-07, sem ampliar a política de cobertura de produto de D329.

**Git:** sem commit; sugerido `feat(FRONTEND-07): add shared presentation utilities`.

**Stop:** FRONTEND-08 não iniciado.

---

### FRONTEND-08 — Primitivas básicas de UI

#### Goal

Criar somente componentes transversais necessários.

#### Scope

Conjunto inicial:

```text
Button
IconButton
TextField
TextArea
Select
FieldError
StatusBadge
Card/Surface
Dialog
Spinner/LoadingState
EmptyState
ErrorState
```

Adicionar Toast somente quando D323 estiver confirmada.

Seguir:

- UI-01…UI-04;
- mobile-first;
- touch target >= 44px;
- foco visível;
- semantic HTML;
- nenhuma dependência Radix sem necessidade concreta.

#### Tests

Testing Library para:

- keyboard;
- disabled;
- labels;
- focus;
- dialog;
- aria.

#### Commit sugerido

```text
feat(FRONTEND-08): add shared UI primitives
```

#### Decisions

D261, D269, UI-01–UI-04; D323 material antes de Toast. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

#### Registro de execução — 2026-10-21

**Estado: DONE.** READ → PRECONDITION CHECK → IMPLEMENT → VERIFY → REVIEW → REPAIR → RE-VERIFY → DONE. FRONTEND-07 DONE e árvore limpa no início. D261/D269 e UI-01–UI-04 confirmadas. D323 permanece `[P]` material: nenhum Toast, biblioteca de notificações, política global de mutação ou feedback de produto foi implementado. O escopo explícito autoriza as primitivas de loading/empty/error e os testes de interação desta task, sem promover D323/D329.

**Componentes:** `Button.tsx` (Button/IconButton), `FormFields.tsx` (TextField/TextArea/Select/FieldError), `StatusBadge.tsx`, `Surface.tsx`, `States.tsx` (Spinner/LoadingState/EmptyState/ErrorState) e `Dialog.tsx`, em `src/shared/components`. Sem novas dependências, barrel especulativo, router, API, provider ou feature.

**Botões/controles:** botão padrão `type="button"`, variante primária navy/branco, secundária, destrutiva semântica e texto; disabled nativo e distinguível sem baixa opacidade; min-height 44 px. IconButton tem nome acessível obrigatório e alvo mínimo 44 × 44 px; ícone decorativo oculto da árvore acessível. Campos preservam atributos/eventos/ref nativos (React 19), label explícito associado, IDs únicos com useId, hint/error via `aria-describedby` e erro por `aria-invalid`/role alert. Textarea redimensionável com altura mínima 96 px; Select nativo. Tokens 4 px nos controles, bordas de contraste aprovado, inputs 16 px, Montserrat e foco global visível.

**Apresentação/estados:** badge usa labels e metadata aprovados em FRONTEND-07, com texto + ícone e raios 4 px, sem recalcular status/expiração. Surface branca, borda e raio 6 px, sem sombra. Spinner decorativo respeita reduced motion; LoadingState fornece uma única região status. EmptyState informa ausência sem anúncio de erro. ErrorState anuncia mensagem textual com ícone e só executa retry por ação explícita do usuário; não há fetch/retry automático ou parser de erro. Nenhuma política de estado de produto criada.

**Dialog:** elemento HTML nativo `<dialog>` acionado por `showModal()` e prop open controlada; título/descrição associados; foco inicial no título; botão explícito de fechar; cancel nativo de Escape; restauração do foco ao elemento de origem no fechamento/unmount. Modalidade/top layer e isolamento do restante da página vêm do navegador. Guard de lifecycle distingue fechamento interno de solicitação externa e tolera replay de effects em StrictMode. Layout com margem mobile 16 px, largura máxima 520 px, altura limitada ao viewport, scroll interno, raio 6 px, sombra overlay e backdrop aprovado. Sem Radix ou implementação manual de focus trap.

**Testes:** quatro novos arquivos de Testing Library/user-event cobrem teclado/Enter, ausência de submit involuntário, submit explícito, disabled, refs, labels/IDs/descrições, remoção de erro, textarea/select nativos, sete badges, status loading, empty/error e retry manual, modal/control state, cancel e restauração de foco/StrictMode. A simulação de showModal/close existe somente em `Dialog.test.tsx` e é restaurada ao fim; jsdom não implementa modalidade nativa, portanto não foi tratada como prova de focus trap real.

**Verificação em navegador:** usada prévia temporária local com os componentes reais. Conferidos visual, backdrop, tipografia, foco visível, estados disabled e badges. Abrir diálogo focou o título, o conteúdo de fundo ficou fora da árvore acessível modal, Tab percorreu os controles do diálogo, Escape fechou e devolveu foco ao botão “Abrir diálogo”. Captura em `/tmp/frontend-08-dialog.png`. Prévia removida e servidor encerrado; nenhum showcase/tela de produto ficou no código. Não houve teste de viewport 320 px ou zoom 200% nesta rodada; o layout usa larguras fluidas e min-width zero.

**Findings e reparos:** primeira suite falhou por `showModal` ausente no jsdom; adicionada simulação local de API, sem polyfill de produção. O teste StrictMode revelou callback de fechamento durante cleanup; corrigido com guard de lifecycle e repetidos os testes direcionados. Tentativa de servidor no sandbox foi negada por EPERM; Vite local iniciado com acesso autorizado e encerrado após a verificação. Sem finding pendente.

**Gates finais:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (**11 arquivos / 108 testes**), `pnpm build` e `git diff --check` passaram após remover a prévia. `git status --short` revisado. Nenhum código/backend, fonte superior, spec visual, IMPLEMENTATION_PLAN, package.json ou lockfile mudou. D260–D334 preservadas. Sem Toast, branding inventado, cálculo local, armazenamento ou sessão. Monorepo Git com pnpm independente no frontend/backend preservado.

**Git:** sem commit; sugerido `feat(FRONTEND-08): add shared UI primitives`.

**Stop:** FRONTEND-09 não iniciado.

---

### FRONTEND-09 — Router, providers e ambiente

#### Precondition

D272 e D281 são decisões materiais aprovadas `[A]` em 2026-10-21. Suas condições são vinculantes.

Antes da implementação:

- verificar se foram aprovadas;
- se não, parar e pedir validação.

#### Goal

Criar bootstrap real da SPA.

#### Scope

- React Router;
- QueryClientProvider;
- árvore de providers;
- route skeleton;
- `/` → `/dashboard`;
- rotas previstas em D281;
- `VITE_API_BASE_URL`;
- proxy Vite conforme D272;
- `.env.example`;
- title/meta básicos.

Usar paths relativos por padrão.

Não implementar features.

#### Commit sugerido

```text
feat(FRONTEND-09): configure app routing and providers
```

#### Decisions

D264, D265, D271, D272, D281, D283. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

#### Registro de execução — 2026-10-21

**Estado: DONE.** READ → PRECONDITION CHECK → IMPLEMENT → VERIFY → REVIEW → REPAIR → RE-VERIFY → DONE. FRONTEND-08 DONE; árvore limpa no início. D272 e D281 `[A]` conferidas, D264/D265/D271 obrigatórias; D283 `[P]` não material aplicada sem promoção. Nenhuma outra decisão material promovida.

**Router:** `src/app/route-definitions.ts` centraliza os dez paths de produto exatamente como D281, sem rotas de lifecycle/instalação/documentos ou criação alternativa de orçamento. `router.tsx` usa React Router 7 declarativo, `/login` e `*` públicos, ramo de produto contendo `/` e os dez paths. `/` tem Navigate replace para `/dashboard` dentro desse ramo. Páginas são somente placeholders com título, sem formulários, dados ou features. Busca/query string preservada. Metadados definem document.title por caminho, incluindo deep links e não encontrado; HTML mantém pt-BR/viewport e adiciona theme-color navy aprovado.

**Proteção nesta etapa:** o elemento padrão do ramo protegido é um placeholder fechado, sem Outlet; ele não assume sessão anônima ou autenticada e não faz requisições. Assim, nenhuma página de produto é exposta enquanto não há sessão real. O ponto de composição `protectedElement` permite integrar o guard nas tasks 11–13. Nos testes, somente, um Outlet libera o ramo para verificar destinos, placeholders e redirecionamento raiz. Não foi criado flag de autenticação, mock de sessão, AuthProvider, RequireAuth, returnTo ou redirect de 401. A raiz autenticada e o redirecionamento de anônimos serão conectados ao estado real nas tasks de sessão/rotas protegidas; a regra de destino já está declarada. O login atual é somente um heading público, não fluxo funcional.

**Providers:** `query-client.ts` cria QueryClient por instância, queries/mutations sem retry automático; refetch de foco desativado por padrão, sem polling ou persistência. `providers.tsx` mantém cliente estável com inicialização lazy em useState. `App.tsx` compõe AppProviders → BrowserRouter → AppRoutes. Não há cache singleton compartilhado entre raízes, estado de produto global ou efeitos de sessão.

**Ambiente:** `src/shared/config/env.ts` lê `VITE_API_BASE_URL` opcional, vazia por padrão e normalizada sem barras finais; `vite-env.d.ts` tipa a variável. Não há cliente HTTP ainda; o futuro client consumirá essa configuração em FRONTEND-10. `.env.example` contém somente variável pública opcional, sem credencial/token/segredo. README recebeu instruções locais com pnpm e localhost, mantendo o restante do template para limpeza futura. Frontend/backend continuam com instalação e lockfiles independentes. Produção permanece na Fase 12.

**Proxy Vite:** host localhost, porta 5173 e strictPort impedem mudança silenciosa de origem. Os cinco prefixos `/auth`, `/clientes`, `/orcamentos`, `/dashboard`, `/dados-do-negocio` apontam para `http://localhost:3000`, sem rewrite e com changeOrigin false. Como os caminhos de UI coincidem com a API, bypass de GET/HEAD que aceitam text/html devolve index.html; fetch/JSON e mutações continuam na API. Origin não é definido nem reescrito pelo frontend. Não foi usado 127.0.0.1 nesta task nem alterado backend.

**Testes:** router/MemoryRouter cobre ramo fechado em todos os destinos, placeholders públicos, rota raiz com Outlet de integração, dez caminhos documentados, query string e ausência de rotas adicionais de ação. Provider cobre estabilidade, isolamento de cache e falhas sem retry. Ambiente cobre ausência/valor vazio/base explícita. `vite.config.test.ts`, incluído na configuração TypeScript Node/ESLint, verifica host/porta, cinco proxies, bypass HTML e manutenção de requisições JSON/POST. Mantidos todos os testes anteriores.

**Gates finais:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (**15 arquivos / 150 testes**), `pnpm build` e `git diff --check` passaram. `git status --short` revisado. Checagem adicional temporária com Vite real e stub HTTP isolado: cinco deep links devolveram HTML da SPA; cinco paths de API e POST preservaram método/path/Origin. O alvo localhost:3000 foi conferido na configuração; no teste de integração foi substituído somente em memória por stub em porta temporária. Backend real não foi acessado. Servidores temporários encerrados. Sem novas dependências ou alteração de package/lockfile.

**Findings/reparos:** evitado proxy encaminhar navegações HTML para API; feita distinção por método/Accept. O teste de configuração inicialmente falhou no typecheck por campos opcionais/unions do defineConfig; corrigido por guards explícitos, sem casts/suppressions. A primeira análise automática de permissão para a checagem de rede local expirou; a única repetição autorizada passou. Gates e verificação de proxy concluídos sem pendência.

**Review semântico:** mapa D281 preservado, todas as páginas de produto sob ramo fechado, criação de orçamento somente no cliente e ações dentro de detalhe futuro; sem sessão falsa, features, cliente HTTP, AuthProvider, AppShell ou retorno ao login antecipado. D260–D334, spec visual, fontes superiores e IMPLEMENTATION_PLAN intactos. Nenhuma mudança backend, workspace ou infraestrutura de produção.

**Git:** sem commit; sugerido `feat(FRONTEND-09): configure app routing and providers`.

**Stop:** FRONTEND-10 não iniciado.

---

### FRONTEND-10 — Cliente HTTP e ApiError

#### Goal

Materializar D267.

#### Scope

Criar:

```text
src/shared/api/http-client.ts
```

Suportar:

- JSON;
- 204;
- Blob;
- base URL;
- `credentials: 'include'`;
- parser defensivo;
- `ApiError`;
- AbortSignal.

Não:

- retry automático;
- refresh token;
- CSRF token;
- interceptors complexos.

Testar respostas:

```text
200
204
400
401
403
409
422
429
500
Blob
```

#### Commit sugerido

```text
feat(FRONTEND-10): add typed HTTP client
```

#### Decisions

D267, D275, D276; D277 e D322 materiais antes dos comportamentos correspondentes. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

---

### FRONTEND-11 — API e estado de sessão

#### Scope

- tipos Auth;
- `/auth/me`;
- login/logout API;
- `AuthProvider`;
- estados loading/authenticated/anonymous/error;
- sessão somente em memória.

Não usar storage.

#### Commit sugerido

```text
feat(FRONTEND-11): add session bootstrap
```

#### Goal

API e estado de sessão, respeitando os contratos e o escopo abaixo.

#### Decisions

D274–D276, D279, D280; D277 material antes do tratamento global de sessão. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

---

### FRONTEND-12 — Login e logout

#### Precondition

D277/D278 materiais.

#### Scope

- LoginPage;
- RHF + Zod;
- login real;
- returnTo seguro;
- 401;
- 429;
- loading;
- logout;
- cache clear.

#### Commit sugerido

```text
feat(FRONTEND-12): implement authentication flows
```

#### Goal

Login e logout, respeitando os contratos e o escopo abaixo.

#### Decisions

D268, D277–D280, D324. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

---

### FRONTEND-13 — Rotas protegidas e AppShell

#### Scope

- RequireAuth;
- redirects;
- bottom nav mobile;
- sidebar desktop;
- logout;
- active route;
- NotFound;
- foco pós navegação;
- branding conforme asset real.

Não inventar símbolo.

#### Commit sugerido

```text
feat(FRONTEND-13): implement protected app shell
```

#### Goal

Rotas protegidas e AppShell, respeitando os contratos e o escopo abaixo.

#### Decisions

D261, D274, D281, D282, D284, UI-04. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

---

### FRONTEND-14 — Camada de dados do Dashboard

#### Scope

- tipos;
- GET `/dashboard`;
- query key;
- hook TanStack.

Não recalcular nada.

#### Commit sugerido

```text
feat(FRONTEND-14): add dashboard data layer
```

#### Goal

Camada de dados do Dashboard, respeitando os contratos e o escopo abaixo.

#### Decisions

D265, D285, D287. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

---

### FRONTEND-15 — DashboardPage

#### Precondition

D286/D288 materiais.

#### Scope

- cinco cards;
- três listas;
- item → orçamento;
- loading/empty/error;
- sem telefone;
- sem gráfico;
- sem “ver todas”.

#### Commit sugerido

```text
feat(FRONTEND-15): implement operational dashboard
```

#### Goal

DashboardPage, respeitando os contratos e o escopo abaixo.

#### Decisions

D285–D289. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

---

### FRONTEND-16 — Contratos/API de Clientes

#### Scope

- tipos;
- payloads;
- address;
- search/get/history/delete;
- query keys/hooks.

#### Commit sugerido

```text
feat(FRONTEND-16): add customer data layer
```

#### Goal

Contratos/API de Clientes, respeitando os contratos e o escopo abaixo.

#### Decisions

D290, D293, D324. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

---

### FRONTEND-17 — Lista e busca de Clientes

#### Scope

- `/clientes`;
- busca server-side;
- debounce;
- query string;
- loading/empty/error;
- create action.

#### Commit sugerido

```text
feat(FRONTEND-17): implement customer list
```

#### Goal

Lista e busca de Clientes, respeitando os contratos e o escopo abaixo.

#### Decisions

D290, D291. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

---

### FRONTEND-18 — Formulário de Cliente

#### Precondition

D292 material.

#### Scope

RHF + Zod:

- name;
- phone;
- email;
- taxId;
- address;
- notes;
- create/edit;
- null/empty;
- backend errors.

Não criar validação de CPF/CNPJ que backend não possui.

#### Commit sugerido

```text
feat(FRONTEND-18): implement customer form
```

#### Goal

Formulário de Cliente, respeitando os contratos e o escopo abaixo.

#### Decisions

D268, D292, D293. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

---

### FRONTEND-19 — Detalhe, histórico e exclusão de Cliente

#### Precondition

D294 material.

#### Scope

- detail;
- quote history;
- Novo orçamento;
- soft delete;
- confirmação;
- invalidation;
- 404.

#### Commit sugerido

```text
feat(FRONTEND-19): complete customer flow
```

#### Goal

Detalhe, histórico e exclusão de Cliente, respeitando os contratos e o escopo abaixo.

#### Decisions

D294, D297, D324. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

---

### FRONTEND-20 — Contratos/API de Orçamentos

#### Goal

Materializar contratos tipados antes da UI complexa.

#### Scope

Tipos para:

- summary;
- detail;
- curtain;
- component;
- add-on;
- discount;
- totals;
- history;
- lifecycle payloads;
- installation;
- documents.

API functions e query keys.

Não importar DTO backend.

#### Commit sugerido

```text
feat(FRONTEND-20): add quote data layer
```

#### Decisions

D262, D295, D302, D308, D313–D318. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

---

### FRONTEND-21 — Lista e filtros de Orçamentos

#### Precondition

D296 material.

#### Scope

- search;
- status;
- URL query string;
- EXPIRED;
- summary;
- loading/empty/error.

Não recalcular expired.

#### Commit sugerido

```text
feat(FRONTEND-21): implement quote list
```

#### Goal

Lista e filtros de Orçamentos, respeitando os contratos e o escopo abaixo.

#### Decisions

D291, D295, D296. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

---

### FRONTEND-22 — Fundação do formulário de Orçamento

#### Precondition

D301/D304 materiais.

#### Scope

- QuoteForm;
- sections;
- RHF;
- Zod UX;
- dirty state;
- route guard;
- MoneyInput;
- DecimalInput;
- address editor;
- notes;
- reset com resposta servidor.

D303-B:

**nenhum cálculo local.**

#### Commit sugerido

```text
feat(FRONTEND-22): establish quote form foundation
```

#### Goal

Fundação do formulário de Orçamento, respeitando os contratos e o escopo abaixo.

#### Decisions

D268, D300, D301, D303-B, D304, D306. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

---

### FRONTEND-23 — Editor de Cortinas e Componentes

#### Scope

- field arrays;
- preservar ids;
- add/remove;
- ordem do array;
- room;
- description;
- material;
- opening width;
- border;
- height;
- factor;
- components;
- notes.

Não enviar sequence.

Não recalcular derived fields.

#### Commit sugerido

```text
feat(FRONTEND-23): implement curtain editor
```

#### Goal

Editor de Cortinas e Componentes, respeitando os contratos e o escopo abaixo.

#### Decisions

D302, D303-B, D307. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

---

### FRONTEND-24 — Adicionais, Desconto e Ajuste Comercial

#### Precondition

D305 material.

#### Scope

- general add-ons;
- quantity/unit/price;
- discount mode;
- fixed/percent;
- commercial adjustment;
- real → cents;
- backend-derived totals.

Nenhum cálculo local.

#### Commit sugerido

```text
feat(FRONTEND-24): implement quote financial inputs
```

#### Goal

Adicionais, Desconto e Ajuste Comercial, respeitando os contratos e o escopo abaixo.

#### Decisions

D303-B, D304, D305, D325. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

---

### FRONTEND-25 — Criação, edição e reconciliação do Orçamento

#### Scope

Criação:

- contexto fixo cliente;
- sem POST ao abrir;
- POST no primeiro salvar;
- após 201 → rota edit.

Edição:

- PATCH;
- preservar IDs;
- collections completas quando alteradas;
- response servidor substitui estado confirmado.

Testar risco de remoção acidental de filhos.

#### Commit sugerido

```text
feat(FRONTEND-25): persist quote form safely
```

#### Goal

Criação, edição e reconciliação do Orçamento, respeitando os contratos e o escopo abaixo.

#### Decisions

D293, D297–D299, D302, D303-B, D324. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

---

### FRONTEND-26 — Detalhe e histórico do Orçamento

#### Scope

- header;
- status;
- client;
- installation;
- curtains;
- additions;
- totals;
- dates;
- expired;
- lateInstallation;
- history;
- areas de actions/documents.

Não recalcular derivados.

#### Commit sugerido

```text
feat(FRONTEND-26): implement quote detail
```

#### Goal

Detalhe e histórico do Orçamento, respeitando os contratos e o escopo abaixo.

#### Decisions

D262, D308, D313, D318, D326. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

---

### FRONTEND-27 — Ações de lifecycle

#### Precondition

D309/D310/D311 materiais.

#### Scope

- send;
- confirm;
- reopen;
- renew;
- cancel;
- start production;
- complete;
- delete draft;
- confirmations;
- 409 refetch;
- 422 gates;
- invalidation/history.

Sem optimistic update.

#### Commit sugerido

```text
feat(FRONTEND-27): implement quote lifecycle actions
```

#### Goal

Ações de lifecycle, respeitando os contratos e o escopo abaixo.

#### Decisions

D308–D311, D313, D324. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

---

### FRONTEND-28 — Agendamento de instalação

#### Precondition

D312 material.

#### Scope

- schedule;
- date/time;
- ISO UTC;
- past allowed;
- remove;
- confirmation;
- lateInstallation do backend.

#### Commit sugerido

```text
feat(FRONTEND-28): implement installation scheduling
```

#### Goal

Agendamento de instalação, respeitando os contratos e o escopo abaixo.

#### Decisions

D312, D313, D326. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

---

### FRONTEND-29 — Documentos PDF

#### Precondition

D317 material.

#### Scope

Commercial PDF e Production Order:

- fetch Blob;
- object URL;
- open/download;
- revoke;
- sem prefetch;
- sem retry;
- tratar 409/500.

Não cachear PDF.

#### Commit sugerido

```text
feat(FRONTEND-29): implement quote documents
```

#### Goal

Documentos PDF, respeitando os contratos e o escopo abaixo.

#### Decisions

D314–D317, D324. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

---

### FRONTEND-30 — Dados do Negócio

#### Precondition

D321 material.

#### Scope

- GET;
- 404 = não configurado;
- form;
- PUT completo;
- save;
- invalidation.

Não criar upload de logo.

#### Commit sugerido

```text
feat(FRONTEND-30): implement business data settings
```

#### Goal

Dados do Negócio, respeitando os contratos e o escopo abaixo.

#### Decisions

D319–D321, D324. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

---

### FRONTEND-31 — Revisão transversal de UX, acessibilidade e testes

#### Preconditions

D322/D323/D329 materiais.

#### Scope

Revisar:

- errors;
- loading;
- success;
- double submit;
- accessibility;
- responsive;
- tests;
- dead code;
- template leftovers;
- unused dependencies;
- logs.

#### Gates

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

#### Commit sugerido

```text
test(FRONTEND-31): harden frontend behavior
```

#### Goal

Revisão transversal de UX, acessibilidade e testes, respeitando os contratos e o escopo abaixo.

#### Decisions

D322, D323, D329–D331. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

---

### FRONTEND-32 — Auditoria final, reparos e fechamento

#### Goal

Fechar a Fase 11 somente após auditoria semântica completa.

Começar read-only.

#### Revisar

- D260–D333;
- decisão pnpm;
- UI-01–UI-04;
- PROJECT_SPEC;
- ARCHITECTURE;
- contratos backend;
- acceptance criteria.

#### Checklist técnico

Confirmar:

- TypeScript strict;
- pnpm no frontend;
- sem `package-lock.json`;
- sem workspace root;
- feature-based;
- sem Redux/Zustand;
- fetch encapsulado;
- TanStack Query;
- RHF + Zod;
- backend fonte de verdade;
- nenhum cálculo local proibido;
- nenhuma sessão persistida;
- nenhuma duplicação de expired/lateInstallation;
- nenhuma alteração backend.

#### Checklist visual

Confirmar:

- Cortinando prevalece;
- navy estrutura;
- laranja acento;
- off-white canvas;
- Montserrat UI;
- Playfair restrita;
- radius 4/6;
- mobile-first;
- sem SaaS genérico;
- sem logo inventada.

#### Gates finais

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
git diff --check
git status --short
```

#### Documentation

Somente depois de tudo verde:

- atualizar `11-frontend.md`;
- atualizar `IMPLEMENTATION_PLAN.md`;
- fechar Fase 11.

Não iniciar Fase 12.

#### Commit sugerido

```text
docs(FRONTEND-32): close frontend phase
```

#### Decisions

D260–D334, UI-01–UI-04. Localizar todas as `[P]` consumidas, conferir §21.3 e parar antes do comportamento dependente de qualquer material ainda sem aprovação. Não promover propostas automaticamente.

#### Scope

Executar somente os itens técnicos e documentais explicitados nesta task.

#### Out of scope

Backend, Fase 12 e implementação das tasks posteriores. Não antecipar features nem infraestrutura atribuída a outra task.

#### Acceptance criteria

Todos os itens do Scope entregues e verificados; contratos preservados; decisões materiais consumidas aprovadas; nenhum item de Out of scope implementado.

#### Tests

Testes direcionados aos comportamentos e riscos do Scope, conforme D270 e decisões de qualidade já aprovadas; sem snapshots como única evidência.

#### Verification

Rodar os gates aplicáveis disponíveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`; registrar resultados e indisponibilidades reais. Antes de commit: `git diff --check` e `git status --short`.

#### Semantic review

Confrontar o Scope e as Decisions com PROJECT_SPEC, ARCHITECTURE, contratos backend, D303-B e a spec visual. Revisar findings, reparar e repetir a verificação afetada antes de DONE.

---

## 24. Condição para início da implementação

Não há `[V]` pendente nem gap backend bloqueante. FRONTEND-03 é a primeira task autorizada desta sequência; executar as tasks em ordem, com precondition check próprio. Cada `[P]` material de §21.3 bloqueia a task que a consome até confirmação explícita. Não promover todas as propostas automaticamente.

Decisões `[A]` são vinculantes. D303-B proíbe cálculo local. A spec `11-frontend-visual.md` é obrigatória; UI-01–UI-04 estão aprovadas e pendências de assets não são blockers globais. Não alterar backend, schema, migration, seed ou endpoint.

O frontend usa pnpm (D334), instalável separadamente do backend, sem workspace pnpm na raiz. FRONTEND-04 só pode começar em outra rodada. Não alterar `IMPLEMENTATION_PLAN.md` nesta rodada; o fechamento da fase ocorrerá somente em FRONTEND-32.

## 25. Conclusão

A decomposição atômica está fechada em FRONTEND-03 a FRONTEND-32. FRONTEND-03 é a primeira task; a Fase 11 só será concluída após a auditoria, reparos e gates de FRONTEND-32. Os contratos backend são suficientes e estáveis. A arquitetura aprovada é uma SPA React por feature, com TypeScript, React Router, TanStack Query, RHF + Zod, Tailwind com primitivas nativas, lucide-react e Vitest/MSW, sem estado global de negócio.

D303-B mantém o backend como única fonte de cálculo. Não há `[V]`; `[P]` materiais continuam sujeitas a confirmação antes da task que as consome. UI-01–UI-04 estão aprovadas. O frontend usa pnpm e não existe workspace pnpm na raiz.
