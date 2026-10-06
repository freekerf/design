# Pesquisa: LightBurn, LaserCut, open source e LaserGRBL

> Escopo: fluxos e padrões de interação. **Não copiamos** identidade visual, ícones, nomes ou assets de nenhum produto. As observações sobre LightBurn e LaserCut vêm da documentação pública, de manuais e de discussões de usuários (fontes no fim). Os "atritos" são queixas que se repetem em fóruns e tutoriais, não testes de usabilidade nossos.

## 1. LightBurn (comercial, Win/macOS/Linux)

**Layout geral.** O canvas fica ao centro, com régua e grade da mesa. À esquerda há a barra de ferramentas de criação/edição; em cima, barras de arquivo, modificação, alinhamento e arranjo. As janelas acopláveis ficam à direita, com abas empilhadas: **Cuts / Layers**, **Laser** (controle da máquina), **Move**, **Console**, **Library**, **Shape Properties**, **Camera Control**. Embaixo do canvas fica a **paleta de cores**, que é o seletor de camadas. Tudo pode ser reorganizado e salvo.

**Camadas por cor = parâmetros.** Cada cor da paleta é uma camada de operação. Selecionar objetos e clicar numa cor move os objetos para aquela camada. A tabela Cuts/Layers lista as camadas em uso com modo (*Line*, *Fill*, *Offset Fill*, *Image*), velocidade, potência mín./máx., passadas, saída on/off, mostrar/ocultar e air assist. Um duplo clique abre o editor completo da camada (intervalo, overscan, ângulo de varredura, sub-camadas…). A ordem da tabela é a ordem de saída. Existem camadas especiais T1/T2 (*tool layers*), que aparecem no canvas mas não vão para o laser.

**Desenho e edição.** Retângulo, elipse, polígono, linha/curva Bézier, texto (com texto variável e texto em curva). Edição de nós com troca entre linha e curva, quebra e junção. Booleanas: união, subtração, interseção e **weld** (solda de vários objetos de uma vez). Offset, arrays em grade e circulares, alinhar/distribuir, agrupar, *Close Path*, *Auto-Join*, otimização de caminhos.

**Importação e trace.** Importa SVG, DXF, AI/PDF, imagens raster. Traçar imagem com limiar, suavização e *ignore less than*. Ajustes de imagem por objeto: brilho, contraste, gama, modo de pontilhado (threshold, ordered, Atkinson, Floyd–Steinberg, Jarvis, Stucki, grayscale…).

**Janela Laser.** Conectar/selecionar dispositivo, **Start / Pause / Stop**, **Frame** (retângulo do trabalho com laser desligado, ou baixo em alguns controladores), **Home**, **Go to Origin**, *Send / Save GCode*, e **Start From**: *Absolute Coords*, *Current Position*, *User Origin*. A **Job Origin** é uma grade 3×3 de ancoragem. Há opções "Cut selected graphics" e "Use selection origin". A janela Move tem jog com passos e velocidade, e o Console mostra o G-code e as respostas.

**Preview e tempo.** Uma janela de preview simula o caminho com cortes e deslocamentos e dá uma estimativa de tempo. A **Material Library** guarda presets por material e espessura. **Câmera**: calibração de lente e alinhamento, com captura sobreposta ao canvas para posicionar o desenho sobre o material. **Print and cut**, rotary, *Material test* (grade de potência × velocidade).

**O que funciona bem**
- O modelo cor → camada → parâmetros é aprendido em minutos e virou padrão de mercado.
- A paleta sempre visível embaixo do canvas permite trocar camada em um clique.
- Frame + Start From + Job Origin juntos resolvem o "onde vai gravar?".
- A biblioteca de materiais e o teste de material fecham o ciclo de calibração.
- A comunidade e a documentação são grandes.

**Atritos conhecidos**
- **Janelas demais**: muitos painéis acopláveis. Iniciantes "perdem" a janela Laser ou a Cuts/Layers e não sabem como reabrir. Painéis comprimidos ficam ilegíveis em telas pequenas.
- **Tabela de camadas densa**: mostra "multi" quando há sub-camadas e obriga a abrir camada por camada para conferir os parâmetros. O editor de camada é modal.
- **Camadas de ferramenta e Frame**: dúvidas recorrentes sobre o que entra no contorno e em que ordem as camadas saem.
- **Touch**: a interface é feita para mouse. Alvos pequenos, menus por hover, sem gestos de canvas além do básico. Usar num tablet de bancada exige remote desktop.
- Licença paga por dispositivo/ano de atualizações. O código não é aberto.
- Estado da máquina pouco visível em relação ao canvas: está numa janela e não numa faixa fixa.

## 2. LaserCut (Leetro/LaserCut 5.x, e variações Thunder/RDWorks)

**Layout geral.** Interface Windows clássica (MFC): menu e barras de ícones em cima, barra de desenho vertical à esquerda, canvas ao centro. À direita fica um painel fixo com abas: **Layer/Process** (lista de camadas) e **Laser Work / Control** (operação da máquina). Ao lado, uma barra de cores que atribui a camada.

**Camadas por cor.** Cada cor é uma camada com modo (*Cut*, *Engrave/Scan*, *Hole/Dot*, *Grade engrave*), velocidade, potência mín./máx. (por tubo) e "corner power". A lista é ordenada de cima para baixo como **ordem de processamento**. Há colunas de **Output** (sai ou não) e **Times** (passadas). Um duplo clique abre o diálogo de parâmetros, com aba de parâmetros auxiliares (offset de entrada, *seal*, sopro).

**Desenho e edição.** Linha, polilinha, retângulo, elipse, texto TrueType. Edição de nós básica. Offset ("Make Curve Offset"), array, alinhar, "Close curve", "Delete overlap", **otimização de caminho** e definição de direção/ponto inicial de corte. Booleanas são limitadas.

**Importação.** DXF, PLT/HPGL, AI, BMP/JPG, com dithering simples e trace limitado.

**Controle da máquina.** **Download** do arquivo para a memória do controlador, então a máquina roda sozinha mesmo sem o PC. Start/Pause/Stop no painel e no teclado da máquina. **Run Box / Frame** (anda o retângulo). **Set origin** com origem relativa ou absoluta. Botões de direção (jog). "Path simulation" com **tempo estimado**. Console limitado.

**O que funciona bem**
- **Painel fixo** e sempre no mesmo lugar: o operador de produção não "perde" nada.
- Lista de camadas com **Output** e **Times** visíveis sem abrir diálogos.
- **Download para o controlador** e operação pelo painel da máquina, bom para produção em série.
- Simulação de caminho com tempo, confiável para orçar.

**Atritos conhecidos**
- Visual datado, traduções inconsistentes, diálogos modais em cascata.
- Só Windows e só controladores do fabricante. Instalação com drivers e, em algumas versões, dongle.
- Ferramentas de desenho fracas: o fluxo típico é desenhar em outro programa e importar DXF.
- Estabilidade e travamentos com arquivos grandes. Pouca documentação oficial atualizada.
- Nada pensado para touch.

## 3. O melhor dos dois para o FreeKerf

| Do LightBurn | Do LaserCut |
|---|---|
| cor = camada com a paleta sempre visível | painel de máquina **fixo e sempre no mesmo lugar** |
| Start From + âncora 3×3 + Frame | colunas *Saída* e *Passadas* visíveis na lista |
| biblioteca de materiais + teste de material | simulação com tempo confiável |
| ferramentas de desenho fortes (booleanas, offset, array) | separação clara entre preparar e produzir |

E o que nenhum dos dois faz bem e o FreeKerf assume como diferencial: **touch de verdade**, **estado da máquina sempre visível com PARAR alcançável**, **dois modos (Projetar/Produzir) em vez de dezenas de janelas**, **software livre multiplataforma** e **importação do LaserGRBL**.

## 4. Open source existente

| Projeto | O que faz bem | Como o FreeKerf se diferencia |
|---|---|---|
| **Rayforge** (Python, GTK4/Libadwaita, Linux/Windows) | UI moderna e nativa do GNOME. Editor paramétrico com restrições. Contorno, raster, *shrink-wrap*, tabs de sustentação, overscan e compensação de kerf. Câmera. Macros/hooks de G-code. Biblioteca com 60+ materiais. Lê/escreve `$$`. | Foco em **touch/tablet e bancada** (Rayforge é desktop GNOME). Núcleo em Rust para canvas pesado. **Migração do LaserGRBL** e da sua base de usuários (Windows, diodo). Modo Produzir separado. macOS e iPad no roadmap. |
| **MeerK40t** (Python/wxPython, MIT) | Suporte de hardware enorme: K40/Lihuiyu, galvo JCZ/Ezcad, GRBL, Ruida, Moshi, Newly. Árvore de elementos/operações com classificação automática. Console de comandos muito poderoso e scriptável. Interface AUI configurável. | MeerK40t privilegia flexibilidade e poder ("tudo é configurável"), o que gera uma interface densa. O FreeKerf privilegia **fluxo guiado e opinativo**, com alvos grandes, poucos painéis e segurança visível. Foco inicial em GRBL/grblHAL, onde está a base do LaserGRBL. |
| **OpenKerf** (Svelte no navegador + extensão Python sobre o MeerK40t, MIT; catálogo de parâmetros CC BY 4.0) | Interface web moderna, camadas em ordem de queima, **checagens pré-voo** e visualização passo a passo do caminho. Biblioteca em SQLite, grade de teste com QR code, geradores (caixa com encaixe, *living hinge*), texto variável a partir de CSV, trabalhos em mosaico. Muitos testes automatizados. | **Nome parecido: atenção à marca.** OpenKerf usa o motor do MeerK40t e foi usado "de verdade" principalmente em controladores Ruida (CO₂). O FreeKerf é GRBL-first, tem núcleo próprio em Rust e é um app nativo multiplataforma (não um servidor web local). Nossa identidade (K-corte âmbar) evita qualquer semelhança visual. Vale citar a diferença na documentação e evitar "Kerf" isolado como apelido. |

## 5. O LaserGRBL atual: o que **precisa** existir no FreeKerf

Levantado lendo `MainForm.cs`, `JogForm.cs`, `SettingsForm.cs`, `CustomButton*.cs`, `SafetyCountdown.cs`, `ResumeJobForm.cs`, `LaserUsage.cs`, `RasterConverter/`, `SvgConverter/`, `Core/`, `ComWrapper/`, `Generator/`, `PSHelper/`.

### Conexão e firmware
- **Firmwares**: `Grbl` (incl. variantes Ortur e Longer, detecção grblHAL e estado `Tool`), `Smoothie`, `Marlin`, `VigoWork` (`Core/*Core.cs`).
- **Transporte** (`ComWrapper/`): serial USB (duas implementações + RJCP), **Telnet**, **WebSocket ESP8266 (LaserWeb)**, **emulador** interno de Grbl.
- **Streaming**: *Buffered*, *Synchronous*, *RepeatOnError*. Modelo de threads configurável. Reset do Grbl ao conectar.
- **Descoberta Wi-Fi** (`WiFiDiscovery/`) e assistentes de configuração Wi-Fi de fabricantes.
- **Gravar firmware** Grbl (`.hex` via avrdude) e instalar o driver CH340 (só Windows).
- **Editor de configuração `$$`** (`GrblConfig`), com importar/exportar.

### Estados da máquina (`MacStatus`)
`Disconnected, Connecting, Idle, Run, Hold, Door, Home, Alarm, Check, Jog, Queue, Cooling, AutoHold, Tool`. O FreeKerf precisa representar **todos**, agrupados em 6 estados visuais (veja `ux.md`).

### Controle
- **Jog** (`JogForm`): 8 direções + Home + Z±, passo e velocidade por slider, jog contínuo (pressionar/soltar) com cancelamento, F máximo lido do firmware.
- Home `$H`, desbloquear `$X`, soft reset, ir para origem, definir origem.
- **Botões personalizados** (`CustomButton`): legenda, tooltip, **ícone**, G-code com **variáveis/expressões** (`ExpressionEvaluator`); tipos *Button*, *TwoStateButton* (G-code 1/2) e *PushButton* (pressionar/soltar); habilitação *Always / Connected / Idle / Run / IdleProgram*; reordenar; **exportar/importar `.zbn`**; conjunto padrão `StandardButtons.zbn`.
- **Contagem regressiva de segurança** (`SafetyCountdown`): 5 s com bipe, cancelável; pode ser silenciada ou desligada nas configurações.
- **Retomar trabalho** (`ResumeJobForm`): diante de `StopResponding`, `UnexpectedReset`, `ManualReset`, `ManualDisconnect`, `UnexpectedDisconnect`, `ManualAbort` ou `MachineAlarm`, oferece *desde o início*, *algumas linhas antes* (17 linhas antes do buffer executado), *a partir da última enviada* ou *a partir da linha N*, mais **refazer homing** e **restaurar WCO** (origem de trabalho). A opção recomendada depende da causa. O protótipo reproduz essa lógica.
- **Rodar a partir da posição** (`RunFromPositionForm`), **várias passadas** e **auto-resfriamento** (pausas programadas).
- **Detector de problemas** (`IssueDetectorForm`) e log de sessão/comunicação.

### Arquivos e conversão
- Abrir **G-code** (`.nc/.cnc/.tap/.gcode/.ngc`), **imagens** (`bmp/png/jpg/gif`), **SVG**, **DXF** e projeto **`.lps`**. Anexar arquivo (*append*) e reabrir.
- **Raster** (`RasterConverter/`): ferramentas *Line2Line*, *Dithering*, *Vectorize* (Potrace), *Centerline* (Autotrace), *NoProcessing*. **12 dithers** (Floyd–Steinberg, Atkinson, Burkes, Jarvis-Judice-Ninke, Sierra 2/3/Lite, Stucki, aleatório…). **15 padrões de preenchimento** (horizontal, vertical, diagonal, grade, cruz, quadrados, zigue-zague, **Hilbert**, *inset filling*…). Brilho/contraste/branco, Hi-Res, gravação unidirecional, ajuda de resolução.
- **SVG/DXF com camadas por cor** (`SvgLayerAccordion`, `SvgColorLayer`), **DXF com arcos verdadeiros**, **splines → arcos** com tolerância (`ArcFitter`, `BezierTools`).
- Cabeçalho, rodapé e G-code entre passadas configuráveis.

### Ferramentas e geradores
- **Teste de corte** (`CuttingTest`), **potência × velocidade** (`PowerVsSpeedForm`), **shake test**, teste de precisão (SVG), teste de escala de cinza. Texto vetorial Hershey para rotular as grades.
- **Biblioteca de materiais** (`PSHelper/MaterialDB`, `StandardMaterials.psh`) por modelo de laser, material, espessura e ação.
- **Uso do laser** (`LaserUsage`, `LaserLifeEdit`): contadores por módulo (tempo e classe de potência), data de "morte", último laser usado.

### Interface e sistema
- **Atalhos de teclado configuráveis** (`HotKeysManager`), **18+ idiomas** (`*.resx`), temas de cor (`ColorScheme`), preview 2D/3D (OpenGL), sons por evento (conectar, desconectar, sucesso, aviso, erro), **notificação Telegram** no fim do trabalho, verificação de atualização, impedir suspensão do sistema durante o trabalho, várias instâncias.

## 6. Matriz de funcionalidades

Legenda: ✅ tem · ◐ parcial/limitado · — não tem. Prioridade FreeKerf: **MVP** (primeira versão utilizável), **v1** (paridade com LaserGRBL e o essencial do LightBurn), **depois**.

| Funcionalidade | LightBurn | LaserCut | LaserGRBL | FreeKerf | Prioridade |
|---|:-:|:-:|:-:|---|:-:|
| GRBL / grblHAL | ✅ | — | ✅ | núcleo | MVP |
| Smoothie / Marlin | ✅ | — | ✅ | adaptadores | v1 |
| Ruida / galvo / Leetro | ✅ | ✅ (Leetro) | — | plugin | depois |
| Serial USB | ✅ | ✅ | ✅ | ✅ | MVP |
| Telnet / WebSocket Wi-Fi | ◐ | — | ✅ | ✅ + descoberta | v1 |
| Simulador de máquina | — | — | ✅ (emulador) | ✅ | MVP |
| Estado da máquina sempre visível | ◐ | ◐ | ✅ (barra) | faixa fixa + PARAR | MVP |
| Jog passo + contínuo | ✅ | ✅ | ✅ | ✅ (homem-morto no touch) | MVP |
| Home / desbloquear / origem | ✅ | ✅ | ✅ | ✅ | MVP |
| Frame (contorno) | ✅ | ✅ | — | ✅ | MVP |
| Start From + âncora 3×3 | ✅ | ◐ | — | ✅ | MVP |
| Confirmação antes de disparar | — | — | ✅ (contagem) | checklist + contagem | MVP |
| Retomar após falha | ◐ (start from) | — | ✅ | ✅ (lógica do LaserGRBL) | MVP |
| Botões personalizados | ◐ (macros) | — | ✅ | ✅ + import `.zbn` | MVP |
| Console G-code | ✅ | ◐ | ✅ | ✅ | MVP |
| Camadas por cor | ✅ | ✅ | ◐ (SVG/DXF) | ✅ | MVP |
| Modos linha / preencher / imagem | ✅ | ✅ | ◐ | ✅ | MVP |
| Formas, texto, mover/escala/rotação | ✅ | ✅ | — | ✅ | MVP |
| Importar SVG / DXF com camadas | ✅ | ✅ | ✅ | ✅ | MVP |
| Importar imagem + dithering | ✅ | ◐ | ✅ (12 dithers) | ✅ | MVP |
| Abrir G-code pronto | ◐ | — | ✅ | ✅ | MVP |
| Preview com tempo estimado | ✅ | ✅ | ✅ | ✅ simulação no canvas | MVP |
| Migração do LaserGRBL | — | — | — | ✅ | MVP |
| Touch / tablet | — | — | — | ✅ | MVP |
| i18n | ✅ | ◐ | ✅ (18+) | ✅ (aproveitar traduções) | MVP |
| Edição de nós | ✅ | ◐ | — | ✅ | v1 |
| Booleanas / solda / offset | ✅ | ◐ | — | ✅ | v1 |
| Array / alinhar / distribuir | ✅ | ✅ | — | ✅ | v1 (alinhar no MVP) |
| Trace (vetorizar) | ✅ | ◐ | ✅ (Potrace/centerline) | ✅ | v1 |
| Biblioteca de materiais | ✅ | ◐ | ✅ | ✅ | v1 (importação no MVP) |
| Teste de material (grade) | ✅ | — | ✅ | ✅ | v1 |
| Contador de uso do laser | — | — | ✅ | ✅ | v1 |
| Editor `$$` | ✅ | — | ✅ | ✅ | v1 |
| Gravar firmware | — | — | ✅ (Windows) | ◐ (link/assistente) | depois |
| Câmera / sobreposição | ✅ | — | — | ✅ | depois |
| Rotary | ✅ | ✅ | — | ✅ | depois |
| Texto variável / CSV | ✅ | — | — | ✅ | depois |
| Download para controlador | ◐ (Ruida) | ✅ | — | — (GRBL é streaming) | depois |
| Controle remoto por tablet | — | — | — | ✅ (`freekerf-core` + cliente) | depois (avaliar) |
| Notificações (som, Telegram…) | ◐ | — | ✅ | ✅ (sons no MVP) | v1 |

## Fontes

- LightBurn: [Coordenadas e origem do trabalho](https://docs.lightburnsoftware.com/latest/GetStarted/CoordinatesOriginBeginner/), [Framing](https://docs.lightburnsoftware.com/2.0/GetStarted/FramingBeginner/), [Basic Usage (legado)](https://docs.lightburnsoftware.com/legacy/BasicUsageEssentials), [Documentation no GitHub](https://github.com/LightBurnSoftware/Documentation/blob/master/CoordinatesOrigin.md), [Thunder Laser: Job Origin e Start From](https://support.thunderlaserusa.com/portal/en/kb/articles/tips-and-tricks-for-using-the-job-origin-and-start-from-in-lightburn-with-your-thunder-laser-nova-odin-and-bolt-series-laser), [zapcraft: Framing, Start From e Job Origin](https://zapcraft.net/lightburn-framing-start-from-job-origin/)
- Atritos do LightBurn: [Cut layer issues](https://forum.lightburnsoftware.com/t/cut-layer-issues/175705), [Cuts/Layers não muda o modo](https://forum.lightburnsoftware.com/t/cuts-layers-window-will-not-let-me-change-mode/132315), [editor de corte cortado](https://forum.lightburnsoftware.com/t/cut-setting-editor-not-functioning-properly-cutting-off-left-side-that-selects-layer-colors/75965), [tool layer framing](https://forum.lightburnsoftware.com/t/tool-layer-framing/192106), [Frame e "No layers selected"](https://forum.lightburnsoftware.com/t/same-old-frame-and-no-layers-selected-for-output-bug/118449)
- LaserCut: [Manual DSP 5.3 (MPC6515)](https://wiki.makeict.org/images/5/5d/RL-80-1290_User_Manual.pdf), [CoMakingSpace Wiki](https://wiki.comakingspace.de/LaserCut_5.3), [Bristol Hackspace: preparação de arquivo](https://wiki.bristolhackspace.org/equipment/cnc/laser/prep), [co2-lasers.com](https://www.co2-lasers.com/blog/leetro-laser-controller-lasercut-5-3-software-for-mpc6535/)
- Rayforge: [GitHub](https://github.com/barebaric/rayforge), [rayforge.org](https://rayforge.org/), [LinuxLinks](https://www.linuxlinks.com/rayforge-laser-cutters-engravers-tool/)
- MeerK40t: [GitHub](https://github.com/meerk40t/meerk40t), [DeepWiki: funcionalidades](https://deepwiki.com/meerk40t/meerk40t/1.2-main-features), [Diode Laser Wiki](https://diode-laser-wiki.com/documentation/meerk40t-alternative-to-lightburn-and-lasergrbl/)
- OpenKerf: [GitHub](https://github.com/openkerf/openkerf)
- LaserGRBL: código-fonte deste repositório (GPLv3, © Diego Settimi).
