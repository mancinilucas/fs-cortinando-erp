# Cortinando ERP

Sistema web para organizar o ciclo comercial e operacional de uma consultoria de cortinas sob medida: do cadastro do cliente à conclusão do serviço.

O projeto foi desenvolvido como um monólito modular, com frontend e backend separados e regras de negócio concentradas no servidor.

## Funcionalidades

- Cadastro e consulta de clientes, com histórico de orçamentos.
- Criação e acompanhamento de orçamentos, com cortinas, medidas, componentes financeiros, adicionais, descontos e ajuste comercial.
- Controle do ciclo do orçamento: envio, confirmação, produção, instalação e conclusão.
- Dashboard com indicadores e acompanhamento operacional de instalações.
- Geração de PDF comercial e ordem de produção.
- Cadastro de dados do negócio usados nos documentos.
- Interface responsiva, pensada para uso em dispositivos móveis.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Frontend | React, TypeScript, Vite, React Router, TanStack Query |
| Backend | Node.js, TypeScript, NestJS |
| Persistência | PostgreSQL, Prisma |
| Documentos | PDF gerado sob demanda |
| Testes | Vitest, Testing Library, MSW |
| Ambiente local | Docker Compose, pnpm |

## Requisitos

- Node.js compatível com os projetos e Corepack habilitado.
- pnpm 12 (ou a versão declarada pelo `packageManager` do frontend).
- Docker e Docker Compose, para subir o PostgreSQL local.

## Executar localmente

Na raiz do repositório, inicie o banco:

```bash
docker compose up -d postgres
```

Configure e inicie o backend em um terminal:

```bash
cd backend
cp .env.example .env
pnpm install
pnpm exec prisma migrate dev
pnpm run seed
pnpm run start:dev
```

Configure e inicie o frontend em outro terminal:

```bash
cd frontend
cp .env.example .env
pnpm install
pnpm dev
```

A aplicação fica disponível em `http://localhost:5173` e a API em `http://localhost:3000`. Use `localhost` nos dois endereços para manter a sessão baseada em cookie funcionando. No arquivo `backend/.env`, defina `ADMIN_EMAIL` e `ADMIN_PASSWORD` para criar a conta administrativa pelo seed. Os valores de conexão fornecidos são apenas para desenvolvimento local; não os reutilize em produção.

## Verificações

Execute os comandos a partir da pasta correspondente.

Frontend:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Backend:

```bash
pnpm run lint
pnpm run test
pnpm run test:e2e
pnpm run build
```

## Estrutura do repositório

```text
backend/   API NestJS, domínio, persistência e geração de documentos
frontend/  Aplicação React organizada por funcionalidades
docs/      Especificação do produto, arquitetura e documentação técnica
```

## Documentação

- [Especificação do produto](docs/PROJECT_SPEC.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [Plano de implementação](docs/IMPLEMENTATION_PLAN.md)

## Escopo

O sistema foi desenhado para operação para uma consultoria. Integrações com calendário e WhatsApp, pagamentos, controle financeiro, multiusuários e aplicativo nativo não fazem parte do escopo atual. A configuração de produção e o hardening de entrega também permanecem como etapa planejada.
