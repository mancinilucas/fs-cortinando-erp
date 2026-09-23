# PROJECT SPEC - Sistema de Gestão de Orçamentos para Consultoria de Cortinas Premium

## 1. VISÃO DO PRODUTO

### 1.1 Contexto do Negócio
Sistema web mobile-first para automatizar e profissionalizar o processo de orçamentação e produção de cortinas sob medida. O empreendedor atua como consultor e precisa gerenciar todo o ciclo: orçamento → confirmação → produção.

### 1.2 Problema Atual (Dores Identificadas)
- ❌ Orçamentos feitos manualmente (papel/WhatsApp)
- ❌ Sem histórico estruturado de orçamentos
- ❌ Impossibilidade de emitir PDF profissional para clientes
- ❌ Base de clientes desorganizada sem histórico
- ❌ Repassar medidas/materiais para produção é manual e propenso a erros
- ❌ Sem controle/histórico de serviços realizados
- ❌ Agendamento de visitas e entregas manual

### 1.3 Solução Proposta
Plataforma web responsiva que centraliza:
- ✅ Gestão profissional de orçamentos
- ✅ Cadastro e histórico de clientes
- ✅ Exportação de PDF para cliente
- ✅ Exportação segura para produção (sem preços expostos)
- ✅ Histórico completo de todas as transações

### 1.4 Escopo MVP
O foco inicial é resolver as dores principais. Features como agenda integrada e controle avançado serão iterações futuras.

**Core Features:**
1. Gestão de Clientes (CRUD com histórico)
2. Gestão de Orçamentos (criar, editar, exportar)
3. Geração de PDF para Cliente
4. Exportação de Dados de Produção
5. Confirmação de Orçamento (marcação manual)
6. Histórico e Relatório Básico

**Out of Scope (Futuras Iterações):**
- Integração com calendário/agenda
- App nativo (Phase 2)
- Sistema de pagamentos
- Relatórios avançados/BI
- Integração com WhatsApp API
- Multi-usuários

## 2. REQUISITOS FUNCIONAIS

### 2.1 Fluxo Principal: Orçamento

```
INÍCIO
  ↓
[1. Criar Orçamento] → Selecionar cliente ou criar novo
  ↓
[2. Adicionar Itens] → Cortina 1, Cortina 2, ... (N cortinas)
  ↓
[3. Configurar Custos] → Custos adicionais (montagem, etc) + Desconto (opcional)
  ↓
[4. Revisar & Validar] → Ver resumo do orçamento
  ↓
[5. Gerar PDF] → Exportar com data de validade (30 dias)
  ↓
[6. Aguardar Confirmação] → Marcar como "Aguardando Confirmação"
  ↓
[7. Cliente Confirma] → Dono marca manualmente como confirmado
  ↓
[8. Exportar para Produção] → Gerar PDF/imagem com dados essenciais
  ↓
FIM (Aguardando Entrega)
```

### 2.2 Entidades e Atributos

#### **Cliente**
```
{
  id: UUID
  nome: string (obrigatório)
  email: string (obrigatório)
  telefone: string (obrigatório)
  endereço: string (obrigatório)
  cidade: string
  estado: string
  cep: string
  anotações: text (opcional)
  dataCreated: datetime
  dataUpdated: datetime
  dataUltimoContato: datetime (nullable)
  statusCliente: enum ['ativo', 'inativo', 'bloqueado']
  
  // Relacionamentos
  orçamentos: Orçamento[]
  serviçosRealizados: ServiçoRealizado[]
}
```

#### **Orçamento**
```
{
  id: UUID
  numeroOrçamento: string (único, auto-gerado ex: ORÇ-2025-001)
  cliente: Cliente (FK, obrigatório)
  
  // Datas
  dataCriação: datetime
  dataValidade: date (padrão: +30 dias da criação)
  dataConfirmação: datetime (nullable)
  
  // Status
  status: enum ['rascunho', 'enviado', 'confirmado', 'cancelado', 'expirado']
  
  // Cálculos
  subtotal: decimal (sum de itens)
  desconto: decimal (opcional, 0 por padrão)
  custosTotaisAdicionais: decimal (sum de custos adicionais)
  total: decimal (subtotal - desconto + custos adicionais)
  
  // Metadados
  observações: text (opcional)
  dataUltimaAtualização: datetime
  
  // Relacionamentos
  itens: ItemOrçamento[]
  custosAdicionais: CustoAdicional[]
  históricoAlterações: HistóricoOrçamento[]
}
```

#### **ItemOrçamento (Cortina)**
```
{
  id: UUID
  orçamento: Orçamento (FK, obrigatório)
  sequência: integer (ordem no orçamento)
  
  // Dados Obrigatórios
  quantidadeCortinas: integer (padrão: 1)
  material: string (nome do tecido, obrigatório)
  
  // Dimensões
  altura: decimal (cm, obrigatório)
  largura: decimal (cm, obrigatório)
  profundidade: decimal (cm, opcional - para nichos, etc)
  
  // Detalhes Técnicos
  tiloTrilho: string (varão/trilho, obrigatório)
  custoPorMetro: decimal (preço do tecido/m², obrigatório)
  quantidadeMetros: decimal (calculado ou manual)
  
  // Cálculos
  custoBase: decimal (quantidadeMetros * custoPorMetro)
  custoUnitário: decimal (custo base / quantidadeCortinas)
  custoTotal: decimal (custoBase * quantidadeCortinas)
  
  // Metadados
  observações: text (opcional)
  dataAdição: datetime
  
  // Relacionamentos
  customFields: CampoCustomizado[]
}
```

#### **CustoAdicional**
```
{
  id: UUID
  orçamento: Orçamento (FK, obrigatório)
  
  // Tipo de Custo
  tipoCustom: boolean (true = campo customizado, false = pré-definido)
  nomeCusto: string (ex: "Montagem", "Frete", obrigatório)
  
  // Valor
  valor: decimal (obrigatório)
  percentual: boolean (false = valor fixo, true = percentual do subtotal)
  
  // Metadados
  observações: text (opcional)
  sequência: integer (ordem de exibição)
}
```

#### **CampoCustomizado**
```
{
  id: UUID
  item: ItemOrçamento (FK, obrigatório)
  
  nomeField: string (ex: "Ajuste Especial")
  tipo: enum ['texto', 'número', 'decimal', 'data']
  valor: string
  
  // Apenas se tipo = número ou decimal
  valor_numérico: decimal (nullable)
}
```

#### **HistóricoOrçamento** (Auditoria)
```
{
  id: UUID
  orçamento: Orçamento (FK)
  
  ação: enum ['criado', 'editado', 'confirmado', 'cancelado', 'pdf_gerado']
  camposAlterados: json (quais campos mudaram)
  novosDados: json (valores novos)
  dadosAntigos: json (valores antigos)
  
  dataAlteração: datetime
  quemAlterou: string (atualmente, sempre o dono = "dono_principal")
}
```

#### **ServiçoRealizado** (Histórico de Serviços)
```
{
  id: UUID
  cliente: Cliente (FK)
  orçamento: Orçamento (FK, opcional - pode ter serviço sem orçamento)
  
  descricaoServiço: string
  dataServiço: date
  dataConclusão: date (nullable)
  
  statusServiço: enum ['planejado', 'em_execução', 'concluído', 'cancelado']
  
  valor: decimal (opcional)
  observações: text
  
  dataRegistro: datetime
}
```

### 2.3 Requisitos Detalhados por Feature

#### **2.3.1 Gestão de Clientes**

**Listar Clientes**
- Exibir todos os clientes ativos
- Filtrar por: nome, email, telefone
- Ordenar por: data de cadastro, último contato, nome
- Exibir no card: nome, telefone, email, data último contato, quantidade de orçamentos
- Indicador visual: ativo/inativo

**Cadastrar Cliente**
- Campos obrigatórios: nome, email, telefone, endereço
- Campos opcionais: cidade, estado, CEP, anotações
- Validação: email único (caso raro de cliente duplicado com mesmo email)
- Feedback: mensagem de sucesso, redirecionamento para cliente criado

**Visualizar Cliente**
- Ver todas as informações
- Histórico de orçamentos (últimos 10, com resumo: número, data, valor, status)
- Histórico de serviços realizados
- Anotações
- Botões: Editar, Criar Orçamento, Ver Orçamentos Completos, Inativar

**Editar Cliente**
- Atualizar qualquer campo
- Adicionar/editar anotações
- Log de quem editou e quando

**Inativar/Ativar Cliente**
- Soft delete (não apaga dados, apenas marca como inativo)
- Clientes inativos não aparecem em listas padrão (filtro opcional)

#### **2.3.2 Gestão de Orçamentos**

**Criar Orçamento**
- Selecionar cliente existente OU criar novo cliente inline
- Sistema gera numero único (ORÇ-2025-001)
- Data de criação: automática
- Data de validade: padrão +30 dias (editável)
- Status inicial: 'rascunho'

**Adicionar Itens (Cortinas)**
- Botão "+ Adicionar Cortina"
- Form com campos:
  - Quantidade de cortinas (padrão 1)
  - Material (obrigatório, pode ter autocomplete com histórico)
  - Altura (cm, obrigatório)
  - Largura (cm, obrigatório)
  - Profundidade (cm, opcional)
  - Tipo de Trilho (obrigatório)
  - Custo por Metro (obrigatório)
  - Quantidade de Metros (auto-calcula ou manual)
  - Observações (opcional)

- Cálculo automático: custo total do item
- Poder adicionar múltiplos itens
- Poder remover/editar itens
- Reordenar itens (drag & drop, opcional mas nice-to-have)

**Adicionar Custos Adicionais**
- Botão "+ Adicionar Custo Adicional"
- Selecionar custo pré-definido OU criar custom:
  - Pré-definidos: Montagem, Frete, Ajuste Especial, Outra Serviço (expansível)
  - Custom: usuário digita nome + valor
- Valor: fixo ou percentual (do subtotal)
- Observação opcional

**Revisar Orçamento**
- Exibir resumo:
  - Dados do cliente
  - Cada cortina (material, medidas, custo)
  - Subtotal
  - Custos adicionais (itemizados)
  - Desconto (se houver)
  - **TOTAL**
- Permitir editar qualquer campo
- Validar antes de exportar/confirmar

**Gerar PDF para Cliente**
- Template profissional com:
  - Logo/Header com nome da empresa
  - Número do orçamento, data, validade
  - Dados do cliente
  - Tabela de itens (quant, material, medidas, custo unitário, custo total)
  - Custos adicionais
  - Desconto
  - Total com realce visual
  - Rodapé com contato, informações legais
  - **IMPORTANTE**: Mostrar apenas quantidade, material, medidas - SEM mostrar preços no PDF enviado ao cliente? (Validar com cliente se quer preços no PDF ou não)
- Exportar como: PDF
- Salvar cópia no histórico do orçamento

**Exportar para Produção**
- Gerar PDF/documento com APENAS informações essenciais:
  - Número do orçamento
  - Data de entrega esperada
  - Para cada cortina: quantidade, material, medidas (altura x largura x prof), tipo de trilho
  - Observações específicas
  - **NUNCA** incluir preços
- Formato otimizado para impressão simples ou envio via WhatsApp
- Salvar no histórico

**Confirmação do Orçamento**
- Botão "Marcar como Confirmado" (manual)
- Registra data/hora de confirmação
- Muda status para 'confirmado'
- Permite exportar para produção após confirmar

**Duplicar Orçamento**
- Útil para cliente que repete tipo de cortina
- Copia itens e estrutura
- Cria novo orçamento com número único
- Status: rascunho

**Cancelar Orçamento**
- Muda status para 'cancelado'
- Registra motivo (opcional)
- Não apaga dados (auditoria)

**Histórico de Alterações**
- Log simples: "Orçamento criado em 15/01/2025"
- "Cortina adicionada em 15/01/2025"
- "Confirmado em 16/01/2025"
- Expandível para ver detalhes

#### **2.3.3 Busca e Filtros Globais**

**Listar Orçamentos (Dashboard)**
- Exibir todos os orçamentos (paginado, 20 por página)
- Filtros: por status, por cliente, por data (range), por valor (range)
- Busca por: número do orçamento, nome do cliente
- Ordenar por: data criação (desc), data modificação, total, cliente
- Mostrar no card: número, cliente, data, status, total, data validade

**Busca Rápida (Navbar)**
- Campo de busca que procura em: número orçamento, nome cliente
- Resultados em dropdown (orçamentos e clientes)

## 3. REQUISITOS NÃO-FUNCIONAIS

### 3.1 Performance
- Carregamento de lista de orçamentos: < 2s
- Geração de PDF: < 5s
- Exportação de dados: < 3s

### 3.2 Segurança
- **Autenticação**: Apenas um usuário (o dono) no MVP
  - Login simples com email + senha
  - Sessão persistida (JWT ou session cookie)
- **Dados Sensíveis**: Preços NÃO são expostos nos PDFs de produção
- **Auditoria**: Registro de quem criou/alterou cada orçamento
- **LGPD**: Cliente pode solicitar dados (export), sistema permite soft-delete de clientes

### 3.3 Confiabilidade
- Backup automático de dados (responsabilidade do host)
- Histórico de alterações para auditoria
- Recuperação de rascunhos não salvos (localStorage, se desejar)

### 3.4 Usabilidade
- Interface mobile-first (responsiva, touch-friendly)
- Confirmações antes de ações destrutivas
- Notificações/toast de sucesso/erro
- Dados pré-preenchidos (ex: cliente recente, custos adicionais frequentes)

## 4. ARQUITETURA TÉCNICA

### 4.1 Stack Escolhida
```
Frontend: React ou Vue.js (responsivo)
Backend: NestJS
Banco: PostgreSQL + Prisma ORM
Autenticação: JWT
PDF Generation: PDFKit (Node.js backend)
Deployment: Docker (local/cloud)
```

### 4.2 Estrutura de Pastas (NestJS + React)

#### Backend (NestJS)
```
backend/
├── src/
│   ├── auth/              # Autenticação (login, JWT)
│   ├── clientes/          # CRUD de clientes
│   ├── orçamentos/        # CRUD de orçamentos
│   ├── itens/             # CRUD de itens de orçamento
│   ├── custos/            # CRUD de custos adicionais
│   ├── pdf/               # Geração de PDFs
│   ├── historico/         # Log de alterações
│   ├── shared/            # DTOs, enums, interfaces
│   ├── database/          # Prisma schema, migrations
│   └── main.ts
├── .env
├── package.json
├── tsconfig.json
├── docker-compose.yml
└── Dockerfile
```

#### Frontend (React/Vue)
```
frontend/
├── src/
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── ClientesPage.jsx
│   │   ├── OrçamentosPage.jsx
│   │   ├── OrçamentoDetalhe.jsx
│   │   └── Login.jsx
│   ├── components/
│   │   ├── ClienteForm.jsx
│   │   ├── OrçamentoForm.jsx
│   │   ├── ItemForm.jsx
│   │   ├── CustoAdicionalForm.jsx
│   │   └── ... (componentes menores)
│   ├── services/
│   │   ├── api.js
│   │   ├── clienteService.js
│   │   ├── orçamentoService.js
│   │   └── pdfService.js
│   ├── hooks/
│   │   ├── useAuth.js
│   │   └── useOrçamento.js
│   ├── utils/
│   │   ├── formatters.js
│   │   ├── validators.js
│   │   └── constants.js
│   ├── App.jsx
│   └── index.css
├── .env
├── vite.config.js
└── package.json
```

### 4.3 Endpoints da API (NestJS)

#### Auth
```
POST   /auth/login         # Login (email, senha)
POST   /auth/logout        # Logout
POST   /auth/refresh       # Refresh token
GET    /auth/me            # Dados do usuário autenticado
```

#### Clientes
```
GET    /clientes                 # Listar (com filtros)
POST   /clientes                 # Criar
GET    /clientes/:id             # Obter por ID
PUT    /clientes/:id             # Atualizar
PATCH  /clientes/:id/inativar    # Inativar (soft delete)
PATCH  /clientes/:id/ativar      # Ativar
GET    /clientes/:id/orçamentos  # Orçamentos do cliente
GET    /clientes/:id/historico   # Histórico de serviços
```

#### Orçamentos
```
GET    /orçamentos                       # Listar (com filtros)
POST   /orçamentos                       # Criar
GET    /orçamentos/:id                   # Obter detalhes
PUT    /orçamentos/:id                   # Atualizar
PATCH  /orçamentos/:id/confirmar         # Marcar como confirmado
PATCH  /orçamentos/:id/cancelar          # Cancelar
DELETE /orçamentos/:id                   # Deletar (apenas rascunho)
POST   /orçamentos/:id/duplicar          # Duplicar orçamento
GET    /orçamentos/:id/historico         # Histórico de alterações
```

#### Itens
```
POST   /orçamentos/:id/itens              # Adicionar item
PUT    /orçamentos/:id/itens/:itemId      # Editar item
DELETE /orçamentos/:id/itens/:itemId      # Remover item
```

#### Custos Adicionais
```
POST   /orçamentos/:id/custos             # Adicionar custo
PUT    /orçamentos/:id/custos/:custoId    # Editar custo
DELETE /orçamentos/:id/custos/:custoId    # Remover custo
```

#### PDF & Exportação
```
GET    /orçamentos/:id/pdf                # Gerar PDF para cliente
GET    /orçamentos/:id/pdf-producao       # Gerar PDF para produção
GET    /orçamentos/:id/export-json        # Exportar como JSON
```

### 4.4 Fluxo de Dados

```
Frontend (React/Vue)
    ↓
API REST (NestJS)
    ↓
Business Logic Layer (Services)
    ↓
Database (PostgreSQL + Prisma)

PDF Generation:
Usuário clica em "Gerar PDF" → Backend gera usando PDFKit → Retorna como download
```

### 4.5 Tratamento de Erros

**Códigos HTTP:**
- 200: OK
- 201: Created
- 400: Bad Request (validação)
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 409: Conflict (ex: email já existe)
- 500: Internal Server Error

**Formato de Erro:**
```json
{
  "statusCode": 400,
  "message": "Validação falhou",
  "errors": [
    {
      "field": "email",
      "message": "Email já cadastrado"
    }
  ]
}
```

## 5. PLANO DE DESENVOLVIMENTO

### Fase 1: MVP (4-6 semanas)
1. Setup inicial (NestJS + React + PostgreSQL + Docker)
2. Autenticação básica (login/logout)
3. CRUD de Clientes
4. CRUD de Orçamentos (criar, editar, listar)
5. CRUD de Itens e Custos Adicionais
6. Geração de PDF (cliente e produção)
7. Testes básicos (unitários)
8. Deploy inicial (ou instructions para self-hosted)

### Fase 2: Iteração 1 (2-4 semanas pós-MVP)
1. Histórico de alterações avançado
2. Campos customizados (adicionar campos dinâmicos)
3. Busca e filtros avançados
4. Relatório básico de orçamentos
5. UI/UX refinement baseado em feedback

### Fase 3: Iteração 2 (Future)
1. Integração com calendário (agenda de visitas/entregas)
2. App nativo (React Native ou Flutter)
3. Sistema de pagamentos
4. Integração com WhatsApp API
5. BI e relatórios avançados

## 6. TECNOLOGIAS ESPECÍFICAS

### Backend
- **Framework**: NestJS (TypeScript)
- **ORM**: Prisma (schema + migrations)
- **Database**: PostgreSQL 15+
- **Autenticação**: @nestjs/jwt, bcrypt
- **Validation**: class-validator, class-transformer
- **PDF**: PDFKit ou similar
- **Logging**: Built-in do NestJS
- **Testing**: Jest

### Frontend
- **Framework**: React 18+ com Vite OU Vue 3 (escolher um)
- **State**: React Context / Zustand (React) OU Pinia (Vue)
- **Styling**: Tailwind CSS + shadcn/ui (ou componentes customizados)
- **Form**: React Hook Form + Zod (React) OU VeeValidate (Vue)
- **HTTP**: Axios
- **PDF Viewer/Download**: pdfjs-dist ou file-saver
- **Date**: date-fns
- **Icons**: Lucide React / Vue Icons
- **Testing**: Vitest + React Testing Library (React)

### DevOps
- **Containerização**: Docker + Docker Compose
- **Envs**: .env para local dev
- **Version Control**: Git + GitHub
- **CI/CD**: GitHub Actions (opcional, Phase 2)

## 7. CONSIDERAÇÕES DE SEGURANÇA E COMPLIANCE

### Autenticação
- Apenas um usuário no MVP (o dono)
- Login seguro com hash bcrypt
- JWT com refresh token
- Sessão com timeout (ex: 24h)

### Dados Sensíveis
- Preços não são expostos em PDFs de produção
- Histórico de alterações registra quem fez o quê
- Soft delete para clientes (LGPD)
- Nenhuma informação de pagamento armazenada (Phase 2)

### Validação e Sanitização
- Backend valida TODOS os inputs
- DTOs com class-validator
- Previne SQL injection (Prisma ORM)
- Previne XSS (React renderiza escapado, backend não injeta scripts)

## 8. DEFINIÇÃO DE PRONTO (Definition of Done)

Um feature está pronto quando:
- ✅ Código desenvolvido e testado (unitários)
- ✅ Code review feito
- ✅ Migrations (se houver) criadas e testadas
- ✅ Documentado (comentários, README updates)
- ✅ Testado manualmente no browser (mobile + desktop)
- ✅ Sem console errors/warnings
- ✅ Performance aceitável (< limiares definidos)
- ✅ Validação de inputs funcionando
- ✅ Mensagens de erro claras para usuário

## 9. PRÓXIMOS PASSOS

1. ✅ Validar esta especificação com o cliente (empreendedor)
2. ✅ Criar repo Git com estrutura inicial
3. ✅ Configurar Docker local
4. ✅ Gerar DEVELOPMENT_SPEC.md com tasks específicas
5. ⏭️ Iniciar desenvolvimento da Fase 1

---

**Última Atualização**: 18/01/2025
**Status**: Pronto para desenvolvimento
