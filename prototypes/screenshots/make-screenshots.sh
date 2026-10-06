#!/bin/sh
# Regenera as screenshots do protótipo com Chrome headless.
# Uso (na pasta design/):  python3 -m http.server 8765 &   e depois   sh prototypes/screenshots/make-screenshots.sh
set -e
OUT=$(dirname "$0"); B="http://127.0.0.1:8765/prototypes/app/index.html?shot=1"
CHROME=$(command -v google-chrome || command -v chromium || command -v chromium-browser)
shot() { # nome  parâmetros  largura  altura  [orçamento de tempo virtual ms]
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --virtual-time-budget=${5:-3500} --window-size=$3,$4 --screenshot="$OUT/$1.png" "$B&$2" >/dev/null 2>&1
}
for th in dark light; do
  shot desktop-1440x900-$th-projetar      "welcome=0&theme=$th&sel=text" 1440 900
  shot desktop-1440x900-$th-produzir      "welcome=0&theme=$th&demo=run" 1440 900 4500
  shot tablet-1024x768-$th-projetar       "welcome=0&theme=$th&density=comfortable&sel=multi" 1024 768
  shot tablet-768x1024-$th-produzir       "welcome=0&theme=$th&density=comfortable&demo=run" 768 1024 4500
  shot celular-375x812-$th-produzir       "welcome=0&theme=$th&density=comfortable&demo=run" 375 812 4500
done
shot tablet-1024x768-dark-produzir        "welcome=0&density=comfortable&demo=run" 1024 768 4500
shot tablet-1024x768-dark-drawer-camadas  "welcome=0&density=comfortable&panel=layers" 1024 768 5000
shot notebook-1280x800-dark-imagem        "welcome=0&sel=image" 1280 800
shot desktop-1440x900-dark-alarme         "welcome=0&demo=alarm" 1440 900 4500
shot desktop-1440x900-dark-recuperar      "welcome=0&demo=recover" 1440 900 4500
shot desktop-1440x900-dark-confirmacao    "welcome=0&demo=preflight" 1440 900 3000
shot desktop-1440x900-dark-boas-vindas    "welcome=1" 1440 900
shot desktop-1440x900-dark-boas-vindas-migrar "welcome=1&wstep=migrate" 1440 900
shot celular-375x812-dark-boas-vindas     "welcome=1&density=comfortable" 375 812
shot desktop-1440x900-de-strings-longas   "welcome=0&lang=de&sel=text" 1440 900
shot tablet-768x1024-de-strings-longas    "welcome=0&lang=de&density=comfortable&demo=run" 768 1024 4500
shot tablet-1024x768-de-camada-aberta     "welcome=0&lang=de&density=comfortable&panel=layers&sel=text" 1024 768 5000
shot desktop-1440x900-alto-contraste      "welcome=0&contrast=1&demo=run" 1440 900 4500
echo "ok: $(ls "$OUT"/*.png | wc -l) screenshots"
