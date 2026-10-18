# ARCHITECTURE.md — Arquitetura do Sistema de Gestão de Orçamentos para Consultoria de Cortinas

**Status:** consolidado após revisão arquitetural  
**Fonte de verdade funcional:** `PROJECT_SPEC.md`  
**Backend:** Node.js + TypeScript + NestJS + Prisma + PostgreSQL  
**Frontend:** React + Vite + TypeScript

---

## 1. Visão arquitetural

### 1.1 Estilo arquitetural

O sistema será implementado como um **monólito modular**, com organização por módulos de negócio e arquitetura em camadas aplicada de forma pragmática.

A modelagem utilizará **DDD tático seletivo** somente onde houver comportamento, invariantes ou complexidade de domínio suficientes para justificar suas abstrações.

A arquitetura não exige que todos os módulos possuam as mesmas camadas ou os mesmos padrões táticos.

```text
Modular Monolith
+
Layered Architecture
+
Pragmatic DDD
```

### 1.2 Princípios

- O `PROJECT_SPEC.md` prevalece sobre este documento em caso de conflito funcional.
- Regras de negócio devem ser protegidas no backend.
- Controllers permanecem finos.
- O domínio não depende de NestJS, Prisma, HTTP ou bibliotecas de PDF.
- Prisma é detalhe de infraestrutura e não define o modelo de domínio.
- Interfaces e abstrações só são introduzidas quando representam uma fronteira real.
- Não serão criadas camadas, repositories, Domain Services ou Domain Events apenas por simetria arquitetural.
- A solução deve continuar compreensível e operável por um desenvolvedor solo.
- Todo o código-fonte é escrito em inglês, incluindo schema Prisma (models, enums, campos e tabelas), identificadores, comentários, testes e mensagens de commit. A documentação de produto e de desenvolvimento permanece em português.

### 1.3 Fora da arquitetura inicial

Não serão adotados no MVP sem necessidade concreta:

- microservices;
- CQRS formal;
- event sourcing;
- message broker;
- Kubernetes;
- generic repositories;
- event bus obrigatório;
- Unit of Work genérico;
- cache distribuído;
- orquestração multiagente dentro do produto.

---

## 2. Módulos e fronteiras

### 2.1 Módulos principais

```text
src/modules/
├── orcamentos/
├── clientes/
├── auth/
└── dados-do-negocio/
```

`Orçamentos` concentra o domínio de maior complexidade e receberá a modelagem DDD mais rica.

`Clientes` possui entidade de domínio própria, mas regras significativamente mais simples.

`Auth` e `DadosDoNegocio` são módulos de suporte e não receberão uma camada `domain/` artificial caso não exista comportamento de domínio que a justifique.

### 2.2 Produção

Produção **não é bounded context nem aggregate independente no MVP**.

Ela representa uma fase do ciclo de vida do orçamento:

```text
CONFIRMADO → EM_PRODUCAO → CONCLUIDO
```

A ordem de produção é uma projeção/documento derivado do orçamento, sem identidade, tabela, repository ou ciclo de vida próprios.

### 2.3 Bounded context, módulo NestJS e feature

Os conceitos não são equivalentes:

```text
Bounded Context ≠ NestJS Module ≠ pasta ≠ feature
```

A organização física deve servir ao modelo e não criar fronteiras de domínio artificiais.

---

## 3. Modelo de domínio

### 3.1 Aggregate Root `Cliente`

`Cliente` é Aggregate Root independente.

Responsabilidades principais:

- identidade e dados cadastrais;
- validações cadastrais necessárias;
- soft delete.

O endereço cadastral é estruturado (`PROJECT_SPEC` §2.8) e usa a mesma estrutura do endereço de instalação do orçamento, como Value Object próprio do módulo `clientes`. Não há Value Object compartilhado entre módulos por simetria.

O histórico exibido na tela do cliente não é uma coleção interna do aggregate. Ele é obtido consultando os orçamentos associados ao `clienteId`.

### 3.2 Aggregate Root `Orcamento`

`Orcamento` é o Aggregate Root do núcleo comercial e operacional.

Sua fronteira inclui conceitualmente:

```text
Orcamento (AR)
├── clienteId
├── numeroOrcamento
├── status
├── enderecoInstalacao
├── Cortina[]
│   └── ItemFinanceiro[]
├── adicionaisGerais: ItemFinanceiro[]
├── descontoGlobal
├── ajusteComercial
├── observacoes
└── datas do ciclo
```

O aggregate é responsável por preservar invariantes relacionadas a cálculos, edição, envio, confirmação, produção, instalação e conclusão.

### 3.3 `Cortina`

`Cortina` é uma **Entity interna** do aggregate `Orcamento`.

Ela possui identidade estável dentro do orçamento e não possui repository próprio.

O campo `sequencia` representa posição/apresentação e não substitui sua identidade técnica.

A própria entidade protege cálculos intrínsecos:

```text
larguraFinal = larguraVao + (2 × valorBorda)
quantidadeTecido = larguraFinal × fatorTecido
```

### 3.4 Itens financeiros

Componentes financeiros de cortinas e adicionais gerais compartilham o mesmo modelo de domínio, provisoriamente denominado `ItemFinanceiro`.

```text
ItemFinanceiro
- id
- nome
- quantidade
- unidade
- valorUnitario
- total derivado
```

O modelo é uma Entity interna do aggregate.

As coleções permanecem semanticamente separadas:

```text
Cortina.componentesFinanceiros[]
Orcamento.adicionaisGerais[]
```

Nomes como `Tecido`, `Mão de obra`, `Trilho`, `Entretela`, `Frete` e `Instalação` são presets de UX, não enums do domínio.

### 3.5 Value Objects

Os VOs inicialmente justificados são:

- `NumeroOrcamento`;
- `Money`;
- `EnderecoInstalacao`;
- `Desconto`.

Não serão criados VOs individuais para cada medida enquanto não houver comportamento adicional que justifique isso.

### 3.6 Desconto

`Desconto` é Value Object global do orçamento.

Tipos:

```text
SEM_DESCONTO
PERCENTUAL
VALOR_FIXO
```

O VO garante combinações válidas e calcula o valor monetário do desconto a partir do subtotal quando necessário.

### 3.7 Ajuste comercial

`ajusteComercial` é um valor monetário global e opcional, positivo ou negativo, aplicado após desconto.

```text
totalCalculado = subtotalOrcamento - valorDesconto
totalOrcamento = totalCalculado + ajusteComercial
```

A interface pode receber diretamente o valor final desejado e derivar o ajuste correspondente.

O ajuste não substitui o desconto e deve permanecer rastreável internamente.

### 3.8 Endereço de instalação

`EnderecoInstalacao` é Value Object pertencente ao orçamento.

Estrutura:

```text
logradouro *
numero *
bairro *
cidade *
complemento?
cep?
uf?
```

Um endereço é considerado preenchido quando possui `logradouro`, `numero`, `bairro` e `cidade`. `complemento`, `cep` e `uf` são opcionais. `numero` é textual.

O orçamento em `RASCUNHO` pode ter endereço vazio ou incompleto; o gate de envio exige endereço preenchido.

O cadastro do `Cliente` utiliza a mesma estrutura e as mesmas regras de preenchimento, como Value Object próprio do módulo `clientes`.

Quando copiado do cliente, uma nova instância/snapshot é criada, campo a campo. Alterações posteriores no cadastro do cliente não modificam o endereço histórico do orçamento.

---

## 4. Ciclo de vida do orçamento

### 4.1 Estados persistidos

```text
RASCUNHO
ENVIADO
CONFIRMADO
EM_PRODUCAO
CONCLUIDO
CANCELADO
```

`EXPIRADO` não é persistido.

### 4.2 Comportamento do Aggregate Root

As transições são operações explícitas do domínio, por exemplo:

```text
marcarComoEnviado()
confirmar()
reabrir()
renovar()
cancelar()
iniciarProducao()
concluir()
```

Os nomes concretos poderão ser refinados na implementação, mas as regras não serão implementadas como simples atribuição de `status` na Application ou Presentation Layer.

### 4.3 Condições derivadas

```text
expirado =
  status == ENVIADO
  && agora > dataValidade
```

```text
instalacaoAtrasada =
  dataInstalacaoAgendada < agora
  && status in [CONFIRMADO, EM_PRODUCAO]
```

Essas condições não serão persistidas como estados.

### 4.4 Datas persistidas

Serão persistidos:

- `dataCriacao`;
- `dataPrimeiroEnvio?`;
- `dataValidade?`;
- `dataConfirmacao?`;
- `dataInicioProducao?`;
- `dataInstalacaoAgendada?`;
- `dataConclusao?`.

Eventos auxiliares como reabertura, renovação e cancelamento serão preservados pelo histórico em vez de originarem campos adicionais inicialmente.

---

## 5. Camadas e responsabilidades

### 5.1 Domain

Responsável por:

- invariantes;
- cálculos de negócio;
- transições de estado;
- Entities;
- Value Objects;
- regras intrínsecas dos aggregates.

Não conhece:

- NestJS;
- HTTP;
- Prisma;
- PostgreSQL;
- geração de PDF;
- cookies/sessões;
- filesystem/storage.

### 5.2 Application

Responsável por:

- casos de uso;
- carregar aggregates;
- chamar comportamentos de domínio;
- coordenar repositories;
- controlar transações;
- registrar histórico;
- coordenar geração de documentos;
- devolver DTOs.

Regra geral:

> Domain decide o que é válido. Application coordena a operação.

### 5.3 Infrastructure

Responsável por:

- Prisma/PostgreSQL;
- implementações concretas de repositories;
- mappers Domain ↔ Persistence;
- sessões persistidas;
- geração de PDF;
- logging técnico;
- integrações externas futuras.

### 5.4 Presentation

Responsável por:

- controllers;
- DTOs HTTP;
- validação estrutural de requests;
- autenticação/guards;
- mapeamento de erros para HTTP;
- serialização de respostas.

Controllers não contêm regras de negócio relevantes.

---

## 6. Casos de uso

Operações de negócio relevantes terão casos de uso explícitos.

Exemplos:

```text
CriarRascunho
AtualizarOrcamento
MarcarComoEnviado
ConfirmarOrcamento
ReabrirOrcamento
RenovarOrcamento
CancelarOrcamento
IniciarProducao
ConcluirServico
GerarPdfComercial
GerarOrdemProducao
```

CRUDs simples podem utilizar estruturas menos cerimoniais quando não houver comportamento relevante.

Domain Services não serão criados por padrão. Só serão introduzidos quando existir regra de domínio legítima que não pertença naturalmente a uma Entity ou Value Object.

---

## 7. Repositories, queries e interfaces

### 7.1 Aggregate repositories

Repositories DDD serão criados somente para Aggregate Roots:

```text
ClienteRepository
OrcamentoRepository
```

Não existirão repositories próprios para:

- Cortina;
- ItemFinanceiro;
- Desconto;
- EnderecoInstalacao.

### 7.2 Interfaces

Interfaces serão utilizadas nas fronteiras em que Application deve permanecer desacoplada da infraestrutura.

Exemplo conceitual:

```ts
interface OrcamentoRepository {
  findById(id: string): Promise<Orcamento | null>;
  save(orcamento: Orcamento): Promise<void>;
}
```

Não será criado `Repository<T>` genérico.

### 7.3 Queries

Dashboard, buscas e listagens podem utilizar Query Services/read repositories com projeções diretas do Prisma.

Não é necessário reconstruir aggregates completos para operações somente de leitura.

Essa separação não constitui CQRS formal.

---

## 8. Histórico

O histórico é persistido separadamente e associado por `orcamentoId`.

Estrutura conceitual:

```text
RegistroHistoricoOrcamento
- id
- orcamentoId
- tipoEvento
- ocorridoEm
- detalhes?
```

`detalhes` poderá utilizar estrutura flexível, preferencialmente JSON, para armazenar mudanças relevantes como valor anterior e novo.

O histórico:

- não faz parte da coleção interna carregada com o aggregate;
- não reconstrói o estado atual;
- não é event sourcing;
- registra eventos de negócio, não navegação ou ações técnicas triviais.

Domain Events/event bus não serão infraestrutura obrigatória no MVP.

---

## 9. Persistência e Prisma

### 9.1 Isolamento

Prisma fica restrito à Infrastructure Layer.

Tipos como `Prisma.Decimal`, `Prisma.*Input` ou payloads gerados não devem aparecer no Domain nem como contrato público da Application Layer.

### 9.2 Mappers

Serão utilizados mappers concretos quando houver diferença real entre modelo relacional e domínio:

```text
ClienteMapper
OrcamentoMapper
```

Não será criada infraestrutura genérica de mapper sem necessidade.

### 9.3 Modelo relacional inicial

#### `orcamentos`

Campos principais:

```text
id UUID PK
numero_orcamento UNIQUE
cliente_id FK
status
observacoes?

desconto_tipo
desconto_percentual?
desconto_valor_fixo_centavos?
ajuste_comercial_centavos?

endereco_instalacao_logradouro
endereco_instalacao_numero
endereco_instalacao_bairro
endereco_instalacao_cidade
endereco_instalacao_complemento?
endereco_instalacao_cep?
endereco_instalacao_uf?

data_criacao
data_primeiro_envio?
data_validade?
data_confirmacao?
data_inicio_producao?
data_instalacao_agendada?
data_conclusao?
```

#### `cortinas`

```text
id UUID PK
orcamento_id FK
sequencia
ambiente
descricao?
material
largura_vao
valor_borda
altura
fator_tecido
observacoes?
```

`larguraFinal` e `quantidadeTecido` não serão persistidos inicialmente porque são deterministicamente derivados.

#### `componentes_financeiros`

```text
id UUID PK
cortina_id FK
nome
quantidade
unidade
valor_unitario_centavos
```

#### `adicionais_gerais`

```text
id UUID PK
orcamento_id FK
nome
quantidade
unidade
valor_unitario_centavos
```

Componentes e adicionais compartilham o mesmo modelo de domínio, mas utilizam tabelas diferentes por clareza referencial.

Totais derivados não serão persistidos inicialmente.

No bloco de endereço acima, `?` indica campo opcional do endereço, não nulabilidade de coluna: **todas** as colunas de endereço são nullable no banco, tanto no orçamento quanto no cadastro de `clientes` (`endereco_...`). Um orçamento em `RASCUNHO` pode não ter endereço e um cliente pode não ter endereço cadastrado; a regra de endereço preenchido pertence ao domínio, não ao schema.

### 9.4 Soft delete de cliente

Cliente utiliza `deletedAt` (ou campo equivalente).

Consultas normais ignoram clientes removidos logicamente, mas orçamentos históricos continuam associados ao registro.

### 9.5 Exclusão de orçamento

Exclusão física é permitida apenas para `RASCUNHO`, conforme o `PROJECT_SPEC`.

O número comercial consumido não volta para a sequência.

### 9.6 Runtime do Prisma 7

O Prisma Client é gerado pelo generator `prisma-client` em `backend/src/generated/prisma`, diretório não versionado compilado junto com o backend. O runtime exige driver adapter: `@prisma/adapter-pg` sobre `pg`.

`PrismaService` fica em `src/shared/database/` e é o único ponto de acesso ao client. Na inicialização ele valida a conexão com o banco, de modo que o NestJS não sobe com um datasource inválido.

---

## 10. Precisão numérica e Money

### 10.1 Medidas, fatores e quantidades

No domínio funcional, medidas são expressas em metros.

Para **entradas de medida** (`larguraVao`, `altura`, `valorBorda`) e para `fatorTecido`, a escala funcional adotada será de 3 casas decimais:

```text
Decimal(..., 3)
```

Três casas nas medidas representam precisão de milímetros.

Valores derivados não serão artificialmente limitados a três casas. Como `quantidadeTecido = larguraFinal × fatorTecido`, o cálculo pode produzir até 6 casas decimais a partir de entradas com escala 3. Essa precisão será preservada durante o cálculo.

Quando `quantidadeTecido` for copiada como quantidade de um item financeiro (por exemplo, Tecido ou Mão de obra), a coluna de quantidade deverá suportar a precisão necessária para não introduzir arredondamento automático de metragem; inicialmente, escala de até 6 casas é adequada.

A precisão total (`p`) será dimensionada no schema Prisma conforme a faixa esperada.

Não será usado `Float` para medidas ou quantidades relevantes.

### 10.2 Dinheiro

Valores monetários terão precisão de centavos.

O Domain utilizará `Money`, conceitualmente baseado em centavos inteiros.

```text
R$ 125,90 → 12590 centavos
```

O banco persiste valores monetários em centavos inteiros quando forem valores monetários finais/unitários.

### 10.3 Arredondamento monetário

Cálculos que gerarem fração de centavo utilizarão arredondamento **HALF_UP** para 2 casas decimais.

Exemplo:

```text
2,375 × R$ 37,90 = R$ 90,0125
→ R$ 90,01
```

Regra:

1. calcular com precisão decimal;
2. arredondar o total do item para centavos usando HALF_UP;
3. somar valores já monetários;
4. aplicar a mesma política ao valor monetário derivado de desconto percentual;
5. aplicar eventual ajuste comercial;
6. obter o total final em centavos.

Essa política se aplica apenas a dinheiro. Medidas e quantidade de tecido não sofrem arredondamento automático de negócio.

---

## 11. Transações

A Application Layer controla transações quando uma operação precisa persistir múltiplas alterações atomicamente.

Exemplo:

```text
BEGIN
  salvar orçamento
  registrar histórico
COMMIT
```

O Prisma fornecerá o mecanismo concreto via `$transaction`.

Não será criado inicialmente um Unit of Work genérico.

Geração de arquivos PDF não deve manter uma transação de banco aberta durante processamento de documento.

---

## 12. Numeração do orçamento

A numeração comercial segue:

```text
ORÇ-AAAA-NNN
```

Será utilizado contador persistido por ano, por exemplo:

```text
orcamento_sequence
- ano PK/UNIQUE
- ultimo_numero
```

No primeiro salvamento do rascunho:

```text
BEGIN
  reservar/incrementar contador anual atomicamente
  montar NumeroOrcamento
  criar orçamento
COMMIT
```

Regras:

- não utilizar `MAX(numero) + 1`;
- número nunca é reutilizado;
- lacunas são permitidas;
- exclusão de rascunho não devolve número;
- `numero_orcamento` possui constraint `UNIQUE`.

`NumeroOrcamento` representa/valida o valor, mas não conhece SQL, locks ou concorrência.

---

## 13. Autenticação e sessão

### 13.1 Estratégia

O MVP utilizará **sessão server-side**, não access/refresh JWT.

Fluxo:

```text
login email + senha
→ validar credenciais
→ criar token aleatório de sessão
→ armazenar somente hash/token derivado no servidor
→ enviar identificador em cookie seguro
→ validar sessão nas rotas privadas
```

### 13.2 Cookie

Em produção:

```text
HttpOnly
Secure
SameSite=Lax ou Strict
Path=/
```

Preferencialmente utilizar prefixo `__Host-` quando compatível com o deployment.

### 13.3 Baseline de segurança

- senha armazenada com hash forte (`Argon2id` preferencialmente; bcrypt aceitável quando justificado);
- HTTPS obrigatório em produção;
- token de sessão gerado por CSPRNG com alta entropia;
- armazenar somente representação segura/hash do token quando aplicável;
- expiração de sessão;
- regeneração/substituição da sessão após login;
- invalidação no logout;
- proteção CSRF para requisições mutáveis;
- rate limiting/backoff no login;
- mensagens de autenticação que não facilitem enumeração de conta;
- logging de falhas sem registrar credenciais.

MFA/TOTP é melhoria recomendada para produção, mas não é requisito funcional obrigatório do MVP neste momento.

### 13.4 Usuário

Mesmo com uma única conta, a credencial será persistida como registro de usuário. Não serão utilizadas credenciais administrativas fixas em `.env` como mecanismo permanente de autenticação.

Não haverá no MVP:

- signup público;
- RBAC;
- gestão de usuários;
- recuperação pública de senha.

---

## 14. API REST

### 14.1 Princípio

CRUD convencional será usado para recursos.

Transições relevantes do aggregate serão expostas como **ações explícitas com `POST`**, evitando permitir alterações arbitrárias de `status` via PATCH genérico.

### 14.2 Rotas conceituais

```text
POST   /auth/login
POST   /auth/logout
GET    /auth/me

GET    /clientes
POST   /clientes
GET    /clientes/:id
PATCH  /clientes/:id
DELETE /clientes/:id
GET    /clientes/:id/orcamentos

POST   /clientes/:clienteId/orcamentos
GET    /orcamentos
GET    /orcamentos/:id
PATCH  /orcamentos/:id
DELETE /orcamentos/:id

POST   /orcamentos/:id/enviar
POST   /orcamentos/:id/confirmar
POST   /orcamentos/:id/reabrir
POST   /orcamentos/:id/renovar
POST   /orcamentos/:id/cancelar
POST   /orcamentos/:id/iniciar-producao
POST   /orcamentos/:id/concluir

PUT    /orcamentos/:id/instalacao
DELETE /orcamentos/:id/instalacao

GET    /orcamentos/:id/historico
GET    /orcamentos/:id/pdf
GET    /orcamentos/:id/ordem-producao

GET    /dashboard
GET    /dados-do-negocio
PUT    /dados-do-negocio
```

Os nomes exatos podem sofrer pequenos refinamentos sem alterar a decisão arquitetural.

### 14.3 DTOs

DTOs HTTP são separados dos objetos de domínio.

Entities não são retornadas diretamente pela API.

---

## 15. Tratamento de erros

O Domain utiliza erros/exceções sem dependência de HTTP.

A Presentation Layer mapeia categorias para respostas HTTP adequadas.

Referência inicial:

```text
input/regra inválida → 400 ou 422
recurso inexistente → 404
conflito → 409
autenticação ausente/inválida → 401
```

Stack traces e detalhes internos não são enviados ao cliente em produção.

---

## 16. Documentos

### 16.1 PDF comercial

O PDF é uma projeção dos dados atuais do orçamento.

Não será persistido nem versionado no MVP.

Sempre que necessário, um novo arquivo será gerado a partir dos dados atuais permitidos pelo `PROJECT_SPEC`.

Gerar ou compartilhar PDF não altera status.

### 16.2 Ordem de produção

A ordem de produção também é gerada sob demanda a partir do orçamento.

Não existem:

- tabela `ordem_producao`;
- `OrdemProducao` Aggregate Root;
- `OrdemProducaoRepository`;
- status próprio da ordem;
- ACL entre contextos de Orçamento e Produção.

A projeção deve incluir somente as informações autorizadas pelo `PROJECT_SPEC` e nunca expor preços ou dados pessoais indevidos.

---

## 17. Testes

A estratégia prioriza risco e regras críticas, não porcentagem isolada de coverage.

### 17.1 Unitários

Foco em:

- `Orcamento`;
- `Cortina`;
- `Desconto`;
- `Money`;
- transições de estado;
- gates;
- cálculos.

### 17.2 Integração

Foco em:

- repositories Prisma;
- mappers;
- transações;
- sequência anual;
- constraints do banco;
- sessão/autenticação.

### 17.3 E2E

Cobrir fluxos críticos do produto:

```text
login
→ cliente
→ rascunho
→ envio
→ confirmação
→ produção
→ instalação opcional
→ conclusão
```

Também cobrir transições inválidas e proteção de rotas.

Coverage será acompanhado, mas não haverá meta global rígida de `>80%` como substituto de qualidade.

---

## 18. Frontend

React/Vite será organizado preferencialmente por features alinhadas ao produto.

Princípios:

- mobile-first;
- estado local e form state por padrão;
- biblioteca global de estado somente quando surgir necessidade concreta;
- cliente HTTP isolado;
- frontend não replica regras críticas como fonte de verdade;
- validações de UX podem existir, mas o backend continua responsável pela integridade.

---

## 19. Estrutura de pastas

Estrutura inicial recomendada:

```text
src/
├── modules/
│   ├── orcamentos/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   ├── value-objects/
│   │   │   └── repositories/
│   │   ├── application/
│   │   │   ├── use-cases/
│   │   │   ├── queries/
│   │   │   └── dto/
│   │   ├── infrastructure/
│   │   │   ├── persistence/
│   │   │   └── documents/
│   │   ├── presentation/
│   │   │   ├── controllers/
│   │   │   └── dto/
│   │   └── orcamentos.module.ts
│   │
│   ├── clientes/
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   ├── presentation/
│   │   └── clientes.module.ts
│   │
│   ├── auth/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   ├── presentation/
│   │   └── auth.module.ts
│   │
│   └── dados-do-negocio/
│       ├── application/
│       ├── infrastructure/
│       ├── presentation/
│       └── dados-do-negocio.module.ts
│
├── shared/
│   ├── database/
│   └── errors/
├── config/
└── main.ts
```

`shared/` deve permanecer pequeno e não funcionar como depósito genérico.

`Money` permanece inicialmente em `orcamentos/domain/value-objects/`. Só será movido para `shared` se outro módulo realmente passar a reutilizá-lo.

---

## 20. Infraestrutura e deployment

Arquitetura do MVP:

```text
React frontend
      ↓ HTTPS
NestJS backend
      ↓
PostgreSQL
```

Docker/Docker Compose será utilizado no desenvolvimento e pode ser utilizado no deployment conforme o provedor escolhido.

Não são necessários inicialmente:

- Redis;
- broker;
- Kubernetes;
- múltiplos serviços;
- banco por módulo.

Produção deve possuir estratégia de backup adequada para PostgreSQL.

---

## 21. Logging, segurança e privacidade

### 21.1 Logging técnico

Logs técnicos são separados do histórico de negócio.

Não registrar integralmente:

- senhas;
- tokens de sessão;
- cookies;
- CPF/CNPJ;
- payloads contendo dados pessoais sem necessidade.

### 21.2 Privacidade

A arquitetura não tratará soft delete como equivalente a "direito ao esquecimento" nem assumirá consentimento obrigatório sem requisito funcional correspondente.

Medidas concretas do MVP incluem:

- minimização de dados;
- autenticação;
- hash de senha;
- proteção de sessões;
- não exposição de dados pessoais/financeiros na ordem de produção;
- logs seguros;
- backup;
- soft delete conforme requisito funcional.

---

## 22. Decisões explicitamente adiadas

Podem ser decididas durante implementação sem alterar a arquitetura-base:

- biblioteca específica de PDF;
- provedor de hosting;
- ferramenta exata de observabilidade;
- implementação concreta de CSRF dentro do stack escolhido;
- adoção de MFA/TOTP;
- refinamento dos nomes de endpoints;
- precisão total `p` dos `Decimal(p,3)`, mantendo escala de 3 casas;
- criação de abstração própria de Unit of Work caso repetição real justifique;
- introdução de optimistic locking se surgir edição concorrente real;
- Domain Events se múltiplos efeitos desacoplados passarem a justificar o padrão.

---

## 23. Resumo das decisões consolidadas

```text
Estilo                     → Monólito modular
Organização                → Arquitetura em camadas pragmática
DDD                         → Tático seletivo
Aggregate Roots             → Cliente, Orçamento
Cortina                     → Entity interna de Orçamento
ItemFinanceiro              → Entity interna compartilhada semanticamente
Desconto                    → Value Object
EnderecoInstalacao          → Value Object/snapshot estruturado (cliente usa a mesma estrutura)
CPF/CNPJ                    → normalizado (somente dígitos) e único em `clientes`
Produção                    → fase de Orçamento, não contexto separado
Histórico                   → persistência separada, sem event sourcing
Repositories DDD            → ClienteRepository, OrcamentoRepository
Prisma                      → Infrastructure apenas
Queries                     → projeções diretas quando apropriado
Transações                  → Application + Prisma $transaction
Unit of Work                → não inicialmente
Número ORÇ-AAAA-NNN         → contador anual atômico
Medidas de entrada          → decimal com 3 casas
Quantidades derivadas        → preservar precisão (até 6 casas quando necessário)
Dinheiro                    → centavos / 2 casas
Arredondamento monetário    → HALF_UP
Ajuste comercial            → global, positivo ou negativo
Autenticação                → sessão server-side + cookie seguro
API                         → REST CRUD + POST para ações de domínio
PDF                         → gerado sob demanda, não persistido
Ordem de produção           → projeção gerada sob demanda
Testes                      → orientados a risco/regras críticas
Deployment                  → aplicação única + PostgreSQL
Idioma do código             → inglês (inclui schema Prisma e mensagens de commit)
```

---

**Status da arquitetura:** decisões principais do MVP consolidadas e alinhadas ao `PROJECT_SPEC.md` revisado.
