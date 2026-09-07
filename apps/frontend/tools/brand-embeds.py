"""Regenera os dois binários de marca que vivem embutidos em código.

São dois porque nenhum dos dois pode ser um arquivo servido pela web:

  packages/core/src/reports/logo.ts        a logo dentro do certificado em PDF.
                                           O PDF carrega o pixel RGB cru,
                                           comprimido com Flate — não um PNG.

  apps/backend/src/notifications/brand-logo.ts   o cabeçalho do e-mail. É
                                           imagem, e não HTML colorido, porque
                                           o Outlook repinta `background-color`
                                           no modo escuro dele e transformava o
                                           azul da marca em roxo. Pixel não é
                                           reescrito. E vai embutido porque
                                           cliente de e-mail bloqueia imagem
                                           remota por padrão.

Uso: python tools/brand-embeds.py   (exige playwright + chromium)
"""
import base64
import pathlib
import zlib

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
REPO = ROOT.parent.parent
WORDMARK = ROOT / "public" / "brand" / "nerdresolve-wordmark.webp"
WORDMARK_WHITE = ROOT / "public" / "brand" / "nerdresolve-wordmark-white.webp"

PDF_LOGO_TS = REPO / "packages" / "core" / "src" / "reports" / "logo.ts"
EMAIL_LOGO_TS = REPO / "apps" / "backend" / "src" / "notifications" / "brand-logo.ts"

# A logo do certificado é impressa a 138pt (1,92 pol) de largura, e 480px dá
# 250 dpi ali — qualidade de impressão sem inflar o PDF. Não sobe para 600:
# o sol do símbolo é degradê, então o Flate não tem o que economizar e cada
# passo de largura custa caro (600px = 124 kB contra 83 kB aqui). Este arquivo
# viaja dentro de TODO certificado emitido.
PDF_WIDTH = 480
EMAIL_SIZE = (600, 236)


def data_uri(path: pathlib.Path) -> str:
    return "data:image/webp;base64," + base64.b64encode(path.read_bytes()).decode()


def wrap(text: str, per_line: int = 96) -> str:
    """Quebra o base64 em linhas de string concatenadas, para o arquivo ser legível."""
    linhas = [text[i : i + per_line] for i in range(0, len(text), per_line)]
    return "\n".join(f'    "{linha}" +' for linha in linhas)[:-2].lstrip()


# ---------------------------------------------------------------- logo do PDF

RGB_BYTES = """
async ([uri, width]) => {
  const img = new Image();
  img.src = uri;
  await img.decode();

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round((img.naturalHeight * width) / img.naturalWidth);
  const ctx = canvas.getContext("2d");
  // A transparência é achatada sobre branco: é o fundo onde a logo aparece no
  // certificado, e o PDF em DeviceRGB não tem canal alfa para carregar.
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const rgb = [];
  for (let i = 0; i < data.length; i += 4) rgb.push(data[i], data[i + 1], data[i + 2]);
  return { size: [canvas.width, canvas.height], rgb };
}
"""

# ------------------------------------------------------------ e-mail: header

EMAIL_HTML = """
<!doctype html>
<html><head><meta charset="utf-8"><style>
  /* A fonte entra embutida: a página é montada em memória, sem servidor que
     sirva /fonts, e sem ela o título sairia em Arial. */
  @font-face { font-family: "DM Sans"; src: url(%(font)s) format("woff2"); font-weight: 100 900; }
  html, body { margin: 0; padding: 0; }
  .banner {
    position: relative;
    width: %(w)spx; height: %(h)spx;
    background: linear-gradient(120deg, #A855F7 0%%, #4C1D95 52%%, #12082B 100%%);
    overflow: hidden;
    font-family: "DM Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .banner svg { position: absolute; inset: 0; width: 100%%; height: 100%%; }
  .logo { position: absolute; left: 44px; top: 34px; width: 168px; height: auto; }
  .title {
    position: absolute; left: 44px; bottom: 40px; margin: 0;
    color: #FFFFFF; font-size: 25px; line-height: 1.24; font-weight: 700;
    letter-spacing: -0.015em;
  }
</style></head>
<body>
  <div class="banner">
    <!-- As curvas repetem a onda da plataforma. Duas linhas finas e uma folha
         translúcida: sem elas o cabeçalho é um retângulo azul. -->
    <svg viewBox="0 0 600 236" preserveAspectRatio="none" fill="none">
      <path d="M0 118 C 120 78, 240 158, 360 118 S 520 62, 600 96" stroke="rgba(255,255,255,0.30)" stroke-width="1.2"/>
      <path d="M0 150 C 140 108, 250 196, 380 150 S 520 96, 600 130" stroke="rgba(255,255,255,0.16)" stroke-width="1"/>
      <path d="M0 236 C 150 176, 330 236, 600 168 L 600 236 Z" fill="rgba(184,198,80,0.16)"/>
      <path d="M0 236 C 180 200, 380 250, 600 196 L 600 236 Z" fill="rgba(0,117,201,0.35)"/>
    </svg>
    <img class="logo" src="%(logo)s" alt="">
    <p class="title">Bem-vindo à plataforma<br>de ensino da Exemplo S.A.</p>
  </div>
</body></html>
"""


def main() -> None:
    with sync_playwright() as play:
        browser = play.chromium.launch(args=["--force-color-profile=srgb"])
        page = browser.new_page(viewport={"width": EMAIL_SIZE[0], "height": EMAIL_SIZE[1]})

        # --- certificado
        result = page.evaluate(RGB_BYTES, [data_uri(WORDMARK), PDF_WIDTH])
        largura, altura = result["size"]
        flate = zlib.compress(bytes(result["rgb"]), 9)
        PDF_LOGO_TS.write_text(
            '/**\n'
            ' * Logo da Exemplo S.A. embutida, pronta para o PDF.\n'
            ' *\n'
            ' * GERADO — não editar à mão. Origem: `public/brand/nerdresolve-wordmark.webp`,\n'
            ' * por `apps/frontend/tools/brand-embeds.py`.\n'
            ' *\n'
            ' * Os bytes já vêm no formato que o PDF espera: RGB de 8 bits comprimido\n'
            ' * com Flate, sem os filtros por linha do PNG. A transparência foi achatada\n'
            ' * sobre branco, que é o fundo onde a logo aparece no certificado.\n'
            ' */\n'
            '\n'
            'export const NERD_LOGO = {\n'
            f'  width: {largura},\n'
            f'  height: {altura},\n'
            '  /** RGB comprimido com Flate, em base64. */\n'
            f'  data:\n    {wrap(base64.b64encode(flate).decode())},\n'
            '} as const;\n',
            encoding="utf8",
        )
        print(f"logo.ts: {largura}x{altura}, {len(flate) / 1024:.1f} kB comprimido")

        # --- e-mail
        page.set_content(
            EMAIL_HTML
            % {
                "w": EMAIL_SIZE[0],
                "h": EMAIL_SIZE[1],
                "logo": data_uri(WORDMARK_WHITE),
                "font": "data:font/woff2;base64,"
                + base64.b64encode((ROOT / "public" / "fonts" / "dm-sans.woff2").read_bytes()).decode(),
            }
        )
        page.wait_for_timeout(200)
        shot = page.locator(".banner").screenshot(type="jpeg", quality=88)
        EMAIL_LOGO_TS.write_text(
            '/**\n'
            ' * Cabeçalho de marca embutido em base64.\n'
            ' *\n'
            ' * Cliente de e-mail bloqueia imagem remota por padrão: um `<img src="https://…">`\n'
            ' * chega como retângulo vazio até quem lê autorizar. Embutido, aparece na\n'
            ' * primeira abertura.\n'
            ' *\n'
            ' * É IMAGEM, e não HTML com cor de fundo, por causa do Outlook: ele aplica o\n'
            ' * próprio modo escuro sobre a mensagem e reescreve `background-color`, o que\n'
            ' * transformava o azul da Exemplo S.A. em roxo. Pixel não é reescrito.\n'
            ' *\n'
            f' * {EMAIL_SIZE[0]}x{EMAIL_SIZE[1]}, ~{len(shot) // 1024} kB. GERADO — não editar à mão.\n'
            ' * Origem: `apps/frontend/tools/brand-embeds.py`.\n'
            ' */\n'
            'export const NERD_EMAIL_HEADER_BASE64 =\n'
            f'  "data:image/jpeg;base64," +\n    {wrap(base64.b64encode(shot).decode())};\n',
            encoding="utf8",
        )
        print(f"brand-logo.ts: {EMAIL_SIZE[0]}x{EMAIL_SIZE[1]}, {len(shot) / 1024:.1f} kB")

        browser.close()


main()
