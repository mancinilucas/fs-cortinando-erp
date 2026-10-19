# PROJECT SPEC --- Sistema de Gestão de Orçamentos para Consultoria de Cortinas

## 1. Visão do Produto

### 1.1 Contexto do negócio

Sistema web mobile-first para apoiar uma consultora de cortinas sob
medida na gestão do ciclo comercial e operacional do serviço: cadastro
do cliente, elaboração do orçamento, confirmação, produção, eventual
instalação e conclusão.

O sistema deve substituir controles manuais e informações dispersas,
mantendo uma fonte única e estruturada para os dados do cliente, da
negociação e da execução do serviço.

### 1.2 Problemas que o produto resolve

-   Orçamentos elaborados e controlados manualmente.
-   Ausência de histórico estruturado por cliente.
-   Dificuldade para emitir uma apresentação comercial padronizada.
-   Informações técnicas de produção repassadas manualmente.
-   Falta de acompanhamento claro do estágio de cada negociação ou
    serviço.
-   Falta de uma visão operacional de instalações futuras ou atrasadas.

### 1.3 Objetivos do MVP

O MVP deve permitir:

1.  cadastrar e consultar clientes;
2.  consultar o histórico de orçamentos e serviços de cada cliente;
3.  criar e acompanhar orçamentos de cortinas sob medida;
4.  registrar dados técnicos das cortinas;
5.  calcular automaticamente medidas e valores definidos pelas regras de
    negócio;
6.  registrar uma composição financeira flexível;
7.  gerar um PDF comercial para o cliente;
8.  gerar uma ordem de produção sem informações comerciais ou dados
    pessoais desnecessários;
9.  acompanhar o ciclo do orçamento até sua conclusão;
10. registrar eventos relevantes do histórico;
11. acompanhar instalações agendadas;
12. operar adequadamente em dispositivos móveis.

### 1.4 Fora do escopo do MVP

-   Integração com Google Calendar ou outro calendário externo.
-   Aplicativo mobile nativo.
-   Sistema de pagamentos.
-   Controle financeiro de recebimentos.
-   Controle de custo real, margem ou lucro.
-   Relatórios avançados e BI.
-   Integração com WhatsApp API.
-   Multiusuários.
-   Papéis e permissões (RBAC).
-   Cadastro público de usuários.
-   Recuperação e alteração de senha.
-   Catálogo de tecidos ou materiais.
-   Catálogo de preços.
-   Campos customizados/dinâmicos.
-   Workflow específico para costureiras.
-   Status próprio para instalação.
-   Versionamento formal de orçamentos.
-   Versionamento de PDFs.
-   Agendamento de visitas para elaboração do orçamento.

------------------------------------------------------------------------

## 2. Conceitos do Domínio

### 2.1 Cliente

Representa a pessoa atendida pela consultora.

Dados:

``` text
Cliente
- id
- nome *
- telefone *
- email?
- cpfCnpj?
- endereco? (estruturado — ver 2.8)
- observacoes?
- dados de criação/atualização
```

Regras:

-   Nome e telefone são obrigatórios.
-   E-mail, CPF/CNPJ, endereço e observações são opcionais.
-   O endereço é estruturado (ver 2.8). Um endereço é considerado
    preenchido quando possui logradouro, número, bairro e cidade.
-   CPF/CNPJ é armazenado normalizado, somente com dígitos.
-   Clientes utilizam soft delete.
-   Um cliente removido logicamente continua associado aos seus
    registros históricos.
-   A implementação exata do soft delete será definida na arquitetura.
-   Soft delete, isoladamente, não deve ser tratado como garantia de
    conformidade com a LGPD.

### 2.2 Orçamento

Representa simultaneamente a negociação comercial e, após confirmação, o
acompanhamento do serviço correspondente.

Não existe uma entidade separada `ServiçoRealizado` no MVP. O histórico
de serviços do cliente é obtido a partir dos próprios orçamentos.

Informações conceituais:

``` text
Orcamento
- id
- numeroOrcamento
- cliente
- enderecoInstalacao (estruturado — ver 2.8)
- status
- cortinas[]
- adicionaisGerais[]
- descontoGlobal?
- ajusteComercial?
- observacoes?
- subtotalCortinas
- totalAdicionaisGerais
- subtotalOrcamento
- valorDesconto
- totalCalculado
- totalOrcamento

- dataCriacao
- dataPrimeiroEnvio?
- dataValidade?
- dataConfirmacao?
- dataInicioProducao?
- dataInstalacaoAgendada?
- dataConclusao?
```

As decisões sobre quais datas serão persistidas diretamente e quais
poderão ser derivadas pertencem à especificação de arquitetura.

### 2.3 Cortina

Cada item do orçamento representa **uma única cortina física**.

Não existe `quantidadeCortinas` no item.

``` text
Cortina
- id
- sequencia
- ambiente
- descricao?
- material
- larguraVao
- valorBorda
- larguraFinal
- altura
- fatorTecido
- quantidadeTecido
- componentesFinanceiros[]
- observacoes?
```

`ambiente` identifica o cômodo ou local, por exemplo:

``` text
Quarto
Sala
Escritório
```

`descricao` é opcional e serve para diferenciar fisicamente cortinas de
um mesmo ambiente:

``` text
Janela ao lado da cama
Porta da varanda
Janela principal
```

`observacoes` é um campo interno da consultora e não deve aparecer nos
documentos destinados ao cliente ou à produção.

Não existe entidade `Ambiente` no MVP.

### 2.4 Componente financeiro da cortina

A composição financeira de cada cortina é flexível.

``` text
ComponenteFinanceiro
- nome
- quantidade
- unidade
- valorUnitario
- total
```

Cálculo:

``` text
total = quantidade × valorUnitario
```

Ao criar uma cortina, a interface pode sugerir:

``` text
Tecido
Mão de obra
Trilho
Entretela
```

Esses nomes são padrões de UX, e não categorias rígidas do domínio. O
usuário pode remover ou substituir componentes.

### 2.5 Adicional geral do orçamento

Representa valores aplicáveis ao orçamento como um todo, por exemplo:

``` text
Frete
Instalação
Deslocamento
```

Possui conceitualmente a mesma estrutura financeira:

``` text
AdicionalGeral
- nome
- quantidade
- unidade
- valorUnitario
- total
```

Os adicionais gerais começam vazios e são incluídos manualmente quando
necessários.

A decisão sobre compartilhar ou não a mesma estrutura
técnica/persistência dos componentes financeiros pertence à arquitetura.

### 2.6 Desconto global

Existe apenas um desconto no nível do orçamento.

Tipos:

``` text
SEM_DESCONTO
PERCENTUAL
VALOR_FIXO
```

Não existem descontos individuais por cortina no MVP.

### 2.7 Dados do negócio

O sistema possui uma configuração simples com os dados usados na
apresentação comercial:

``` text
DadosDoNegocio
- nomeComercialOuConsultor *
- telefone *
- email?
- cpfCnpj?
```

A identidade visual e o logo são fixos no template da aplicação no MVP.

Não haverá upload ou gerenciamento de logo.

Campos opcionais vazios não devem ser exibidos no PDF.

### 2.8 Endereço

O endereço é um dado estruturado, utilizado tanto no cadastro do cliente
quanto no endereço de instalação do orçamento.

``` text
Endereco
- logradouro *
- numero *
- bairro *
- cidade *
- complemento?
- cep?
- uf?
```

Regras:

-   O endereço como um todo é opcional no cadastro do cliente.
-   Um endereço é considerado preenchido quando possui `logradouro`,
    `numero`, `bairro` e `cidade`.
-   `complemento`, `cep` e `uf` são opcionais.
-   `numero` é textual e aceita valores como `123A` ou `s/n`.
-   O endereço de instalação do orçamento utiliza a mesma estrutura, como
    um snapshot próprio do orçamento (ver 5).
-   Durante `RASCUNHO`, o endereço do orçamento pode estar vazio ou
    incompleto. A exigência de endereço preenchido vale no envio (ver 5 e
    8.5).

------------------------------------------------------------------------

## 3. Fluxo de Clientes

### 3.1 Cadastro

Quando a pessoa ainda não existe, a consultora realiza seu cadastro.

Campos obrigatórios:

-   nome;
-   telefone.

Campos opcionais:

-   e-mail;
-   CPF/CNPJ;
-   endereço (estruturado — ver 2.8);
-   observações.

### 3.2 Detalhes do cliente

A tela do cliente deve funcionar como ponto de entrada para o
relacionamento comercial.

Deve apresentar:

-   dados cadastrais;
-   ação `Novo orçamento`;
-   histórico dos orçamentos/serviços vinculados ao cliente.

O histórico é uma consulta aos próprios orçamentos e não uma entidade
separada.

### 3.3 Busca de clientes

No MVP, a busca necessária é por nome.

### 3.4 Criação de orçamento a partir do cliente

Um novo orçamento é iniciado a partir da tela do cliente.

``` text
Cliente
  ↓
Novo orçamento
  ↓
Formulário do orçamento
```

O cliente fica definido pelo contexto de criação. Não existe
funcionalidade para trocar o cliente de um orçamento já criado.

Se o orçamento foi iniciado para o cliente errado e ainda está em
`RASCUNHO`, ele pode ser excluído e criado novamente para o cliente
correto.

### 3.5 Dados atuais do cliente versus dados do orçamento

Nome, telefone e demais informações cadastrais são lidos do cadastro
atual do cliente.

O `enderecoInstalacao`, porém, é dado próprio do orçamento e preserva o
endereço utilizado naquele serviço, copiado campo a campo a partir do
endereço do cliente quando essa opção é utilizada (ver 5).

------------------------------------------------------------------------

## 4. Criação e Numeração do Orçamento

### 4.1 Formulário inicial

Clicar em `Novo orçamento` apenas abre o formulário.

Nenhum registro é criado até a primeira ação `Salvar rascunho`.

### 4.2 Primeiro salvamento

No primeiro `Salvar rascunho`:

-   o orçamento é persistido;
-   recebe status `RASCUNHO`;
-   recebe `dataCriacao`;
-   recebe um número único;
-   passa a aparecer no histórico do cliente.

O rascunho pode estar incompleto.

### 4.3 Número do orçamento

Formato comercial:

``` text
ORÇ-AAAA-NNN
```

Exemplo:

``` text
ORÇ-2026-001
```

Regras:

-   numeração sequencial anual;
-   sequência reinicia a cada ano;
-   número nunca é reutilizado;
-   excluir um rascunho não libera seu número;
-   lacunas na sequência são aceitáveis;
-   o mesmo número acompanha todo o ciclo do orçamento;
-   a produção utiliza esse mesmo número como referência;
-   não existe número separado de ordem de produção no MVP.

A estratégia técnica para garantir unicidade e concorrência será
definida na arquitetura.

------------------------------------------------------------------------

## 5. Endereço de Instalação

Todo orçamento enviado deve possuir um endereço de instalação próprio.

Ao preencher o orçamento, a consultora pode:

``` text
Usar endereço do cliente
```

ou:

``` text
Informar outro endereço
```

Se utilizar o endereço do cliente, os campos do endereço são copiados
campo a campo para o orçamento.

Se informar outro endereço, o valor é registrado diretamente no
orçamento.

Em ambos os casos, o resultado é um `enderecoInstalacao` próprio do
orçamento. Alterações posteriores no endereço cadastral do cliente não
modificam o endereço histórico do orçamento.

O endereço de instalação utiliza a mesma estrutura definida em 2.8. Um
endereço é considerado preenchido quando possui logradouro, número, bairro
e cidade; complemento, CEP e UF são opcionais.

Se o cliente não possuir endereço cadastrado, a opção de copiá-lo não
fica disponível e a consultora deve informar o endereço manualmente.

Durante `RASCUNHO`, o endereço pode estar vazio.

Para `RASCUNHO → ENVIADO`, ele é obrigatório.

------------------------------------------------------------------------

## 6. Regras Técnicas da Cortina

### 6.1 Medidas

A consultora informa:

``` text
larguraVao
altura
valorBorda
fatorTecido
```

Todos os valores de medidas são tratados em metros no domínio funcional.

### 6.2 Borda

`valorBorda` representa a margem adicionada de forma simétrica aos dois
lados do vão.

Valor padrão:

``` text
0,15 m
```

Pode ser alterado individualmente em cada cortina.

Regra:

``` text
larguraFinal = larguraVao + (2 × valorBorda)
```

Validação:

``` text
larguraVao > 0
valorBorda >= 0
```

Não existe limite mínimo/máximo arbitrário para a borda no MVP.

### 6.3 Altura

A altura é informada diretamente pela consultora.

``` text
altura > 0
```

Não existe margem automática aplicada à altura.

A altura não participa do cálculo da quantidade de tecido definido neste
MVP.

### 6.4 Fator de tecido

Valor padrão:

``` text
3,5
```

Pode ser alterado por cortina.

Validação:

``` text
fatorTecido > 0
```

Não existe regra especial automática baseada na altura da cortina.

### 6.5 Quantidade de tecido

``` text
quantidadeTecido = larguraFinal × fatorTecido
```

O sistema utiliza o resultado matemático diretamente.

Não existe regra automática de arredondamento ou ajuste de metragem.
Ajustes necessários são responsabilidade da consultora.

### 6.6 Material

`material` é um campo textual da cortina.

Não existe catálogo de tecidos no MVP.

O material deve estar definido antes de o orçamento ser enviado.

A escolha do material não determina automaticamente seu preço.

### 6.7 Trilho

Não existe `tipoTrilho` como dado técnico estruturado da cortina no MVP.

Quando cobrado, trilho é representado como componente financeiro.

Trilho não é enviado à produção de costura.

### 6.8 Entretela

Entretela pode ser adicionada como componente financeiro sugerido.

Quantidade, unidade e preço são informados manualmente enquanto a regra
comercial específica não estiver formalizada.

------------------------------------------------------------------------

## 7. Composição Financeira

### 7.1 Princípio

O sistema registra **valores comerciais negociados**, e não custos reais
do negócio.

O MVP não calcula nem acompanha:

-   custo real;
-   margem;
-   lucro.

### 7.2 Componentes por cortina

Cada cortina deve possuir pelo menos um componente financeiro válido
antes do envio.

Para qualquer componente presente:

``` text
quantidade > 0
valorUnitario > 0
total = quantidade × valorUnitario
```

Componentes com valor zero não são utilizados.

Se um componente não se aplica, ele deve ser removido.

Reduções comerciais são representadas pelo desconto global.

### 7.3 Tecido

Quando `Tecido` for utilizado como componente:

``` text
quantidade sugerida = quantidadeTecido calculada
unidade sugerida = m
valorUnitario = informado manualmente
```

A consultora pode definir o preço comercial por metro.

### 7.4 Mão de obra

Quando `Mão de obra` for utilizada:

``` text
quantidade sugerida = quantidadeTecido
unidade sugerida = m
valorUnitario padrão = R$ 30,00
```

O valor unitário pode ser alterado pela consultora.

### 7.5 Trilho e entretela

São componentes financeiros sugeridos.

Quantidade, unidade e valor são informados manualmente no MVP.

### 7.6 Adicionais gerais

Começam vazios.

Quando presentes, devem respeitar:

``` text
quantidade > 0
valorUnitario > 0
total calculável > 0
```

Não são detalhados no PDF comercial enviado ao cliente.

### 7.7 Desconto

Para desconto percentual:

``` text
0 < percentual <= 100
```

Para desconto em valor fixo:

``` text
0 < valorDesconto <= subtotalOrcamento
```

Quando percentual, o sistema calcula internamente o valor equivalente em
moeda.

O desconto não é itemizado no PDF comercial. O cliente visualiza apenas
o valor final.

### 7.8 Ajuste comercial global

Após os cálculos da composição financeira e do desconto, a consultora
pode ajustar manualmente o valor final apresentado ao cliente.

O objetivo é permitir adequações comerciais simples, por exemplo:

``` text
total calculado = R$ 458,87
valor final desejado = R$ 460,00
ajuste comercial = + R$ 1,13
```

O ajuste também pode ser negativo:

``` text
total calculado = R$ 462,40
valor final desejado = R$ 460,00
ajuste comercial = - R$ 2,40
```

A interface pode permitir que a consultora informe diretamente o valor
final desejado. O sistema calcula internamente a diferença correspondente
como `ajusteComercial`.

O ajuste comercial:

- é global ao orçamento;
- é opcional;
- pode ser positivo ou negativo;
- não substitui nem altera a semântica do desconto global;
- não é itemizado no PDF comercial;
- deve ficar registrado internamente para preservar a rastreabilidade da
  composição do valor final.

### 7.9 Totais

``` text
valorCortina = Σ componentesFinanceirosDaCortina

subtotalCortinas = Σ valorCortina

totalAdicionaisGerais = Σ adicionaisGerais

subtotalOrcamento =
  subtotalCortinas + totalAdicionaisGerais

totalCalculado =
  subtotalOrcamento - valorDesconto

totalOrcamento =
  totalCalculado + ajusteComercial
```

Quando não houver ajuste comercial:

``` text
ajusteComercial = 0
totalOrcamento = totalCalculado
```

Para envio:

``` text
totalOrcamento > 0
```

------------------------------------------------------------------------

## 8. Ciclo de Vida do Orçamento

### 8.1 Status persistidos

``` text
RASCUNHO
ENVIADO
CONFIRMADO
EM_PRODUCAO
CONCLUIDO
CANCELADO
```

### 8.2 Condições derivadas

`EXPIRADO` não é status persistido.

Um orçamento é apresentado como expirado quando:

``` text
status == ENVIADO
AND
dataAtual > dataValidade
```

O status armazenado permanece `ENVIADO`.

### 8.3 Fluxo principal

``` text
RASCUNHO
   ↓ Marcar como enviado
ENVIADO
   ↓ Confirmar
CONFIRMADO
   ↓ Iniciar produção
EM_PRODUCAO
   ↓ Concluir serviço
CONCLUIDO
```

Fluxos auxiliares:

``` text
RASCUNHO → CANCELADO
ENVIADO → CANCELADO
CONFIRMADO → CANCELADO

CONFIRMADO → ENVIADO
por meio de "Reabrir orçamento"
```

`EM_PRODUCAO` é o ponto de não retorno do fluxo normal.

### 8.4 RASCUNHO

Permite:

-   edição normal;
-   salvar alterações;
-   pré-visualizar o PDF comercial;
-   exclusão física;
-   cancelamento.

A prévia do PDF não altera o status.

O rascunho pode estar incompleto.

### 8.5 Gate RASCUNHO → ENVIADO

Para `Marcar como enviado`, é necessário:

-   cliente vinculado;
-   endereço de instalação preenchido (ver 2.8);
-   pelo menos uma cortina;
-   para cada cortina:
    -   ambiente preenchido;
    -   largura do vão \> 0;
    -   altura \> 0;
    -   borda \>= 0;
    -   fator de tecido \> 0;
    -   material preenchido;
    -   pelo menos um componente financeiro válido;
-   para todos os componentes presentes:
    -   quantidade \> 0;
    -   valor unitário \> 0;
    -   total calculável;
-   adicionais gerais, quando presentes, válidos;
-   desconto global, quando presente, válido;
-   ajuste comercial, quando presente, deve resultar em total final válido;
-   total final \> 0.

No primeiro envio:

``` text
dataPrimeiroEnvio = momento do envio
dataValidade sugerida = dataPrimeiroEnvio + 30 dias
```

A consultora pode alterar a data de validade antes de confirmar o envio.

`dataValidade` não é obrigatória enquanto o orçamento está em rascunho.

### 8.6 ENVIADO

Permite:

-   edição normal;
-   gerar/reemitir PDF comercial;
-   compartilhar orçamento;
-   confirmar;
-   cancelar;
-   renovar quando necessário.

Gerar ou compartilhar o PDF não muda o status.

### 8.7 EXPIRADO

Enquanto estiver expirado:

-   permanece tecnicamente `ENVIADO`;
-   aparece separadamente no dashboard e nos filtros;
-   não é contado visualmente entre os enviados válidos;
-   pode ser visualizado;
-   pode ser editado;
-   pode gerar/reemitir PDF;
-   pode ser cancelado;
-   pode ser renovado;
-   não pode ser confirmado diretamente.

Para voltar a poder ser confirmado, é necessário executar
`Renovar orçamento`.

### 8.8 Renovar orçamento

`Renovar orçamento`:

-   exige uma nova `dataValidade` futura;
-   mantém o mesmo orçamento;
-   mantém o mesmo número;
-   registra a renovação no histórico;
-   registra validade anterior e nova validade.

Renovar não cria uma nova versão formal do orçamento.

### 8.9 CONFIRMADO

A confirmação é manual.

Não é exigido:

-   assinatura;
-   comprovante;
-   upload;
-   registro do canal de confirmação.

Ao confirmar:

-   registra-se a data/hora;
-   o orçamento passa para `CONFIRMADO`;
-   edição técnica/comercial normal é bloqueada;
-   ordem de produção passa a poder ser gerada;
-   instalação passa a poder ser agendada;
-   produção pode ser iniciada.

### 8.10 Reabrir orçamento

Disponível apenas em `CONFIRMADO`.

``` text
CONFIRMADO
  ↓ Reabrir orçamento
ENVIADO
```

A ação:

-   mantém o mesmo número;
-   mantém o mesmo registro;
-   não cria versão formal;
-   registra o evento no histórico;
-   permite novamente edição técnica e comercial;
-   exige nova confirmação posteriormente;
-   mantém a `dataValidade` existente;
-   não renova automaticamente a validade.

Se a validade estiver vencida após a reabertura, o orçamento é
apresentado como `EXPIRADO` e deve ser renovado antes de uma nova
confirmação.

### 8.11 Cancelamento

Permitido em:

``` text
RASCUNHO
ENVIADO
CONFIRMADO
```

Não permitido em:

``` text
EM_PRODUCAO
CONCLUIDO
```

`motivoCancelamento` é opcional e textual.

`CANCELADO` é terminal.

Um orçamento cancelado:

-   permanece consultável;
-   não pode ser editado;
-   não pode ser renovado;
-   não pode ser confirmado;
-   não pode ser reaberto.

Uma nova negociação exige um novo orçamento.

### 8.12 EM_PRODUCAO

A transição é manual por meio de `Iniciar produção`.

Pré-condição:

``` text
status == CONFIRMADO
```

Não existe um segundo gate redundante de validação.

Se houver necessidade de corrigir dados antes da produção:

``` text
CONFIRMADO
→ Reabrir
→ ENVIADO
→ Editar
→ Confirmar novamente
→ Iniciar produção
```

Não existe rollback de `EM_PRODUCAO` para `CONFIRMADO`.

Não existe cancelamento após o início da produção no fluxo normal do
MVP.

### 8.13 CONCLUIDO

A transição é manual por meio de `Concluir serviço`.

`CONCLUIDO` significa que a execução do serviço foi encerrada. Não
significa necessariamente que houve instalação.

O cliente pode, por exemplo, receber ou retirar a cortina sem contratar
instalação e o serviço ainda assim ser concluído.

`CONCLUIDO` é terminal e imutável.

Permite apenas consultas e reemissões de documentos já aplicáveis.

Não permite:

-   editar dados técnicos;
-   editar composição financeira;
-   alterar desconto;
-   alterar endereço;
-   reabrir;
-   alterar status;
-   alterar agendamento de instalação.

------------------------------------------------------------------------

## 9. Instalação

### 9.1 Agendamento

O MVP utiliza apenas:

``` text
dataInstalacaoAgendada?
```

Não existe status próprio de instalação.

O agendamento pode ser criado, alterado ou removido em:

``` text
CONFIRMADO
EM_PRODUCAO
```

Não fica disponível em:

``` text
RASCUNHO
ENVIADO
EXPIRADO
CANCELADO
CONCLUIDO
```

Todas as alterações relevantes são registradas no histórico.

### 9.2 Conclusão com instalação futura

Se:

``` text
dataInstalacaoAgendada > agora
```

`Concluir serviço` fica bloqueado.

Se a instalação não ocorrer, a consultora deve remover o agendamento
antes de concluir.

Se:

``` text
dataInstalacaoAgendada <= agora
```

o serviço pode ser concluído.

Não existe uma confirmação separada de `instalação realizada`.

### 9.3 Instalação atrasada

Quando a data de instalação já passou e o orçamento continua em
`CONFIRMADO` ou `EM_PRODUCAO`, o dashboard deve destacar:

``` text
Instalação atrasada
```

Isso é uma condição operacional e não um novo status.

------------------------------------------------------------------------

## 10. Documentos e Compartilhamento

O sistema possui três visões distintas das informações.

### 10.1 Visão interna da consultora

Pode apresentar:

-   dados do cliente;
-   endereço de instalação;
-   dados técnicos completos;
-   cálculos;
-   componentes financeiros;
-   adicionais gerais;
-   desconto;
-   total;
-   observações internas;
-   histórico.

### 10.2 PDF comercial do cliente

O PDF utiliza template visual fixo com identidade do negócio.

Deve apresentar:

-   número do orçamento;
-   identidade do negócio;
-   nome do cliente;
-   telefone do cliente;
-   serviços por ambiente;
-   descrição da cortina, quando existente;
-   valor final consolidado;
-   data exata de validade.

Exemplo conceitual:

``` text
ORÇAMENTO Nº ORÇ-2026-001

[Identidade do negócio]

CLIENTE
Nome
Telefone

SERVIÇOS
Quarto — Cortina sob medida
Sala — Janela principal — Cortina sob medida

VALOR TOTAL DO SERVIÇO
R$ X.XXX,XX

Orçamento válido até: DD/MM/AAAA
```

Não deve apresentar:

-   CPF/CNPJ do cliente;
-   endereço cadastral do cliente;
-   endereço de instalação;
-   dimensões;
-   material/tecido;
-   quantidade de tecido;
-   borda;
-   fator de tecido;
-   componentes financeiros internos;
-   adicionais gerais itemizados;
-   desconto itemizado;
-   observações internas.

A validade é apresentada apenas como data exata. Não é necessário exibir
simultaneamente textos como `válido por 30 dias`.

Campos opcionais vazios não são renderizados.

### 10.3 Prévia do PDF

Durante `RASCUNHO`, a consultora pode visualizar uma prévia quando
houver dados suficientes para compor o documento.

A prévia não altera o status e não substitui o gate completo de envio.

### 10.4 Geração do PDF comercial

Gerar ou compartilhar o PDF não altera automaticamente o status.

`RASCUNHO → ENVIADO` acontece exclusivamente pela ação explícita
`Marcar como enviado`.

O sistema mantém apenas a versão mais recente do PDF gerado, caso o
documento seja armazenado.

Não existe versionamento de arquivos PDF no MVP.

O histórico registra a geração do documento.

### 10.5 Ordem de produção

A ordem de produção fica disponível em:

``` text
CONFIRMADO
EM_PRODUCAO
CONCLUIDO
```

Não fica disponível em:

``` text
RASCUNHO
ENVIADO
EXPIRADO
CANCELADO
```

Pode ser gerada e compartilhada sem alterar o status.

Gerar a ordem de produção não é pré-requisito para `Iniciar produção`.

### 10.6 Conteúdo da ordem de produção

A produção é realizada por costureiras terceirizadas e deve receber
apenas as informações necessárias para confeccionar a cortina.

Cabeçalho:

``` text
numeroOrcamento
```

Para cada cortina:

``` text
ambiente
descricao? 
material
larguraFinal
altura
```

Não deve incluir:

-   nome do cliente;
-   telefone;
-   CPF/CNPJ;
-   endereço;
-   endereço de instalação;
-   quantidade total de tecido;
-   valor da borda;
-   fator de tecido;
-   trilho;
-   entretela;
-   frete;
-   mão de obra;
-   componentes financeiros;
-   preços;
-   desconto;
-   dados da negociação;
-   observações internas.

### 10.7 Compartilhamento

O produto deve permitir compartilhar:

-   orçamento comercial;
-   ordem de produção.

Não existe integração específica com WhatsApp API no MVP.

A escolha técnica do mecanismo de compartilhamento pertence à
arquitetura/implementação.

------------------------------------------------------------------------

## 11. Histórico do Orçamento

O histórico registra eventos relevantes do negócio, e não cada interação
técnica da interface.

Eventos previstos:

``` text
Orçamento criado
Orçamento enviado
Orçamento editado
Orçamento confirmado
Orçamento reaberto
Orçamento renovado
Orçamento cancelado
Produção iniciada
Instalação agendada
Instalação alterada
Instalação removida
Serviço concluído
PDF comercial gerado
Ordem de produção gerada
```

Todas as transições de status devem possuir data/hora registrada.

Uma alteração de orçamento deve ser agrupada em um único evento de
edição quando fizer parte da mesma operação de salvamento.

Quando relevante, o histórico deve preservar valor anterior e novo
valor.

Exemplo:

``` text
Orçamento editado

Cortina "Sala":
altura: 2,60 m → 2,65 m
material: Linho A → Linho B

Desconto:
R$ 100,00 → R$ 150,00

Ajuste comercial:
R$ 0,00 → + R$ 1,13
```

Não geram eventos de histórico:

-   abrir uma tela;
-   visualizar uma prévia;
-   simples navegação;
-   alterações cadastrais do cliente.

O histórico não é event sourcing.

------------------------------------------------------------------------

## 12. Dashboard e Consultas

### 12.1 Dashboard operacional

O dashboard do MVP é operacional, não uma ferramenta avançada de BI.

Deve apresentar visão do funil baseada nos próprios orçamentos.

Estados/condições relevantes:

``` text
RASCUNHO
ENVIADO
EXPIRADO
CONFIRMADO
EM_PRODUCAO
CONCLUIDO
CANCELADO
```

Cards principais podem destacar:

``` text
RASCUNHO
ENVIADO
CONFIRMADO
EM_PRODUCAO
```

`EXPIRADO` deve aparecer separadamente de `ENVIADO`.

Um orçamento expirado não deve ser contado visualmente como enviado
válido.

O dashboard também deve destacar:

-   próximas instalações;
-   instalações da semana;
-   instalações atrasadas.

Cards e estágios podem funcionar como atalhos/filtros para as
respectivas listas.

### 12.2 Busca de orçamentos

Busca necessária no MVP:

``` text
nome do cliente
numeroOrcamento
```

### 12.3 Filtros

Filtros de situação:

``` text
RASCUNHO
ENVIADO
EXPIRADO
CONFIRMADO
EM_PRODUCAO
CONCLUIDO
CANCELADO
```

Filtros avançados por material, cidade, valor ou outros critérios ficam
fora do escopo inicial.

### 12.4 Histórico do cliente

A página do cliente deve listar seus orçamentos/serviços com informações
suficientes para navegação, como:

-   número;
-   data;
-   situação;
-   valor final.

Não existe entidade separada para esse histórico.

------------------------------------------------------------------------

## 13. Autenticação e Acesso

O MVP possui apenas uma conta de acesso: a consultora responsável pelo
negócio.

Requisitos:

-   login com e-mail e senha;
-   logout;
-   acesso às funcionalidades apenas após autenticação;
-   não existe cadastro público;
-   não existe gestão de usuários;
-   não existe RBAC;
-   recuperação e alteração de senha ficam fora do escopo inicial.

A estratégia técnica de autenticação, sessão, tokens e cookies será
definida na arquitetura.

------------------------------------------------------------------------

## 14. Requisitos Não Funcionais

### 14.1 Usabilidade

-   Interface mobile-first.
-   Responsiva e adequada para uso por toque.
-   Formulários adequados ao uso durante atendimento.
-   Feedback claro de sucesso e erro.
-   Confirmação antes de ações destrutivas ou irreversíveis.
-   Valores padrão devem reduzir digitação sem impedir edição quando a
    regra permitir.

### 14.2 Integridade

-   Regras de negócio devem ser validadas no backend.
-   Transições de estado inválidas devem ser rejeitadas.
-   Dados derivados devem ser calculados de forma consistente.
-   A numeração comercial deve ser única.
-   Registros históricos não devem ser silenciosamente alterados por
    mudanças posteriores no cadastro do cliente.

### 14.3 Segurança e privacidade

-   Funcionalidades privadas exigem autenticação.
-   Senhas não podem ser armazenadas em texto puro.
-   A ordem de produção não deve expor dados pessoais do cliente.
-   A ordem de produção não deve expor informações financeiras.
-   O sistema não armazena dados de pagamento no MVP.
-   Clientes utilizam soft delete conforme regra funcional definida
    neste documento.
-   Requisitos adicionais de segurança e decisões técnicas serão
    detalhados na arquitetura.

### 14.4 Confiabilidade

-   Eventos relevantes do ciclo do orçamento devem ser preservados no
    histórico.
-   A infraestrutura de produção deve possuir estratégia de backup
    adequada.
-   Falhas devem produzir mensagens compreensíveis para a consultora sem
    corromper o estado do orçamento.

### 14.5 Performance

O sistema deve oferecer resposta adequada ao uso interativo em
dispositivos móveis e desktop.

Metas específicas de performance e estratégia de medição devem ser
definidas durante a implementação, evitando transformar valores
arbitrários não validados em requisitos rígidos do produto.

------------------------------------------------------------------------

## 15. Regras de Edição e Imutabilidade

Resumo:

``` text
RASCUNHO
- edição normal
- pode excluir
- pode cancelar
- pode visualizar prévia

ENVIADO
- edição normal
- pode renovar
- pode confirmar
- pode cancelar
- pode gerar/compartilhar PDF

EXPIRADO (condição de ENVIADO)
- edição normal
- pode renovar
- pode cancelar
- não pode confirmar sem renovar

CONFIRMADO
- edição técnica/comercial bloqueada
- pode reabrir
- pode cancelar
- pode gerar ordem de produção
- pode agendar instalação
- pode iniciar produção

EM_PRODUCAO
- edição técnica/comercial bloqueada
- não pode cancelar
- não pode reabrir
- pode gerenciar instalação
- pode reemitir ordem de produção
- pode concluir quando regras de instalação permitirem

CONCLUIDO
- terminal
- imutável
- documentos aplicáveis podem ser consultados/reemitidos

CANCELADO
- terminal
- imutável
```

------------------------------------------------------------------------

## 16. Decisões Deliberadamente Deixadas para ARCHITECTURE.md

Este documento define comportamento do produto e regras de negócio.

Não fixa:

-   limites de agregados DDD;
-   entidades versus value objects;
-   organização dos módulos NestJS;
-   estrutura de pastas;
-   repositories;
-   use cases/application services;
-   estratégia Prisma;
-   schema físico do banco;
-   persistência ou derivação das datas do ciclo;
-   estratégia concorrente da numeração anual;
-   representação de valores monetários/decimais;
-   estratégia de autenticação e sessão;
-   formato dos endpoints REST;
-   mecanismo técnico de compartilhamento;
-   biblioteca de geração de PDF;
-   armazenamento dos PDFs;
-   estratégia de testes;
-   estrutura React;
-   gerenciamento de estado do frontend;
-   infraestrutura e deployment.

Essas decisões devem ser tratadas em `ARCHITECTURE.md`.

------------------------------------------------------------------------

## 17. Critérios Funcionais de Pronto do MVP

O MVP funcional deve permitir que a consultora complete o seguinte
fluxo:

``` text
Cadastrar/localizar cliente
→ abrir cliente
→ Novo orçamento
→ preencher e salvar rascunho
→ adicionar cortinas
→ calcular medidas
→ configurar composição financeira
→ informar endereço de instalação
→ visualizar prévia
→ marcar como enviado
→ gerar/compartilhar PDF comercial
→ registrar confirmação
→ gerar/compartilhar ordem de produção
→ iniciar produção
→ opcionalmente agendar instalação
→ concluir serviço
→ consultar histórico posteriormente
```

Além disso:

-   as regras de cálculo devem estar corretas;
-   o gate de envio deve impedir orçamento comercial inválido;
-   transições inválidas devem ser bloqueadas;
-   dados pessoais/financeiros não devem vazar para a ordem de produção;
-   estados terminais devem permanecer imutáveis;
-   histórico deve registrar os eventos de negócio definidos;
-   dashboard deve refletir corretamente enviados, expirados e
    instalações atrasadas;
-   interface deve funcionar adequadamente em mobile e desktop.

------------------------------------------------------------------------

## 18. Fluxo Consolidado

``` text
CLIENTE
  ↓
[Novo orçamento]
  ↓
Formulário ainda não persistido
  ↓
[Salvar rascunho]
  ↓
RASCUNHO
  │
  ├── editar
  ├── visualizar prévia
  ├── excluir
  ├── cancelar → CANCELADO
  │
  ↓
[Marcar como enviado]
  │
  ├── validar gate completo
  ├── registrar primeiro envio
  └── definir validade
  ↓
ENVIADO
  │
  ├── validade vencida
  │       ↓
  │    EXPIRADO
  │       │
  │       └── [Renovar] → ENVIADO
  │
  ├── cancelar → CANCELADO
  │
  ↓
[Confirmar]
  ↓
CONFIRMADO
  │
  ├── gerar/compartilhar ordem de produção
  ├── agendar instalação
  ├── reabrir → ENVIADO
  ├── cancelar → CANCELADO
  │
  ↓
[Iniciar produção]
  ↓
EM_PRODUCAO
  │
  ├── gerenciar instalação
  ├── reemitir ordem de produção
  │
  ↓
[Concluir serviço]
  ↓
CONCLUIDO
```

`CANCELADO` e `CONCLUIDO` são estados terminais.

`EM_PRODUCAO` é o ponto de não retorno do fluxo normal.

`EXPIRADO` e `Instalação atrasada` são condições derivadas, não novos
estados persistidos.

A geração de documentos não provoca transições automáticas de estado.

------------------------------------------------------------------------

**Status da especificação:** requisitos funcionais do MVP validados e
consolidados.

**Próximo documento a validar:** `ARCHITECTURE.md`.
