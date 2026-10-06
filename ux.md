# Arquitetura de informação e fluxos

## Personas

| | **Bia, hobbista iniciante** | **Marcos, produção com CO₂** | **Rafa, operadora de bancada** | **Seu Jorge, vem do LaserGRBL** |
|---|---|---|---|---|
| Máquina | diodo 10 W, GRBL, 400×400 | CO₂ 80 W, grblHAL, 600×400 | a mesma CO₂ do Marcos | diodo Ortur, GRBL 1.1 |
| Equipamento | notebook Windows | desktop Linux + monitor | tablet 11" preso na máquina, luva às vezes | PC Windows antigo |
| Objetivo | gravar fotos e nomes em madeira para presentes | lotes de 50 peças cortadas, orçar tempo | trocar material, enquadrar, apertar Iniciar, vigiar | continuar usando seus botões e materiais |
| Medo | "vou queimar a mesa / pôr fogo" | perder um lote por falha no meio | errar a posição e estragar a chapa | reaprender tudo |
| Precisa | assistente, presets, confirmação clara | camadas visíveis, tempo confiável, recuperação | botões grandes, estado legível a 2 m, PARAR | importação, atalhos parecidos, mesmas funções |
| Modo principal | Projetar → Produzir | Projetar (desktop) + Produzir (tablet) | **Produzir** | Produzir com G-code pronto + Projetar simples |

## Estrutura

```
FreeKerf
├── Barra superior (sempre): marca · arquivo · [Projetar | Produzir] · ESTADO · Conectar · ⚙ · PARAR
├── Projetar
│   ├── Trilho de ferramentas (selecionar, nós, retângulo, elipse, texto · importar, vetorizar, câmera · solda, subtrair, offset, matriz, teste)
│   ├── Canvas (mesa em mm, réguas, grade, paleta de camadas)
│   └── Dock: Camadas (fixo no topo) + [Objeto | Máquina | Console]
├── Produzir
│   ├── Canvas como preview (sem edição): cabeçote, rastro, contorno do trabalho, leitura grande de %/tempo
│   └── Dock: [Camadas | Máquina | Console], com Máquina aberta por padrão
├── Barra de status (sempre): estado · cabeçote XY · seleção · progresso · mm/pol · zoom · tipo de entrada
└── Diálogos: boas-vindas · configurações · confirmação de disparo · recuperação · atalhos
```

### Modos: separar ou não?

**Decisão:** um **único espaço de trabalho com dois modos** (*Projetar* e *Produzir*), alternados por um seletor segmentado na barra superior (Ctrl+1 / Ctrl+2). Não são duas janelas nem dois apps.

- **Projetar** mostra as ferramentas de edição, a paleta e o inspetor. A máquina fica a uma aba de distância.
- **Produzir** esconde as ferramentas, trava a edição (o canvas vira preview com pan/zoom) e abre o painel da máquina com botões maiores e a leitura de progresso em fonte grande.
- **Ao Iniciar um trabalho**, o app entra sozinho em Produzir. Voltar a Projetar durante o trabalho é permitido (para preparar o próximo arquivo), mas a faixa de estado e o PARAR continuam lá.

**Por quê:** o LightBurn mistura tudo e gera "janelas demais". O LaserCut separa bem o controle num painel fixo, mas é rígido. Dois modos dão foco a cada tarefa sem esconder a outra, e o modo Produzir é exatamente o que o tablet de bancada precisa. *(Pergunta em aberto no README: permitir abrir Produzir em uma segunda janela/monitor.)*

**Sempre visível, em qualquer modo e layout:** estado da máquina (cor + ícone + palavra), botão **PARAR**, posição do cabeçote (barra de status ou DRO), progresso quando há trabalho.

## Estados da máquina

Os 14 estados do LaserGRBL (`MacStatus`) são agrupados em 6 estados visuais. **Nunca dependem só da cor**: cada um tem ícone, palavra e, quando o laser pode estar ligado, padrão animado.

| Visual | Estados do firmware | Cor (token) | Ícone | Extra |
|---|---|---|---|---|
| **Desconectada** | Disconnected | `state-offline` (cinza) | tomada cortada | botão Conectar em destaque |
| **Conectando…** | Connecting | ciano esmaecido | tomada | — |
| **Pronta** | Idle, Check, Queue | `state-idle` (ciano) | ✓ | — |
| **Executando / Movendo / Contornando / Referenciando** | Run, Jog, Home, Cooling, Tool | `state-run` (âmbar) | feixe | **listras diagonais animadas** quando o laser pode disparar (Run) |
| **Em pausa** | Hold, Door, AutoHold | `state-hold` (violeta) | ⏸ | Door mostra "porta aberta" |
| **Alarme** | Alarm | `state-alarm` (magenta) | ⚠ | pisca 1×/s (respeita *reduced motion*) + faixa sobre o canvas |

## Segurança

1. **PARAR sempre visível e alcançável.** Fica na barra superior em todos os layouts com tela larga e na **barra inferior (zona do polegar)** no celular/retrato. Diálogos **não são modais**: o PARAR fica por cima do fundo escurecido e continua clicável com qualquer diálogo aberto. Atalho **Shift+Esc**, que funciona até dentro de campos de texto. Forma octogonal + anel amarelo + palavra.
   O PARAR envia *soft reset* (0x18) e desliga o laser. O texto de ajuda diz que **não substitui a parada de emergência física**.
2. **Pausar é fácil e seguro.** Esc pausa um trabalho em execução (feed hold `!`), e o botão Pausar fica sempre ao lado do Iniciar.
3. **Confirmação antes de disparar.** Iniciar abre "Pronto para gravar?" com o resumo (camadas · tempo · área) e uma checklist de bancada (óculos certos para este laser, exaustão/ar, material preso e foco, extintor por perto). O botão **Disparar laser** só habilita após **3 s** (herança da contagem de 5 s do LaserGRBL; configurável, mas não removível nas configurações padrão). A checklist é um lembrete, não um bloqueio.
4. **Contorno sempre com laser desligado** por padrão ("laser baixo" é opção explícita de um botão personalizado).
5. **Jog contínuo é homem-morto:** o movimento só continua enquanto o dedo/botão está pressionado. Soltar, perder o ponteiro ou o app perder o foco envia cancelamento de jog (0x85).
6. **Estado claro em falhas:** faixa magenta sobre o canvas com o que aconteceu, onde (linha), o que o controlador já fez, e as ações **Desbloquear** / **Recuperar trabalho…**.

## Fluxos principais

### 1. Primeira execução
1. **Boas-vindas** (logo, "Bem-vindo ao FreeKerf", crédito ao LaserGRBL/Diego Settimi). Três caminhos: *Configurar minha máquina*, *Importar do LaserGRBL* (só aparece se uma instalação for detectada), *Explorar com o simulador*. Também há "Pular".
2. **Máquina:** diodo / CO₂ / outra (cartões grandes) e área de trabalho (X × Y). Na versão real, perfis de fabricantes preenchem tudo.
3. **Conexão:** procura portas USB e a rede (mDNS/Telnet). Lista o que achou (com o simulador sempre presente). O usuário escolhe.
4. **Detecção:** conecta, lê `$I` e `$$`, identifica o firmware (Grbl/grblHAL/Smoothie/Marlin), lê a área (`$130/$131`), o modo laser (`$32`) e a potência máxima (`$30`). Avisa com calma se `$32=0` ("Modo laser desligado: os cantos podem queimar mais. Ligar agora?").
5. **Pronto:** abre um projeto de exemplo com instruções curtas no próprio canvas.
*Protótipo: `?welcome=1`.*

### 2. Migração do LaserGRBL
1. Detecta `%APPDATA%/LaserGRBL` (Windows) ou o prefixo do Wine (Linux).
2. Lista o que dá para importar, tudo marcado por padrão: conexão (porta, baud, firmware, streaming, threading), **botões personalizados** (`CustomButtons.bin` / `.zbn`, com ícones e G-code), **biblioteca de materiais** (`.psh`/MaterialDB), **contadores de uso do laser**, atalhos, preferências de importação raster/vetor, idioma.
3. Mostra um resumo do que foi convertido e **avisa o que não tem equivalente** (ex.: variáveis de botão que mudaram de sintaxe), com link para revisar.
4. **Nunca altera os arquivos originais.** Mantém um registro da importação.
5. Mantém os atalhos do LaserGRBL como **esquema de teclado opcional** ("LaserGRBL" / "FreeKerf padrão").

### 3. Importar SVG → ajustar camadas → contorno → gravar
1. Arrastar o SVG para o canvas (ou Importar / Ctrl+I). As cores do SVG são mapeadas para as camadas mais próximas, e um diálogo curto pergunta se quer **manter as cores originais** ou **unificar**.
2. A tabela de **Camadas** mostra cada cor com o modo inferido (traço → Linha, preenchimento → Preencher) e a contagem de objetos.
3. Toca/clica numa camada para expandir e ajustar velocidade, potência, passadas e ar, ou aplica um material da biblioteca. Ordem de saída com ↑/↓.
4. Posiciona o desenho. Em *Produzir*, escolhe "Início do trabalho" (absoluto / posição atual / origem do usuário) e a âncora 3×3.
5. **Contorno:** o cabeçote percorre o retângulo com laser desligado. A linha tracejada aparece no canvas.
6. **Iniciar** → confirmação → **Disparar laser** → acompanha o progresso. O canvas mostra o rastro de queima e o cabeçote.

### 4. Foto → ajustar → preview → gravar
1. Importa a imagem: ela vai para uma camada no modo **Imagem**.
2. No inspetor: brilho, contraste, **pontilhado** (Floyd–Steinberg, Atkinson, limiar; versão real com os 12 do LaserGRBL + escala de cinza), resolução (linhas/mm) e direção de varredura. O preview no canvas mostra os pontos reais do pontilhado, na cor da camada.
3. A camada define velocidade e potência (mín./máx. para escala de cinza).
4. Estimativa de tempo atualizada ao vivo na linha da camada ("≈3:06").
5. Contorno → Iniciar, como no fluxo 3.
*Protótipo: `?sel=image`.*

### 5. Texto + forma do zero → booleanas → matriz → cortar
1. Ferramenta Texto (T): toca no canvas e digita no inspetor. Ferramenta Retângulo (R): arrasta.
2. Seleciona os dois (toque com "Seleção múltipla", Shift+clique ou seleção por área) → **Subtrair** (o texto vira furo).
3. **Matriz**: 3×2 com espaçamento (o protótipo cria 3×2 com 5 mm. A versão real tem um diálogo com contagem, espaçamento e matriz circular).
4. Troca a camada para "Linha, corte" tocando na cor da paleta.
5. Contorno → Iniciar.

### 6. Teste de material e salvar na biblioteca
1. Ferramentas → **Teste de material**. Escolhe o material, a espessura e o modo (linha/preencher). Define a grade: potência de 10 a 100 % em 5 passos × velocidade de 500 a 6000 mm/min em 5 passos. Rótulos gravados em texto vetorial de traço único (Hershey, como no LaserGRBL).
2. Preview e tempo. Contorno → Iniciar.
3. Depois de gravar, o canvas mostra a mesma grade. O usuário **toca na célula que ficou melhor**.
4. "Salvar como material": nome, espessura, ação (corte/gravação) → vai para a biblioteca, disponível em "Aplicar material…" de qualquer camada.

### 7. Pausar, retomar e recuperar de erro
- **Pausar** (botão, Esc, F6): feed hold. O estado vira *Em pausa* (violeta, ⏸). **Continuar** retoma.
- **Parar trabalho**: aborta, desliga o laser e o estado volta a *Pronta*.
- **Alarme** (ex.: limite físico) ou **PARAR**: estado *Alarme*. Faixa sobre o canvas com causa, linha e o que o controlador já fez. Ações: *Desbloquear* e *Recuperar trabalho…*.
- **Conexão perdida**: estado *Desconectada* e faixa. *Recuperar trabalho…* reconecta e abre o diálogo.
- **Diálogo de recuperação** (lógica do `ResumeJobForm` do LaserGRBL):
  - *Desde o início*
  - *Algumas linhas antes da interrupção* (17 antes da última executada), **recomendado** para alarme/reset/parada, porque o buffer do Grbl é descartado
  - *A partir da última linha enviada*, **recomendado** para desconexão, porque o que foi enviado pode ter sido executado
  - *A partir da linha N*
  - ☐ Referenciar ($H) antes de continuar (marcado quando a posição pode ter se perdido)
  - ☐ Restaurar origem de trabalho X… Y…
*Protótipo: Máquina → Simular falha, ou `?demo=alarm` / `?demo=recover`.*

### 8. Tablet controla, desktop prepara (avaliação)
**Faz sentido, mas não para o MVP.** O cenário do Marcos e da Rafa é real: o PC fica no escritório e o tablet na máquina.

- **Arquitetura:** `freekerf-core` roda junto da máquina (no PC ligado a ela ou num Raspberry Pi) e é **o único dono da porta serial**. Interfaces (desktop, tablet) são clientes via WebSocket na rede local, com pareamento por QR code.
- **Regras:** só **um cliente controla** por vez (tem a "chave"). Os outros veem o estado e podem pausar/parar. **PARAR e Pausar funcionam em qualquer cliente**, sempre. Iniciar exige a confirmação local no cliente que tem a chave.
- O desktop "envia para a máquina" um trabalho pronto (fila). O tablet vê o trabalho, enquadra e inicia.
- **Riscos:** latência de Wi-Fi no jog (mitigação: jog só por passos remotamente, contínuo só local ou com *heartbeat* de 100 ms e parada automática se o sinal se perder) e segurança de rede (pareamento + autenticação).
- Registrado como pergunta em aberto. O desenho de `freekerf-core` deve prever isso desde o começo (API de eventos).

## Layouts (resumo; regras em `interaction.md`)

| Largura | Layout | Edição | Painéis |
|---|---|---|---|
| ≥ 1180 px | **Largo** (desktop, notebook 13" em 1280+) | completa | dock à direita: Camadas fixo + abas |
| 820–1179 px | **Médio** (tablet paisagem, notebook pequeno, monitor touch) | completa | gavetas (drawers) por cima do canvas, abertas por um trilho de ícones. Em Produzir, o painel da máquina fica acoplado |
| < 820 px | **Estreito** (tablet retrato, celular) | **não** | preview em cima, Máquina/Console/Camadas embaixo, barra inferior Iniciar/Pausar/Contorno/PARAR |

**Por que sem edição abaixo de 820 px:** editar vetores com precisão de 0,1 mm exige área de canvas, alças e inspetor ao mesmo tempo. Num celular, cada um disputa a mesma tela, e a chance de um toque errado mover a peça sem querer é alta. Na bancada, o que se faz com o celular/tablet em pé é **operar e vigiar**: enquadrar, iniciar, pausar, parar. Pequenos ajustes (mover o trabalho inteiro) ficam a cargo do "Início do trabalho" + âncora + jog, que são operações de máquina e não de desenho. *(Pergunta em aberto: permitir edição básica em tablet retrato.)*
