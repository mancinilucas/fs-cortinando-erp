# ARCHITECTURE.md - Padrões de Engenharia e Arquitetura

**Sistema de Gestão de Orçamentos para Consultoria de Cortinas**
**Padrão Arquitetural**: Domain-Driven Design (DDD)
**Rigor de Testes**: Alta (>80% coverage)
**Compliance**: LGPD + Segurança como prioridade no MVP
**Data**: 18/01/2025

---

## ÍNDICE
1. [Visão Geral Arquitetural](#1-visão-geral-arquitetural)
2. [Domain-Driven Design](#2-domain-driven-design)
3. [Padrões de Implementação](#3-padrões-de-implementação)
4. [Estratégia de Testes](#4-estratégia-de-testes)
5. [LGPD e Segurança](#5-lgpd-e-segurança)
6. [Convenções de Código](#6-convenções-de-código)
7. [Diagramas](#7-diagramas)
8. [Code Review Checklist](#8-code-review-checklist)

---

## 1. VISÃO GERAL ARQUITETURAL

### 1.1 Princípios Guia

A arquitetura segue **Domain-Driven Design** com foco em:

```
┌─────────────────────────────────────────────────────────┐
│                   BOUNDED CONTEXTS                      │
│  (Domínios independentes com responsabilidades claras)  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │  CONTEXT: Cliente Management                    │  │
│  │  - Aggregates: Cliente, Contato                 │  │
│  │  - Use Cases: Cadastrar, Inativar, Buscar       │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │  CONTEXT: Orçamento Management                  │  │
│  │  - Aggregates: Orçamento, ItemOrcamento         │  │
│  │  - Use Cases: Criar, Confirmar, Cancelar        │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │  CONTEXT: Produção Management                   │  │
│  │  - Aggregates: OrdemProducao                    │  │
│  │  - Use Cases: Exportar, Acompanhar              │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Pilares Arquiteturais

| Pilar | Descrição | Implementação |
|-------|-----------|----------------|
| **Domain Layer** | Lógica de negócio pura (sem frameworks) | Entities, Value Objects, Domain Services |
| **Application Layer** | Orquestração de casos de uso | Use Cases, Application Services, DTOs |
| **Infrastructure Layer** | Detalhes técnicos (BD, APIs, etc) | Repositories, Prisma, Email Service |
| **Presentation Layer** | Exposição via HTTP | Controllers, Error Handlers, Filters |
| **Shared Kernel** | Código reutilizável | Exceptions, Value Objects comuns, Guards |

---

## 2. DOMAIN-DRIVEN DESIGN

### 2.1 Bounded Contexts Identificados

#### **Context 1: Clientes (Cliente Management)**

**Responsabilidades**:
- Gerenciar dados de clientes
- Manter histórico de contatos
- Soft delete e inativação

**Agregado Principal: Cliente**
```
Cliente (Aggregate Root)
├── ClienteId (Value Object)
├── Nome (Value Object)
├── Email (Value Object - único)
├── Telefone (Value Object)
├── Endereço (Value Object)
├── Status (Value Object - enum)
├── Auditoria (Value Object)
└── Contatos[] (Entity dentro do agregado)
```

**Use Cases**:
- `CreateClienteUseCase`: Criar novo cliente
- `UpdateClienteUseCase`: Atualizar dados
- `FindClienteUseCase`: Buscar por ID
- `ListClientesUseCase`: Listar com filtros
- `DeactivateClienteUseCase`: Inativar cliente (soft delete)
- `ExportClienteDataUseCase`: Exportar dados (LGPD)

---

#### **Context 2: Orçamentos (Orçamento Management)**

**Responsabilidades**:
- Criar e gerenciar orçamentos
- Calcular valores com precisão
- Gerar representações (PDF, JSON)
- Validar mudanças de estado

**Agregado Principal: Orçamento**
```
Orçamento (Aggregate Root)
├── OrcamentoId (Value Object)
├── NumeroOrcamento (Value Object - único, auto-gerado)
├── ClienteId (Reference a outro agregado)
├── DataCriacao (Value Object)
├── DataValidade (Value Object)
├── Status (Value Object - enum)
├── Dinheiro (Value Object)
│   ├── Subtotal
│   ├── Desconto
│   ├── CustosTotais
│   └── Total
├── Itens[] (ItemOrcamento - Entity)
│   ├── ItemId
│   ├── Material (Value Object)
│   ├── Medidas (Value Object - altura x largura x prof)
│   ├── Trilho (Value Object)
│   └── Custo (Value Object)
├── CustosAdicionais[] (Entity)
│   ├── CustoId
│   ├── Tipo (Value Object - pré-definido ou custom)
│   ├── Valor (Value Object)
│   └── Percentual (Value Object)
├── Observações (Value Object)
└── Auditoria (Value Object)
```

**Value Objects Importantes**:
- `NumeroOrcamento`: Formato ORÇ-YYYY-XXX (imutável)
- `Medidas`: { altura, largura, profundidade } (imutável)
- `Dinheiro`: Valor em centavos (precision)
- `OrcamentoStatus`: enum ['rascunho', 'enviado', 'confirmado', 'cancelado', 'expirado']

**Use Cases**:
- `CreateOrcamentoUseCase`: Criar novo orçamento
- `AddItemOrcamentoUseCase`: Adicionar cortina
- `UpdateItemOrcamentoUseCase`: Editar cortina
- `RemoveItemOrcamentoUseCase`: Remover cortina
- `AddCustoAdicionalUseCase`: Adicionar custo extra
- `ConfirmOrcamentoUseCase`: Marcar como confirmado
- `CancelOrcamentoUseCase`: Cancelar
- `ExportOrcamentoPdfUseCase`: Gerar PDF para cliente
- `CalculateOrcamentoUseCase`: Recalcular totais (internal)

**Domain Events** (publicar quando algo importante acontece):
- `OrcamentoCriadoEvent`
- `OrcamentoConfirmadoEvent`
- `OrcamentoCanceladoEvent`
- `ItemAdicionadoEvent`

---

#### **Context 3: Produção (Produção Management)**

**Responsabilidades**:
- Exportar dados para produção (sem preços)
- Rastrear status de produção (future)
- Comunicar com equipe de produção

**Agregado Principal: OrdemProducao**
```
OrdemProducao (Aggregate Root)
├── OrdemId (Value Object)
├── OrcamentoId (Reference)
├── ItenProducao[] (Entity)
│   ├── Material
│   ├── Medidas
│   ├── Trilho
│   └── Quantidade
├── DataEntregaEsperada (Value Object)
├── Status (Value Object - enum)
└── Observacoes (Value Object)
```

**Use Cases**:
- `GenerateOrcamentoProducaoPdfUseCase`: Exportar PDF de produção
- `GenerateProducaoSummaryUseCase`: Resumo para costureiras
- `UpdateProducaoStatusUseCase`: Atualizar status (future)

---

### 2.2 Anti-Corruption Layer (ACL)

Padrão para comunicação entre bounded contexts:

```typescript
// src/shared/adapters/anticorruption-layer.ts

/**
 * Converte dados do contexto de Orçamento
 * para o formato esperado pelo contexto de Produção
 * Protege a integridade de cada domínio
 */
export class OrcamentoProducaoACL {
  static adaptarParaProducao(orcamento: Orcamento): OrdemProducaoDto {
    // Filtra apenas dados de produção
    // Nunca expõe preços
    // Mapeia estrutura de Orçamento para OrdemProducao
  }
}
```

---

## 3. PADRÕES DE IMPLEMENTAÇÃO

### 3.1 Estrutura de Pastas (DDD + NestJS)

```
backend/src/
│
├── modules/
│   │
│   ├── clientes/                          # BOUNDED CONTEXT: Cliente
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   └── cliente.entity.ts      # Entity: regras de negócio
│   │   │   ├── value-objects/
│   │   │   │   ├── cliente-id.vo.ts
│   │   │   │   ├── email.vo.ts            # Validação de email
│   │   │   │   └── telefone.vo.ts
│   │   │   ├── repositories/
│   │   │   │   └── cliente.repository.interface.ts  # Contrato
│   │   │   ├── services/
│   │   │   │   └── cliente-domain.service.ts  # Lógica de negócio
│   │   │   └── events/
│   │   │       └── cliente-criado.event.ts
│   │   │
│   │   ├── application/
│   │   │   ├── use-cases/
│   │   │   │   ├── create-cliente.use-case.ts
│   │   │   │   ├── update-cliente.use-case.ts
│   │   │   │   ├── list-clientes.use-case.ts
│   │   │   │   ├── deactivate-cliente.use-case.ts
│   │   │   │   └── export-cliente-data.use-case.ts  # LGPD
│   │   │   └── dtos/
│   │   │       ├── create-cliente.dto.ts
│   │   │       ├── update-cliente.dto.ts
│   │   │       └── cliente.dto.ts
│   │   │
│   │   ├── infrastructure/
│   │   │   ├── repositories/
│   │   │   │   └── prisma-cliente.repository.ts  # Implementação
│   │   │   └── mappers/
│   │   │       └── cliente.mapper.ts  # Domain ↔ Prisma
│   │   │
│   │   ├── presentation/
│   │   │   ├── controllers/
│   │   │   │   └── clientes.controller.ts
│   │   │   └── http-dtos/
│   │   │       └── create-cliente.http.dto.ts
│   │   │
│   │   └── clientes.module.ts              # Dependency Injection
│   │
│   ├── orcamentos/                         # BOUNDED CONTEXT: Orçamento
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── orcamento.entity.ts
│   │   │   │   ├── item-orcamento.entity.ts
│   │   │   │   └── custo-adicional.entity.ts
│   │   │   ├── value-objects/
│   │   │   │   ├── orcamento-id.vo.ts
│   │   │   │   ├── numero-orcamento.vo.ts
│   │   │   │   ├── medidas.vo.ts         # { altura, largura, prof }
│   │   │   │   ├── dinheiro.vo.ts        # Valor em centavos (precision)
│   │   │   │   └── orcamento-status.vo.ts
│   │   │   ├── repositories/
│   │   │   │   └── orcamento.repository.interface.ts
│   │   │   ├── services/
│   │   │   │   ├── orcamento-domain.service.ts
│   │   │   │   ├── orcamento-calculos.service.ts
│   │   │   │   └── orcamento-validator.service.ts
│   │   │   └── events/
│   │   │       ├── orcamento-criado.event.ts
│   │   │       ├── orcamento-confirmado.event.ts
│   │   │       └── orcamento-cancelado.event.ts
│   │   │
│   │   ├── application/
│   │   │   ├── use-cases/
│   │   │   │   ├── create-orcamento/
│   │   │   │   │   ├── create-orcamento.use-case.ts
│   │   │   │   │   └── create-orcamento.use-case.spec.ts
│   │   │   │   ├── add-item-orcamento/
│   │   │   │   ├── update-item-orcamento/
│   │   │   │   ├── confirm-orcamento/
│   │   │   │   ├── cancel-orcamento/
│   │   │   │   ├── export-orcamento-pdf/
│   │   │   │   ├── export-producao-pdf/
│   │   │   │   └── list-orcamentos/
│   │   │   └── dtos/
│   │   │       └── ...
│   │   │
│   │   ├── infrastructure/
│   │   │   ├── repositories/
│   │   │   │   └── prisma-orcamento.repository.ts
│   │   │   ├── mappers/
│   │   │   │   └── orcamento.mapper.ts
│   │   │   └── services/
│   │   │       └── pdf-generation.service.ts
│   │   │
│   │   ├── presentation/
│   │   │   ├── controllers/
│   │   │   │   └── orcamentos.controller.ts
│   │   │   └── http-dtos/
│   │   │       └── ...
│   │   │
│   │   └── orcamentos.module.ts
│   │
│   └── producao/                          # BOUNDED CONTEXT: Produção
│       ├── domain/
│       │   ├── entities/
│       │   │   └── ordem-producao.entity.ts
│       │   ├── value-objects/
│       │   │   └── ordem-producao-id.vo.ts
│       │   └── repositories/
│       │       └── ordem-producao.repository.interface.ts
│       │
│       ├── application/
│       │   └── use-cases/
│       │       ├── generate-producao-pdf.use-case.ts
│       │       └── generate-summary.use-case.ts
│       │
│       ├── infrastructure/
│       │   └── repositories/
│       │       └── prisma-ordem-producao.repository.ts
│       │
│       └── producao.module.ts
│
├── shared/                                 # SHARED KERNEL
│   ├── domain/
│   │   ├── base/
│   │   │   ├── entity.ts                  # Classe base para entities
│   │   │   ├── aggregate-root.ts         # Classe base para aggregates
│   │   │   ├── value-object.ts           # Classe base para VOs
│   │   │   └── domain-event.ts           # Event base class
│   │   └── value-objects/
│   │       ├── id.vo.ts                  # ID genérico
│   │       ├── email.vo.ts               # Email reutilizável
│   │       └── audit.vo.ts               # Auditoria
│   │
│   ├── application/
│   │   ├── handlers/
│   │   │   └── event-bus.service.ts
│   │   ├── exceptions/
│   │   │   ├── business.exception.ts
│   │   │   ├── validation.exception.ts
│   │   │   └── not-found.exception.ts
│   │   └── decorators/
│   │       └── use-case.decorator.ts
│   │
│   ├── infrastructure/
│   │   ├── database/
│   │   │   └── prisma.service.ts
│   │   ├── cache/
│   │   │   └── cache.service.ts          # future
│   │   └── email/
│   │       └── email.service.ts          # future
│   │
│   ├── presentation/
│   │   ├── filters/
│   │   │   ├── http-exception.filter.ts
│   │   │   └── business-exception.filter.ts
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts
│   │   │   ├── performance.interceptor.ts
│   │   │   └── request-audit.interceptor.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── rate-limit.guard.ts        # future
│   │   └── decorators/
│   │       ├── current-user.decorator.ts
│   │       └── public.decorator.ts
│   │
│   └── utils/
│       ├── validators/
│       │   ├── cpf.validator.ts          # Brazillian validators
│       │   ├── email.validator.ts
│       │   └── phone.validator.ts
│       └── formatters/
│           ├── money.formatter.ts
│           └── date.formatter.ts
│
├── config/
│   ├── environment.ts
│   ├── database.config.ts
│   └── jwt.config.ts
│
└── main.ts
```

### 3.2 Base Classes para DDD

```typescript
// src/shared/domain/base/entity.ts
import { randomUUID } from 'crypto';

/**
 * Entity: Tem identidade única
 * Pode ser modificada mas é rastreada pela ID
 */
export abstract class Entity<Props> {
  protected readonly _id: string;
  protected props: Props;
  protected createdAt: Date;
  protected updatedAt: Date;

  constructor(props: Props, id?: string) {
    this.props = props;
    this._id = id || randomUUID();
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  get id(): string {
    return this._id;
  }

  equals(other: Entity<Props>): boolean {
    return this._id === other._id;
  }

  touch(): void {
    this.updatedAt = new Date();
  }
}

// src/shared/domain/base/aggregate-root.ts
import { Entity } from './entity';
import { DomainEvent } from './domain-event';

/**
 * Aggregate Root: Entity que é raiz de um agregado
 * Responsável por guardar eventos de domínio
 */
export abstract class AggregateRoot<Props> extends Entity<Props> {
  private _domainEvents: DomainEvent[] = [];

  get domainEvents(): DomainEvent[] {
    return this._domainEvents;
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  clearDomainEvents(): void {
    this._domainEvents = [];
  }
}

// src/shared/domain/base/value-object.ts
/**
 * Value Object: Imutável, identificado pelo seus valores
 * Sem identidade única (dois VOs com mesmos valores são iguais)
 */
export abstract class ValueObject<Props> {
  protected props: Props;

  constructor(props: Props) {
    // Deep freeze para garantir imutabilidade
    this.props = Object.freeze(props);
  }

  equals(other: ValueObject<Props>): boolean {
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }

  getProps(): Props {
    return this.props;
  }
}

// src/shared/domain/base/domain-event.ts
export abstract class DomainEvent {
  public readonly occurredAt: Date;
  public readonly aggregateId: string;

  constructor(aggregateId: string) {
    this.aggregateId = aggregateId;
    this.occurredAt = new Date();
  }

  abstract getEventType(): string;
}
```

### 3.3 Exemplo Prático: Cliente Entity + Value Objects

```typescript
// src/modules/clientes/domain/value-objects/email.vo.ts
import { ValueObject } from '@shared/domain/base/value-object';

export class Email extends ValueObject<{ value: string }> {
  private constructor(email: string) {
    // Validação no constructor
    if (!Email.isValid(email)) {
      throw new Error('Email inválido');
    }
    super({ value: email.toLowerCase() });
  }

  static create(email: string): Email {
    return new Email(email);
  }

  static isValid(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  get value(): string {
    return this.props.value;
  }
}

// src/modules/clientes/domain/value-objects/telefone.vo.ts
import { ValueObject } from '@shared/domain/base/value-object';

export class Telefone extends ValueObject<{ value: string }> {
  private constructor(telefone: string) {
    if (!Telefone.isValid(telefone)) {
      throw new Error('Telefone inválido');
    }
    // Remove formatação, armazena apenas números
    const apenasNumeros = telefone.replace(/\D/g, '');
    super({ value: apenasNumeros });
  }

  static create(telefone: string): Telefone {
    return new Telefone(telefone);
  }

  static isValid(telefone: string): boolean {
    const apenasNumeros = telefone.replace(/\D/g, '');
    return apenasNumeros.length >= 10 && apenasNumeros.length <= 11;
  }

  get value(): string {
    return this.props.value;
  }

  getFormatted(): string {
    // (11) 99999-9999
    if (this.props.value.length === 11) {
      return `(${this.props.value.slice(0, 2)}) ${this.props.value.slice(2, 7)}-${this.props.value.slice(7)}`;
    }
    return `(${this.props.value.slice(0, 2)}) ${this.props.value.slice(2, 6)}-${this.props.value.slice(6)}`;
  }
}

// src/modules/clientes/domain/entities/cliente.entity.ts
import { AggregateRoot } from '@shared/domain/base/aggregate-root';
import { Email } from '../value-objects/email.vo';
import { Telefone } from '../value-objects/telefone.vo';
import { ClienteCriadoEvent } from '../events/cliente-criado.event';

interface ClienteProps {
  nome: string;
  email: Email;
  telefone: Telefone;
  endereco: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  anotacoes?: string;
  statusCliente: 'ativo' | 'inativo' | 'bloqueado';
  dataUltimoContato?: Date;
}

export class Cliente extends AggregateRoot<ClienteProps> {
  private constructor(props: ClienteProps, id?: string) {
    super(props, id);
  }

  static create(props: Omit<ClienteProps, 'statusCliente'>): Cliente {
    const cliente = new Cliente(
      {
        ...props,
        statusCliente: 'ativo',
      }
    );

    // Publicar evento de domínio
    cliente.addDomainEvent(
      new ClienteCriadoEvent(cliente.id, props.nome, props.email.value)
    );

    return cliente;
  }

  static with(props: ClienteProps, id: string): Cliente {
    return new Cliente(props, id);
  }

  // Getters
  get nome(): string {
    return this.props.nome;
  }

  get email(): Email {
    return this.props.email;
  }

  get telefone(): Telefone {
    return this.props.telefone;
  }

  get endereco(): string {
    return this.props.endereco;
  }

  get statusCliente(): string {
    return this.props.statusCliente;
  }

  // Métodos de negócio
  inativar(): void {
    if (this.props.statusCliente === 'inativo') {
      throw new Error('Cliente já está inativo');
    }
    this.props.statusCliente = 'inativo';
    this.touch();
  }

  ativar(): void {
    if (this.props.statusCliente === 'ativo') {
      throw new Error('Cliente já está ativo');
    }
    this.props.statusCliente = 'ativo';
    this.touch();
  }

  atualizarAnotacoes(novasAnotacoes: string): void {
    this.props.anotacoes = novasAnotacoes;
    this.props.dataUltimoContato = new Date();
    this.touch();
  }

  isAtivo(): boolean {
    return this.props.statusCliente === 'ativo';
  }
}
```

### 3.4 Use Case Pattern

```typescript
// src/shared/application/use-case.decorator.ts
export interface UseCase<Request, Response> {
  execute(request: Request): Promise<Response>;
}

// src/modules/clientes/application/use-cases/create-cliente.use-case.ts
import { Injectable } from '@nestjs/common';
import { UseCase } from '@shared/application/use-case.decorator';
import { ClienteRepository } from '@modules/clientes/domain/repositories/cliente.repository.interface';
import { Cliente } from '@modules/clientes/domain/entities/cliente.entity';
import { Email } from '@modules/clientes/domain/value-objects/email.vo';
import { Telefone } from '@modules/clientes/domain/value-objects/telefone.vo';
import { CreateClienteDto } from '../dtos/create-cliente.dto';
import { ClienteDto } from '../dtos/cliente.dto';

@Injectable()
export class CreateClienteUseCase implements UseCase<CreateClienteDto, ClienteDto> {
  constructor(
    private clienteRepository: ClienteRepository,
    private eventBus: EventBusService,
  ) {}

  async execute(request: CreateClienteDto): Promise<ClienteDto> {
    // 1. Validar se email já existe (LGPD: não reutilizar emails)
    const clienteExistente = await this.clienteRepository.findByEmail(request.email);
    if (clienteExistente) {
      throw new BusinessException('Email já cadastrado');
    }

    // 2. Criar agregado com Value Objects (validações acontecem aqui)
    const cliente = Cliente.create({
      nome: request.nome.trim(),
      email: Email.create(request.email),
      telefone: Telefone.create(request.telefone),
      endereco: request.endereco,
      cidade: request.cidade,
      estado: request.estado,
      cep: request.cep,
      anotacoes: request.anotacoes,
    });

    // 3. Persistir no repositório
    const clienteSalvo = await this.clienteRepository.save(cliente);

    // 4. Publicar eventos de domínio (triggers para outras ações)
    // Ex: enviar email de boas-vindas
    for (const event of clienteSalvo.domainEvents) {
      await this.eventBus.publish(event);
    }
    clienteSalvo.clearDomainEvents();

    // 5. Retornar DTO (nunca expor entidade diretamente)
    return ClienteMapper.toPersistence(clienteSalvo);
  }
}
```

### 3.5 Repository Pattern

```typescript
// src/modules/clientes/domain/repositories/cliente.repository.interface.ts
import { Cliente } from '../entities/cliente.entity';

/**
 * Interface de repositório - define contrato
 * Implementação fica em infrastructure layer
 */
export interface IClienteRepository {
  save(cliente: Cliente): Promise<Cliente>;
  findById(id: string): Promise<Cliente | null>;
  findByEmail(email: string): Promise<Cliente | null>;
  findAll(filters?: ClienteFilters): Promise<Cliente[]>;
  delete(id: string): Promise<void>;
  update(cliente: Cliente): Promise<Cliente>;
}

// src/modules/clientes/infrastructure/repositories/prisma-cliente.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/prisma.service';
import { IClienteRepository } from '@modules/clientes/domain/repositories/cliente.repository.interface';
import { Cliente } from '@modules/clientes/domain/entities/cliente.entity';
import { ClienteMapper } from '../mappers/cliente.mapper';

@Injectable()
export class PrismaClienteRepository implements IClienteRepository {
  constructor(private prisma: PrismaService) {}

  async save(cliente: Cliente): Promise<Cliente> {
    const clienteData = ClienteMapper.toPersistence(cliente);
    const clienteSalvo = await this.prisma.cliente.create({
      data: clienteData,
    });
    return ClienteMapper.toDomain(clienteSalvo);
  }

  async findById(id: string): Promise<Cliente | null> {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
    });
    return cliente ? ClienteMapper.toDomain(cliente) : null;
  }

  // ... outros métodos
}

// src/modules/clientes/infrastructure/mappers/cliente.mapper.ts
/**
 * Mapper: Converte entre diferentes representações
 * Domain ↔ Persistence ↔ HTTP
 */
export class ClienteMapper {
  // Domain Entity → Prisma Persistence
  static toPersistence(cliente: Cliente) {
    return {
      id: cliente.id,
      nome: cliente.nome,
      email: cliente.email.value,
      telefone: cliente.telefone.value,
      endereco: cliente.endereco,
      statusCliente: cliente.statusCliente,
      // ... outros campos
    };
  }

  // Prisma → Domain Entity
  static toDomain(raw: any): Cliente {
    return Cliente.with(
      {
        nome: raw.nome,
        email: Email.create(raw.email),
        telefone: Telefone.create(raw.telefone),
        endereco: raw.endereco,
        statusCliente: raw.statusCliente,
        // ... outros
      },
      raw.id
    );
  }

  // Domain Entity → HTTP Response DTO
  static toDto(cliente: Cliente): ClienteDto {
    return {
      id: cliente.id,
      nome: cliente.nome,
      email: cliente.email.value,
      telefone: cliente.telefone.getFormatted(),
      endereco: cliente.endereco,
      status: cliente.statusCliente,
    };
  }
}
```

---

## 4. ESTRATÉGIA DE TESTES

### 4.1 Pirâmide de Testes (Objetivo: >80% coverage)

```
        ╱╲
       ╱  ╲        E2E Tests (10%)
      ╱    ╲       - Fluxo completo (API + Frontend)
     ╱──────╲      - 2-3 cenários críticos
    ╱        ╲
   ╱          ╲     Integration Tests (30%)
  ╱            ╲    - Service + Repository
 ╱──────────────╲   - Banco de dados
╱                ╲  
─────────────────   Unit Tests (60%)
                    - Entities
                    - Value Objects
                    - Services
                    - Use Cases
```

### 4.2 Unit Tests: Entities e Value Objects

```typescript
// src/modules/clientes/domain/entities/cliente.entity.spec.ts
import { describe, it, expect } from '@jest/globals';
import { Cliente } from './cliente.entity';
import { Email } from '../value-objects/email.vo';
import { Telefone } from '../value-objects/telefone.vo';

describe('Cliente Entity', () => {
  describe('create', () => {
    it('should create a valid cliente', () => {
      const props = {
        nome: 'João Silva',
        email: Email.create('joao@example.com'),
        telefone: Telefone.create('11999999999'),
        endereco: 'Rua A, 123',
      };

      const cliente = Cliente.create(props);

      expect(cliente.id).toBeDefined();
      expect(cliente.nome).toBe('João Silva');
      expect(cliente.statusCliente).toBe('ativo');
    });

    it('should publish ClienteCriadoEvent on creation', () => {
      const cliente = Cliente.create({
        nome: 'Maria',
        email: Email.create('maria@example.com'),
        telefone: Telefone.create('11998888888'),
        endereco: 'Rua B, 456',
      });

      expect(cliente.domainEvents).toHaveLength(1);
      expect(cliente.domainEvents[0].getEventType()).toBe('ClienteCriadoEvent');
    });
  });

  describe('inativar', () => {
    it('should deactivate an active cliente', () => {
      const cliente = Cliente.create({
        nome: 'Pedro',
        email: Email.create('pedro@example.com'),
        telefone: Telefone.create('11997777777'),
        endereco: 'Rua C, 789',
      });

      cliente.inativar();

      expect(cliente.statusCliente).toBe('inativo');
    });

    it('should throw error when inativating already inactive cliente', () => {
      const cliente = Cliente.create({
        nome: 'Ana',
        email: Email.create('ana@example.com'),
        telefone: Telefone.create('11996666666'),
        endereco: 'Rua D, 101',
      });

      cliente.inativar();

      expect(() => cliente.inativar()).toThrow('Cliente já está inativo');
    });
  });

  describe('atualizarAnotacoes', () => {
    it('should update anotacoes and dataUltimoContato', () => {
      const cliente = Cliente.create({
        nome: 'Carlos',
        email: Email.create('carlos@example.com'),
        telefone: Telefone.create('11995555555'),
        endereco: 'Rua E, 202',
      });

      const novasAnotacoes = 'Cliente muito exigente com cores';
      cliente.atualizarAnotacoes(novasAnotacoes);

      expect(cliente['props'].anotacoes).toBe(novasAnotacoes);
      expect(cliente['props'].dataUltimoContato).toBeDefined();
    });
  });
});

// src/modules/clientes/domain/value-objects/email.vo.spec.ts
describe('Email Value Object', () => {
  describe('create', () => {
    it('should create a valid email', () => {
      const email = Email.create('user@example.com');
      expect(email.value).toBe('user@example.com');
    });

    it('should throw when email is invalid', () => {
      expect(() => Email.create('invalid-email')).toThrow('Email inválido');
      expect(() => Email.create('test@')).toThrow('Email inválido');
    });

    it('should normalize email to lowercase', () => {
      const email = Email.create('User@EXAMPLE.COM');
      expect(email.value).toBe('user@example.com');
    });
  });

  describe('equals', () => {
    it('should consider two emails with same value as equal', () => {
      const email1 = Email.create('test@example.com');
      const email2 = Email.create('test@example.com');
      expect(email1.equals(email2)).toBe(true);
    });

    it('should consider two emails with different values as not equal', () => {
      const email1 = Email.create('test1@example.com');
      const email2 = Email.create('test2@example.com');
      expect(email1.equals(email2)).toBe(false);
    });
  });
});
```

### 4.3 Integration Tests: Use Cases + Repository

```typescript
// src/modules/clientes/application/use-cases/create-cliente.use-case.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CreateClienteUseCase } from './create-cliente.use-case';
import { ClienteRepository } from '@modules/clientes/domain/repositories/cliente.repository.interface';
import { PrismaClienteRepository } from '@modules/clientes/infrastructure/repositories/prisma-cliente.repository';
import { PrismaService } from '@shared/infrastructure/database/prisma.service';
import { EventBusService } from '@shared/application/handlers/event-bus.service';

describe('CreateClienteUseCase (Integration)', () => {
  let useCase: CreateClienteUseCase;
  let repository: ClienteRepository;
  let prismaService: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateClienteUseCase,
        {
          provide: ClienteRepository,
          useClass: PrismaClienteRepository,
        },
        {
          provide: PrismaService,
          useValue: {
            cliente: {
              create: jest.fn(),
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: EventBusService,
          useValue: {
            publish: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<CreateClienteUseCase>(CreateClienteUseCase);
    repository = module.get<ClienteRepository>(ClienteRepository);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should create cliente with valid data', async () => {
    const dto = {
      nome: 'João Silva',
      email: 'joao@example.com',
      telefone: '11999999999',
      endereco: 'Rua A, 123',
    };

    jest.spyOn(repository, 'findByEmail').mockResolvedValue(null);
    jest.spyOn(repository, 'save').mockResolvedValue({
      id: '123',
      ...dto,
      statusCliente: 'ativo',
    } as any);

    const result = await useCase.execute(dto);

    expect(result).toBeDefined();
    expect(result.nome).toBe('João Silva');
    expect(repository.save).toHaveBeenCalled();
  });

  it('should throw when email already exists (LGPD)', async () => {
    const dto = {
      nome: 'Maria',
      email: 'existing@example.com',
      telefone: '11988888888',
      endereco: 'Rua B, 456',
    };

    jest.spyOn(repository, 'findByEmail').mockResolvedValue({
      id: 'existing-id',
    } as any);

    await expect(useCase.execute(dto)).rejects.toThrow('Email já cadastrado');
  });
});
```

### 4.4 E2E Tests: Fluxo Completo

```typescript
// test/e2e/cliente.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@src/app.module';
import { PrismaService } from '@src/shared/infrastructure/database/prisma.service';

describe('Cliente E2E', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);

    // Login e obter token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@cortinas.com',
        password: 'senha123',
      });

    token = loginResponse.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /clientes', () => {
    it('should create a cliente with valid data', async () => {
      const response = await request(app.getHttpServer())
        .post('/clientes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nome: 'João da Silva',
          email: 'joao@example.com',
          telefone: '11999999999',
          endereco: 'Rua A, 123',
          cidade: 'São Paulo',
          estado: 'SP',
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.nome).toBe('João da Silva');
    });

    it('should return 400 when email is invalid', async () => {
      await request(app.getHttpServer())
        .post('/clientes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nome: 'Maria',
          email: 'invalid-email',
          telefone: '11988888888',
          endereco: 'Rua B, 456',
        })
        .expect(400);
    });

    it('should return 409 when email already exists', async () => {
      // Criar primeiro cliente
      await request(app.getHttpServer())
        .post('/clientes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nome: 'Pedro',
          email: 'duplicate@example.com',
          telefone: '11977777777',
          endereco: 'Rua C, 789',
        })
        .expect(201);

      // Tentar criar com mesmo email
      await request(app.getHttpServer())
        .post('/clientes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nome: 'Ana',
          email: 'duplicate@example.com',
          telefone: '11966666666',
          endereco: 'Rua D, 101',
        })
        .expect(409);
    });
  });

  describe('GET /clientes/:id', () => {
    it('should retrieve a cliente by id', async () => {
      // Criar cliente
      const createResponse = await request(app.getHttpServer())
        .post('/clientes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nome: 'Carlos',
          email: 'carlos@example.com',
          telefone: '11955555555',
          endereco: 'Rua E, 202',
        });

      const clienteId = createResponse.body.id;

      // Buscar
      const getResponse = await request(app.getHttpServer())
        .get(`/clientes/${clienteId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(getResponse.body.id).toBe(clienteId);
      expect(getResponse.body.nome).toBe('Carlos');
    });

    it('should return 404 when cliente not found', async () => {
      await request(app.getHttpServer())
        .get('/clientes/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('Complete Flow', () => {
    it('should: create → retrieve → update → deactivate cliente', async () => {
      // 1. Create
      const createResp = await request(app.getHttpServer())
        .post('/clientes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nome: 'Complete Flow Test',
          email: 'flow@example.com',
          telefone: '11944444444',
          endereco: 'Rua F, 303',
        })
        .expect(201);

      const clienteId = createResp.body.id;

      // 2. Retrieve
      await request(app.getHttpServer())
        .get(`/clientes/${clienteId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // 3. Update
      await request(app.getHttpServer())
        .put(`/clientes/${clienteId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          anotacoes: 'Cliente atualizado via E2E test',
        })
        .expect(200);

      // 4. Deactivate
      await request(app.getHttpServer())
        .patch(`/clientes/${clienteId}/inativar`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Verify deactivation
      const finalResp = await request(app.getHttpServer())
        .get(`/clientes/${clienteId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(finalResp.body.status).toBe('inativo');
    });
  });
});
```

### 4.5 Configuração de Testes

```json
// jest.config.js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.interface.ts',
    '!**/*.module.ts',
    '!**/main.ts',
    '!**/index.ts',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@modules/(.*)$': '<rootDir>/modules/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.module.ts',
    '!src/main.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

---

## 5. LGPD E SEGURANÇA

### 5.1 Princípios LGPD Implementados

| Princípio | Implementação |
|-----------|---------------|
| **Consentimento** | Explícito ao criar cliente (terms accepted) |
| **Coleta Mínima** | Apenas dados necessários (nome, email, phone, address) |
| **Direito ao Esquecimento** | Soft delete, dados não são realmente apagados |
| **Portabilidade** | `ExportClienteDataUseCase` → JSON/CSV |
| **Transparência** | Histórico de alterações (quem, quando, o quê) |
| **Segurança de Dados** | Encriptação de dados sensíveis (future) |

### 5.2 Use Case: Exportar Dados (LGPD)

```typescript
// src/modules/clientes/application/use-cases/export-cliente-data.use-case.ts
import { Injectable } from '@nestjs/common';
import { UseCase } from '@shared/application/use-case.decorator';

/**
 * Implementa direito de portabilidade da LGPD
 * Cliente pode solicitar seus dados em formato portável (JSON/CSV)
 */
@Injectable()
export class ExportClienteDataUseCase implements UseCase<string, any> {
  constructor(
    private clienteRepository: ClienteRepository,
  ) {}

  async execute(clienteId: string): Promise<any> {
    // 1. Buscar cliente
    const cliente = await this.clienteRepository.findById(clienteId);
    if (!cliente) {
      throw new NotFoundException('Cliente não encontrado');
    }

    // 2. Compilar todos os dados do cliente
    const dados = {
      cliente: {
        id: cliente.id,
        nome: cliente.nome,
        email: cliente.email.value,
        telefone: cliente.telefone.value,
        endereco: cliente.endereco,
        dataCadastro: cliente['createdAt'],
      },
      orcamentos: [], // Buscar todos os orçamentos
      servicos: [],   // Buscar todos os serviços
    };

    // 3. Retornar em formato exportável (JSON)
    // Frontend converte para CSV se necessário
    return dados;
  }
}
```

### 5.3 Auditoria e Logging

```typescript
// src/shared/domain/value-objects/audit.vo.ts
import { ValueObject } from './value-object';

interface AuditProps {
  criadoPor: string;
  criadoEm: Date;
  modificadoPor?: string;
  modificadoEm?: Date;
}

export class Audit extends ValueObject<AuditProps> {
  private constructor(props: AuditProps) {
    super(props);
  }

  static create(criadoPor: string): Audit {
    return new Audit({
      criadoPor,
      criadoEm: new Date(),
    });
  }

  updateModification(modificadoPor: string): Audit {
    return new Audit({
      ...this.props,
      modificadoPor,
      modificadoEm: new Date(),
    });
  }

  get criadoPor(): string {
    return this.props.criadoPor;
  }

  get modificadoPor(): string | undefined {
    return this.props.modificadoPor;
  }
}

// src/shared/presentation/interceptors/request-audit.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Logger } from '@nestjs/common';

/**
 * Loga todas as requisições (quem, quando, o quê)
 * Importante para LGPD e auditoria de segurança
 */
@Injectable()
export class RequestAuditInterceptor implements NestInterceptor {
  private logger = new Logger('AuditLog');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, body } = request;
    const timestamp = new Date().toISOString();

    this.logger.log(
      `[${timestamp}] ${method} ${url} | User: ${user?.email || 'anonymous'} | Body: ${JSON.stringify(body)}`
    );

    return next.handle().pipe(
      tap(() => {
        this.logger.log(`[${timestamp}] Response: OK`);
      }),
    );
  }
}
```

### 5.4 Validação e Sanitização

```typescript
// src/shared/presentation/filters/business-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { BusinessException } from '@shared/application/exceptions/business.exception';

/**
 * Captura exceções de negócio e retorna erro apropriado
 * Nunca expõe stack trace ou detalhes técnicos
 */
@Catch(BusinessException)
export class BusinessExceptionFilter implements ExceptionFilter {
  catch(exception: BusinessException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message: exception.message,
      // Nunca expor: stack, detalhes técnicos, dados sensíveis
    });
  }
}

// src/shared/application/exceptions/business.exception.ts
export class BusinessException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessException';
    // Remove stack trace para não expor detalhes técnicos
    Error.captureStackTrace(this, this.constructor);
  }
}
```

### 5.5 Criptografia (future, mas estrutura já)

```typescript
// src/shared/infrastructure/encryption/encryption.service.ts
import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Estrutura para criptografia de dados sensíveis (future)
 * Usar para CPF, dados de pagamento, etc
 */
@Injectable()
export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decrypt(encrypted: string): string {
    const [iv, authTag, encryptedText] = encrypted.split(':');
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
```

---

## 6. CONVENÇÕES DE CÓDIGO

### 6.1 Naming Conventions

```typescript
// Entities e Aggregates: Singular, PascalCase
class Cliente { }
class Orcamento { }

// Value Objects: Sufixo "VO" ou descritor, PascalCase
class Email { }
class ClienteId { }
class OrcamentoStatus { }

// Repositories: Interface com "I" prefix, implementação com nome da DB
interface IClienteRepository { }
class PrismaClienteRepository { }

// Use Cases: Nome + "UseCase"
class CreateClienteUseCase { }
class ConfirmOrcamentoUseCase { }

// Services: Nome + "Service"
class ClienteDomainService { }
class OrcamentoCalculosService { }

// Controllers: Sufixo "Controller"
class ClientesController { }
class OrcamentosController { }

// DTOs: Nome + "Dto" ou "HttpDto"
class CreateClienteDto { }
class ClienteResponseDto { }

// Events: Nome + "Event"
class ClienteCriadoEvent { }
class OrcamentoConfirmadoEvent { }

// Variáveis e métodos: camelCase
let clienteId: string;
function calcularTotal(): number { }

// Constantes: UPPER_SNAKE_CASE
const MAX_CLIENTES_PER_PAGE = 20;
const STATUS_ATIVO = 'ativo';

// Private fields: prefixo underscore
private _domainEvents: DomainEvent[] = [];
```

### 6.2 Imports: Absolute Imports

```typescript
// ❌ Evitar: Relative imports
import { Cliente } from '../../../domain/entities/cliente.entity';

// ✅ Usar: Absolute imports via tsconfig alias
import { Cliente } from '@modules/clientes/domain/entities/cliente.entity';
import { EventBusService } from '@shared/application/handlers/event-bus.service';
import { PrismaService } from '@shared/infrastructure/database/prisma.service';
```

**tsconfig.json**:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@src/*": ["src/*"],
      "@shared/*": ["src/shared/*"],
      "@modules/*": ["src/modules/*"]
    }
  }
}
```

### 6.3 Comentários

```typescript
// ✅ Bom: Comentários explicam POR QUÊ, não O QUÊ
class Cliente {
  // LGPD: Email único para evitar duplicação de dados pessoais
  async findByEmail(email: string): Promise<Cliente | null> {
    // ...
  }
}

// ❌ Ruim: Comentário óbvio
class Cliente {
  // Encontra cliente por email
  async findByEmail(email: string): Promise<Cliente | null> {
    // ...
  }
}

// ✅ Use JSDoc para métodos públicos
/**
 * Inativa um cliente e marca como não mais contato
 * @param clienteId - ID do cliente a inativar
 * @throws BusinessException se cliente já está inativo
 */
async deactivateCliente(clienteId: string): Promise<void> {
  // ...
}
```

### 6.4 Logging

```typescript
// src/shared/infrastructure/logger/logger.service.ts
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LoggerService extends Logger {
  log(message: string, context?: string) {
    super.log(`[${context}] ${message}`);
  }

  error(message: string, error: Error, context?: string) {
    super.error(`[${context}] ${message} - ${error.message}`);
  }

  warn(message: string, context?: string) {
    super.warn(`[${context}] ${message}`);
  }

  debug(message: string, context?: string) {
    super.debug(`[${context}] ${message}`);
  }
}

// Uso em services
@Injectable()
export class CreateClienteUseCase {
  constructor(
    private logger: LoggerService,
    private repository: ClienteRepository,
  ) {}

  async execute(request: CreateClienteDto): Promise<ClienteDto> {
    this.logger.log('Iniciando criação de cliente', 'CreateClienteUseCase');

    try {
      const cliente = Cliente.create({ /* ... */ });
      const saved = await this.repository.save(cliente);
      this.logger.log(`Cliente criado: ${saved.id}`, 'CreateClienteUseCase');
      return saved;
    } catch (error) {
      this.logger.error('Erro ao criar cliente', error, 'CreateClienteUseCase');
      throw error;
    }
  }
}
```

---

## 7. DIAGRAMAS

### 7.1 Arquitetura em Camadas

```
┌──────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                         │
│  Controllers | HTTP DTOs | Filters | Interceptors | Guards   │
├──────────────────────────────────────────────────────────────┤
│                   APPLICATION LAYER                           │
│  Use Cases | Application Services | Command/Query Handlers    │
├──────────────────────────────────────────────────────────────┤
│                      DOMAIN LAYER                             │
│  Entities | Aggregates | Value Objects | Domain Services      │
│  Domain Events | Repository Interfaces | Business Rules       │
├──────────────────────────────────────────────────────────────┤
│                  INFRASTRUCTURE LAYER                         │
│  Repository Implementations | Prisma | External Services      │
├──────────────────────────────────────────────────────────────┤
│                     SHARED KERNEL                             │
│  Base Classes | Common Value Objects | Exceptions | Utilities │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 Fluxo de Dados (Use Case)

```
HTTP Request
    ↓
[Controller]
    ↓ (HTTP DTO → Application DTO)
[Use Case]
    ↓ (valida, orquestra)
[Domain Services / Entities]
    ↓ (lógica de negócio pura)
[Repository Interface]
    ↓
[Prisma Repository]
    ↓
[PostgreSQL Database]
    ↓ (retorna)
[Mapper] (DB → Domain)
    ↓
[Domain Events published]
    ↓
[Application DTOs → HTTP Response DTO]
    ↓
[Controller]
    ↓
HTTP Response
```

### 7.3 Relacionamento Entre Bounded Contexts

```
┌──────────────────────────┐
│  Cliente Context         │
│  - Aggregate: Cliente    │
│  - Value Objects        │
└────────────┬─────────────┘
             │ (ClienteId reference)
             │
┌────────────▼─────────────┐
│  Orçamento Context       │
│  - Aggregate: Orçamento  │
│  - Relaciona com Cliente │
└────────────┬─────────────┘
             │ (OrcamentoId reference)
             │
┌────────────▼─────────────┐
│  Produção Context        │
│  - Aggregate: OrdemProd  │
│  - Anti-Corruption Layer │
│  - (sem preços)          │
└──────────────────────────┘
```

---

## 8. CODE REVIEW CHECKLIST

### 8.1 Domain Layer Review

- [ ] Entidade implementa lógica de negócio corretamente?
- [ ] Value Objects são imutáveis?
- [ ] Validações ocorrem nos construtores de VOs?
- [ ] Não há lógica de infraestrutura (BD, HTTP, etc)?
- [ ] Aggregate Root publica Domain Events?
- [ ] Repository Interface definida (sem implementação)?
- [ ] Testes unitários > 90% coverage?

### 8.2 Application Layer Review

- [ ] Use Case implementa Dependency Injection?
- [ ] Use Case traduz entre DTOs e Domain Objects?
- [ ] Exceções de negócio são lançadas corretamente?
- [ ] Domain Events são publicados pós-persistência?
- [ ] Testes de integração cobrem fluxos críticos?

### 8.3 Infrastructure Layer Review

- [ ] Repository implementa interface corretamente?
- [ ] Mapper converte entre Domain e Persistence corretamente?
- [ ] Nenhuma lógica de negócio aqui?
- [ ] Transações de BD gerenciadas corretamente?

### 8.4 Presentation Layer Review

- [ ] Controller apenas orquestra (delega para Use Case)?
- [ ] HTTP DTOs não expõem detalhes internos?
- [ ] Validação de input antes de chamar Use Case?
- [ ] Tratamento de erros com mensagens claras (sem stack trace)?
- [ ] Autenticação verificada via Guard?

### 8.5 Testes Review

- [ ] Coverage > 80%?
- [ ] Testes têm nomes descritivos?
- [ ] Testes são independentes (sem side effects)?
- [ ] Mocks usados apenas onde necessário?
- [ ] AAA (Arrange, Act, Assert) pattern seguido?

### 8.6 Segurança & LGPD Review

- [ ] Dados sensíveis não são logados?
- [ ] Validações happening em todas as layers?
- [ ] Autorização verificada (não apenas autenticação)?
- [ ] Auditoria registrada (quem, quando)?
- [ ] Soft delete implementado?
- [ ] Sem exposição de stack traces?

---

## RESUMO: DDD + Testes + LGPD

```
✅ Domain Layer: Lógica de negócio pura, testes coverage 90%+
✅ Application Layer: Orquestração, DTOs, > 80% coverage
✅ Infrastructure Layer: Implementações concretas (Prisma)
✅ Presentation Layer: Thin controllers, delegam para Use Cases
✅ Unit Tests: Entities, VOs, Services
✅ Integration Tests: Use Cases + Repository
✅ E2E Tests: Fluxos completos críticos
✅ LGPD: Soft delete, export, auditoria, validação
✅ Segurança: Sem stack traces, validação em camadas, logging
```

---

**Versão**: 1.0
**Data**: 18/01/2025
**Status**: Pronto para implementação com padrões maduros
