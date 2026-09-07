"""Converte os assets de marca do site institucional (dev/SITE) para o LMS.

Por que existe: o site entrega o logotipo colorido em webp e o branco como um
SVG que embrulha um PNG. O LMS precisa dos dois no mesmo formato, na mesma
caixa e com sobra recortada — senão a troca de tema move o logotipo na tela
(as fontes têm 2.46 e 2.38 de proporção).

Saída: webp para a marca (o logotipo tem degradê fotográfico no sol; em PNG dá
139 kB contra 28 kB) e PNG para os ícones que o Next serve como metadata.

Uso: python tools/brand-assets.py   (exige playwright + chromium)
"""
import base64
import mimetypes
import os
import pathlib
import re

from playwright.sync_api import sync_playwright

# O site institucional é outro repositório. O caminho padrão é o de quem gerou;
# em outra máquina, aponte com $SITE_PUBLIC.
SITE = pathlib.Path(
    os.environ.get("SITE_PUBLIC", r"c:/Users/matheus.vianna/Documents/dev/SITE/apps/frontend/public")
)
if not SITE.exists():
    raise SystemExit(f"site institucional não encontrado em {SITE} — aponte $SITE_PUBLIC")
ROOT = pathlib.Path(__file__).resolve().parent.parent
BRAND = ROOT / "public" / "brand"
APP = ROOT / "src" / "app"


def data_uri(path: pathlib.Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def svg_inner_png(path: pathlib.Path) -> str:
    """O SVG branco do site é só um PNG embutido; devolve o data URI dele."""
    match = re.search(r'xlink:href="(data:image/png;base64,[^"]+)"', path.read_text(encoding="utf8"))
    assert match, f"PNG embutido não encontrado em {path.name}"
    return match.group(1)


# destino, fonte, largura, altura (None = pela proporção), recortar sobra, formato
JOBS = [
    (BRAND / "nerdresolve-wordmark.webp", data_uri(SITE / "img/logo-nerdlms-energy.webp"), 400, 170, True, "image/webp"),
    (BRAND / "nerdresolve-wordmark-white.webp", svg_inner_png(SITE / "img/logo-nerdlms-energy-branco.svg"), 400, 170, True, "image/webp"),
    (BRAND / "nerdresolve-mark.webp", data_uri(SITE / "favicon/android-chrome-256x256.png"), 176, None, True, "image/webp"),
    (APP / "icon.png", data_uri(SITE / "favicon/android-chrome-192x192.png"), 192, 192, False, "image/png"),
    (APP / "apple-icon.png", data_uri(SITE / "favicon/android-chrome-256x256.png"), 180, 180, False, "image/png"),
]

RENDER = """
async ([uri, width, height, trim, type]) => {
  const img = new Image();
  img.src = uri;
  await img.decode();

  const src = document.createElement("canvas");
  src.width = img.naturalWidth;
  src.height = img.naturalHeight;
  src.getContext("2d").drawImage(img, 0, 0);

  let box = { x: 0, y: 0, w: src.width, h: src.height };
  if (trim) {
    const { data } = src.getContext("2d").getImageData(0, 0, src.width, src.height);
    let x0 = src.width, y0 = src.height, x1 = -1, y1 = -1;
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const i = (y * src.width + x) * 4;
        const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
        // sobra: transparente, ou o branco de fundo quando a arte veio opaca
        if (a < 8 || (a > 248 && r > 247 && g > 247 && b > 247)) continue;
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
    if (x1 >= x0 && y1 >= y0) box = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  const out = document.createElement("canvas");
  out.width = width;
  out.height = height ?? Math.round((box.h * width) / box.w);
  const ctx = out.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, box.x, box.y, box.w, box.h, 0, 0, out.width, out.height);

  return { size: [out.width, out.height], data: out.toDataURL(type, 0.9).split(",")[1] };
}
"""

BRAND.mkdir(parents=True, exist_ok=True)

with sync_playwright() as play:
    browser = play.chromium.launch()
    page = browser.new_page()

    for dest, uri, width, height, trim, mime in JOBS:
        result = page.evaluate(RENDER, [uri, width, height, trim, mime])
        blob = base64.b64decode(result["data"])
        dest.write_bytes(blob)
        print(f"{dest.name}: {result['size'][0]}x{result['size'][1]} ({len(blob) / 1024:.1f} kB)")

    browser.close()
