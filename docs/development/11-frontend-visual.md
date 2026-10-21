# Fase 11 — Direção visual, identidade e tokens da Cortinando

**Documento:** `docs/development/11-frontend-visual.md`
**Fase:** 11 — Frontend
**Task:** FRONTEND-02B — Consolidar direção visual, identidade e tokens da Cortinando
**Data:** 2026-10-20
**Status:** VALIDADA — direção visual aprovada
**Validação humana:** 2026-10-20 — UI-01 a UI-04 aprovadas; `UI abertas = 0`
**Escopo desta rodada:** análise e documentação. Nenhum código, configuração, asset ou dependência foi alterado.

---

## 1. Objetivo

Consolidar a direção visual do ERP da Cortinando antes da implementação da Fase 11, estabelecendo:

- a identidade visual que prevalece sobre qualquer referência externa;
- a paleta de marca e a escala funcional mínima;
- a tipografia, o espaçamento, os raios e a estratégia de bordas/elevação;
- a direção do shell, do dashboard, dos formulários e dos componentes operacionais;
- os tokens conceituais que orientarão a implementação;
- as decisões visuais que ainda dependem de validação humana.

Este documento **não implementa** nada. Ele não cria CSS, configuração Tailwind, tokens em TypeScript, fontes, componentes, mockups, screenshots, favicon ou qualquer alteração no PDF. Também não altera `frontend/`, `backend/`, `package.json`, lockfiles, imagens, testes, configurações ou `docs/IMPLEMENTATION_PLAN.md`.

A direção aqui registrada é subordinada às fontes de verdade do projeto:

1. `docs/PROJECT_SPEC.md` — comportamento do produto;
2. `docs/ARCHITECTURE.md` — fronteiras e decisões técnicas;
3. decisões aprovadas em `docs/development/11-frontend.md` (D260–D333);
4. contratos HTTP já implementados;
5. este documento, para a camada visual.

Em caso de conflito, prevalece a fonte de maior prioridade. Este documento não altera D260–D333 e não introduz regra de negócio.

As decisões visuais UI-01 a UI-04 foram aprovadas em 2026-10-20. A direção visual da Fase 11 está validada e não há decisão visual aberta:

```text
UI abertas = 0
```

---

## 2. Fontes visuais

### 2.1 Inventário

| Fonte | Natureza | Uso neste documento |
|---|---|---|
| `LOGOMARCA_PNG.png` | Logo principal fornecida, lockup vertical empilhado | Referência primária de marca, símbolo, wordmark e cores |
| `IDENTIDADE VISUAL DANIEL_FRENTE.jpg` | Versão da mesma marca sobre fundo navy | Referência da versão alternativa/inversa e medição do navy |
| `www.pierrefrey.com-DESIGN.md` | Referência estética externa | Inspiração de composição, tipografia, espaço, hierarquia, geometria e sensação premium |
| Instagram público da Cortinando | Contexto de marca e posicionamento | Contexto de linguagem e percepção; não é fonte técnica nem de layout |
| `docs/PROJECT_SPEC.md` | Fonte de verdade do produto | Restrições funcionais e de experiência |
| `docs/ARCHITECTURE.md` | Fonte de verdade técnica | Fronteiras e decisões de frontend |
| `docs/development/11-frontend-audit.md` | Auditoria da Fase 11 | Estado atual, contratos e lacunas |
| `docs/development/11-frontend.md` | Especificação aprovada da Fase 11 | Decisões D260–D333, escopo e critérios |

### 2.2 Método de verificação das cores

As cores de marca foram medidas diretamente nos arquivos fornecidos, por amostragem de cor dominante, e não foram copiadas de terceiros.

- Navy medido: `#203864`.
- Laranja medido: `#EC7C30`.
- O briefing cita `#ED7D31` de forma aproximada; a diferença é de cerca de uma unidade por canal e não é perceptível em uso. Este documento adota os valores medidos como canônicos até que exista um manual de marca oficial com valores de impressão (Pantone/CMYK) ou digitais formais.
- Não há informação de Pantone, CMYK ou variações oficiais. Nada foi inferido além do que os arquivos mostram.

### 2.3 O que foi observado na logo

- O arquivo `LOGOMARCA_PNG.png` contém um **lockup vertical empilhado**: símbolo de janela/cortina, wordmark “CORTINANDO” e tagline “Cortinas Personalizadas”, em laranja sobre fundo transparente/claro.
- O arquivo `IDENTIDADE VISUAL DANIEL_FRENTE.jpg` contém o mesmo lockup em laranja sobre fundo navy `#203864`.
- **Não foi fornecido** um lockup horizontal completo nem um arquivo isolado apenas do símbolo.
- O briefing menciona “logo horizontal completa”; neste documento, essa expressão designa a assinatura completa disponível (lockup empilhado), e a ausência de uma versão horizontal oficial fica registrada como pendência de asset na seção 11.

### 2.4 Referência Pierre Frey

O design de Pierre Frey serve como referência estética para linguagem premium, editorial, espaçamento, geometria e tipografia. Não é fonte de identidade visual da Cortinando e não deve ser copiado literalmente.

A referência é usada apenas para:

- generosidade de espaço em branco;
- hierarquia tipográfica com contraste entre serifada e sem serifa;
- composição calma, editorial e assimétrica quando fizer sentido;
- geometria contida e ausência de ruído visual;
- sensação de sofisticação discreta.

A referência **não** é usada para:

- copiar a paleta (o `design.md` usa `#2D2D2D`, `#FFFFFF`, `#F9F7F6` e `#A09A94`; a Cortinando usa navy e laranja);
- copiar textos, marca, layout ou composição institucional;
- impor raio zero em todos os elementos;
- impor peso 300 em toda a interface;
- eliminar cores semânticas;
- introduzir fotografia decorativa nas telas operacionais.

### 2.5 Instagram

O Instagram público é considerado apenas como contexto de posicionamento: cortinas sob medida, consultoria, atendimento próximo e estética cuidadosa. Ele não é fonte de componentes, medidas, cores ou layout. Nenhuma imagem da rede social será incorporada ao ERP nesta fase.

---

## 3. Identidade da Cortinando

### 3.1 O que a marca é

A Cortinando trabalha com cortinas personalizadas, sob medida, com consultoria e atendimento próximo. O ERP é a ferramenta de trabalho de quem atende, orça, confirma e acompanha a instalação. A interface deve transmitir a mesma qualidade do produto, sem transformar a operação em uma peça publicitária.

Atributos desejados:

- **premium** — cuidado com proporção, espaço e acabamento;
- **moderna** — linguagem limpa, sem nostalgia decorativa;
- **sóbria** — sem excesso de cor, brilho ou movimento;
- **refinada** — detalhes discretos, tipografia bem hierarquizada;
- **confiável** — previsível, legível, com estados claros;
- **calma** — superfícies tranquilas, sem competição visual;
- **profissional** — ferramenta de trabalho, não vitrine.

### 3.2 Como isso se traduz visualmente

- Muito espaço em branco e ritmo consistente.
- Navy como estrutura: navegação, títulos-chave, ações principais e estados ativos.
- Laranja como assinatura: pontual, ligado à marca, nunca como cor padrão de tudo.
- Superfícies off-white e brancas, com bordas finas e sombra quase ausente.
- Tipografia com contraste serifada/sem serifa, mas com a serifada restrita a títulos.
- Geometria reta ou levemente arredondada, com aparência arquitetônica.
- Ícones lineares, discretos, funcionais.

### 3.3 O que evitar

- Aparência genérica de SaaS: gradientes, cards flutuantes, sombras pesadas, ilustrações aleatórias.
- Excesso de cards e de caixas dentro de caixas.
- Cores vibrantes concorrendo com a marca.
- Laranja em toda ação primária, em todo alerta ou como decoração de fundo.
- Estética infantil: cantos muito arredondados, ícones lúdicos, animações chamativas.
- Estética corporativa/tecnológica demais: azul elétrico, gráficos densos, linguagem de “dashboard financeiro”.
- Fotografia decorativa nas telas internas.
- Efeitos de vidro, blur, neon ou parallax.

---

## 4. Princípios de design

1. **A identidade da Cortinando prevalece.** Nenhuma referência externa substitui a marca, a paleta ou o posicionamento da Cortinando.
2. **Premium é calma, não ornamento.** Sofisticação vem de proporção, espaço, tipografia e precisão — não de efeitos.
3. **Navy estrutura; laranja assina.** O navy organiza a interface. O laranja aparece como acento de marca, não como cor funcional universal.
4. **Bordas e superfícies antes de sombras.** Cartões são planos; sombra é exceção para overlays.
5. **Legibilidade operacional primeiro.** Nenhuma escolha estética pode reduzir clareza, contraste ou velocidade de uso.
6. **Mobile-first de verdade.** A experiência principal acontece no celular, durante o atendimento; o desktop é uma ampliação confortável.
7. **Restrição cromática.** Poucas cores, bem usadas. Cores semânticas são discretas e nunca competem com a marca.
8. **Consistência por tokens.** Medidas, cores e tipografia vêm de um conjunto mínimo e reutilizável.
9. **Acessibilidade não é negociável.** Contraste AA, foco visível, alvos de toque e rótulos explícitos fazem parte do acabamento premium.
10. **Nada de cópia literal.** A referência Pierre Frey inspira linguagem; não define paleta, layout, textos ou marca.

---

## 5. Paleta

### 5.1 Cores de marca

| Token | Hex | Papel | Observações |
|---|---|---|---|
| `colors.brand.navy` | `#203864` | Estrutura, navegação, títulos-chave, ação primária, estados ativos | Cor de maior autoridade visual; não usar como fundo de todas as telas |
| `colors.brand.orange` | `#EC7C30` | Assinatura da marca, acento comercial pontual | Não é cor padrão de ação primária; não é warning/error automático |
| `colors.brand.navy-tint` | `#E9EDF3` | Fundos de estado ativo, badges informativos, realce sutil | Derivado funcional do navy |
| `colors.brand.orange-tint` | `#FBEEE5` | Fundo de destaque comercial pontual, badge “Em produção” | Derivado funcional do laranja |

O laranja `#EC7C30` é a cor da marca. Ele não deve ser alterado para “ficar mais vivo” ou “mais acessível”. A acessibilidade se resolve com contraste e com texto adequado, não mudando a marca.

### 5.2 Escala funcional mínima

| Token | Hex | Papel | Contraste |
|---|---|---|---|
| `colors.surface.canvas` | `#F9F7F6` | Fundo geral das telas; off-white quente | Base da maior parte da interface |
| `colors.surface.primary` | `#FFFFFF` | Formulários, cartões, modais, áreas de leitura | Superfície de conteúdo |
| `colors.surface.alt` | `#F2EEEA` | Blocos secundários, cabeçalhos de tabela, estados neutros | Separação sem sombra |
| `colors.text.primary` | `#1E2433` | Texto principal | 14,51:1 sobre `canvas` |
| `colors.text.secondary` | `#5F6470` | Texto secundário, labels auxiliares, metadados | 5,55:1 sobre `canvas` |
| `colors.text.inverse` | `#FFFFFF` | Texto sobre navy | 11,60:1 sobre navy |
| `colors.text.on-orange` | `#1E2433` | Texto sobre preenchimento laranja | 5,53:1 sobre laranja |
| `colors.border.default` | `#E3DEDA` | Divisórias decorativas, contorno de cards | 1,34:1 sobre branco; apenas separação visual |
| `colors.border.strong` | `#C9C3BD` | Bordas de menor ênfase em superfícies alternativas | 1,75:1 sobre branco; não usar como única borda de controle |
| `colors.border.control` | `#8A8782` | Contorno de inputs e controles interativos | 3,58:1 sobre branco; 3,35:1 sobre canvas |
| `colors.focus.ring` | `#203864` | Anel de foco em superfícies claras | 2 px de anel + 2 px de offset |
| `colors.focus.ring-inverse` | `#F9F7F6` | Anel de foco sobre navy | 2 px de anel + 2 px de offset |

O off-white `#F9F7F6` é uma **proposta funcional**, não uma cor original de marca. Ele foi escolhido por ser quente, discreto e compatível com o navy e o laranja. Não deve ser tratado como “a cor da Cortinando”.

### 5.3 Regras de uso

**Navy**

- Navegação e estrutura do shell.
- Títulos de página e títulos de seção quando precisarem de peso institucional.
- Ação primária padrão.
- Estados ativos e selecionados.
- Ícones de navegação e de ações principais.
- Nunca como fundo de conteúdo longo; grandes áreas navy cansam e reduzem a sensação de leveza.

**Laranja**

- Assinatura da marca: símbolo, pequenos acentos, detalhe de destaque.
- Ações comerciais específicas, quando o contexto pedir destaque (por exemplo, uma ação ligada a confirmação comercial), desde que com texto escuro e contraste adequado.
- Não usar em todos os botões primários.
- Não usar como warning, error ou “atenção” automática.
- Não usar como fundo de grandes áreas, cabeçalhos ou sidebars inteiras.
- Não usar texto laranja sobre branco em corpo de texto: 2,80:1 reprova em AA para texto normal.

**Off-white e branco**

- `canvas` off-white para o fundo geral.
- `surface.primary` branco para cartões, formulários, modais e áreas de leitura.
- `surface.alt` para blocos secundários e cabeçalhos de tabela.
- Evitar branco puro em toda a tela; o off-white dá calma e profundidade sem sombra.

**Preto e cinzas**

- Não usar preto puro em texto longo; `#1E2433` é mais confortável e mantém a temperatura da marca.
- Cinzas devem ser neutros-quentes, não azulados, para não competir com o navy.

### 5.4 Contraste — decisões decorrentes

- **Laranja com texto branco reprova** (2,80:1). Preenchimentos laranja usam texto `#1E2433` (5,53:1).
- **Navy com branco passa com folga** (11,60:1). É a base da ação primária.
- **Texto secundário passa AA** sobre canvas (5,55:1) e sobre branco (5,93:1).
- **Bordas de controle** usam `#8A8782` para atender ao contraste não textual de 3:1. `border.default` é só separação decorativa.
- A logo e a tagline são tratadas como marca (exceção de logotipo da WCAG); ainda assim, não usar a tagline como texto de interface.

### 5.5 O que não criar

- Gradientes de marca.
- Paletas extensas de 50–900 para navy e laranja.
- Cores de marca “clareadas” para virar fundo de seção.
- Sombras coloridas.
- Neon, glow ou transparências chamativas.

---

## 6. Cores semânticas

### 6.1 Camada mínima

| Token | Texto | Fundo | Borda | Contraste texto/fundo |
|---|---|---|---|---|
| `colors.semantic.success` | `#2F6B4F` | `#EAF2ED` | `#C9DED2` | 5,52:1 |
| `colors.semantic.warning` | `#8A5A12` | `#F7EFE2` | `#E6D3B3` | 5,18:1 |
| `colors.semantic.error` | `#A23B36` | `#F7E9E7` | `#E6C7C3` | 5,53:1 |
| `colors.semantic.info` | `#3C6E8F` | `#EAF0F4` | `#C9DAE4` | 4,78:1 |

Também são necessários os pares de texto sobre fundo claro para mensagens isoladas:

- `success` sobre `#FFFFFF` — 6,53:1;
- `warning` sobre `#FFFFFF` — 6,11:1;
- `error` sobre `#FFFFFF` — 6,53:1;
- `info` sobre `#FFFFFF` — 5,65:1.

### 6.2 Regras

- Usar com parcimônia: a maior parte da interface é navy, neutros e laranja de marca.
- Cores semânticas **nunca** são o único sinal. Sempre acompanhar de ícone, texto ou rótulo.
- Não usar laranja como warning automático. O warning tem cor própria, mais terrosa e escura.
- Não usar vermelho vivo. O error é sóbrio, consistente com a paleta.
- Não usar verde/vermelho em pares “semáforo” para status de negócio; a leitura precisa funcionar para daltonismo.
- Não preencher grandes áreas com cor semântica. Em geral: fundo tingido + borda sutil + texto escuro.
- Em telas operacionais, o estado deve ser legível pelo rótulo antes da cor.

---

## 7. Tipografia

### 7.1 Famílias

| Token | Família | Uso |
|---|---|---|
| `font.family.sans` | Montserrat | Interface inteira: navegação, corpo, labels, botões, tabelas, dados, mensagens |
| `font.family.display` | Playfair Display | Apenas títulos de página e grandes títulos editoriais |

Fallbacks conceituais, caso a fonte não carregue:

- sans: `Montserrat, system-ui, -apple-system, "Segoe UI", sans-serif`;
- display: `"Playfair Display", Georgia, "Times New Roman", serif`.

As fontes ainda **não** foram adicionadas ao projeto. A forma de carregamento (self-hosted ou serviço externo) será decidida na implementação, considerando desempenho, privacidade e disponibilidade offline.

### 7.2 Escala

| Token | Tamanho | Peso | Line-height | Uso |
|---|---|---|---|---|
| `font.size.display` | 36–40 px desktop; 30–34 px mobile | 400 | 1,10 | Título editorial de página, quando houver |
| `font.size.page-title` | 28–32 px desktop; 24–26 px mobile | 400/500 | 1,20 | Título principal de cada tela |
| `font.size.section-title` | 18–20 px | 600 | 1,30 | Títulos de seção de formulário, blocos e listas |
| `font.size.body` | 15–16 px | 400 | 1,55 | Corpo, textos de apoio, descrições |
| `font.size.label` | 13 px | 500/600 | 1,40 | Labels de campo, cabeçalhos de tabela, navegação |
| `font.size.caption` | 12 px | 400/500 | 1,40 | Metadados, ajuda, notas auxiliares |
| `font.size.button` | 14 px | 600 | 1,20 | Rótulos de botão |
| `font.size.numeric` | 16–32 px conforme contexto | 500/600 | 1,10 | Números de dashboard, totais monetários, quantidades |

### 7.3 Pesos

- **400** — corpo, descrições, textos longos, células de tabela.
- **500** — labels, navegação, destaques discretos, números intermediários.
- **600** — botões, títulos de seção, títulos de página quando não usarem Playfair, números de destaque.
- **Evitar 300** na interface operacional. O peso 300 do `design.md` funciona em títulos editoriais grandes; em telas de ERP, reduz legibilidade, especialmente no celular e sob luz ruim.
- Não usar 700/800 como padrão. Se um número precisar de mais peso, aumentar tamanho ou usar 600 antes de subir para 700.

### 7.4 Playfair Display — limites

Usar apenas em:

- título principal de página;
- título de bloco editorial/institucional;
- eventual número de destaque muito grande, se a legibilidade se mantiver.

Nunca usar em:

- inputs, selects, textareas;
- botões;
- tabelas e células;
- labels;
- badges e status;
- mensagens de erro/sucesso;
- textos longos;
- números financeiros pequenos;
- navegação.

Playfair é uma serifada de contraste alto; em tamanhos pequenos e em telas móveis ela perde legibilidade. A decisão UI-01 `[A]` aprovou o uso restrito descrito acima; qualquer redução ou remoção futura exigirá nova decisão.

### 7.5 Números e dados

- Aplicar `font-variant-numeric: tabular-nums` em tabelas, totais, quantidades e datas.
- Alinhar números à direita em tabelas financeiras; labels à esquerda.
- Não usar Playfair para valores monetários.
- Formatar moeda e datas conforme D325/D326 e os contratos do backend; a camada visual não recalcula nada (D303-B).

### 7.6 Regras gerais

- Não usar caixa alta em textos longos. Caixa alta é aceitável em labels curtos de navegação ou cabeçalhos de tabela, com `letter-spacing` discreto.
- Não usar itálico em UI.
- Não usar sublinhado como decoração; apenas em links.
- Evitar mais de três tamanhos tipográficos na mesma seção.
- Texto de input no mobile deve ter pelo menos 16 px para evitar zoom automático no iOS.

---

## 8. Spacing

### 8.1 Escala

Base de 4 px. A escala é intencionalmente curta.

| Token | Valor |
|---|---|
| `spacing.1` | 4 px |
| `spacing.2` | 8 px |
| `spacing.3` | 12 px |
| `spacing.4` | 16 px |
| `spacing.5` | 20 px |
| `spacing.6` | 24 px |
| `spacing.8` | 32 px |
| `spacing.10` | 40 px |
| `spacing.12` | 48 px |
| `spacing.16` | 64 px |

### 8.2 Uso

- **4–8 px** — relação ícone/texto, espaçamento interno de badges, ajustes finos.
- **12–16 px** — padding interno de inputs, distância entre label e campo, itens de lista compactos.
- **16–24 px** — padding de cartões, separação entre campos, grupos de formulário.
- **24–32 px** — separação entre seções, respiro ao redor de blocos.
- **40–64 px** — respiro de página, separação de grandes blocos, cabeçalhos editoriais.

### 8.3 Layout

- Gutters mobile: 16 px.
- Gutters desktop: 24–32 px.
- Largura máxima de conteúdo: 1240 px.
- Largura máxima de formulário: 760 px.
- Sidebar desktop: 248 px (faixa 240–264 px).
- Header desktop: 64 px.
- Bottom nav mobile: 56 px + safe area.
- Altura mínima de alvo de toque: 44 × 44 px.
- Espaço mínimo entre alvos de toque: 8 px.

### 8.4 Ritmo

- Preferir espaçamento generoso a densidade excessiva.
- No mobile, não desperdiçar viewport: o respiro é vertical e controlado, não padding gigante em todas as direções.
- Em formulários longos, agrupar campos por seção e usar separadores; não empilhar tudo com o mesmo espaçamento.
- Em listas, usar separadores e espaçamento constante; evitar “cards dentro de cards”.

---

## 9. Radius

### 9.1 Escala

| Token | Valor | Uso |
|---|---|---|
| `radius.none` | 0 px | Divisórias, bordas de seção, elementos arquitetônicos |
| `radius.sm` | 4 px | Botões, inputs, selects, textareas, badges |
| `radius.md` | 6 px | Cards, modais, menus flutuantes, blocos de conteúdo |

### 9.2 Regras

- A interface é predominantemente reta. O raio é um detalhe, não uma personalidade.
- Botões e inputs: 4 px.
- Cards: 4–6 px. Preferir 6 px em blocos maiores e 4 px em blocos compactos.
- Badges: 4 px. **Não** usar pill (`9999px`) como padrão.
- Modais e menus: 6 px.
- Não usar 12, 16, 24 px ou “full” em componentes operacionais.
- Não arredondar tudo com o mesmo valor; a escala deve refletir hierarquia.
- Não usar cantos arredondados para “suavizar” uma interface que precisa ser precisa.

A decisão UI-02 `[A]` aprovou a alternativa B: escala 0/4/6 px, com 4 px em botões e inputs e até 6 px em cards e superfícies. Elementos editoriais podem permanecer retos; pill não é linguagem padrão; arredondamentos de 12–24 px não são adotados.

---

## 10. Borders e elevação

### 10.1 Estratégia

A separação visual vem, em ordem de preferência:

1. contraste de superfície (canvas off-white × card branco);
2. borda de 1 px;
3. espaçamento;
4. sombra — apenas quando o elemento flutua de verdade.

Cartões normais são planos. Não usar sombra para “destacar” um card no fluxo.

### 10.2 Bordas

- Padrão: 1 px.
- `border.default` (`#E3DEDA`) para divisórias decorativas e contorno de cards.
- `border.control` (`#8A8782`) para inputs e controles interativos, garantindo 3:1.
- `border.strong` (`#C9C3BD`) para separadores em superfícies alternativas.
- Não usar bordas duplas, tracejadas ou coloridas como decoração.
- Não usar borda + sombra no mesmo card.

### 10.3 Sombra

| Token | Valor | Uso |
|---|---|---|
| `shadow.overlay` | `0 12px 32px rgba(20, 28, 45, 0.16)` | Modais, overlays, menus flutuantes, toasts |

Regras:

- Sombra só em elementos que realmente sobrepõem conteúdo.
- Não usar sombra em cards, tabelas, inputs, botões ou headers.
- Não usar sombras pesadas, difusas demais ou coloridas.
- Em mobile, modais em tela cheia não precisam de sombra.

### 10.4 Foco

- Anel de 2 px em `colors.focus.ring`, com offset de 2 px.
- Sobre navy, usar `colors.focus.ring-inverse`.
- O foco deve ser visível em todos os elementos interativos, inclusive links, checkboxes, radios e itens de navegação.
- Não remover o outline sem substituí-lo por um anel equivalente.

---

## 11. Logo

### 11.1 Ativos disponíveis

| Ativo | Conteúdo | Uso |
|---|---|---|
| `LOGOMARCA_PNG.png` | Lockup empilhado laranja sobre transparente/claro | Assinatura principal em fundos claros |
| `IDENTIDADE VISUAL DANIEL_FRENTE.jpg` | Lockup laranja sobre navy | Versão inversa/alternativa em fundo navy |

### 11.2 Usos

- **Login e telas institucionais:** lockup completo. Em desktop, pode ser usado no painel navy do login; em mobile, acima do formulário.
- **Header desktop:** lockup completo na sidebar, no topo. Não repetir a logo no header de conteúdo.
- **Sidebar compacta / mobile:** símbolo isolado somente quando existir asset oficial. Enquanto não houver, usar ícone funcional de navegação; não recortar o lockup nem tentar simular a marca.
- **Fundo navy:** usar a versão fornecida ou, preferencialmente, um arquivo oficial com transparência. Não recolorir a logo para “combinar”.
- **Favicon:** símbolo isolado, em versão oficial. Não criar a partir de recorte caseiro. A alteração de favicon não faz parte desta rodada.

### 11.3 Espaço de respiro e tamanho mínimo

- Manter ao redor da logo um espaço livre equivalente à altura do símbolo.
- Tamanho mínimo do lockup completo: 120 px de largura em tela. Abaixo disso, usar o símbolo isolado somente quando houver asset oficial; caso contrário, não aplicar a logo em espaço tão compacto.
- Não posicionar a logo sobre fundo de baixo contraste, imagem ou padrão.
- Não competir com a logo: evitar títulos, badges ou botões laranja imediatamente ao lado.

### 11.4 Pendências de asset

- **Não existe lockup horizontal oficial.** O briefing menciona “logo horizontal completa”, mas o arquivo fornecido é vertical empilhado. Este documento usa o lockup empilhado como assinatura completa disponível.
- **Não existe símbolo isolado oficial.** Para sidebar compacta, mobile nav e favicon, será necessário solicitar o arquivo oficial. Até lá, a navegação compacta usa ícone funcional e não recorta o lockup.
- **Não existe versão inversa com transparência** para aplicar sobre qualquer fundo navy; o JPG fornecido tem fundo navy fixo.
- Não recortar, redesenhar, distorcer, recolorir ou “recriar” a logo para suprir essas lacunas.

### 11.5 Don'ts

- Não alterar proporções.
- Não alterar cores.
- Não adicionar sombra, contorno, gradiente ou efeito.
- Não rotacionar, inclinar ou aplicar perspectiva.
- Não separar símbolo e wordmark de forma não prevista.
- Não usar a tagline como texto de interface.
- Não usar a logo como marca d'água em telas operacionais.

---

## 12. Shell

### 12.1 Direção geral

O shell deve sumir quando o usuário está trabalhando. A identidade aparece no ponto de entrada e na navegação; o conteúdo domina.

- Fundo geral: `surface.canvas`.
- Sidebar/header: `surface.primary` com borda `border.default`.
- Estados ativos: navy.
- Sem fundo totalmente escuro nas telas internas.
- Sem excesso de branding repetido.
- Sem sidebar pesada, com muitos ícones e rótulos competindo.

### 12.2 Mobile

- **Bottom navigation** fixa, com 4 itens: Dashboard, Orçamentos, Clientes e, se necessário, “Mais”/Perfil.
- Altura: 56 px + safe area.
- Ícones lineares de 22–24 px; labels de 11–12 px.
- Item ativo: ícone preenchido ou traço mais forte + label navy + indicador superior de 2 px. Não usar laranja como único sinal de ativo.
- Itens inativos: `text.secondary`.
- Superfície: branca ou off-white, com borda superior de 1 px.
- Marca no header mobile apenas com asset oficial; até lá, priorizar o título da página e não recortar o lockup para simular a marca.
- Header mobile: 56–64 px, título da página, ação principal quando fizer sentido, acesso a perfil/“sair” em menu.
- Evitar dois níveis de navegação simultâneos.
- O conteúdo deve ter padding inferior suficiente para não ficar sob a bottom nav.

### 12.3 Desktop

- **Sidebar** à esquerda, 248 px, clara.
- Topo da sidebar: lockup completo em tamanho moderado.
- Itens de navegação: 44 px de altura, ícone + label, 12–16 px de padding horizontal.
- Item ativo: fundo `navy-tint`, texto navy, barra de 3 px à esquerda. O laranja não é necessário aqui.
- Item hover: fundo `surface.alt`, sem mudança de cor de texto.
- Rodapé da sidebar: usuário e ação de sair, discretos.
- Header de conteúdo: 64 px, título da página à esquerda, ações contextuais à direita. Sem logo repetida.
- Conteúdo com largura máxima de 1240 px e respiro de 24–32 px.
- Sidebar não deve ser totalmente navy; isso pesaria a interface e competiria com o conteúdo.

### 12.4 Login

- Mobile: uma coluna, fundo `canvas`, lockup acima do formulário, card branco com borda de 1 px, largura total com gutter de 16–24 px.
- Desktop: composição em duas áreas — painel navy com o lockup inverso e uma frase curta de marca; formulário branco à direita, centralizado, com largura de 400–440 px.
- Sem fotografia de cortina no login nesta fase.
- Sem gradiente no painel navy.
- Campos visíveis, foco evidente, botão primário navy.
- A frase do painel deve ser curta e institucional, sem promessa de produto não prevista.

### 12.5 O que evitar no shell

- Sidebar escura em todas as telas.
- Logo grande no header de conteúdo.
- Muitos badges ou contadores na navegação.
- Bottom nav com mais de 5 itens.
- Ícones coloridos individualmente.
- Header que muda de altura entre telas.
- Navegação que esconde o conteúdo ou exige scroll horizontal.

---

## 13. Dashboard

### 13.1 Estrutura

O dashboard é uma visão de trabalho, não um painel de BI. Cinco números e três listas funcionais bastam.

- Título de página simples.
- Cinco cartões de contagem: Rascunhos, Enviados, Expirados, Confirmados, Em produção.
- Listas: próximas instalações, instalações da semana, instalações atrasadas.
- Sem gráficos no MVP.
- Sem filtros complexos no topo.

### 13.2 Cartões de contagem

- Grid mobile: 2 colunas; o quinto cartão pode ocupar a largura toda ou ficar na segunda linha.
- Grid desktop: 5 colunas iguais, com quebra para 3+2 em larguras intermediárias.
- Cartão branco, borda de 1 px, raio 6 px, sem sombra.
- Label curto em `text.secondary`, 12–13 px, sentence case.
- Número grande em Montserrat 600, 28–32 px, `tabular-nums`.
- Número em navy. Não usar cinco cores diferentes.
- Um pequeno traço ou ponto de 6–8 px pode indicar a família do estado:
  - rascunhos: neutro;
  - enviados: navy;
  - expirados: warning;
  - confirmados: success;
  - em produção: laranja de marca.
- O ponto é secundário; o número e o label são a leitura principal.
- Evitar ícones decorativos grandes em cada cartão.

### 13.3 Listas

- Blocos brancos com borda, sem cards internos.
- Título da lista em 18–20 px, 600.
- Itens separados por `border.default` de 1 px.
- Cada item: nome do cliente, número do orçamento, data e status.
- Ações por item: um link/ação textual discreta, não uma fileira de botões.
- Datas em formato curto e consistente (D326).
- Empty state simples: uma linha de texto e, se fizer sentido, uma ação.
- Não usar tabela no mobile; usar lista empilhada.
- Em desktop, as listas podem ocupar duas colunas; a de atrasadas pode ficar em largura total se tiver mais itens.

### 13.4 Atrasadas

- Não usar vermelho de alarme.
- Usar `warning` com ícone de relógio/alerta e texto explícito “Atrasada”.
- A data deve ser legível; o atraso não pode depender só da cor.
- Ordenar da mais antiga para a mais recente.
- Não piscar, não animar, não usar badge pulsante.

### 13.5 O que evitar

- Cards genéricos de SaaS com ícone grande, número e seta de tendência.
- Gráficos de pizza/linha no MVP.
- Muitas cores por cartão.
- Fundos coloridos atrás dos números.
- Sombras e elevação.
- Textos longos dentro dos cartões.
- “Bem-vindo, [nome]” ocupando meia tela.

---

## 14. Formulários

### 14.1 Prioridade

O formulário de orçamento é o centro operacional do produto. Ele deve ser premium no acabamento, mas acima de tudo rápido, claro e tocável.

- Uma coluna no mobile.
- Duas colunas no desktop apenas para campos curtos e relacionados.
- Largura máxima de 760 px.
- Seções claras, com título e separador.
- Labels sempre visíveis, acima do campo.
- Sem placeholder como substituto de label.
- Campos obrigatórios marcados de forma textual e consistente.

### 14.2 Estrutura

Ordem visual sugerida, alinhada a D300 e ao fluxo aprovado:

1. Cliente.
2. Itens do orçamento.
3. Condições comerciais.
4. Observações.
5. Resumo/totais.
6. Ações.

Cada seção:

- título em 18–20 px, 600;
- separador de 1 px;
- espaçamento de 24 px antes e 16 px depois;
- descrição curta apenas quando ajudar.

Não usar accordions para esconder seções essenciais. Não usar tabs para o fluxo principal. Não fragmentar o formulário em várias telas sem necessidade.

### 14.3 Campos

- Altura mínima: 44 px.
- Fundo branco.
- Borda de 1 px `border.control`.
- Raio 4 px.
- Sem sombra.
- Texto de 15–16 px; no mobile, pelo menos 16 px.
- Padding horizontal de 12–16 px.
- Foco: anel navy de 2 px + offset; borda pode escurecer para navy.
- Erro: borda `semantic.error`, mensagem abaixo com ícone + texto.
- Ajuda: `caption` em `text.secondary`, abaixo do campo.
- Desabilitado: fundo `surface.alt`, texto `text.secondary`, borda mais clara; não usar apenas opacidade.
- Selects: nativos ou com aparência nativa; não criar combobox customizado sem necessidade de acessibilidade.
- Textarea: altura mínima de 96 px, redimensionamento vertical.
- Checkbox/radio: nativos, com `accent-color` navy; label clicável; área de toque de 44 px.
- Switch: usar apenas quando o estado for binário e imediato; sempre com label e texto de estado. Não usar switch para ações que exigem salvar.
- Máscaras: apenas quando o contrato exigir; não formatar valores de forma que altere o dado enviado.

### 14.4 Grupos e seções

- Espaço entre label e campo: 8 px.
- Espaço entre campos: 16–20 px.
- Espaço entre grupos: 24–32 px.
- Espaço entre seções: 32–40 px.
- Linha de dois campos no desktop: usar grid com gap de 16–24 px; no mobile, empilhar.
- Não usar caixas ao redor de cada campo ou grupo; a hierarquia vem do espaço e dos títulos.

### 14.5 Ações

- Ação primária: navy, à direita no desktop; largura total no mobile quando for a ação principal da tela.
- Ação secundária: outline discreto.
- Cancelar: texto, sem preenchimento, com confirmação se houver perda de dados.
- Em formulários longos, usar uma barra de ações fixa no rodapé do formulário, acima da bottom nav no mobile. Ela não deve cobrir conteúdo; adicionar padding inferior.
- Não usar dois botões primários na mesma tela.
- Não esconder a ação principal no topo.

### 14.6 Totais e feedback financeiro

- D303-B: o frontend **não calcula** total de item, subtotal, desconto, ajuste, total final, largura final, quantidade de tecido ou qualquer valor derivado.
- A área de resumo mostra valores somente após resposta do backend.
- Antes de salvar, exibir um estado claro de “salve para ver os totais”, sem números inventados.
- Não usar placeholders com “R$ 0,00” que pareçam valores reais.
- Não duplicar fórmulas de arredondamento ou de precificação.
- O resumo deve ser um bloco simples: linhas label/valor, separador, total em destaque navy.
- Valores monetários alinhados à direita, `tabular-nums`, formato de moeda conforme D325.

### 14.7 Erros e validação

- Erros de campo junto ao campo.
- Erros de formulário em um resumo no topo ou no rodapé, com link para o campo.
- Não usar apenas cor; usar ícone e texto.
- Não limpar o formulário em caso de erro.
- Não usar alerts nativos do navegador para erros de negócio.
- Feedback de sucesso: toast ou mensagem inline, curta, com a próxima ação quando aplicável.

---

## 15. Componentes

### 15.1 Botões

| Variante | Aparência | Uso |
|---|---|---|
| Primário | Fundo navy, texto branco, raio 4 px, altura 44 px | Ação principal da tela; uma por contexto |
| Secundário | Fundo transparente/branco, borda `border.control`, texto navy | Ações alternativas, cancelar com menos peso |
| Destrutivo | Fundo `semantic.error`, texto branco, ou outline error | Excluir/cancelar de forma irreversível; nunca usar laranja |
| Texto | Sem fundo, texto navy, sublinhado apenas em hover/foco | Ações terciárias, links de lista |
| Ícone | 44 × 44 px, ícone linear, sem fundo ou com fundo sutil | Ações compactas; sempre com `aria-label` |

Regras:

- Navy é a cor padrão do botão primário (UI-03 `[A]`: alternativa A). Laranja não é CTA primário universal.
- Laranja pode ser usado em uma ação comercial específica, com texto `#1E2433`, desde que não haja dois CTAs laranja na mesma tela.
- Não usar botões com gradiente, sombra ou efeito 3D.
- Não usar botões pill.
- Estado hover: escurecer levemente o fundo; sem deslocamento.
- Estado active: leve redução de contraste ou deslocamento de 1 px, se necessário.
- Estado disabled: fundo `surface.alt`, texto `text.secondary`, cursor padrão; não usar opacidade baixa a ponto de sumir.
- Loading: spinner discreto + texto; manter a largura para evitar salto de layout.
- Ícones opcionais à esquerda; não usar ícone à direita em botões de formulário.

### 15.2 Inputs e controles

- Ver seção 14.3.
- Select: seta discreta, mesma altura e borda do input.
- Checkbox/radio: 20 × 20 px, label com área de toque.
- Switch: 44 × 24 px, trilho neutro, ativo navy; não usar laranja como estado ativo.
- Busca: ícone à esquerda, input com label acessível; não usar placeholder como único rótulo.
- Upload: área simples com borda tracejada? Evitar. Usar botão secundário + nome do arquivo; o produto não tem upload nesta fase.

### 15.3 Cards

- Fundo branco.
- Borda 1 px `border.default`.
- Raio 6 px.
- Sem sombra.
- Padding 16–24 px.
- Título 18–20 px, 600.
- Conteúdo com espaçamento consistente.
- Não aninhar cards.
- Não usar card apenas para agrupar um único campo.
- Em mobile, cards ocupam a largura disponível, com gutter de 16 px.

### 15.4 Badges de status

- Altura 24–28 px.
- Padding horizontal 8–10 px.
- Raio 4 px.
- Texto 12 px, 500/600.
- Ícone opcional de 14 px.
- Cor de fundo tingida, texto escuro, borda sutil.
- Nunca usar apenas cor; o label em português é obrigatório.
- Não usar badge pill.
- Não usar sete cores fortes; ver seção 16.

### 15.5 Tabelas e listas

- Mobile-first: a apresentação padrão no mobile é lista empilhada ou cartões de linha, não tabela com scroll horizontal.
- Desktop: tabela permitida para dados comparáveis.
- Cabeçalho de tabela: `surface.alt`, texto 12–13 px, 600, `text.secondary`.
- Linhas: 48–56 px, separador `border.default`, hover `surface.alt`.
- Números alinhados à direita; texto à esquerda.
- Ações por linha: uma ação textual ou menu de contexto; não uma fileira de botões.
- Não usar zebra striping forte; se precisar, usar contraste muito sutil.
- Não usar bordas verticais em todas as células.
- Em mobile, cada linha vira um bloco com pares label/valor; ações no rodapé do bloco.
- Nunca forçar scroll horizontal como comportamento padrão.

### 15.6 Diálogos

- Título claro, 18–20 px, 600.
- Texto curto.
- Ação primária + cancelar.
- Fundo branco, raio 6 px, sombra `shadow.overlay`.
- Largura desktop: 400–520 px.
- Mobile: largura total com margem de 16 px; em fluxos longos, tela cheia.
- Fechar por Esc e por botão explícito.
- Foco preso no diálogo e devolvido ao elemento de origem.
- Não usar animações elaboradas; fade/scale curto, se necessário.
- Não usar diálogo para conteúdo longo; preferir página ou seção.

### 15.7 Toasts e feedback

- Desktop: canto superior direito ou inferior direito, 320–400 px.
- Mobile: acima da bottom nav, largura disponível menos gutters.
- Fundo branco, borda, raio 6 px, sombra overlay.
- Ícone semântico + texto; cor não é o único sinal.
- Duração: 4–6 s; erro pode persistir até o usuário fechar.
- Não usar toast para erro de campo.
- Não empilhar mais de 3 toasts.

### 15.8 Empty states e loading

- Empty state: ícone linear discreto, título curto, uma frase e, se aplicável, uma ação.
- Sem ilustrações grandes.
- Loading: skeleton estático ou pulso muito sutil; respeitar `prefers-reduced-motion`.
- Evitar spinners de tela cheia para carregamentos curtos; usar skeleton no bloco.
- Não usar barras de progresso decorativas.

### 15.9 Navegação e outros

- Links: navy, sublinhado no hover/foco; não usar laranja para links.
- Breadcrumbs: apenas se houver hierarquia real; não inventar.
- Paginação: botões discretos, números tabulares, estado atual navy.
- Tooltip: apenas para ícones sem label visível; não usar para informação essencial.
- Accordion: apenas para conteúdo secundário; não para o fluxo principal.

---

## 16. Status

### 16.1 Status de orçamento

| Status | Label em português | Tratamento visual | Sinal adicional |
|---|---|---|---|
| `DRAFT` | Rascunho | Fundo `surface.alt`, texto `text.secondary`, borda `border.default` | Ícone de lápis/documento |
| `SENT` | Enviado | Fundo `navy-tint`, texto navy, borda `#C9D3E2` | Ícone de envio |
| `EXPIRED` | Expirado | Fundo warning, texto warning, borda warning | Ícone de relógio/alerta |
| `CONFIRMED` | Confirmado | Fundo success, texto success, borda success | Ícone de check |
| `IN_PRODUCTION` | Em produção | Fundo `orange-tint`, texto `#8A4A12`, borda `#EBC9AF` | Ícone de tear/engrenagem |
| `COMPLETED` | Concluído | Fundo success, texto success, borda success | Ícone de check duplo |
| `CANCELLED` | Cancelado | Fundo `surface.alt`, texto `#6F6C68`, borda `border.default` | Ícone de traço |

Contrastes medidos:

- Rascunho: 5,13:1.
- Enviado: 9,87:1.
- Expirado: 5,18:1.
- Confirmado: 5,52:1.
- Em produção: 6,02:1.
- Concluído: 5,52:1.
- Cancelado: 4,52:1.

Todos passam AA para texto normal.

### 16.2 Regras

- O label em português é obrigatório; o código interno nunca aparece na interface.
- Cor nunca é o único sinal: usar label + ícone +, quando útil, texto de contexto.
- Evitar sete cores fortes. A paleta de status reutiliza neutro, navy, warning, success e um tom de laranja terroso.
- `CANCELLED` não usa vermelho; é um estado encerrado, não um erro.
- `EXPIRED` usa warning, não error; é um estado de negócio esperado.
- `COMPLETED` e `CONFIRMED` compartilham a família success; o label e o ícone diferenciam.
- Badges são compactos; não dominam a linha.
- Em listas, o status pode aparecer como badge; em detalhes, pode aparecer como badge + texto explicativo.
- Não usar badge para “atrasada”; atraso é um indicador derivado, não um status do orçamento.

### 16.3 Indicadores derivados

- **Instalação atrasada:** `warning` + ícone de relógio + texto “Atrasada”. Não criar um oitavo status.
- **Orçamento expirado:** já é status `EXPIRED`; não duplicar com outro badge.
- **Instalação da semana:** indicador de contexto na lista, sem cor forte.
- **Prioridade comercial:** não existe no MVP; não inventar.

---

## 17. Responsividade

### 17.1 Breakpoints

| Faixa | Largura | Comportamento |
|---|---|---|
| Mobile | 0–639 px | Uma coluna, bottom nav, formulários em coluna única, listas empilhadas |
| Tablet | 640–1023 px | Duas colunas quando fizer sentido, sidebar ainda não; navegação adaptada |
| Desktop | 1024–1279 px | Sidebar, header, grids de 2–3 colunas |
| Desktop amplo | 1280 px+ | Conteúdo centralizado com largura máxima; não esticar linhas |

### 17.2 Regras

- Mobile-first: o layout base é o mobile; o desktop é progressivo.
- Não usar hover como única forma de revelar ação.
- Não depender de largura fixa.
- Não usar scroll horizontal na página.
- Tabelas: converter para lista/cartões no mobile; se uma tabela for inevitável, permitir scroll apenas no contêiner, com indicação visual, nunca na página.
- Diálogos: tela cheia no mobile quando o conteúdo for longo; centralizados no desktop.
- Formulários: uma coluna no mobile; duas apenas no desktop e para campos curtos.
- Bottom nav: respeitar `env(safe-area-inset-bottom)`.
- Conteúdo: padding inferior para não ficar sob a bottom nav.
- Texto: não usar tamanhos abaixo de 12 px; corpo 15–16 px.
- Imagens: não introduzir nesta fase.
- Zoom: a 200%, o layout deve continuar utilizável; a 320 px de largura, não deve haver scroll horizontal.

### 17.3 Toque

- Alvos mínimos de 44 × 44 px.
- Espaço mínimo de 8 px entre alvos.
- Botões de ícone com área de toque maior que o ícone.
- Não usar controles pequenos apenas para “parecer refinado”.

---

## 18. Acessibilidade

### 18.1 Requisitos

- Contraste mínimo AA:
  - texto normal 4,5:1;
  - texto grande 3:1;
  - componentes e bordas de controle 3:1.
- Foco visível em todos os elementos interativos.
- Não usar cor como único meio de transmitir informação.
- Labels explícitos e associados aos campos.
- Mensagens de erro claras, junto ao campo e com texto.
- Estados desabilitados distinguíveis, mas ainda legíveis.
- Alvos de toque de 44 × 44 px.
- Texto redimensionável sem perda de conteúdo.
- Layout funcional a 320 px de largura e com zoom de 200%.
- `lang="pt-BR"` no documento.
- Ícones sem label visível devem ter nome acessível.
- Diálogos com foco gerenciado.
- Tabelas com cabeçalhos associados.
- Respeitar `prefers-reduced-motion`.
- Não sacrificar acessibilidade por estética.

### 18.2 Decisões de contraste já verificadas

- Navy sobre branco: 11,60:1.
- Texto principal sobre canvas: 14,51:1.
- Texto secundário sobre canvas: 5,55:1.
- Laranja sobre branco: 2,80:1 — **não usar para texto normal**.
- Texto escuro sobre laranja: 5,53:1 — usar em preenchimentos laranja.
- Bordas de controle `#8A8782`: 3,58:1 sobre branco.
- Status: todos os pares da seção 16 passam AA.

### 18.3 Cuidados específicos

- Playfair não é usada em texto pequeno.
- O laranja da logo não é usado como cor de texto de interface.
- O foco não é removido; é substituído por anel visível.
- O estado ativo da navegação não depende só de cor; usa indicador e label.
- Badges de status sempre têm texto.
- O atraso de instalação tem ícone e texto.
- Inputs no mobile usam 16 px para evitar zoom automático.
- Toasts não são o único registro de uma ação importante; mensagens inline complementam.

---

## 19. Motion

### 19.1 Princípio

Movimento é funcional, curto e discreto. Ele confirma uma ação ou orienta uma transição; não decora.

### 19.2 Tokens

| Token | Valor | Uso |
|---|---|---|
| `motion.duration.fast` | 120 ms | Hover, foco, mudança de cor |
| `motion.duration.base` | 160 ms | Abertura/fechamento de menus e diálogos |
| `motion.duration.slow` | 200 ms | Transições de layout leves |
| `motion.easing.standard` | `cubic-bezier(0.2, 0, 0, 1)` | Padrão |

### 19.3 Permitido

- Transição de cor de fundo/texto em hover e foco.
- Abertura/fechamento de diálogo com fade + scale de 0,98 para 1.
- Toast entrando/saindo com fade + deslocamento curto.
- Skeleton com pulso suave.
- Feedback de loading em botão.

### 19.4 Proibido

- Animação decorativa.
- Parallax.
- Transições longas (acima de 250 ms).
- Movimento infinito fora de loading.
- Bounce, elastic, shake.
- Animar números de dashboard.
- Animar entrada de cada card.
- Vídeo ou fundo animado.

### 19.5 Reduced motion

- Respeitar `prefers-reduced-motion: reduce`.
- Remover deslocamentos e animações; manter apenas mudanças instantâneas de estado.
- Loading pode usar opacidade estática ou um indicador não animado.

---

## 20. Tokens

Esta seção define **tokens conceituais**. Nenhum arquivo de configuração, CSS, variável ou tipo foi criado nesta rodada.

### 20.1 Cores

```text
colors.brand.navy          #203864
colors.brand.orange        #EC7C30
colors.brand.navy-tint     #E9EDF3
colors.brand.orange-tint   #FBEEE5

colors.surface.canvas      #F9F7F6
colors.surface.primary     #FFFFFF
colors.surface.alt         #F2EEEA
colors.surface.overlay     rgba(20, 28, 45, 0.48)

colors.text.primary        #1E2433
colors.text.secondary      #5F6470
colors.text.inverse        #FFFFFF
colors.text.on-orange      #1E2433
colors.text.disabled       #7C7874

colors.border.default      #E3DEDA
colors.border.strong       #C9C3BD
colors.border.control      #8A8782

colors.focus.ring          #203864
colors.focus.ring-inverse  #F9F7F6

colors.semantic.success.fg #2F6B4F
colors.semantic.success.bg #EAF2ED
colors.semantic.success.border #C9DED2

colors.semantic.warning.fg #8A5A12
colors.semantic.warning.bg #F7EFE2
colors.semantic.warning.border #E6D3B3

colors.semantic.error.fg   #A23B36
colors.semantic.error.bg   #F7E9E7
colors.semantic.error.border #E6C7C3

colors.semantic.info.fg    #3C6E8F
colors.semantic.info.bg    #EAF0F4
colors.semantic.info.border #C9DAE4
```

### 20.2 Tipografia

```text
font.family.sans           "Montserrat", system-ui, sans-serif
font.family.display        "Playfair Display", Georgia, serif

font.weight.regular        400
font.weight.medium         500
font.weight.semibold       600

font.size.display          36px / 40px
font.size.page-title       28px / 32px
font.size.section-title    18px / 20px
font.size.body             15px / 16px
font.size.label            13px
font.size.caption          12px
font.size.button           14px
font.size.numeric          16px–32px
```

### 20.3 Espaçamento

```text
spacing.1   4px
spacing.2   8px
spacing.3   12px
spacing.4   16px
spacing.5   20px
spacing.6   24px
spacing.8   32px
spacing.10  40px
spacing.12  48px
spacing.16  64px
```

### 20.4 Raios

```text
radius.none  0px
radius.sm    4px
radius.md    6px
```

### 20.5 Layout

```text
layout.gutter.mobile       16px
layout.gutter.desktop      24px–32px
layout.content.max         1240px
layout.form.max            760px
layout.sidebar.width       248px
layout.header.height       64px
layout.bottom-nav.height   56px + safe area
layout.touch.target        44px
```

### 20.6 Elevação e movimento

```text
shadow.overlay             0 12px 32px rgba(20, 28, 45, 0.16)

motion.duration.fast       120ms
motion.duration.base       160ms
motion.duration.slow       200ms
motion.easing.standard     cubic-bezier(0.2, 0, 0, 1)
```

### 20.7 Observações

- Estes tokens são conceituais e não implicam nomes finais de classes, variáveis CSS ou chaves de tema.
- A configuração Tailwind só será criada na implementação, respeitando as decisões UI-01 a UI-04 aprovadas.
- Não criar uma escala 50–900 de marca; a paleta é intencionalmente curta.
- Tokens semânticos devem ser usados por papel, não por aparência.

---

## 21. Do / Don't

| Faça | Não faça |
|---|---|
| Usar navy para estrutura, títulos e ação primária | Usar navy como fundo de todas as telas |
| Usar laranja como assinatura pontual | Usar laranja em todos os botões primários |
| Usar off-white como canvas e branco para conteúdo | Usar branco puro em toda a tela |
| Usar bordas de 1 px e contraste de superfície | Usar sombras em cards e tabelas |
| Usar raio 4–6 px com moderação | Usar 12/16/24 px ou pill em tudo |
| Usar Montserrat na interface | Usar Playfair em inputs, tabelas ou botões |
| Usar Playfair apenas em títulos grandes | Usar peso 300 em toda a UI |
| Usar labels visíveis e foco evidente | Usar placeholder como label |
| Usar cor + texto + ícone para status | Comunicar status só por cor |
| Converter tabelas em listas no mobile | Forçar scroll horizontal na página |
| Usar 44 × 44 px como alvo mínimo | Criar controles pequenos “elegantes” |
| Usar movimento curto e funcional | Usar animação decorativa ou parallax |
| Manter a logo intacta | Recriar, recolorir ou distorcer a logo |
| Usar ícone funcional na navegação compacta até existir símbolo oficial | Recortar o lockup para simular a marca |
| Tratar Pierre Frey como inspiração | Copiar paleta, layout ou textos da referência |
| Usar o lockup empilhado como assinatura disponível | Inventar um lockup horizontal que não foi fornecido |
| Deixar o conteúdo dominar | Repetir a marca em cada tela |

---

## 22. Decisões visuais validadas

**Validação humana:** 2026-10-20

```text
UI abertas = 0
```

As quatro decisões visuais da Fase 11 foram aprovadas. Elas são exclusivamente visuais, não alteram D260–D333 e não introduzem regra de negócio. As alternativas consideradas permanecem registradas como histórico de decisão.

### UI-01 — Fonte display `[A]`

**Status:** `[A]` — aprovada em 2026-10-20
**Decisão aprovada:** alternativa B — Montserrat + Playfair Display.

**Regra vinculante:**

- Montserrat é a fonte principal da interface.
- Playfair Display é usada apenas em títulos de página e grandes headings editoriais.
- Playfair não é usada em inputs, tabelas, botões, labels, dados, mensagens ou componentes operacionais.
- A serifada é um recurso de identidade e hierarquia, não uma fonte geral de UI.

**Alternativas consideradas:**

| Alternativa | Descrição | Resultado |
|---|---|---|
| A | Montserrat apenas | Não adotada |
| B | Montserrat + Playfair Display, com Playfair restrita a títulos | **Adotada** |

**Motivo:** o contraste serifada/sem serifa reforça a identidade editorial e ajuda a afastar a interface do “SaaS genérico”, desde que a serifada fique restrita a tamanhos grandes.

**Impacto:** duas famílias; necessidade de definir carregamento e fallback; nenhuma mudança de layout.

---

### UI-02 — Radius `[A]`

**Status:** `[A]` — aprovada em 2026-10-20
**Decisão aprovada:** alternativa B — escala 0/4/6 px.

**Regra vinculante:**

```text
radius.none = 0px
radius.sm   = 4px
radius.md   = 6px
```

- Botões: 4 px.
- Inputs: 4 px.
- Cards e superfícies: até 6 px.
- Elementos editoriais podem permanecer retos.
- Não usar pill como linguagem padrão.
- Evitar arredondamentos altos de 12–24 px.

**Alternativas consideradas:**

| Alternativa | Descrição | Resultado |
|---|---|---|
| A | 0 px em tudo | Não adotada |
| B | Escala 0/4/6 px, com 4 px em botões e inputs e 6 px em cards | **Adotada** |
| C | Arredondamento alto (12–24 px, pill) | Não adotada |

**Motivo:** 4–6 px dá acabamento sem transformar a interface em um produto lúdico, mantendo a geometria reta predominante.

**Impacto:** tokens `radius.none/sm/md`; nenhum componente pill; revisão de qualquer arredondamento de 12–24 px.

---

### UI-03 — Cor do CTA primário `[A]`

**Status:** `[A]` — aprovada em 2026-10-20
**Decisão aprovada:** alternativa A — navy como cor padrão da ação primária.

**Regra vinculante:**

- Navy é a cor padrão da ação primária.
- Texto branco sobre navy.
- Laranja permanece cor de assinatura/acento.
- Laranja não é CTA primário universal.
- Laranja não é warning/error.
- Ação laranja só pode existir quando houver motivo comercial/visual específico e contraste adequado.
- Não criar telas com múltiplos CTAs concorrentes.

**Alternativas consideradas:**

| Alternativa | Descrição | Resultado |
|---|---|---|
| A | Navy como padrão; laranja como acento comercial específico | **Adotada** |
| B | Laranja como padrão de CTA | Não adotada |
| C | Variar por contexto, sem regra fixa | Não adotada |

**Motivo:** navy garante contraste, seriedade e previsibilidade; o laranja permanece assinatura, não ruído. A regra também evita depender de texto branco sobre laranja, que reprova em AA.

**Impacto:** botão primário navy; laranja reservado a exceções documentadas; nenhuma ação primária laranja por padrão.

---

### UI-04 — Uso da logo no shell `[A]`

**Status:** `[A]` — aprovada em 2026-10-20
**Decisão aprovada:** alternativa B, com ressalva de asset.

**Regra vinculante:**

- Usar o lockup completo disponível em login e em contextos com espaço suficiente.
- Usar símbolo isolado em áreas compactas somente quando existir um asset oficial.
- Não recortar, redesenhar ou recriar o símbolo atual.
- Não inventar lockup horizontal.
- Não distorcer proporção nem recolorir arbitrariamente.

**Enquanto o símbolo isolado oficial não estiver disponível:**

- Não bloquear toda a Fase 11.
- Usar o lockup completo apenas onde houver espaço adequado.
- Em navegação compacta, priorizar ícone funcional de navegação sem tentar simular a marca.
- Registrar a substituição pelo símbolo oficial como pendência visual.

**Alternativas consideradas:**

| Alternativa | Descrição | Resultado |
|---|---|---|
| A | Lockup completo sempre, inclusive em espaços compactos | Não adotada |
| B | Lockup completo em login/header desktop e símbolo em espaços compactos | **Adotada, com ressalva de asset** |
| C | Sem logo após o login, apenas wordmark textual | Não adotada |

**Motivo:** a marca precisa estar presente sem competir com o conteúdo; o símbolo é mais legível em áreas pequenas e evita repetição do wordmark.

**Impacto:** solicitar o símbolo isolado oficial; definir tamanhos e clear space; nenhuma alteração de layout estrutural.

---

### 22.1 Pendências de asset (não são decisões UI)

Manter registradas:

- símbolo isolado oficial;
- lockup horizontal oficial, se existir;
- versão inversa transparente;
- manual de marca oficial.

Essas pendências não bloqueiam a fundação técnica ou as telas funcionais. Também não bloqueiam o início da implementação visual: a direção está validada e os componentes podem ser construídos com o lockup completo onde houver espaço e com ícones funcionais na navegação compacta.

Elas bloqueiam apenas a aplicação final e fiel da marca nos pontos específicos que dependem desses assets:

- favicon;
- símbolo em navegação compacta;
- versão inversa em fundos navy arbitrários;
- eventuais peças institucionais que exijam a marca em versão horizontal.

Não criar substitutos por recorte, redesenho ou recriação.

---

## 23. Conclusão

A direção visual da Cortinando para a Fase 11 é:

- **premium e calma**, com espaço, tipografia hierarquizada e geometria contida;
- **navy como estrutura** e **laranja como assinatura**, sem transformar a interface em um painel azul ou em uma marca laranja onipresente;
- **off-white e branco** como base de leitura, com bordas finas e sombra apenas em overlays;
- **Montserrat** na operação e **Playfair Display** restrita a títulos, conforme UI-01 `[A]`;
- **raio 4–6 px** e espaçamento em múltiplos de 4, conforme UI-02 `[A]`;
- **mobile-first**, com bottom nav, formulários em coluna única e tabelas convertidas em listas;
- **acessibilidade AA** desde o início, com foco visível, status não dependentes de cor e alvos de toque adequados;
- **Pierre Frey apenas como inspiração estética**, nunca como fonte de paleta, layout, textos ou marca.

A identidade da Cortinando prevalece sobre o `design.md`. A referência externa foi usada para calibrar composição, tipografia, espaço, hierarquia e sensação premium; não para copiar.

Nenhum código, configuração, asset, dependência ou arquivo de `frontend/` e `backend/` foi alterado nesta rodada documental.

As decisões UI-01 a UI-04 foram aprovadas em 2026-10-20. A direção visual da Fase 11 está validada e não há decisão visual aberta:

```text
UI abertas = 0
```

A implementação visual está autorizada. As pendências de asset não bloqueiam a fundação técnica, as telas funcionais ou o início da implementação; bloqueiam apenas a aplicação final e fiel da marca nos pontos que dependem desses arquivos. Até a chegada dos assets oficiais, usar o lockup completo onde houver espaço e ícones funcionais na navegação compacta, sem recortar, redesenhar ou recriar a marca.
