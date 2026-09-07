"""Regenera o vídeo de demonstração da aula (`public/media/aula-demo.mp4`).

Existe porque a aula precisa de ALGUM vídeo para a tela ser real — barra de
progresso, retomada de posição, tempo assistido — e não há conteúdo gravado.
O clipe é um cartão da marca com o cronômetro correndo: ver o número andar é o
que prova que a reprodução está funcionando, e é o que uma tarja parada não faz.

Os quadros são desenhados em HTML no Chromium (é como a tipografia sai em DM
Sans de verdade) e o ffmpeg costura. 8 fps porque a imagem só muda no
cronômetro, e h264 baseline em 640x360 com crf 33 porque o vídeo é embutido em
base64 no protótipo, onde cada kB é multiplicado por página — em 1280x720 e crf
28 o arquivo triplicava sem que nada ficasse mais legível.

Uso: python tools/demo-video.py
     FFMPEG=/caminho/para/ffmpeg python tools/demo-video.py

Depende de um ffmpeg no PATH (ou em $FFMPEG) — por isso NÃO entra no `verify`:
é um asset gerado uma vez e versionado, não um portão de cada build.
"""
import base64
import os
import pathlib
import shutil
import subprocess
import tempfile

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
DESTINO = ROOT / "public" / "media" / "aula-demo.mp4"
LOGO = ROOT / "public" / "brand" / "nerdresolve-wordmark-white.webp"
FONTE = ROOT / "public" / "fonts" / "dm-sans.woff2"

LARGURA, ALTURA = 640, 360
FPS = 8
SEGUNDOS = 40

FFMPEG = os.environ.get("FFMPEG") or shutil.which("ffmpeg")
if not FFMPEG:
    raise SystemExit("ffmpeg não encontrado — instale ou aponte $FFMPEG")

QUADRO = """
<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face { font-family: "DM Sans"; src: url(%(font)s) format("woff2"); font-weight: 100 900; }
  html, body { margin: 0; padding: 0; }
  .frame {
    width: %(w)spx; height: %(h)spx;
    background: linear-gradient(120deg, #A855F7 0%%, #4C1D95 55%%, #1E0F45 100%%);
    font-family: "DM Sans", sans-serif;
    color: #fff;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 14px;
  }
  .frame img { width: 216px; height: auto; }
  .kicker { margin: 0; font-size: 15px; font-weight: 500; letter-spacing: .01em; opacity: .88; }
  /* tabular-nums: sem isso o cronômetro treme de quadro em quadro, e o tremor
     rouba a atenção justamente de quem está tentando ler o tempo. */
  .clock { margin: 0; font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; opacity: .95; }
</style></head>
<body><div class="frame">
  <img src="%(logo)s" alt="">
  <p class="kicker">Vídeo de demonstração</p>
  <p class="clock" id="clock">00:00.000</p>
</div></body></html>
"""


def cronometro(quadro: int) -> str:
    total_ms = round(quadro * 1000 / FPS)
    minutos, resto = divmod(total_ms, 60_000)
    segundos, ms = divmod(resto, 1000)
    return f"{minutos:02d}:{segundos:02d}.{ms:03d}"


def main() -> None:
    logo = "data:image/webp;base64," + base64.b64encode(LOGO.read_bytes()).decode()
    fonte = "data:font/woff2;base64," + base64.b64encode(FONTE.read_bytes()).decode()

    with tempfile.TemporaryDirectory() as tmp:
        pasta = pathlib.Path(tmp)

        with sync_playwright() as play:
            browser = play.chromium.launch(args=["--force-color-profile=srgb"])
            page = browser.new_page(viewport={"width": LARGURA, "height": ALTURA})
            page.set_content(QUADRO % {"w": LARGURA, "h": ALTURA, "logo": logo, "font": fonte})
            page.wait_for_timeout(300)

            total = FPS * SEGUNDOS
            for quadro in range(total):
                page.evaluate("(t) => { document.getElementById('clock').textContent = t; }", cronometro(quadro))
                page.locator(".frame").screenshot(path=str(pasta / f"f{quadro:05d}.png"))

            browser.close()

        DESTINO.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [
                FFMPEG, "-y", "-loglevel", "error",
                "-framerate", str(FPS), "-i", str(pasta / "f%05d.png"),
                "-c:v", "libx264", "-profile:v", "baseline", "-level", "3.0",
                "-pix_fmt", "yuv420p", "-crf", "33", "-r", str(FPS),
                # +faststart põe o índice no início: sem ele o navegador baixa o
                # arquivo inteiro antes do primeiro quadro aparecer.
                "-movflags", "+faststart",
                str(DESTINO),
            ],
            check=True,
        )

    print(f"{DESTINO.name}: {LARGURA}x{ALTURA}, {SEGUNDOS}s a {FPS} fps, {DESTINO.stat().st_size / 1024:.1f} kB")


main()
