#!/usr/bin/env python3
"""Gera os SVGs finais da marca FreeKerf (logo, símbolo, ícones, favicon).

Requer: fontTools (pip install fonttools) e a fonte Space Grotesk (OFL-1.1).
Uso:    python3 build_brand.py [caminho/para/SpaceGrotesk-Bold.ttf]
Os PNGs/ICO/ICNS são gerados depois por render_icons.py (Chrome headless + Pillow).
"""
import os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

HERE = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.dirname(HERE)
FONT_DIR = sys.argv[1] if len(sys.argv) > 1 else "/usr/share/fonts/truetype/space-grotesk-zorin-os"

# ---- paleta da marca (espelha tokens.json: fk.color.brand.*) ----
AMBER = "#F4A51C"      # Âmbar Kerf (marca)
AMBER_DEEP = "#B86E00" # âmbar para fundo claro (contraste ≥ 3:1 em gráfico)
GRAPHITE = "#151A20"   # Grafite 900
GRAPHITE_TILE = "#1B2129"
GRAPHITE_EDGE = "#3A434F"
PAPER = "#E9EDF2"      # texto/stem sobre fundo escuro

# ---- geometria do símbolo (grade 64) ----
STEM = '<rect x="9" y="8" width="13" height="48" rx="2" fill="{c}"/>'
ARMS = '<path d="M43 8H57L39.5 32 57 56H43L25.5 32Z" fill="{c}"/>'
BEAM = '<rect x="23" y="2" width="1.5" height="60" rx=".75" fill="{c}" opacity="{o}"/>'


def symbol_group(stem, arms, beam=None, beam_op=.75):
    g = STEM.format(c=stem) + ARMS.format(c=arms)
    if beam:
        g += BEAM.format(c=beam, o=beam_op)
    return g


def svg(w, h, body, label, vb=None):
    vb = vb or f"0 0 {w} {h}"
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w}" height="{h}" '
            f'role="img" aria-label="{label}">\n<title>{label}</title>\n{body}\n</svg>\n')


def wordmark_paths(text_parts, size_cap=48.0):
    """Retorna (svg_paths, largura) com o texto em contornos, altura de versal = size_cap."""
    out, x = [], 0.0
    for text, weight, color in text_parts:
        f = TTFont(os.path.join(FONT_DIR, f"SpaceGrotesk-{weight}.ttf"))
        gs = f.getGlyphSet(); cmap = f.getBestCmap(); hmtx = f["hmtx"]
        cap = getattr(f["OS/2"], "sCapHeight", 700) or 700
        s = size_cap / cap
        d = []
        for ch in text:
            gname = cmap[ord(ch)]
            pen = SVGPathPen(gs)
            # y da fonte cresce para cima; o SVG cresce para baixo. Linha de base em y=size_cap.
            tp = TransformPen(pen, (s, 0, 0, -s, x, size_cap))
            gs[gname].draw(tp)
            d.append(pen.getCommands())
            x += hmtx[gname][0] * s
            x += 0.6  # leve tracking (em unidades da grade)
        out.append(f'<path fill="{color}" d="{" ".join(d)}"/>')
    return "\n".join(out), x - 0.6


def write(path, content):
    path = os.path.join(BRAND, path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        fh.write(content)
    print("escrito", os.path.relpath(path, BRAND))


def build():
    # --- símbolo ---
    variants = {
        "dark":  dict(stem=PAPER, arms=AMBER, beam=AMBER),
        "light": dict(stem=GRAPHITE, arms=AMBER_DEEP, beam=AMBER_DEEP),
        "mono-black": dict(stem="#000", arms="#000"),
        "mono-white": dict(stem="#fff", arms="#fff"),
    }
    for name, v in variants.items():
        write(f"logo/freekerf-symbol-{name}.svg",
              svg(64, 64, symbol_group(v["stem"], v["arms"], v.get("beam")), "FreeKerf"))

    # --- horizontal: símbolo + nome (Free regular/medium + Kerf bold) ---
    for name, v in variants.items():
        text_color = v["stem"]
        kerf_color = v["stem"]
        paths, tw = wordmark_paths([("Free", "Medium", text_color), ("Kerf", "Bold", kerf_color)], size_cap=34)
        gap = 14
        W = 9 + 48 + gap + tw + 4  # símbolo ocupa x 9..57
        body = (f'<g>{symbol_group(v["stem"], v["arms"], v.get("beam"))}</g>\n'
                f'<g transform="translate({57 + gap:.2f} {32 - 17:.2f})">{paths}</g>')
        write(f"logo/freekerf-horizontal-{name}.svg",
              svg(round(W + 5), 64, body, "FreeKerf", vb=f"4 0 {W + 5:.2f} 64"))

    # --- ícone do app (grade 64; Linux/Windows) ---
    tile = (f'<rect x="1" y="1" width="62" height="62" rx="14" fill="{GRAPHITE_TILE}"/>'
            f'<rect x="1.5" y="1.5" width="61" height="61" rx="13.5" fill="none" stroke="{GRAPHITE_EDGE}" stroke-width="1"/>')
    k = f'<g transform="translate(32 32) scale(.74) translate(-33 -32)">{symbol_group(PAPER, AMBER, AMBER, .8)}</g>'
    write("icon/freekerf.svg", svg(64, 64, tile + k, "FreeKerf"))

    # --- 32 px: desenhado na grade de 32 px, sem feixe ---
    t32 = (f'<rect x="0" y="0" width="32" height="32" rx="7" fill="{GRAPHITE_TILE}"/>'
           f'<rect x=".5" y=".5" width="31" height="31" rx="6.5" fill="none" stroke="{GRAPHITE_EDGE}"/>')
    k32 = (f'<rect x="7" y="6" width="5" height="20" rx="1" fill="{PAPER}"/>'
           f'<path d="M20 6H26L19 16 26 26H20L13.5 16Z" fill="{AMBER}"/>')
    write("icon/freekerf-32.svg", svg(32, 32, t32 + k32, "FreeKerf"))

    # --- 16 px: grade de 16 px, alinhado a pixel inteiro ---
    t16 = f'<rect width="16" height="16" rx="3.5" fill="{GRAPHITE_TILE}"/>'
    k16 = (f'<rect x="3" y="3" width="3" height="10" fill="{PAPER}"/>'
           f'<path d="M10 3H13.5L10 8 13.5 13H10L7 8Z" fill="{AMBER}"/>')
    write("icon/freekerf-16.svg", svg(16, 16, t16 + k16, "FreeKerf"))

    # --- symbolic (freedesktop: monocromático, 16 px, cor herdada) ---
    sym = ('<rect x="2" y="2" width="3" height="12" fill="#2e3436"/>'
           '<path d="M9.5 2H13L9.5 8 13 14H9.5L6.5 8Z" fill="#2e3436"/>')
    write("icon/freekerf-symbolic.svg", svg(16, 16, sym, "FreeKerf"))

    # --- macOS: grade 1024, forma "squircle" 824 px com margem e sombra ---
    mac = f'''<defs>
<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#232A33"/><stop offset="1" stop-color="#14181E"/></linearGradient>
<filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-opacity=".35"/></filter>
</defs>
<rect x="100" y="100" width="824" height="824" rx="185" fill="url(#g)" filter="url(#s)"/>
<rect x="102" y="102" width="820" height="820" rx="183" fill="none" stroke="{GRAPHITE_EDGE}" stroke-width="4"/>
<g transform="translate(512 512) scale(9.4) translate(-33 -32)">{symbol_group(PAPER, AMBER, AMBER, .8)}</g>'''
    write("icon/freekerf-macos.svg", svg(1024, 1024, mac, "FreeKerf"))

    # --- favicon (o mesmo ladrilho; funciona em abas claras e escuras) ---
    write("icon/favicon.svg", svg(32, 32, t32 + k32, "FreeKerf"))


if __name__ == "__main__":
    build()
