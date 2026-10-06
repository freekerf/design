#!/usr/bin/env python3
"""Rasteriza os ícones do FreeKerf (Chrome headless) e monta .ico/.icns (Pillow).

Uso: python3 render_icons.py   (precisa de google-chrome ou chromium no PATH)
"""
import os, shutil, subprocess, tempfile
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ICON = os.path.join(os.path.dirname(HERE), "icon")
PNG = os.path.join(ICON, "png")
CHROME = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")


def render(svg, size, out):
    with tempfile.TemporaryDirectory() as td:
        html = os.path.join(td, "i.html")
        with open(html, "w") as fh:
            fh.write(f'<html><body style="margin:0;background:transparent">'
                     f'<img src="file://{svg}" width="{size}" height="{size}" style="display:block"></body></html>')
        shot = os.path.join(td, "s.png")
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                        "--default-background-color=00000000", "--force-device-scale-factor=1",
                        f"--window-size={size},{size}", f"--screenshot={shot}", f"file://{html}"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        Image.open(shot).convert("RGBA").crop((0, 0, size, size)).save(out)
    print("png", os.path.relpath(out, ICON))


def main():
    os.makedirs(PNG, exist_ok=True)
    src = lambda n: os.path.join(ICON, n)
    # Cada tamanho usa o SVG desenhado para a sua grade.
    plan = {16: "freekerf-16.svg", 24: "freekerf-32.svg", 32: "freekerf-32.svg", 48: "freekerf.svg",
            64: "freekerf.svg", 128: "freekerf.svg", 256: "freekerf.svg", 512: "freekerf.svg", 1024: "freekerf.svg"}
    for s, f in plan.items():
        render(src(f), s, os.path.join(PNG, f"freekerf-{s}.png"))
    for s in (16, 32, 64, 128, 256, 512, 1024):
        f = "freekerf-16.svg" if s == 16 else "freekerf-32.svg" if s == 32 else "freekerf-macos.svg"
        render(src(f), s, os.path.join(PNG, f"freekerf-macos-{s}.png"))

    # Windows .ico (16, 24, 32, 48, 256)
    imgs = [Image.open(os.path.join(PNG, f"freekerf-{s}.png")) for s in (16, 24, 32, 48, 256)]
    imgs[-1].save(os.path.join(ICON, "freekerf.ico"), sizes=[(i.width, i.height) for i in imgs], append_images=imgs[:-1])
    # favicon.ico (16, 32, 48)
    imgs[0].save(os.path.join(ICON, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)],
                 append_images=[imgs[2], imgs[3]])
    # macOS .icns
    Image.open(os.path.join(PNG, "freekerf-macos-1024.png")).save(os.path.join(ICON, "freekerf.icns"))
    # freedesktop hicolor
    hc = os.path.join(ICON, "hicolor")
    for s in (16, 24, 32, 48, 64, 128, 256, 512):
        d = os.path.join(hc, f"{s}x{s}", "apps"); os.makedirs(d, exist_ok=True)
        shutil.copy(os.path.join(PNG, f"freekerf-{s}.png"), os.path.join(d, "freekerf.png"))
    for d, f, n in (("scalable", "freekerf.svg", "freekerf.svg"), ("symbolic", "freekerf-symbolic.svg", "freekerf-symbolic.svg")):
        p = os.path.join(hc, d, "apps"); os.makedirs(p, exist_ok=True)
        shutil.copy(src(f), os.path.join(p, n))
    print("ico/icns/hicolor ok")


if __name__ == "__main__":
    main()
