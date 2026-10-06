# Implicações técnicas: toolkit de UI em Rust

O que os requisitos de design impõem ao toolkit:

- **multitoque real** (pinça, pan com dois dedos, toque longo, cancelamento ao entrar o 2º dedo) e troca automática de densidade por `pointerType`;
- **canvas** com milhares de caminhos + imagens de 20–50 MP, pan/zoom a 60 fps e simulação do cabeçote;
- **tablet**: Android e iPad (no iPad, só como cliente de rede, porque o iPadOS não dá acesso a USB-serial CH340/CP210x para apps comuns);
- tokens `fk-` aplicáveis sem reescrever componentes, temas claro/escuro/alto contraste, i18n com strings longas, acessibilidade;
- licença compatível com **GPL-3.0-or-later**.

Arquitetura assumida em qualquer opção: **`freekerf-core`** (Rust, sem UI): conexão serial/Telnet/WebSocket, protocolos GRBL/grblHAL/Smoothie/Marlin, planejamento do trabalho, geometria (booleanas, offset), raster/dithering, estimativa de tempo, e API de eventos (que também habilita o fluxo "tablet controla" de `ux.md`). A UI é um cliente desse núcleo.

## Comparação

| Critério | **egui / eframe** | **Slint** | **iced** | **Tauri 2** (UI web + core Rust) | **Flutter + flutter_rust_bridge** |
|---|---|---|---|---|---|
| Multitoque e gestos | ◐ eventos de toque e `zoom_delta`/multi-touch básicos; gestos ricos à mão | ◐ toque ok; gestos de pinça/rotação são recentes, **validar** | ◐ eventos de toque crus; gestos à mão | ✅ Pointer Events completos (o protótipo já funciona) · ⚠ qualidade do touch no WebKitGTK (Linux) varia | ✅ melhor da lista: arena de gestos, `ScaleGestureRecognizer`, `InteractiveViewer` |
| Canvas: milhares de vetores, imagens grandes | ✅ epaint + callbacks wgpu para render próprio | ◐ elemento `Path` limitado; render próprio via *underlay* (wgpu/femtovg) | ✅ `Canvas` com cache + wgpu | ✅ WebGL/WebGPU (ou Canvas2D) · ⚠ memória de imagens grandes no WebView, custo de IPC se a geometria vier do Rust | ✅ `CustomPainter` + Impeller; imagens grandes ok |
| iPad / Android | ◐ Android experimental, iOS informal | ◐ Android ok; iOS recente/prévia | — não oficial | ✅ suporte oficial no v2 (WKWebView / Android WebView) | ✅ primeira classe |
| Acessibilidade | ✅ AccessKit | ✅ AccessKit | ◐ em andamento | ✅ árvore de acessibilidade do navegador | ✅ `Semantics` |
| i18n / texto | ◐ sem framework; *shaping* complexo limitado | ✅ `@tr` + gettext embutido | ◐ sem framework; cosmic-text bom | ✅ `Intl`, ICU do navegador, qualquer lib | ✅ `intl`/ARB |
| Temas e tokens `fk-` | ✅ `Style`/`Visuals` em código: fácil gerar a partir do JSON | ✅ *globals* `.slint`: mapeamento direto | ◐ `Theme` + funções de estilo; dá, com mais código | ✅ **CSS custom properties idênticas ao protótipo** | ✅ `ThemeData` + `ThemeExtension` |
| Maturidade / licença | 0.x, API muda; MIT/Apache-2.0 ✅ | 1.x estável; **GPL-3.0** ou royalty-free ou comercial ✅ | 0.x, API muda; MIT ✅ | 2.x estável; MIT/Apache-2.0 ✅ (WebViews do sistema) | Flutter estável BSD-3 ✅; frb MIT ✅; segunda linguagem (Dart) |
| Reuso do protótipo | baixo | médio (layout declarativo) | baixo | **alto** (HTML/CSS/JS → componentes) | médio (só o design) |

## Recomendação

**Tauri 2 com a interface web e `freekerf-core` em Rust**, com **Flutter + flutter_rust_bridge** como plano B, a ser decidido por um *spike* de 2–3 semanas.

Motivos:
1. **Touch e tablet são requisitos centrais.** As únicas opções com multitoque maduro e iPad/Android oficiais são Tauri e Flutter. egui, Slint e iced exigiriam implementar gestos e ainda teriam suporte móvel incerto.
2. O **protótipo já é a especificação executável**: tokens, componentes e lógica de interação em Pointer Events migram quase diretamente. A comunidade de contribuidores web é muito maior que a de Dart.
3. O núcleo em Rust fica isolado e testável (a suíte [`freekerf/conformance`](https://github.com/freekerf/conformance) já prevê um `HostAdapter` para o core em Rust) e serve também ao modo "tablet como cliente".
4. Licenças compatíveis com GPL-3.0 em toda a pilha.

O ponto fraco do Tauri é o **WebKitGTK no Linux**: desempenho de WebGL e touch. Ele decide se o plano B entra.

## O que o spike precisa validar

| # | Teste | Critério de aceite | Plataformas |
|---|---|---|---|
| 1 | Canvas com **20 000 caminhos** (SVG real com texto convertido) + imagem **8000×6000** com dithering, pan/zoom/pinça | ≥ 50 fps no pan; zoom sem travar > 100 ms; memória < 1,5 GB | Windows (WebView2), macOS (WKWebView), **Linux (WebKitGTK)**, iPad, Android |
| 2 | Pinça + pan + toque longo + cancelamento de arraste pelo 2º dedo | igual ao protótipo, sem *ghost clicks* | Linux com tela touch, Windows touch, iPad, Android |
| 3 | Transporte core → UI de geometria e simulação (IPC Tauri: eventos binários / canal) | 60 atualizações/s do cabeçote; 5 MB de geometria em < 200 ms | todas |
| 4 | Serial USB (CH340, CP210x, CDC) pelo core; **Android USB host** | conectar, `$$`, *streaming* de 100 k linhas sem *underrun* | Windows, Linux, macOS, Android |
| 5 | Modo cliente remoto: core no PC/RPi, UI no iPad via WebSocket na LAN | jog por passo < 100 ms; PARAR < 50 ms; *heartbeat* do jog contínuo | iPad, Android |
| 6 | Acessibilidade: leitor de tela no canvas (lista de objetos espelhada), foco e atalhos | NVDA, VoiceOver, Orca leem estado, camadas e botões | todas |
| 7 | Empacotamento | instalador < 25 MB; `.deb`/AppImage/Flatpak, MSI, DMG assinados | desktop |
| 8 | **Plano B:** os mesmos testes 1, 2 e 5 em Flutter (`CustomPainter`) | comparar fps, memória e esforço | Linux, iPad |

Se o teste 1 ou o 2 falhar no WebKitGTK e não houver contorno (ex.: renderizar o canvas com wgpu/vello compilado para WebGPU/wasm, ou exigir WebKitGTK ≥ versão X), a recomendação passa para **Flutter**.
