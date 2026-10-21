# Fase 11 — Auditoria do frontend e dos contratos backend

**Task de origem:** FRONTEND-01 — Auditoria do estado atual do frontend e dos
contratos backend
**Data:** 2026-10-20
**Branch:** `feat/11-frontend`
**Natureza:** auditoria e análise; nenhuma alteração de código, configuração,
schema, migration, seed, teste ou dependência.
**Spec que consome esta auditoria:** `docs/development/11-frontend.md`

---

## 1. Objetivo e método

Esta auditoria responde a três perguntas:

1. qual é o estado real do diretório `frontend/` antes da Fase 11;
2. quais contratos HTTP o backend já oferece e podem ser consumidos sem
   alteração;
3. quais lacunas, divergências e decisões de UX precisam ser fechadas antes de
   implementar telas.

Método:

- leitura integral dos arquivos do template em `frontend/`;
- leitura do código executável do backend (controllers, DTOs, mappers, guards,
  use cases e queries), não apenas da documentação;
- leitura das specs de desenvolvimento `02-auth.md`, `03-clientes.md`,
  `04-orcamentos.md`, `08-documentos.md`, `09-queries-dashboard.md` e
  `10-dados-negocio.md`;
- confronto com `docs/PROJECT_SPEC.md`, `docs/ARCHITECTURE.md` e
  `docs/IMPLEMENTATION_PLAN.md`;
- execução dos checks de baseline do frontend, sem instalar dependências.

Onde código e documentação divergem, prevalece o código implementado para
descrever o contrato HTTP, e a divergência é registrada na seção 4 ou 6.

---

## 2. Hierarquia de fontes aplicada

1. `docs/PROJECT_SPEC.md` — comportamento do produto.
2. `docs/ARCHITECTURE.md` — fronteiras técnicas.
3. Decisões aprovadas `[A]` das specs `02` a `10` (D1–D259).
4. Contratos HTTP efetivamente implementados.
5. A spec da Fase 11 (`11-frontend.md`).
6. `docs/IMPLEMENTATION_PLAN.md` — sequência e progresso.

Nenhuma fonte de prioridade inferior é usada para sobrepor uma de prioridade
superior. Em particular, a exigência de interface mobile-first de
`PROJECT_SPEC.md` §1.3 (item 12) e §14.1 e de `ARCHITECTURE.md` §18 prevalece
sobre qualquer sugestão de layout desktop-first.

---

## 3. Estado atual do frontend

### 3.1 Inventário

```text
frontend/
├── .gitignore
├── README.md                  (README do template React + Vite)
├── eslint.config.js           (configuração do template, JavaScript)
├── index.html                 (lang="en", title "frontend")
├── package.json
├── package-lock.json
├── vite.config.js             (apenas plugin React)
├── public/
│   ├── favicon.svg            (asset do template)
│   └── icons.svg              (ícones do template; inclui bluesky)
└── src/
    ├── main.jsx               (render do template)
    ├── App.jsx                (contador e logos do template)
    ├── App.css                (CSS do template, 184 linhas)
    ├── index.css              (CSS base do template, 111 linhas)
    └── assets/
        ├── hero.png
        ├── react.svg
        └── vite.svg
```

Não existe `node_modules/`. Não existem `.env`, `.env.local` ou variáveis de
ambiente do frontend.

### 3.2 Classificação dos arquivos atuais

| Arquivo | Classificação | Destino na Fase 11 |
| --- | --- | --- |
| `index.html` | template útil | permanece, com `lang="pt-BR"`, título e meta ajustados |
| `src/main.jsx` | template útil | permanece, migrado para `.tsx` se D263 aprovada |
| `src/App.jsx` | template a remover | substituído pelo roteador/providers |
| `src/App.css` | template a remover | substituído pelos estilos da aplicação |
| `src/index.css` | template a substituir | vira o CSS base (Tailwind, se D269 aprovada) |
| `src/assets/hero.png` | template a remover | sem uso previsto |
| `src/assets/react.svg` | template a remover | sem uso previsto |
| `src/assets/vite.svg` | template a remover | sem uso previsto |
| `public/favicon.svg` | template a substituir | ícone do produto |
| `public/icons.svg` | template a remover | símbolos sem uso previsto |
| `README.md` | template a substituir | documentação do frontend do produto |
| `eslint.config.js` | template útil | ajustado para TypeScript/React se D263 aprovada |
| `vite.config.js` | template útil | ganha proxy/alias se D272 aprovada |

### 3.3 Stack declarada

`frontend/package.json`:

- React `^19.2.8` e React DOM `^19.2.8`.
- Vite `^8.3.0` e `@vitejs/plugin-react` `^6.1.1`.
- ESLint `^10.10.0`, `@eslint/js` `^10.0.1`, `eslint-plugin-react-hooks`
  `^7.1.1`, `eslint-plugin-react-refresh` `^0.5.6`, `globals` `^17.12.0`.
- Dependências declaradas sem uso no código atual: `axios` `^1.20.0`,
  `react-hook-form` `^7.88.0`, `shadcn-ui` `^0.9.5`, `zod` `^4.6.5`,
  `zustand` `^5.0.15`.
- `tailwindcss` `^4.3.3`, `postcss` `^8.5.28` e `autoprefixer` `^10.6.1`
  declarados, mas sem arquivo de configuração e sem uso no CSS atual.

O `package-lock.json` confirma as versões resolvidas. O pacote `shadcn-ui`
está marcado como depreciado no registro npm; não é a forma atual de adoção do
shadcn/ui. Não há React Router, TanStack Query, Radix, Lucide, Vitest, Testing
Library, MSW, Playwright ou TypeScript.

O projeto usa **npm** no frontend (`package-lock.json`) e **pnpm** no backend
(`pnpm-lock.yaml`). Essa separação já é a adotada pelo repositório.

### 3.4 TypeScript versus JavaScript

O código atual é integralmente JavaScript (`.js`/`.jsx`), sem `tsconfig.json`.
`docs/IMPLEMENTATION_PLAN.md` linha 31 afirma:

> `[x] Projeto frontend React + Vite + TypeScript criado.`

Essa afirmação **não corresponde ao estado do repositório**. A divergência é
registrada aqui e não é corrigida nesta rodada. A decisão sobre migrar para
TypeScript antes das features é D263 em `11-frontend.md`.

### 3.5 Configuração de build e desenvolvimento

`vite.config.js` contém somente:

```js
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({ plugins: [react()] })
```

Consequências:

- porta padrão `5173`;
- nenhum proxy para o backend;
- nenhuma variável de ambiente;
- nenhum alias de importação;
- nenhuma configuração de teste.

O backend escuta em `PORT` (padrão `3000`) e usa
`APP_ORIGIN="http://localhost:5173"` como origem permitida em
`backend/.env.example`. O CORS está habilitado com `credentials: true`.

### 3.6 Checks de baseline

Executados em `frontend/`, sem instalar dependências:

| Comando | Resultado | Causa |
| --- | --- | --- |
| `npm run lint` | falha: `eslint: comando não encontrado` | `node_modules` ausente |
| `npm run build` | falha: `vite: comando não encontrado` | `node_modules` ausente |
| `npm test` | falha: `Missing script: "test"` | script não existe |

Essas falhas são de **ambiente**, não defeitos do código do frontend. Nenhuma
dependência foi instalada nesta rodada, conforme o escopo. Os gates reais só
podem ser executados depois da task de fundação que instala dependências e
define os scripts.

Versões do ambiente usadas na auditoria: Node `v26.4.0`, npm `12.0.2`.

### 3.7 Estado funcional

Não existe qualquer funcionalidade de produto:

- nenhuma rota;
- nenhum cliente HTTP;
- nenhuma tela de login ou sessão;
- nenhuma feature de clientes, orçamentos, dashboard, documentos ou dados do
  negócio;
- nenhum teste.

O template Vite permanece praticamente intacto. `package.json` não muda desde
o commit inicial `16369c4`.

---

## 4. Divergências e inconsistências documentais

### 4.1 TypeScript declarado, JavaScript implementado

Ver seção 3.4. Impacto: a Fase 11 precisa decidir explicitamente entre migrar
ou permanecer em JavaScript (D263).

### 4.2 Dependências declaradas sem uso e pacote depreciado

`axios`, `react-hook-form`, `shadcn-ui`, `zod`, `zustand`, `tailwindcss`,
`postcss` e `autoprefixer` estão no manifesto sem uso. `shadcn-ui` está
depreciado. O manifesto não é evidência de decisão arquitetural; a Fase 11
decide o que manter (D269, D273).

### 4.3 Mobile-first versus sugestão desktop-first

`PROJECT_SPEC.md` §1.3 e §14.1 e `ARCHITECTURE.md` §18 exigem interface
mobile-first, responsiva e adequada ao toque. Qualquer premissa de layout
desktop-first deve ser rejeitada. A decisão D261 registra o conflito e a
precedência.

### 4.4 Logo ausente no PDF

`IMPLEMENTATION_PLAN.md` marca a manutenção do logo como concluída, mas a
pendência visual D150 registra que o PNG real nunca foi fornecido. O PDF é
gerado sem logo. Não é um defeito do frontend e não existe upload de logo no
contrato (D150, D126, D139).

### 4.5 Cobertura de testes do backend

A suíte do backend já cobre Auth, Clientes, Orçamentos, Documentos, Dashboard
e Dados do Negócio. Esta auditoria não reabre nenhum contrato. Não há endpoint
faltante que bloqueie a Fase 11.

### 4.6 Cliente inativo no envio

A spec `04-orcamentos.md` deixa em aberto o status HTTP para cliente inativo
no momento do envio. O código resolve: `MarkQuoteAsSentUseCase` lança
`QuoteValidationError` com `CUSTOMER_NOT_ACTIVE`, mapeado para `422`. O
contrato efetivo é `422`, não `404`.

### 4.7 Histórico de cliente inexistente

`GET /clientes/:id/orcamentos` retorna `404 Customer not found` quando o
cliente nunca existiu, e `200` com o histórico quando o cliente foi
logicamente excluído. Comportamento confirmado em
`PrismaSearchQuotesQuery.listByCustomerId` e nos testes E2E.

### 4.8 `status=SENT` exclui expirados

O dashboard usa `sent` como SENT válido e `expired` separado. O filtro
`GET /orcamentos?status=SENT` aplica `validSentQuoteCondition`, excluindo
SENT expirados. `status=EXPIRED` usa `expiredQuoteCondition`. Portanto o card
`sent` e a lista filtrada concordam. A dúvida levantada na auditoria da Fase 9
está resolvida pelo código.

### 4.9 Corpo de erro não é uniforme

O `ValidationPipe` global responde `400` com `message` em formato de array. O
`429` responde apenas `{ statusCode, message }`, sem `error`. `404`, `401`,
`403` e `409` normalmente incluem `error`. `422` de `QuoteValidationError`
inclui `{ message, errors[] }`; `422` de `UnknownQuoteItemError` inclui apenas
`{ message }`. O frontend deve parsear de forma defensiva (D322).

### 4.10 `quoteNumber` canônico

O código e a spec usam `ORÇ-AAAA-NNN` (com cedilha). A representação em JSON é
UTF-8. O frontend não deve gerar, reformatar ou validar o número; apenas
exibir.

---

## 5. Contratos backend

Todos os endpoints abaixo já existem e estão cobertos por testes. Nenhum
endpoint novo é necessário para a Fase 11.

### 5.1 Auth

| Método | Rota | Sucesso | Erros relevantes |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | `200` `{ id, email }` + `Set-Cookie` | `400`, `401`, `403`, `429` |
| `GET` | `/auth/me` | `200` `{ id, email }` | `401` |
| `POST` | `/auth/logout` | `204` sem corpo | `403` (o `204` é idempotente) |

Detalhes:

- `POST /auth/login` recebe `{ email, password }`, ambos obrigatórios. O email
  é normalizado no backend (`trim`, NFC, `toLowerCase`).
- Credenciais inválidas: `401` com `message: "Invalid credentials"`, sem
  distinguir email inexistente de senha errada.
- `POST /auth/logout` não exige sessão válida; sempre responde `204` e limpa o
  cookie com `Max-Age=0`.
- Cookie: `cortinando_session` em desenvolvimento e
  `__Host-cortinando_session` em produção; `HttpOnly`, `Path=/`,
  `SameSite=Strict`, `Secure` em produção, `Max-Age=43200` (12 horas).
- Não há token de sessão exposto ao JavaScript e não há refresh token.
- CSRF: métodos `POST`, `PUT`, `PATCH` e `DELETE` exigem `Origin` (ou
  `Referer`) pertencente a `APP_ORIGIN`; caso contrário `403
  { statusCode: 403, message: "Invalid origin" }`. Não existe CSRF token.
- CORS: origens configuradas, `credentials: true`; não há wildcard com
  credenciais.
- Throttling: limite global de 60 requisições por minuto por IP em todas as
  rotas e limite específico de 5 tentativas por minuto por IP + email
  normalizado no login. Excesso: `429 { statusCode: 429, message: "Too Many
  Requests" }`. O limite global também afeta leituras.
- Sessão tem TTL absoluto de 12 horas, sem renovação deslizante.
- Sessões concorrentes são permitidas; um novo login não invalida os
  anteriores.

### 5.2 Clientes

| Método | Rota | Sucesso | Erros relevantes |
| --- | --- | --- | --- |
| `GET` | `/clientes?search=` | `200` lista de resumos | `400`, `401`, `429` |
| `POST` | `/clientes` | `201` detalhe | `400`, `401`, `403`, `429` |
| `GET` | `/clientes/:id` | `200` detalhe | `400`, `401`, `404` |
| `PATCH` | `/clientes/:id` | `200` detalhe | `400`, `401`, `403`, `404`, `429` |
| `DELETE` | `/clientes/:id` | `204` (idempotente) | `400`, `401`, `403`, `404` |
| `GET` | `/clientes/:id/orcamentos` | `200` lista de resumos de orçamento | `400`, `401`, `404` |

Campos de entrada (`POST`/`PATCH`):

```text
name, phone, email, taxId, address, notes
address: postalCode, street, number, complement, neighborhood, city, state
```

Resumo (`GET /clientes`):

```json
{ "id": "...", "name": "...", "phone": "...", "email": "..." }
```

Detalhe (`POST`, `GET`, `PATCH`):

```text
id, name, phone, email, taxId, address, notes, createdAt, updatedAt
```

- `deletedAt` nunca é exposto.
- `email`, `taxId`, `address` e `notes` são `null` quando ausentes.
- `address` é `null` ou um objeto completo com as sete chaves; quando
  presente, `street`, `number`, `neighborhood` e `city` são obrigatórios.
- `name` e `phone` são obrigatórios e não podem ser `null`/vazios.
- `PATCH` é parcial no nível superior: campo omitido permanece; `null` limpa
  campo opcional; `address` é substituído como bloco inteiro; corpo vazio é
  `200` sem alteração.
- Não há unicidade para `email` ou `taxId`; duplicidade é permitida.
- Busca: somente por `name`, substring literal case-insensitive e **sensível a
  acento** (`José` ≠ `Jose`), com escape de `%`, `_` e `\`. Ordenação
  `name ASC, id ASC`. Sem paginação.
- Exclusão é lógica. Após excluir: `GET`/`PATCH` → `404`, `DELETE` repetido →
  `204`, listas excluem o cliente. O histórico de orçamentos do cliente
  excluído continua acessível por `GET /clientes/:id/orcamentos`.
- Normalizações do backend: `name` (`trim` + NFC), `phone` (somente `trim`),
  `email` (`trim` + NFC + lowercase), `taxId` (somente dígitos; 11 ou 14),
  `postalCode` (somente dígitos; 8), `state` (`trim` + uppercase; 2 letras),
  textos opcionais (`trim`; vazio vira `null`). Não há validação de dígito
  verificador de CPF/CNPJ nem de DDD.

### 5.3 Orçamentos

Rotas:

| Método | Rota | Sucesso | Observações |
| --- | --- | --- | --- |
| `POST` | `/clientes/:customerId/orcamentos` | `201` detalhe | cria `DRAFT`; corpo pode ser `{}` |
| `GET` | `/clientes/:customerId/orcamentos` | `200` resumos | funciona para cliente excluído; `404` se nunca existiu |
| `GET` | `/orcamentos?search=&status=` | `200` resumos | `search` em nome do cliente ou número; `status` inclui `EXPIRED` |
| `GET` | `/orcamentos/:id` | `200` detalhe | `404` |
| `PATCH` | `/orcamentos/:id` | `200` detalhe | somente `DRAFT`/`SENT`; `409` fora disso |
| `DELETE` | `/orcamentos/:id` | `204` | somente `DRAFT`; `409` fora disso |
| `POST` | `/orcamentos/:id/enviar` | `200` detalhe | `422` no gate |
| `POST` | `/orcamentos/:id/confirmar` | `200` detalhe | `409` se inválido/expirado |
| `POST` | `/orcamentos/:id/reabrir` | `200` detalhe | `CONFIRMED → SENT` |
| `POST` | `/orcamentos/:id/renovar` | `200` detalhe | novo `validUntil` futuro |
| `POST` | `/orcamentos/:id/cancelar` | `200` detalhe | motivo opcional até 500 |
| `POST` | `/orcamentos/:id/iniciar-producao` | `200` detalhe | `CONFIRMED → IN_PRODUCTION` |
| `POST` | `/orcamentos/:id/concluir` | `200` detalhe | `IN_PRODUCTION → COMPLETED` |
| `PUT` | `/orcamentos/:id/instalacao` | `200` detalhe | `CONFIRMED`/`IN_PRODUCTION` |
| `DELETE` | `/orcamentos/:id/instalacao` | `204` | `CONFIRMED`/`IN_PRODUCTION` |
| `GET` | `/orcamentos/:id/historico` | `200` eventos | ordem `occurredAt ASC, id ASC` |
| `GET` | `/orcamentos/:id/pdf` | `200` PDF | ver 5.6 |
| `GET` | `/orcamentos/:id/ordem-producao` | `200` PDF | ver 5.6 |

Criação:

- `customerId` vem exclusivamente da rota e é imutável.
- Corpo opcional: `notes`, `discount`, `commercialAdjustmentCents`,
  `installationAddress`, `curtains`, `generalAddOns`.
- Corpo vazio cria um `DRAFT` sem cortinas.
- O número comercial é gerado no backend; números consumidos por rascunhos
  excluídos não são reutilizados.
- `POST` responde `404` se o cliente não existir ou estiver excluído.

Detalhe (`GET /orcamentos/:id`):

```text
id, quoteNumber, customerId, status, notes, installationAddress,
curtains[], generalAddOns[], discount, commercialAdjustmentCents,
totals, createdAt, updatedAt, firstSentAt, validUntil, confirmedAt,
productionStartedAt, scheduledInstallationAt, completedAt,
expired, lateInstallation
```

Cortina:

```text
id, sequence, room, description, material, openingWidth, borderValue,
finalWidth, height, fabricFactor, fabricQuantity, notes, components[],
totalCents
```

Item financeiro (componente ou adicional):

```text
id, name, quantity, unit, unitPriceCents, totalCents
```

Totais:

```text
curtainsSubtotalCents, generalAddOnsSubtotalCents, subtotalCents,
discountValueCents, calculatedTotalCents, commercialAdjustmentCents,
totalCents
```

Resumo (`GET /orcamentos` e histórico do cliente):

```text
id, quoteNumber, customer{id,name}, status, expired, totalCents,
createdAt, validUntil, scheduledInstallationAt
```

`PATCH`:

- Campo escalar omitido permanece; `null` limpa quando permitido.
- `curtains` e `generalAddOns` enviados representam a coleção completa.
- Item com `id` conhecido é atualizado; sem `id` é criado; ausente da coleção
  é removido. `components` segue a mesma regra dentro de cada cortina.
- A ordem do array define `sequence` (`1..N`); o cliente nunca envia
  `sequence`.
- `id` desconhecido ou pertencente a outro orçamento/cortina → `422`.
- Salvar sem mudança efetiva → `200` sem evento e sem alterar `updatedAt`.
- `customerId`, `quoteNumber`, `status`, `firstSentAt` e `validUntil` não são
  editáveis por `PATCH`.

Valores e formatos:

- Dinheiro: inteiro de centavos, campos com sufixo `Cents`.
- Medidas: número decimal em metros, no máximo 3 casas.
- Quantidades (`fabricQuantity`, `quantity`): no máximo 6 casas.
- Percentual de desconto: no máximo 2 casas.
- Datas: ISO 8601 UTC.
- `finalWidth`, `fabricQuantity`, totais de item/cortina, subtotal, desconto,
  total calculado, total final, `expired` e `lateInstallation` são derivados
  e somente leitura.

Gate de envio (`422` com `errors[]`):

```text
TOTAL_OUT_OF_RANGE, INSTALLATION_ADDRESS_INCOMPLETE, NO_CURTAINS,
CURTAIN_ROOM_REQUIRED, CURTAIN_OPENING_WIDTH_INVALID,
CURTAIN_HEIGHT_INVALID, CURTAIN_BORDER_INVALID,
CURTAIN_FABRIC_FACTOR_INVALID, CURTAIN_MATERIAL_REQUIRED,
CURTAIN_COMPONENT_REQUIRED, COMPONENT_INVALID, GENERAL_ADD_ON_INVALID,
DISCOUNT_EXCEEDS_SUBTOTAL, TOTAL_NOT_POSITIVE, VALID_UNTIL_NOT_FUTURE,
CUSTOMER_NOT_ACTIVE
```

Ciclo de vida:

| Situação | Ações disponíveis |
| --- | --- |
| `DRAFT` | editar, excluir, cancelar, prévia de PDF, enviar |
| `SENT` válido | editar, cancelar, renovar, confirmar, PDF |
| `SENT` expirado | editar, cancelar, renovar, PDF; não confirmar |
| `CONFIRMED` | reabrir, cancelar, agendar instalação, iniciar produção, ordem de produção, PDF |
| `IN_PRODUCTION` | gerenciar instalação, concluir, ordem de produção, PDF |
| `COMPLETED` | terminal; documentos |
| `CANCELLED` | terminal; sem PDF nem ordem de produção (`409`) |

Regras adicionais:

- `renovar` exige `validUntil` estritamente futuro.
- `reabrir` limpa `confirmedAt` e `scheduledInstallationAt`, preserva
  `firstSentAt` e `validUntil` e pode deixar o orçamento imediatamente
  expirado.
- `cancelar` aceita `DRAFT`, `SENT` e `CONFIRMED`; motivo opcional.
- Instalação aceita `CONFIRMED` e `IN_PRODUCTION`; datas passadas são aceitas;
  o mesmo instante é no-op.
- `concluir` é bloqueado por instalação futura agendada.
- Não há concorrência otimista; a última escrita vence.

Histórico:

```json
{ "id": "...", "eventType": "QUOTE_SENT", "occurredAt": "...", "details": {} }
```

Eventos: `QUOTE_CREATED`, `QUOTE_SENT`, `QUOTE_EDITED`, `QUOTE_CONFIRMED`,
`QUOTE_REOPENED`, `QUOTE_RENEWED`, `QUOTE_CANCELLED`, `PRODUCTION_STARTED`,
`INSTALLATION_SCHEDULED`, `INSTALLATION_CHANGED`, `INSTALLATION_REMOVED`,
`SERVICE_COMPLETED`, `COMMERCIAL_PDF_GENERATED`,
`PRODUCTION_ORDER_GENERATED`.

Erros:

| Situação | HTTP |
| --- | --- |
| DTO/validação estrutural ou UUID inválido | `400` |
| Sessão ausente | `401` |
| Origem inválida | `403` |
| Orçamento ou cliente inexistente | `404` |
| Transição inválida ou orçamento não editável | `409` |
| Violação de negócio do gate/`422` | `422` |
| `id` de filho desconhecido ou estrangeiro | `422` |
| Erro inesperado | `500` genérico |

### 5.4 Dashboard

`GET /dashboard` → `200`:

```json
{
  "statusCounts": {
    "draft": 0,
    "sent": 0,
    "expired": 0,
    "confirmed": 0,
    "inProduction": 0
  },
  "upcomingInstallations": [],
  "weeklyInstallations": [],
  "overdueInstallations": []
}
```

Item das três listas:

```json
{
  "quoteId": "uuid",
  "quoteNumber": "ORÇ-2026-001",
  "customerName": "Cliente",
  "scheduledInstallationAt": "2026-10-20T15:00:00.000Z",
  "status": "CONFIRMED"
}
```

- `statusCounts` sempre contém as cinco chaves, inclusive com zero.
- `sent` = SENT válido (não expirado); `expired` = SENT expirado.
- `upcomingInstallations`: instante `>= now`, status `CONFIRMED` ou
  `IN_PRODUCTION`, ordem por instante e número, limite 5.
- `weeklyInstallations`: semana civil em `America/Sao_Paulo`, segunda 00:00
  inclusive até a segunda seguinte exclusive, mesmos status, sem limite.
- `overdueInstallations`: instante `< now`, mesmos status, mais antigos
  primeiro, sem limite.
- Nenhuma lista traz telefone, email, documento, endereço ou valores.
- Clientes excluídos continuam aparecendo; a navegação deve usar `quoteId`.
- Sem paginação, sem filtros e sem outros endpoints de instalação.

### 5.5 Dados do negócio

| Método | Rota | Sucesso | Erros |
| --- | --- | --- | --- |
| `GET` | `/dados-do-negocio` | `200` recurso | `401`; `404` se não configurado |
| `PUT` | `/dados-do-negocio` | `200` recurso | `400`, `401`, `403` |

Recurso:

```json
{
  "commercialNameOrConsultant": "Cortinando",
  "phone": "(11) 99999-9999",
  "email": "contato@example.com",
  "taxId": "12345678901",
  "updatedAt": "2026-10-20T12:00:00.000Z"
}
```

- Não há `id`.
- `commercialNameOrConsultant` e `phone` são obrigatórios e nunca `null`.
- `email` e `taxId` são opcionais e `null` quando ausentes.
- `PUT` é substituição completa e create-or-update; sempre `200`.
- Campo opcional omitido é apagado. O formulário deve reenviar os quatro
  campos.
- Não há `POST`, `PATCH`, `DELETE`, logo, cor ou endereço.
- `404` no `GET` significa "ainda não configurado", não erro de permissão.

### 5.6 Documentos

| Método | Rota | Status permitidos | Efeito |
| --- | --- | --- | --- |
| `GET` | `/orcamentos/:id/pdf` | `DRAFT` (prévia), `SENT`, `EXPIRED`, `CONFIRMED`, `IN_PRODUCTION`, `COMPLETED` | gera/reemite; exceto DRAFT, grava `COMMERCIAL_PDF_GENERATED` |
| `GET` | `/orcamentos/:id/ordem-producao` | `CONFIRMED`, `IN_PRODUCTION`, `COMPLETED` | gera; grava `PRODUCTION_ORDER_GENERATED` |

- Resposta `200` `application/pdf`, `Cache-Control: no-store`,
  `Content-Disposition: inline` com `filename="orcamento-<numero>.pdf"` ou
  `"ordem-de-producao-<numero>.pdf"`.
- `CANCELLED` → `409 Document is not available in the current status`.
- Dados do negócio ausentes no PDF comercial → `409 Business data is not
  configured`.
- Dados incompletos → `409 Document data is incomplete`.
- Não há lista, armazenamento, versionamento, URL permanente ou metadados JSON.
- Cada geração/reemissão grava um evento; cliques repetidos geram eventos
  repetidos. Não fazer prefetch nem retry automático.
- A prévia de `DRAFT` não grava evento e não altera `updatedAt`.
- A ordem de produção não depende dos dados do negócio nem inclui dados
  pessoais ou financeiros.
- O logo é um asset fixo do backend e atualmente está ausente (D150). Não
  existe upload.

### 5.7 Transversais

- Formato de erro: `statusCode`, `message` e, na maioria, `error`. `429` não
  traz `error`. `400` traz `message` como array. `422` de gate traz
  `errors[]` com `{ code, message }`.
- Não há envelope de resposta (`data`, `meta`, `generatedAt`).
- Não há paginação em nenhuma lista.
- Todas as rotas de produto exigem `AuthGuard`.
- `GET`/`HEAD`/`OPTIONS` não passam pelo `CsrfOriginGuard`; mutações passam.
- O backend não traduz mensagens; elas são em inglês. A interface é em
  português, então o frontend precisa de um mapa de tradução e um fallback
  genérico.

---

## 6. Gaps

### 6.1 Gaps de backend

Nenhum gap bloqueia a Fase 11. Os itens abaixo são limitações conscientes do
contrato ou lacunas menores de especificação:

| Item | Situação | Impacto no frontend |
| --- | --- | --- |
| Listas sem paginação | por decisão (D59, D113) | a UI precisa lidar com listas completas |
| Sem endpoint de todas as instalações | por decisão (D238, D249) | "ver todas" de instalações não tem destino próprio |
| Sem troca de cliente do orçamento | por decisão (D78) | rascunho errado deve ser excluído e recriado |
| Sem restauração de cliente excluído | por decisão (D57) | cliente excluído não pode ser reaberto |
| Sem upload/gestão de logo | por decisão (D150) | nenhuma tela de marca |
| Sem lista ou armazenamento de PDFs | por decisão (D143/D144) | documentos são ações, não uma tela |
| Sem papéis/permissões | contrato atual é sessão única | não há UI de administração |
| Sem tradução de mensagens no backend | contrato atual | o frontend traduz |
| `422` com formatos diferentes | `{message}` ou `{message, errors}` | parser defensivo |
| Sem `Retry-After` garantido no `429` | comportamento do throttler | mensagem genérica, sem retry automático |
| Sem filtro de data em orçamentos | por decisão (D113) | não inventar filtros |

### 6.2 Gaps de frontend

- Sem TypeScript, roteador, cliente HTTP, features, telas ou testes.
- Sem tratamento de sessão, CSRF, 401, 403, 422, 429 ou 409.
- Sem convenção de formatação de dinheiro, medidas, datas ou rótulos.
- Sem estados de carregamento, erro, vazio e confirmação.
- Sem acessibilidade definida além do template.

### 6.3 Decisões de UX ainda abertas

- migrar para TypeScript ou permanecer em JavaScript (D263);
- biblioteca de rotas (D264);
- biblioteca de estado de servidor (D265);
- cliente HTTP (D267);
- biblioteca de formulários (D268);
- estilização e componentes (D269);
- testes (D270);
- shell de navegação (D282);
- destino de "ver todas as instalações" (D289);
- momento de criação do orçamento (D298);
- modelo do formulário de orçamento (D300);
- prévia local de cálculos (D303);
- abertura dos PDFs (D314).

---

## 7. Riscos

| Risco | Probabilidade | Impacto | Mitigação proposta |
| --- | --- | --- | --- |
| Origem diferente entre SPA e API quebra CSRF/cookie | média | todas as mutações falham com `403` | usar mesma origem em desenvolvimento (proxy) e produção (Fase 12) |
| `SameSite=Strict` com `localhost` e `127.0.0.1` misturados | média | cookie não é enviado | fixar um único host no desenvolvimento |
| Limite global de 60 req/min | média | `429` em telas com refetch agressivo | cache, debounce e sem polling |
| Duplo envio de ações | alta | eventos e transições duplicados | desabilitar durante o envio; sem optimistic update |
| Sessão expira em 12h sem refresh | média | perda de formulário não salvo | aviso de alterações não salvas e salvamento frequente |
| Concorrência sem versionamento | baixa | última escrita vence | recarregar após `409` |
| Duplicação de fórmulas no cliente | alta | totais divergentes | servidor como autoridade; prévia apenas se D303 aprovar |
| Float em dinheiro/medidas | média | arredondamento incorreto | inteiros de centavos e strings decimais |
| Coleções enviadas incorretamente no PATCH | média | remoção acidental de cortinas/componentes | preservar ids e enviar somente coleções alteradas |
| Cliques repetidos em PDF | média | eventos de histórico duplicados | desabilitar enquanto gera |
| Listas grandes sem paginação | média | lentidão em mobile | renderização simples e busca no servidor |
| Migração para TypeScript junto com features | média | aumento de escopo e regressões | fazer a migração como etapa isolada |
| `shadcn-ui` depreciado | baixa | dependência morta | remover; não usar o pacote |

---

## 8. Dependências candidatas

Nenhuma dependência foi instalada nesta rodada. A tabela é uma proposta; cada
linha dependente de decisão `[V]` só pode ser implementada após aprovação.

| Necessidade | Candidata | Versão de referência | Justificativa | Decisão |
| --- | --- | --- | --- | --- |
| Tipagem | `typescript`, `typescript-eslint` | estável na implementação | contratos HTTP e formulários complexos | D263 `[V]` |
| Rotas | `react-router` | 7.x | rotas declarativas, params, navegação | D264 `[V]` |
| Estado de servidor | `@tanstack/react-query` | 5.x | cache, loading, erro, invalidação | D265 `[V]` |
| HTTP | `fetch` nativo | — | sem dependência; cookies e erros sob controle | D267 `[V]` |
| Formulários | `react-hook-form` | 7.88 (já declarado) | formulários grandes e mobile | D268 `[V]` |
| Validação de UX | `zod` | 4.6 (já declarado) | schemas locais; backend continua autoridade | D268 `[V]` |
| Estilo | `tailwindcss` + `@tailwindcss/vite` | 4.3 (já declarado) | utilitários responsivos e mobile-first | D269 `[V]` |
| Primitivas acessíveis | HTML nativo (`<dialog>`, `<details>`) | — | sem biblioteca especulativa | D269 `[V]` |
| Ícones | `lucide-react` | estável na implementação | ícones leves e tree-shakeable | D269 `[V]` |
| Testes | `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `msw` | estáveis na implementação | testes de hooks, formulários e fluxos | D270 `[V]` |
| Utilitário de classes | `clsx` | estável | composição condicional de classes | D269 `[P]` |
| Notificações | `sonner` | estável | feedback de sucesso/erro | D323 `[P]` |
| Datas | `Intl` nativo | — | formatação pt-BR | D326 `[P]` |
| Dinheiro | `Intl` nativo | — | formatação BRL | D325 `[P]` |

Dependências a remover na fundação, se as decisões correspondentes forem
aprovadas: `axios`, `shadcn-ui`, `zustand`. `tailwindcss`, `postcss` e
`autoprefixer` só permanecem se o Tailwind for adotado; no Tailwind 4 o
plugin do Vite substitui a configuração PostCSS tradicional.

---

## 9. Arquivos provavelmente afetados na implementação

Esta auditoria não altera nenhum destes arquivos; a lista serve para
planejamento.

Removidos ou substituídos:

```text
frontend/src/App.jsx
frontend/src/App.css
frontend/src/assets/hero.png
frontend/src/assets/react.svg
frontend/src/assets/vite.svg
frontend/public/icons.svg
frontend/README.md
```

Alterados:

```text
frontend/index.html
frontend/package.json
frontend/package-lock.json
frontend/eslint.config.js
frontend/vite.config.js
frontend/src/main.jsx
frontend/src/index.css
frontend/public/favicon.svg
```

Criados (estrutura prevista na spec):

```text
frontend/tsconfig.json
frontend/tsconfig.node.json
frontend/src/app/**
frontend/src/shared/**
frontend/src/features/**
frontend/src/**/*.test.ts(x)
```

Nenhum arquivo de `backend/`, `backend/prisma/`, `docs/IMPLEMENTATION_PLAN.md`
ou configuração raiz é alterado pela Fase 11.

---

## 10. Conclusão

O backend está pronto para a Fase 11: todos os contratos necessários existem,
estão protegidos por sessão, usam o mesmo modelo de erro e não exigem endpoint
novo. O frontend, porém, é apenas o template Vite em JavaScript, sem qualquer
funcionalidade de produto.

As lacunas são de frontend e de decisão, não de backend. As treze decisões
`[V]` de `11-frontend.md` precisam de validação humana antes de qualquer
implementação. A mais estrutural é D263 (TypeScript): migrar depois de iniciar
as features aumenta o custo e o risco. A mais sensível ao produto é D303
(prévia local de cálculos), porque toca a fronteira entre UX e autoridade do
backend.

Nenhuma tela, componente, dependência, configuração ou teste foi criado ou
alterado nesta rodada.
