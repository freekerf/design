# Interação: mouse, teclado, caneta e toque

Princípio: **toda ação tem pelo menos dois caminhos**, um por ponteiro (mouse/caneta/dedo) e um por teclado ou por botão visível. Nada depende só de hover, só de clique direito ou só de gesto.

## 1. Detecção de entrada e densidade

- Usamos **Pointer Events** (`pointerType`: `mouse`, `pen`, `touch`) em todo o canvas e nos controles.
- Densidade **Automática** (padrão):
  - na partida: `matchMedia('(pointer: coarse)')` → **Confortável**, senão **Compacta**;
  - depois: o **último `pointerdown`** decide. Toque → Confortável; mouse/caneta → Compacta. Num notebook touch, a interface cresce quando a pessoa toca a tela e encolhe quando volta ao trackpad.
  - Para não "pular" no meio de uma ação, a troca só acontece num `pointerdown` novo, nunca durante um arraste.
- O usuário pode **fixar** Compacta ou Confortável nas configurações. A barra de status mostra o ícone da entrada atual + "auto".

| Token | Compacta (mouse/caneta) | Confortável (toque) |
|---|---|---|
| `--fk-control-h` | 28 px | **44 px** |
| `--fk-icon-btn` | 32 px | **48 px** |
| `--fk-row-h` (linhas de camadas) | 30 px | 48 px |
| `--fk-hit-min` | 24 px (WCAG 2.5.8 AA) | **44 px** (WCAG 2.5.5 AAA / HIG) |
| `--fk-handle` / `--fk-handle-hit` (alças) | 8 / 16 px | 16 / **44 px** |
| `--fk-jog-btn` | 44 px | **72 px** |
| corpo de texto | 13 px | 15 px |

## 2. Regras de toque

1. **Alvo mínimo 44×44 px** no modo confortável. Alvos visuais menores (ex.: alça de 16 px) têm área de toque de 44 px.
2. **Nada só por hover.** Tooltips viram `title` + `aria-label`. No toque, a mesma informação aparece em texto (rótulo visível, linha de parâmetros, *toast*) ou por toque longo.
3. **Clique direito ↔ toque longo (500 ms)** abrem o mesmo menu de contexto, com itens de 44 px e as cores de camada em quadrados de 40 px.
4. **Sem gestos de borda** que briguem com o sistema (voltar no Android, Central de Controle no iPad).
5. **Feedback háptico** curto (`navigator.vibrate(12)`) ao entrar em toque longo e em seleção por área, quando suportado.
6. **Rejeição de palma** com caneta: enquanto houver ponteiro `pen` ativo, ignorar `touch` no canvas.

## 3. Gestos no canvas

| Ação | Mouse / trackpad | Caneta | Toque |
|---|---|---|---|
| Selecionar | clique | toque da ponta | **toque** |
| Somar/tirar da seleção | Shift/Ctrl+clique | botão lateral + toque | botão **Seleção múltipla** (alterna) e depois toques |
| Mover | arrastar objeto | arrastar | **arrastar objeto** (limiar de 8 px para não mover sem querer) |
| Redimensionar | alças (cantos proporcionais por padrão; Shift inverte; Alt = a partir do centro) | idem | alças grandes. "Manter proporção" no inspetor substitui o Shift |
| Girar | alça circular acima da caixa (Shift = passo de 15°) | idem | alça circular. **Encaixe automático de 5°** |
| Pan | botão do meio, **Espaço+arrastar**, Shift+roda (horizontal) | botão lateral + arrastar | **1 dedo no vazio** ou 2 dedos |
| Zoom | **roda** (no cursor), Ctrl+roda/pinça do trackpad, + / − | — | **pinça** (centro entre os dedos) |
| Ajustar à mesa | F, Ctrl+0, botão | botão | botão |
| Seleção por área | arrastar no vazio: **→ janela** (só o que fica todo dentro), **← cruzamento** (o que encosta, tracejado) | idem | **toque longo no vazio + arrastar**, ou botão **Seleção por área** e depois arrastar |
| Menu de contexto | clique direito | botão lateral | **toque longo** no objeto |
| Cancelar | Esc | Esc | tocar no vazio (limpa a seleção) |

**Dois dedos interrompem tudo:** se um segundo dedo pousa durante um arraste, o arraste é **desfeito** (o objeto volta à posição) e o gesto vira pinça/pan. Isso evita mover uma peça por acidente ao dar zoom.

### Edição de nós com o dedo (v1; fora do protótipo)
- Toque num caminho em modo **Nós (N)** mostra os nós como círculos de 16 px com área de 44 px.
- Arrastar move o nó. **Toque longo num nó** abre o menu: excluir, quebrar, linha↔curva, suavizar.
- **Toque no segmento** insere um nó.
- **Lupa:** ao arrastar um nó, aparece uma lupa 2× deslocada 60 px acima do dedo, para o dedo não cobrir o ponto.
- **Arraste de precisão:** com dois dedos parados em outro lugar da tela, o movimento do nó fica 4× mais lento.
- Alças de Bézier aparecem só no nó ativo, para não poluir a tela.

## 4. Campos numéricos e sliders

- **Campo com unidade** (`mm`, `pol`, `°`, `%`, `mm/min`). Aceita **expressões e unidades**: `10+5`, `2,5 pol`, `1in`, `25.4mm`. Vírgula e ponto valem como separador decimal.
- **Scrub:** arrastar o rótulo do campo na horizontal muda o valor. Shift = ×10, Alt = ×0,1, e no toque o ganho é menor.
- **Setas ↑/↓** no campo somam o passo (Shift ×10, Alt ×0,1).
- **No modo confortável** aparecem **botões − / +** de 44 px dentro do campo.
- **Sliders**: trilho alto (44 px) e polegar ampliado no modo confortável, sempre **pareados com um campo numérico** para valores exatos (nunca slider sozinho).

## 5. Jog por toque

- **Cruz 3×3** com diagonais e Home no centro. Botões de 72 px no modo confortável.
- **Passos** em controle segmentado: 0,1 · 1 · 10 · 50 mm (configuráveis).
- **Modo passo** (padrão): cada toque move um passo.
- **Modo contínuo** ("segure para mover"): **homem-morto**. Move enquanto o dedo está na tecla e envia o cancelamento de jog ao soltar, sair, perder a captura do ponteiro ou o app perder o foco.
- **Joystick analógico: não no MVP.** Um joystick livre facilita movimentos involuntários e é difícil de parar com precisão sobre a peça. Se entrar no futuro: zona morta de 20 %, velocidade proporcional limitada a 50 % do máximo e o mesmo homem-morto.
- Em rede (tablet remoto), o jog contínuo só funciona com *heartbeat*. Sem confirmação em 300 ms, a máquina para.

## 6. Teclado

Os atalhos seguem convenções de editores gráficos, e o **esquema "LaserGRBL"** (opcional, importado na migração) mantém os atalhos do usuário. A lista completa fica no app em ⚙ → Atalhos de teclado.

| Grupo | Atalho | Ação |
|---|---|---|
| Ferramentas | V / R / E / T / N | Selecionar / Retângulo / Elipse / Texto / Nós |
| Edição | Ctrl+Z · Ctrl+Shift+Z / Ctrl+Y | Desfazer · Refazer |
| | Ctrl+D · Del · Ctrl+A | Duplicar · Excluir · Selecionar tudo |
| | setas (Shift 10 mm, Alt 0,1 mm) | Mover seleção |
| | Ctrl+I | Importar |
| | Esc | Cancelar ferramenta / limpar seleção |
| Vista | + / − · F · Ctrl+0 | Zoom · Ajustar à mesa |
| | Espaço + arrastar | Pan |
| | Ctrl+1 / Ctrl+2 | Projetar / Produzir |
| Máquina | **F5** | Iniciar (abre a confirmação) |
| | **F6** | Pausar / continuar |
| | **F7** | Contorno |
| | **Esc** (com trabalho rodando) | Pausar (feed hold) |
| | **Shift+Esc** | **PARAR**, funciona em qualquer lugar, até em campos de texto |

- **Foco visível** sempre (anel âmbar de 2 px). Ordem de tabulação: barra superior → ferramentas → canvas → painéis.
- O **canvas é focável**. Setas movem a seleção e as camadas mudam de cor pelo menu de contexto (tecla Menu / Shift+F10, na versão real).
- Nenhum atalho de uma tecla dispara o laser. **Iniciar sempre passa pela confirmação.**

## 7. Layouts responsivos

| Layout | Gatilho | Composição | Justificativa |
|---|---|---|---|
| **Largo** | ≥ 1180 px | trilho de ferramentas · canvas · dock 300–380 px (Camadas fixo no topo + abas Objeto/Máquina/Console) | camadas e propriedades lado a lado sem trocar de aba, como no LightBurn, mas com um dock só |
| **Médio** | 820–1179 px | trilho · canvas · **trilho de painéis** à direita. Painéis abrem como **gaveta** por cima do canvas, com o fundo escurecido abaixo da barra superior. Em Produzir, a Máquina fica acoplada | o canvas precisa de largura. Gaveta é o padrão de tablet. O fundo nunca cobre o PARAR |
| **Estreito** | < 820 px | preview (≈40 % da altura) · abas Máquina/Console/Camadas · **barra inferior** Iniciar/Pausar/Contorno/PARAR | monitoramento e operação, sem edição (ver `ux.md`). Ações na zona do polegar |

- Tablet 1024×768 paisagem → **Médio**. Tablet 768×1024 retrato → **Estreito**. Celular 375×812 → **Estreito**.
- O layout é definido por largura (não por tipo de dispositivo). A densidade, pelo tipo de entrada. São eixos independentes: um monitor touch de 24" é **Largo + Confortável**.
- Ao redimensionar, a vista mantém o centro do canvas. Ao trocar de layout, refaz o "ajustar à mesa".
- Strings longas: rótulos de botão quebram linha em vez de cortar. Abas e linhas de tabela usam reticências + `title`. Nas gavetas, só a aba ativa mostra o rótulo e as outras viram ícones com nome acessível. Testado com alemão (`?lang=de`).

## 8. Uso em oficina

- **Tema escuro padrão** (pouca luz, sem ofuscar perto do feixe). O tema claro é para ambientes muito iluminados.
- **Alto contraste** opcional: preto puro, bordas brancas de 2 px, texto branco, âmbar mais claro.
- **Leitura à distância:** no modo Produzir, porcentagem em **40 px** mono e tempo restante em 18 px, no canto do canvas, legíveis a ~2 m. O token `--fk-font-size-readout-xl` (64 px) fica reservado para um futuro "modo painel" em tela cheia.
- **Óculos de proteção** (laranja/vermelhos para diodo 445 nm; verdes para fibra/Nd:YAG): azuis, cianos e violetas escurecem. Por isso:
  - estados têm **ícone + palavra + padrão** (listras no Executando, piscar no Alarme), nunca só a cor;
  - a cor de ação (âmbar) atravessa óculos laranja;
  - camadas têm **código de 2 dígitos** escrito na amostra, além da cor;
  - progresso usa listras + número, não só o preenchimento.
- **Luvas e dedos sujos:** alvos de 44–72 px, nada de gestos de 3+ dedos, confirmação com contagem de tempo (não com "segure por 3 s", que é ruim com luva).
- **Sons** (herança do LaserGRBL): conectar, desconectar, concluído, aviso, erro. Configuráveis, e o de alarme não pode ser silenciado durante um trabalho.
- `prefers-reduced-motion`: desliga as listras animadas e o piscar (mantém o padrão estático).
