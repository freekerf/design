# Créditos e licenças

## Assets incluídos

| Asset | Origem | Licença |
|---|---|---|
| Inter: subset WOFF2 (`assets/fonts/Inter-*.woff2`) | The Inter Project Authors (Rasmus Andersson) | SIL OFL-1.1, texto em `assets/fonts/OFL.txt` |
| JetBrains Mono: subset WOFF2 (`assets/fonts/JetBrainsMono-*.woff2`) | The JetBrains Mono Project Authors | SIL OFL-1.1 |
| Space Grotesk Bold: subset WOFF2; contornos do wordmark nos SVGs do logo | The Space Grotesk Project Authors | SIL OFL-1.1 |
| Logo, símbolo, ícones do app, favicon (`brand/`) | desenho original FreeKerf | GPL-3.0-or-later (pergunta em aberto: CC BY-SA + política de marca) |
| Ícones de interface (`prototypes/app/icons.js`, ~80) | desenho original FreeKerf | GPL-3.0-or-later |
| Tokens (`tokens.json`, `tokens/fk-tokens.css`), protótipo, wireframes, documentos | original FreeKerf | GPL-3.0-or-later |
| Imagem de exemplo do protótipo (paisagem) | gerada por código em `app.js` | GPL-3.0-or-later |

Os subsets das fontes foram feitos com `pyftsubset` (fontTools). Nenhum glifo foi alterado. Os contornos do wordmark foram extraídos com fontTools e são uma obra derivada sob a OFL (o logo é um documento criado com a fonte, o que a OFL permite).

## Ferramentas usadas para gerar (não distribuídas)

| Ferramenta | Uso | Licença |
|---|---|---|
| fontTools | subsets e contornos do wordmark (`brand/tools/build_brand.py`) | MIT |
| Pillow | `.ico`, `.icns`, montagem de imagens (`brand/tools/render_icons.py`) | MIT-CMU (HPND) |
| Google Chrome headless | rasterizar SVG → PNG e tirar screenshots | proprietário; qualquer Chromium (BSD) serve |

## Referências e inspiração

- **LaserGRBL** © Diego Settimi, GPLv3: origem do projeto. Funcionalidades e a lógica de recuperação de trabalho e contagem de segurança foram estudadas no código deste repositório.
- **LightBurn** e **LaserCut**: inspiração de **fluxos** (camadas por cor, Start From, contorno, painel de máquina). Nenhum ícone, screenshot, nome ou asset deles foi usado.
- Paletas de cor seguras para daltônicos: Okabe & Ito (2008) e Paul Tol, como ponto de partida das cores de camada.
