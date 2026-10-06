#!/usr/bin/env python3
"""Converte ../tokens.json (W3C DTCG) em fk-tokens.css. Sem dependências.

Saída:
  :root                      -> primitivos + tema escuro (padrão) + densidade compacta
  [data-theme=light]         -> tema claro
  [data-contrast=high]       -> alto contraste (sobre o escuro)
  [data-density=comfortable] -> densidade de toque
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(os.path.dirname(HERE), "tokens.json")
OUT = os.path.join(HERE, "fk-tokens.css")

data = json.load(open(SRC))["fk"]


def get(path):
    node = {"fk": data}
    for p in path.split("."):
        node = node[p]
    return node["$value"]


def resolve(v):
    if isinstance(v, str):
        m = re.fullmatch(r"\{(.+)\}", v)
        if m:
            return resolve(get(m.group(1)))
        return v
    if isinstance(v, list):
        return ", ".join(f'"{x}"' if " " in x else x for x in v)
    if isinstance(v, dict) and "offsetX" in v:
        return f'{v["offsetX"]} {v["offsetY"]} {v["blur"]} {v["spread"]} {v["color"]}'
    return str(v)


def leaves(node, prefix):
    for k, v in node.items():
        if k.startswith("$"):
            continue
        if isinstance(v, dict) and "$value" in v:
            yield f"{prefix}-{k}", resolve(v["$value"])
        elif isinstance(v, dict):
            yield from leaves(v, f"{prefix}-{k}")


def block(sel, pairs):
    return sel + " {\n" + "".join(f"  --{n}: {v};\n" for n, v in pairs) + "}\n"


prims = []
for group in ("color", "font", "space", "radius", "elevation", "duration", "z"):
    prims += list(leaves(data[group], f"fk-{group}"))
theme = lambda t: [(n.replace(f"fk-theme-{t}-", "fk-color-"), v) for n, v in leaves(data["theme"][t], f"fk-theme-{t}")]
dens = lambda d: [(n.replace(f"fk-density-{d}-", "fk-"), v) for n, v in leaves(data["density"][d], f"fk-density-{d}")]

css = "/* GERADO por tokens/build_tokens.py a partir de tokens.json — não edite à mão. */\n"
css += block(":root", prims + theme("dark") + dens("compact"))
css += block('[data-theme="light"]', theme("light"))
css += block('[data-contrast="high"]', theme("high-contrast"))
css += block('[data-density="comfortable"]', dens("comfortable"))
open(OUT, "w").write(css)
print(f"{OUT}: {css.count('--fk-')} variáveis")
