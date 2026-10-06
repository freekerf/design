# Design system FreeKerf

**Fonte única:** [`tokens.json`](tokens.json) (formato [W3C Design Tokens / DTCG](https://tr.designtokens.org/format/)). `python3 tokens/build_tokens.py` gera [`tokens/fk-tokens.css`](tokens/fk-tokens.css), que o protótipo usa. Depois, um gerador equivalente produzirá constantes Rust ou um tema do toolkit escolhido (veja `tech-notes.md`).

Todos os nomes de saída têm o prefixo **`fk-`**: `--fk-color-surface-1`, `--fk-space-2`, `--fk-control-h`…

## 1. Camadas de tokens

```
primitivos      fk.color.brand.amber-500, fk.color.neutral.900, fk.space.2 …   (valores crus)
semânticos      fk.theme.dark.surface-1 → {fk.color.neutral.900}              (intenção, por tema)
densidade       fk.density.compact.control-h = 28px | comfortable = 44px      (por tipo de entrada)
componentes     no código (ex.: .estop usa estop, estop-ring, control-h)      (sem tokens próprios por enquanto)
```

Componentes só consomem **semânticos e densidade**, nunca primitivos. Assim, trocar de tema não exige mexer em componente.

| Seletor CSS | Conteúdo |
|---|---|
| `:root` | primitivos + tema **escuro (padrão)** + densidade **compacta** |
| `[data-theme="light"]` | tema claro |
| `[data-contrast="high"]` | alto contraste (sobre o escuro) |
| `[data-density="comfortable"]` | densidade de toque |

## 2. Cor

### Marca e neutros
- **Âmbar Kerf** `amber-500 #F4A51C`: ação primária, foco, seleção, feixe. Escala de 50 a 900.
- **Grafite** `neutral 0…1000`: neutros levemente frios (aço/chapa).

### Semânticos (escuro / claro)

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `surface-0` | `#0E1115` | `#EBEEF2` | fundo do app |
| `surface-1` | `#151A20` | `#FFFFFF` | painéis, barras |
| `surface-2` | `#1D232B` | `#F6F7F9` | campos, cartões, botões |
| `surface-3` | `#28303A` | `#D3D9E0` | hover/pressionado |
| `surface-canvas` / `surface-workarea` | `#0B0D10` / `#12161B` | `#DCE1E7` / `#FBFBFC` | fora da mesa / mesa |
| `text` / `text-muted` / `text-subtle` | 15,0 / 8,3 / 5,1 :1 | 17,5 / 10,0 / 5,8 :1 | contraste sobre `surface-1` |
| `accent-text` | `#F9B23A` (9,5:1) | `#8A5200` (6,4:1) | texto e ícones âmbar |
| `on-accent` sobre `accent` | 9,2:1 | 9,2:1 | rótulo do botão primário |
| `selection`, `focus` | âmbar 400/300 | âmbar 700 | caixa de seleção, anel de foco |
| `grid-minor` / `grid-major` | sutis, sem competir com camadas | | |
| `head` / `burn` | branco / âmbar claro | grafite / âmbar escuro | cabeçote e rastro simulado |

Todos os pares de texto passam **WCAG AA** (≥ 4,5:1). Cores de estado sobre `surface-1`: ciano 8,4, violeta 7,4, magenta 6,0 (escuro); 5,8 / 6,3 / 5,9 (claro).

### Estados da máquina

`state-offline` (cinza) · `state-idle` (ciano) · `state-run` (âmbar, **listras animadas**) · `state-hold` (violeta) · `state-alarm` (magenta, **pisca**). Sempre com ícone + palavra (veja `ux.md`).

### PARAR

`estop #D33027` com texto branco (**4,97:1**) + `estop-ring #FFD23F` (anel amarelo, 3,4:1 contra o vermelho) + forma **octogonal**. Convenção ISO 13850 de parada de emergência (vermelho sobre amarelo), **reservada exclusivamente** para o PARAR. Nada mais na interface usa esse par.

### Por que não vermelho/verde puros
- O vermelho do laser e os óculos de proteção alteram a percepção: óculos laranja para diodo escurecem azul/ciano/verde, e óculos verdes (fibra) escurecem vermelho.
- ~8 % dos homens têm deficiência vermelho-verde.
- Por isso, *sucesso* é **verde-azulado** (`teal`), *erro/alarme* é **magenta**, *aviso* é **amarelo**, e todos vêm com ícone.

### Cores de camada (C00–C11 + T1)

Baseadas nas paletas seguras para daltônicos de Okabe-Ito e Paul Tol, ajustadas para luminância média. **A cor nunca identifica a camada sozinha:** cada amostra tem o **código de 2 dígitos** escrito, e a camada de ferramenta T1 tem **hachura**.

| Código | Nome | Hex | Contraste na mesa escura | na mesa clara |
|---|---|---|---|---|
| C00 | Azul | `#4C8DFF` | 5,7 | 3,1 |
| C01 | Vermelhão | `#E8622C` | 5,4 | 3,3 |
| C02 | Verde-azulado | `#10A37F` | 5,7 | 3,1 |
| C03 | Amarelo | `#E8C21F` | 10,5 | 1,7 ⚠ |
| C04 | Púrpura | `#B36AE2` | 5,3 | 3,3 |
| C05 | Céu | `#52B8E8` | 8,1 | 2,2 ⚠ |
| C06 | Rosa | `#E0559A` | 5,1 | 3,4 |
| C07 | Laranja | `#F08C1A` | 7,3 | 2,4 ⚠ |
| C08 | Oliva | `#8FA31E` | 6,4 | 2,7 ⚠ |
| C09 | Ardósia | `#7F8EA3` | 5,5 | 3,2 |
| C10 | Marrom | `#A0693A` | 4,0 | 4,4 |
| C11 | Turquesa | `#25C2B5` | 8,2 | 2,2 ⚠ |
| T1 | Ferramenta | `#9AA3AF` (tracejado + hachura) | 7,1 | 2,5 |

⚠ **No tema claro**, as linhas do canvas ganham um **halo grafite de 45 %** por baixo, o que leva todas as cores acima de 3:1 (contraste mínimo para elementos gráficos, WCAG 1.4.11). As cores das camadas **não mudam entre temas**, porque fazem parte do arquivo (SVG/DXF) e da memória muscular do usuário.

## 3. Tipografia

| Família | Uso | Licença |
|---|---|---|
| **Inter** | toda a interface | OFL-1.1 |
| **JetBrains Mono** | números (DRO, campos, tempos, progresso), console, G-code. Dígitos tabulares | OFL-1.1 |
| **Space Grotesk** | só o wordmark e títulos de marketing/boas-vindas | OFL-1.1 |

Escala (`fk.font.size`): `xs 11 · sm 12 · md 13 (corpo compacto) · lg 15 (corpo toque) · xl 18 · 2xl 22 · 3xl 28 · readout 40 · readout-xl 64`. Altura de linha: `tight 1.15`, `base 1.45`.

Regras: números sempre em mono tabular (não "dançam" ao atualizar). Rótulos de seção em caixa alta com espaçamento de letras de 0,06 em. Nunca menos de 11 px.

## 4. Espaço, raio, elevação, movimento, camadas Z

- **Espaço** (base 4): `half 2 · 1 4 · 2 8 · 3 12 · 4 16 · 5 20 · 6 24 · 8 32 · 10 40 · 12 48`.
- **Raio**: `sm 4 · md 6 (controles) · lg 10 (cartões, barra flutuante) · xl 14 (diálogos) · full`.
- **Elevação**: `1` (amostras), `2` (barras flutuantes), `3` (gavetas, diálogos, menus).
- **Duração**: `fast 120 ms` (hover), `base 200 ms` (gaveta), `slow 320 ms`. Com `prefers-reduced-motion`, nada se anima.
- **Z**: `panel 10 · drawer 30 · popover 40 · toast 50 · dialog 60 · estop 100`. A barra superior fica **acima** do fundo de diálogos e gavetas, então o PARAR nunca fica encoberto.

## 5. Densidade

| Token | Compacta | Confortável |
|---|---|---|
| `control-h` | 28 | 44 |
| `icon-btn` | 32 | 48 |
| `row-h` | 30 | 48 |
| `hit-min` | 24 | 44 |
| `handle` / `handle-hit` | 8 / 16 | 16 / 44 |
| `font-body` | 13 | 15 |
| `gap` | 8 | 12 |
| `jog-btn` | 44 | 72 |

## 6. Inventário de componentes

Cada componente existe no protótipo (`prototypes/app/`), salvo indicação.

| Componente | Anatomia e regras | Estados |
|---|---|---|
| **Barra superior** | marca · arquivo (com ponto de "não salvo") · seletor de modo · *espaçador* · **chip de estado** · Conectar · ⚙ · **PARAR** | no estreito: só símbolo, estado, conectar (ícone), ⚙; o PARAR vai para a barra inferior |
| **Chip de estado** | círculo com ícone + palavra, borda e fundo na cor do estado. Clique abre o painel Máquina | 6 estados visuais; listras (run) e piscar (alarm) |
| **PARAR** | octógono branco + palavra, vermelho com anel amarelo, ≥ `control-h + 8` | hover mais claro, ativo encolhe 3 % |
| **Trilho de ferramentas** | botões de ícone `icon-btn`, grupos separados por linha, desfazer/refazer no pé. Ferramentas ainda não implementadas aparecem esmaecidas e mostram um *toast* | `aria-pressed` na ferramenta ativa |
| **Barra flutuante do canvas** | Seleção múltipla e Seleção por área (só no modo toque) · zoom − · ajustar · zoom + | alternâncias com `aria-pressed` |
| **Paleta de camadas** | 13 amostras com código, cada uma com `icon-btn − 4`. Contorno = camada atual, ponto = camadas da seleção | toque troca a camada da seleção ou define a camada atual |
| **Tabela de camadas** | linha: amostra/código · modo + nº de objetos · vel · pot · passadas · ≈tempo · **Enviar ao laser** · **Mostrar** · expandir. A ordem da lista é a ordem de saída | expandida: modo (segmentado), velocidade e potência (slider + campo), passadas, intervalo, ar, ↑/↓ ordem, "Aplicar material…" |
| **Inspetor** | X/Y (centro, Y para cima) · largura · altura · rotação · manter proporção · texto · ajustes de imagem · camada · alinhar · ações | campos ao vivo durante o arraste |
| **Campo numérico** | rótulo arrastável (*scrub*) · valor mono à direita · unidade · (− +) no toque. Aceita expressões e unidades | foco com borda âmbar; valor inválido volta ao anterior |
| **Slider** | sempre pareado com campo numérico; trilho de 44 px no toque | — |
| **Controle segmentado** | opções mutuamente exclusivas; a ativa tem fundo e sublinhado âmbar | quebra linha em `.wrap` |
| **Painel da máquina** | Conexão · Trabalho (progresso, decorrido, restante, camada, linha N de M, Iniciar/Pausar/Parar, Contorno) · Início do trabalho + âncora 3×3 · DRO + jog 3×3 + passos + contínuo + desbloquear/origem · Botões personalizados · Simular falha | desabilitados conforme o estado; Pausar ↔ Continuar |
| **DRO** | X e Y em mono 22 px, na unidade atual | — |
| **Console** | log mono com prefixos `›` (enviado), `‹` (recebido), `✕` (erro), `•` (sistema); a cor não é a única pista. Entrada de comando + Enviar. Filtro de relatórios de status | rolagem automática; até 400 linhas |
| **Barra de status** | estado · cabeçote XY · seleção L×A · progresso · mm/pol (alternável) · zoom · tipo de entrada | escondida no estreito |
| **Barra inferior** | só no estreito: Iniciar · Pausar · Contorno · PARAR, ícone sobre o rótulo | espelha o estado dos botões do painel |
| **Faixa de alarme** | sobre o canvas: ícone ⚠, título, corpo com linha e o que já foi feito, Desbloquear · Recuperar trabalho… | alarme, PARAR, conexão perdida |
| **Diálogo** | cabeçalho (título + fechar) · corpo rolável · rodapé com ações à direita (primária por último). **Não modal**: fundo próprio abaixo da barra superior. Esc fecha. Clicar no fundo fecha, exceto na confirmação de disparo (para não cancelar por toque acidental) | foco vai para o primeiro controle e volta ao fechar |
| **Confirmação de disparo** | resumo mono · checklist · nota de pausa/parada · Cancelar · **Disparar laser** (habilita após 3 s, com contagem no rótulo) | — |
| **Recuperação** | causa · 4 opções (uma "recomendado") · referenciar · restaurar origem · Agora não · Continuar daqui | a recomendação muda com a causa |
| **Toast** | ícone + frase, 3,5 s (erro 6 s), no máximo 3 empilhados, `role=status` (erro `alert`) | ok / aviso / erro / info |
| **Menu de contexto** | ações de 44 px + grade de cores de camada | clique direito ou toque longo |
| **Boas-vindas** | herói (símbolo + título Space Grotesk) · cartões grandes · rodapé com crédito ao LaserGRBL/Diego Settimi · pontos de progresso | 5 passos (início, máquina, conexão, migrar, pronto) |
| **Configurações** | tema, alto contraste, densidade, idioma, unidades, atalhos, rever boas-vindas | — |
| *Pendentes de design* | diálogo de importação SVG/DXF, editor de botões personalizados, biblioteca de materiais, teste de material, editor `$$`, uso do laser | — |

## 7. Ícones

Desenho próprio (`prototypes/app/icons.js`): grade de 24, traço de 1,75 com pontas e junções arredondadas, preenchimento só onde ajuda a leitura (play, pause, stop, PARAR). Cerca de 80 ícones, licença do projeto (GPL-3.0-or-later). Ícones nunca aparecem sozinhos em ações destrutivas ou de máquina: têm rótulo visível ou, no mínimo, `aria-label` + `title`.

## 8. i18n

- Strings em chaves (`FK.t('machine.start')`), com placeholders. pt-BR é a referência. `de` é usado como teste de comprimento.
- Componentes **crescem ou quebram linha** em vez de cortar. Onde cortar é inevitável (abas, linhas de tabela), há reticências + `title`.
- Números, decimais e tempos formatados com `Intl.NumberFormat` do idioma (vírgula decimal em pt-BR e de).
- "FreeKerf" nunca é traduzido.
