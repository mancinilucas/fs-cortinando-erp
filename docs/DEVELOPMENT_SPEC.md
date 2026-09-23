# DEVELOPMENT_SPEC.md - Especificação de Desenvolvimento

**Sistema de Gestão de Orçamentos para Consultoria de Cortinas**
**Status**: Pronto para Desenvolvimento - MVP
**Data**: 18/01/2025

---

## ÍNDICE
1. [Setup Inicial](#1-setup-inicial)
2. [Tarefas Fase 1 (MVP)](#2-tarefas-fase-1-mvp)
3. [Wireframes & Mockups](#3-wireframes--mockups)
4. [Exemplos de Código](#4-exemplos-de-código)
5. [Checklist de QA](#5-checklist-de-qa)

---

## 1. SETUP INICIAL

### 1.1 Escolhas Finais de Stack

**Frontend**: React 18 + Vite (recomendado para sua trilha de estudo)
**Backend**: NestJS + TypeScript
**Database**: PostgreSQL 15+ (local com Docker)
**ORM**: Prisma
**Styling**: Tailwind CSS + shadcn/ui
**Form Validation**: React Hook Form + Zod
**State Management**: React Context + useReducer
**HTTP Client**: Axios

### 1.2 Estrutura de Repositório

```
cortinando/
├── backend/                 # NestJS + Prisma
│   ├── src/
│   │   ├── auth/
│   │   ├── clientes/
│   │   ├── orçamentos/
│   │   ├── itens/
│   │   ├── custos/
│   │   ├── pdf/
│   │   ├── database/
│   │   └── main.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/                # React + Vite
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.js
│   └── .env.example
│
├── docker-compose.yml
├── .gitignore
├── README.md
└── PROJECT_SPEC.md
```

### 1.3 Instruções de Setup (Local)

```bash
# Clone / Crie estrutura
mkdir cortinando && cd cortinando
git init

# Backend setup
mkdir backend && cd backend
npm init -y
npm install @nestjs/common @nestjs/core @nestjs/config typescript
npm install -D ts-node @types/node
npm install @prisma/client prisma
npm install bcrypt @nestjs/jwt @nestjs/passport passport passport-jwt
npm install pdfkit
npm install class-validator class-transformer
cd ..

# Frontend setup
mkdir frontend && cd frontend
npm create vite@latest . -- --template react
npm install axios react-hook-form zod zustand
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install shadcn-ui
cd ..

# Docker Compose (na raiz)
# Ver exemplo abaixo
```

### 1.4 Docker Compose (local-dev)

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: cortinas_user
      POSTGRES_PASSWORD: cortinas_password
      POSTGRES_DB: cortinas_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cortinas_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: "postgresql://cortinas_user:cortinas_password@postgres:5432/cortinas_db"
      JWT_SECRET: "your-secret-key-change-in-production"
      NODE_ENV: development
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./backend:/app
    command: npm run start:dev

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: "http://localhost:3000"
    volumes:
      - ./frontend:/app
    command: npm run dev

volumes:
  postgres_data:
```

### 1.5 Variáveis de Ambiente

**backend/.env**
```env
DATABASE_URL="postgresql://cortinas_user:cortinas_password@localhost:5432/cortinas_db"
JWT_SECRET="chave-super-secreta-mudar-em-producao"
JWT_EXPIRATION="24h"
NODE_ENV="development"
PORT=3000
CORS_ORIGIN="http://localhost:5173"
```

**frontend/.env**
```env
VITE_API_URL=http://localhost:3000
```

---

## 2. TAREFAS FASE 1 (MVP)

### Sprint 1: Setup + Autenticação + Clientes (Semana 1-2)

#### Task 1.1: Setup NestJS + Prisma + PostgreSQL
**Objetivo**: Ambiente backend pronto com DB conectado

**Acceptance Criteria**:
- ✅ NestJS rodando em localhost:3000
- ✅ PostgreSQL conectado via Prisma
- ✅ Primeiro schema.prisma criado (Clientes)
- ✅ Migrations funcionando

**Steps**:
1. Criar projeto NestJS: `nest new backend`
2. Instalar Prisma: `npm install @prisma/client prisma`
3. Inicializar Prisma: `npx prisma init`
4. Configurar DATABASE_URL no .env
5. Criar schema.prisma com modelo Cliente (versionamento)
6. Rodar migration: `npx prisma migrate dev --name init`
7. Verificar: `npx prisma studio` (GUI do banco)

**Código Referência**:
```prisma
// prisma/schema.prisma (INICIAL)
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Cliente {
  id                String   @id @default(cuid())
  nome              String
  email             String   @unique
  telefone          String
  endereco          String
  cidade            String?
  estado            String?
  cep               String?
  anotacoes         String?
  statusCliente     String   @default("ativo") // "ativo", "inativo", "bloqueado"
  
  dataCreated       DateTime @default(now())
  dataUpdated       DateTime @updatedAt
  dataUltimoContato DateTime?
  
  // Relacionamentos
  orcamentos        Orcamento[]
  
  @@map("clientes")
}

model Orcamento {
  id                String   @id @default(cuid())
  numeroOrcamento   String   @unique
  cliente           Cliente  @relation(fields: [clienteId], references: [id], onDelete: Cascade)
  clienteId         String
  
  dataCriacao       DateTime @default(now())
  dataValidade      DateTime
  dataConfirmacao   DateTime?
  status            String   @default("rascunho") // "rascunho", "enviado", "confirmado", "cancelado", "expirado"
  
  subtotal          Float
  desconto          Float    @default(0)
  custosTotaisAdicionais Float @default(0)
  total             Float
  
  observacoes       String?
  dataUltimaAtualizacao DateTime @updatedAt
  
  // Relacionamentos
  itens             ItemOrcamento[]
  custosAdicionais  CustoAdicional[]
  
  @@map("orcamentos")
}

model ItemOrcamento {
  id                String   @id @default(cuid())
  orcamento         Orcamento @relation(fields: [orcamentoId], references: [id], onDelete: Cascade)
  orcamentoId       String
  
  sequencia         Int
  quantidadeCortinas Int @default(1)
  material          String
  
  altura            Float    // cm
  largura           Float    // cm
  profundidade      Float?   // cm
  
  tipoTrilho        String
  custoPorMetro     Float
  quantidadeMetros  Float
  
  custoBase         Float
  custoUnitario     Float
  custoTotal        Float
  
  observacoes       String?
  dataAdicao        DateTime @default(now())
  
  @@map("itens_orcamento")
}

model CustoAdicional {
  id                String   @id @default(cuid())
  orcamento         Orcamento @relation(fields: [orcamentoId], references: [id], onDelete: Cascade)
  orcamentoId       String
  
  tipoCustom        Boolean  @default(false)
  nomeCusto         String
  valor             Float
  percentual        Boolean  @default(false)
  
  observacoes       String?
  sequencia         Int
  
  @@map("custos_adicionais")
}
```

---

#### Task 1.2: Implementar Autenticação (JWT)
**Objetivo**: Sistema de login/logout com JWT

**Acceptance Criteria**:
- ✅ Endpoint POST /auth/login funciona
- ✅ JWT token retornado e armazenado no frontend
- ✅ Guard @UseGuards(JwtAuthGuard) protege rotas privadas
- ✅ Logout limpa token do frontend

**Steps**:
1. Criar módulo auth: `nest g module auth`
2. Instalar JWT: `npm install @nestjs/jwt @nestjs/passport passport passport-jwt`
3. Implementar JwtStrategy, JwtAuthGuard
4. Criar AuthService com login (bcrypt para senha)
5. Criar AuthController com POST /auth/login
6. Implementar no Frontend: Context + useAuth hook

**Código Referência - Backend**:
```typescript
// backend/src/auth/auth.service.ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async login(email: string, password: string) {
    // Para MVP: validar contra uma senha hardcoded ou BD
    // Em produção: buscar usuário do BD e comparar hash
    
    const ADMIN_EMAIL = 'admin@cortinas.com';
    const ADMIN_PASSWORD = 'senha123'; // HARDCODED PARA MVP
    
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const payload = { sub: email, email };
      return {
        access_token: this.jwtService.sign(payload),
        user: { email }
      };
    }
    throw new UnauthorizedException('Credenciais inválidas');
  }

  validateToken(token: string) {
    return this.jwtService.verify(token);
  }
}

// backend/src/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    return { userId: payload.sub, email: payload.email };
  }
}

// backend/src/auth/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

**Código Referência - Frontend**:
```typescript
// frontend/src/context/AuthContext.jsx
import React, { createContext, useReducer } from 'react';

export const AuthContext = createContext();

const initialState = {
  user: null,
  token: localStorage.getItem('token') || null,
  isAuthenticated: !!localStorage.getItem('token'),
};

function authReducer(state, action) {
  switch (action.type) {
    case 'LOGIN':
      localStorage.setItem('token', action.payload.token);
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
      };
    case 'LOGOUT':
      localStorage.removeItem('token');
      return {
        user: null,
        token: null,
        isAuthenticated: false,
      };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const login = (user, token) => {
    dispatch({ type: 'LOGIN', payload: { user, token } });
  };

  const logout = () => {
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// frontend/src/hooks/useAuth.js
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
```

---

#### Task 1.3: Implementar CRUD de Clientes (Backend)
**Objetivo**: Rotas de clientes no backend prontas

**Acceptance Criteria**:
- ✅ GET /clientes (listar com filtros)
- ✅ POST /clientes (criar)
- ✅ GET /clientes/:id (detalhe)
- ✅ PUT /clientes/:id (atualizar)
- ✅ PATCH /clientes/:id/inativar (soft delete)
- ✅ Todas as rotas protegidas com JwtAuthGuard

**Steps**:
1. Criar módulo clientes: `nest g resource clientes`
2. Implementar ClientesService (criar, buscar, atualizar)
3. Implementar ClientesController com todas as rotas
4. Adicionar validação com class-validator
5. Testar com Postman/Thunder Client

**Código Referência**:
```typescript
// backend/src/clientes/clientes.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateClienteDto, UpdateClienteDto } from './dto';

@Injectable()
export class ClientesService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateClienteDto) {
    return this.prisma.cliente.create({ data });
  }

  async findAll(skip = 0, take = 20, filters?: any) {
    const where = {};
    
    if (filters?.nome) {
      where.nome = { contains: filters.nome, mode: 'insensitive' };
    }
    if (filters?.email) {
      where.email = { contains: filters.email };
    }
    if (filters?.status) {
      where.statusCliente = filters.status;
    }

    return this.prisma.cliente.findMany({
      where,
      skip,
      take,
      orderBy: { dataCreated: 'desc' },
      include: {
        _count: { select: { orcamentos: true } }
      }
    });
  }

  async findById(id: string) {
    return this.prisma.cliente.findUnique({
      where: { id },
      include: { orcamentos: true }
    });
  }

  async update(id: string, data: UpdateClienteDto) {
    return this.prisma.cliente.update({
      where: { id },
      data: {
        ...data,
        dataUpdated: new Date()
      }
    });
  }

  async inativar(id: string) {
    return this.prisma.cliente.update({
      where: { id },
      data: { statusCliente: 'inativo' }
    });
  }

  async ativar(id: string) {
    return this.prisma.cliente.update({
      where: { id },
      data: { statusCliente: 'ativo' }
    });
  }
}

// backend/src/clientes/clientes.controller.ts
import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateClienteDto, UpdateClienteDto } from './dto';

@Controller('clientes')
@UseGuards(JwtAuthGuard)
export class ClientesController {
  constructor(private clientesService: ClientesService) {}

  @Post()
  create(@Body() dto: CreateClienteDto) {
    return this.clientesService.create(dto);
  }

  @Get()
  findAll(@Query('skip') skip = 0, @Query('take') take = 20, @Query() filters) {
    return this.clientesService.findAll(skip, take, filters);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.clientesService.findById(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClienteDto) {
    return this.clientesService.update(id, dto);
  }

  @Patch(':id/inativar')
  inativar(@Param('id') id: string) {
    return this.clientesService.inativar(id);
  }

  @Patch(':id/ativar')
  ativar(@Param('id') id: string) {
    return this.clientesService.ativar(id);
  }
}

// backend/src/clientes/dto/create-cliente.dto.ts
import { IsEmail, IsString, IsOptional } from 'class-validator';

export class CreateClienteDto {
  @IsString()
  nome: string;

  @IsEmail()
  email: string;

  @IsString()
  telefone: string;

  @IsString()
  endereco: string;

  @IsOptional()
  @IsString()
  cidade?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsString()
  cep?: string;

  @IsOptional()
  @IsString()
  anotacoes?: string;
}
```

---

#### Task 1.4: Implementar UI de Clientes (Frontend)
**Objetivo**: Páginas de listar, criar, editar clientes

**Acceptance Criteria**:
- ✅ Página de listagem de clientes com busca/filtros
- ✅ Modal/Página para criar cliente
- ✅ Modal/Página para editar cliente
- ✅ Botão de inativar/ativar
- ✅ Integração com API backend

**Steps**:
1. Criar páginas: ClientesPage.jsx, ClienteDetalhe.jsx
2. Criar componentes: ClienteForm.jsx, ClientesList.jsx
3. Criar serviço: clienteService.js (axios calls)
4. Implementar hooks de estado
5. Testar fluxo completo

**Código Referência**:
```typescript
// frontend/src/services/clienteService.js
import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const clienteService = {
  getAll: (skip = 0, take = 20, filters = {}) =>
    API.get('/clientes', { params: { skip, take, ...filters } }),
  
  getById: (id) => API.get(`/clientes/${id}`),
  
  create: (data) => API.post('/clientes', data),
  
  update: (id, data) => API.put(`/clientes/${id}`, data),
  
  inativar: (id) => API.patch(`/clientes/${id}/inativar`),
  
  ativar: (id) => API.patch(`/clientes/${id}/ativar`),
};

// frontend/src/pages/ClientesPage.jsx
import { useState, useEffect } from 'react';
import { clienteService } from '../services/clienteService';
import ClientesList from '../components/ClientesList';
import ClienteForm from '../components/ClienteForm';

export default function ClientesPage() {
  const [clientes, setClientes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadClientes();
  }, []);

  const loadClientes = async () => {
    setLoading(true);
    try {
      const { data } = await clienteService.getAll();
      setClientes(data);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCliente = async (novoCliente) => {
    try {
      await clienteService.create(novoCliente);
      setShowForm(false);
      loadClientes();
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Clientes</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          + Novo Cliente
        </button>
      </div>

      {showForm && (
        <ClienteForm
          onSave={handleCreateCliente}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <p>Carregando...</p>
      ) : (
        <ClientesList clientes={clientes} onRefresh={loadClientes} />
      )}
    </div>
  );
}
```

---

### Sprint 2: Orçamentos (Semana 3-4)

#### Task 2.1: Implementar CRUD de Orçamentos (Backend)
#### Task 2.2: Implementar UI de Orçamentos (Frontend)
#### Task 2.3: Implementar Itens e Custos Adicionais
#### Task 2.4: Testar fluxo completo

[Similar structure para orçamentos...]

---

### Sprint 3: PDF + Exportação (Semana 5-6)

#### Task 3.1: Gerar PDF para Cliente
#### Task 3.2: Gerar PDF de Produção
#### Task 3.3: Testar PDFs

[Similar structure para PDF...]

---

## 3. WIREFRAMES & MOCKUPS

### 3.1 Wireframe - Página de Clientes

```
┌─────────────────────────────────────────────────────┐
│  CLIENTES                          [+ Novo Cliente] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Buscar: [________________]  Status: [Todos v]     │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ Nome        │ Email           │ Tel     │ Ação│ │
│  ├───────────────────────────────────────────────┤ │
│  │ João Silva  │ joao@email.com  │ 11999 │ ✏️  ▼ │ │
│  │ Maria Santos│ maria@email.com │ 21888 │ ✏️  ▼ │ │
│  │ Pedro Costa │ pedro@email.com │ 31777 │ ✏️  ▼ │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  < Ant. | Página 1 de 5 | Próx >                   │
└─────────────────────────────────────────────────────┘
```

### 3.2 Wireframe - Criar Orçamento

```
┌─────────────────────────────────────────────────────┐
│  NOVO ORÇAMENTO                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Cliente: [Selecionar Cliente v]                    │
│                                                     │
│  Data de Validade: [15/03/2025] (padrão: +30 dias) │
│                                                     │
│  Observações: [___________________________]         │
│                                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │  ITENS (CORTINAS)                           │  │
│  │  [+ Adicionar Cortina]                      │  │
│  ├─────────────────────────────────────────────┤  │
│  │                                             │  │
│  │  Cortina 1: Material X | 100x150cm | R$500 │  │
│  │  [✏️  Editar] [❌ Remover]                   │  │
│  │                                             │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │  CUSTOS ADICIONAIS                          │  │
│  │  [+ Adicionar Custo]                        │  │
│  ├─────────────────────────────────────────────┤  │
│  │  Montagem: R$ 150                           │  │
│  │  [✏️  Editar] [❌ Remover]                   │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  RESUMO:                                           │
│  Subtotal: R$ 500                                  │
│  Custos Adicionais: R$ 150                        │
│  Desconto: R$ 0                                    │
│  ─────────────────                                 │
│  TOTAL: R$ 650                                     │
│                                                     │
│  [Gerar PDF] [Salvar Rascunho] [Cancelar]          │
└─────────────────────────────────────────────────────┘
```

### 3.3 Wireframe - Adicionar Cortina

```
┌─────────────────────────────────────┐
│  ADICIONAR CORTINA                  │
├─────────────────────────────────────┤
│                                     │
│  Quantidade: [1]                    │
│  Material: [_____________]          │
│  Altura (cm): [___]                 │
│  Largura (cm): [___]                │
│  Profundidade (cm): [___] (opt)     │
│  Tipo de Trilho: [_____________]    │
│  Custo por Metro: [R$ ____]         │
│  Quantidade de Metros: [___] (auto) │
│  Observações: [______________]      │
│                                     │
│  Custo Total: R$ 500 (calc)         │
│                                     │
│  [Adicionar] [Cancelar]             │
└─────────────────────────────────────┘
```

### 3.4 Estrutura de Navegação (Frontend)

```
Login (público)
├─ Email: ___________
├─ Senha: ___________
└─ [Entrar]

Dashboard (privado)
├─ /clientes
│  ├─ /clientes (lista)
│  └─ /clientes/:id (detalhe)
├─ /orcamentos
│  ├─ /orcamentos (lista)
│  ├─ /orcamentos/novo (criar)
│  └─ /orcamentos/:id (detalhe + editar)
└─ /perfil
   └─ /perfil (settings, logout)
```

---

## 4. EXEMPLOS DE CÓDIGO

### 4.1 Exemplo: Cálculo de Orçamento

```typescript
// backend/src/orcamentos/orcamentos.service.ts

interface CalculoOrcamento {
  subtotal: number;
  custosTotais: number;
  desconto: number;
  total: number;
}

calcularOrcamento(
  itens: ItemOrcamento[],
  custosAdicionais: CustoAdicional[],
  desconto: number = 0
): CalculoOrcamento {
  // Subtotal dos itens
  const subtotal = itens.reduce((sum, item) => {
    const quantidadeMetros = (item.altura * item.largura) / 10000; // conv cm² para m²
    const custoBase = quantidadeMetros * item.custoPorMetro;
    const custoItem = custoBase * item.quantidadeCortinas;
    return sum + custoItem;
  }, 0);

  // Custos adicionais
  let custosTotais = 0;
  custosAdicionais.forEach((custo) => {
    if (custo.percentual) {
      custosTotais += (subtotal * custo.valor) / 100;
    } else {
      custosTotais += custo.valor;
    }
  });

  // Total final
  const total = subtotal + custosTotais - desconto;

  return { subtotal, custosTotais, desconto, total };
}
```

### 4.2 Exemplo: Geração de PDF (Backend)

```typescript
// backend/src/pdf/pdf.service.ts
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

@Injectable()
export class PdfService {
  generateClientPdf(orcamento: Orcamento): Buffer {
    const doc = new PDFDocument();
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));

    // Header
    doc.fontSize(20).text('ORÇAMENTO', { align: 'center' });
    doc.fontSize(10).text('Consultoria de Cortinas Premium', { align: 'center' });
    doc.moveDown();

    // Info básica
    doc.fontSize(10);
    doc.text(`Número: ${orcamento.numeroOrcamento}`);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`);
    doc.text(`Válido até: ${new Date(orcamento.dataValidade).toLocaleDateString('pt-BR')}`);
    doc.moveDown();

    // Cliente
    doc.text(`Cliente: ${orcamento.cliente.nome}`);
    doc.text(`Email: ${orcamento.cliente.email}`);
    doc.text(`Telefone: ${orcamento.cliente.telefone}`);
    doc.moveDown();

    // Tabela de itens
    doc.fontSize(12).text('DETALHES:');
    doc.fontSize(10);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

    let y = doc.y + 5;
    doc.text('Material', 50, y);
    doc.text('Medidas', 200, y);
    doc.text('Custo', 400, y);
    y += 15;
    doc.moveTo(50, y).lineTo(550, y).stroke();

    orcamento.itens.forEach(item => {
      y += 15;
      doc.text(item.material, 50, y);
      doc.text(`${item.altura}x${item.largura}cm`, 200, y);
      doc.text(`R$ ${item.custoTotal.toFixed(2)}`, 400, y);
    });

    y += 20;
    doc.moveTo(50, y).lineTo(550, y).stroke();
    y += 10;

    // Total
    doc.fontSize(12).text(`TOTAL: R$ ${orcamento.total.toFixed(2)}`, 400, y);

    doc.end();

    return Buffer.concat(chunks);
  }

  generateProductionPdf(orcamento: Orcamento): Buffer {
    const doc = new PDFDocument();
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));

    // Header
    doc.fontSize(14).text('ORDEM DE PRODUÇÃO', { align: 'center' });
    doc.moveDown();

    doc.fontSize(10);
    doc.text(`Orçamento: ${orcamento.numeroOrcamento}`);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`);
    doc.moveDown();

    // Apenas dados essenciais
    doc.text('ITENS PARA PRODUÇÃO:');
    doc.moveDown();

    orcamento.itens.forEach((item, idx) => {
      doc.text(`${idx + 1}. ${item.material}`);
      doc.text(`   Cortinas: ${item.quantidadeCortinas}`);
      doc.text(`   Medidas: ${item.altura}cm H x ${item.largura}cm L`);
      if (item.profundidade) {
        doc.text(`   Profundidade: ${item.profundidade}cm`);
      }
      doc.text(`   Trilho: ${item.tipoTrilho}`);
      if (item.observacoes) {
        doc.text(`   Obs: ${item.observacoes}`);
      }
      doc.moveDown();
    });

    doc.end();

    return Buffer.concat(chunks);
  }
}

// backend/src/orcamentos/orcamentos.controller.ts
@Get(':id/pdf')
async getPdfCliente(@Param('id') id: string, @Res() res: Response) {
  const orcamento = await this.orcamentosService.findById(id);
  const pdfBuffer = this.pdfService.generateClientPdf(orcamento);
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="orcamento-${orcamento.numeroOrcamento}.pdf"`);
  res.send(pdfBuffer);
}

@Get(':id/pdf-producao')
async getPdfProducao(@Param('id') id: string, @Res() res: Response) {
  const orcamento = await this.orcamentosService.findById(id);
  const pdfBuffer = this.pdfService.generateProductionPdf(orcamento);
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="producao-${orcamento.numeroOrcamento}.pdf"`);
  res.send(pdfBuffer);
}
```

### 4.3 Exemplo: Hook de Orçamento (Frontend)

```typescript
// frontend/src/hooks/useOrcamento.js
import { useState, useCallback } from 'react';
import { orcamentoService } from '../services/orcamentoService';

export function useOrcamento(orcamentoId) {
  const [orcamento, setOrcamento] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadOrcamento = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await orcamentoService.getById(orcamentoId);
      setOrcamento(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [orcamentoId]);

  const addItem = useCallback(async (item) => {
    try {
      const { data } = await orcamentoService.addItem(orcamentoId, item);
      setOrcamento(data);
      return data;
    } catch (err) {
      setError(err.message);
    }
  }, [orcamentoId]);

  const updateItem = useCallback(async (itemId, updatedItem) => {
    try {
      const { data } = await orcamentoService.updateItem(orcamentoId, itemId, updatedItem);
      setOrcamento(data);
    } catch (err) {
      setError(err.message);
    }
  }, [orcamentoId]);

  const removeItem = useCallback(async (itemId) => {
    try {
      const { data } = await orcamentoService.removeItem(orcamentoId, itemId);
      setOrcamento(data);
    } catch (err) {
      setError(err.message);
    }
  }, [orcamentoId]);

  return {
    orcamento,
    loading,
    error,
    loadOrcamento,
    addItem,
    updateItem,
    removeItem,
  };
}
```

---

## 5. CHECKLIST DE QA

### 5.1 Teste Funcional - Fluxo Completo

**Scenario: Criar orçamento do zero até exportar PDF**

- [ ] Logar com credenciais corretas
- [ ] Criar novo cliente (validar campos obrigatórios)
- [ ] Criar novo orçamento para esse cliente
- [ ] Adicionar primeira cortina (validar cálculos)
- [ ] Adicionar segunda cortina (verificar sequência)
- [ ] Adicionar custo adicional (montagem, R$ 150)
- [ ] Verificar total calculado corretamente
- [ ] Gerar PDF para cliente (download deve funcionar)
- [ ] Verificar PDF contém dados do orçamento
- [ ] Marcar como confirmado
- [ ] Gerar PDF de produção (sem preços)
- [ ] Cancelar orçamento (status deve ser 'cancelado')

### 5.2 Teste de Validação

- [ ] Campo obrigatório vazio → erro clara
- [ ] Email inválido → erro
- [ ] Email duplicado → erro
- [ ] Número negativo em custo → validação
- [ ] Data inválida → validação
- [ ] Remover último item → confirmação

### 5.3 Teste de Responsividade

- [ ] Desktop (1920x1080): layout correto
- [ ] Tablet (768x1024): barra lateral colapsável
- [ ] Mobile (375x667): menu hamburger, botões acessíveis

### 5.4 Teste de Segurança

- [ ] JWT expirado → redireciona para login
- [ ] Tentar acessar /orcamentos sem token → 401
- [ ] Alterar token no localStorage → aplicação desconecta
- [ ] Preços não aparecem no PDF de produção

### 5.5 Teste de Performance

- [ ] Listar 100+ clientes → < 2s
- [ ] Gerar PDF → < 5s
- [ ] Buscar cliente → < 1s

---

## 6. DEFINIÇÃO DE PRONTO (DoD)

Uma tarefa está pronta para merge quando:

✅ Código testado (unitários passando)
✅ Sem console.error/warnings
✅ Código revisado (ou revisão pendente)
✅ Migrations rodadas (if DB changes)
✅ Documentação atualizada (comentários no código)
✅ Testado manualmente (frontend + backend)
✅ Commit message clara (ex: "feat: adicionar CRUD de clientes")
✅ Branch mergeada em `develop`

---

## 7. STACK RESUMO FINAL

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| **Frontend** | React + Vite | 18+ / 4.x |
| **Styling** | Tailwind CSS | 3.x |
| **Componentes** | shadcn/ui | Latest |
| **Forms** | React Hook Form | 7.x |
| **Validação** | Zod | 3.x |
| **HTTP Client** | Axios | 1.x |
| **State** | React Context | Built-in |
| **Backend** | NestJS | 10.x |
| **ORM** | Prisma | 5.x |
| **Database** | PostgreSQL | 15+ |
| **Auth** | JWT + Passport | Latest |
| **PDF** | PDFKit | 0.14+ |
| **Testing** | Jest / Vitest | Latest |
| **DevOps** | Docker | Latest |

---

## 8. PRÓXIMOS PASSOS

1. ✅ Validar spec com cliente final (empreendedor)
2. ⏭️ Iniciar Task 1.1 (Setup NestJS + Prisma)
3. ⏭️ Paralelizar Task 1.2 e 1.3
4. ⏭️ Ao terminar Sprint 1, começar Sprint 2

**Estimativa Total MVP**: 6-8 semanas (1.5-2 sprints de desenvolvimento)

---

**Versão**: 1.0
**Última Atualização**: 18/01/2025
**Próxima Review**: Após Sprint 1 (2 semanas)
