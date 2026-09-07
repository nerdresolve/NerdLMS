"""
Captura as telas do preview com Chromium (Playwright) — validação visual real.

Existe porque o motor do wkhtmltoimage não implementa CSS grid, container query
nem aspect-ratio, e por isso escondeu quatro bugs de layout durante sete ciclos.
Ver progress.md -> DEC-015.

Uso: python3 tools/shot.py      (saída em shots/, desktop e mobile)
"""
import pathlib

from playwright.sync_api import sync_playwright

PAGES = ["landing", "login", "dashboard", "catalog", "library", "completed", "favorites", "course", "lesson", "profile", "studio", "editor", "engagement", "admin", "users", "manager", "team", "tracks", "rewards", "agenda", "audit"]
VIEWPORTS = [("desktop", 1440, 900), ("mobile", 390, 844)]

root = pathlib.Path(__file__).resolve().parent.parent
preview = root / "preview"
out = root / "shots"
out.mkdir(exist_ok=True)

with sync_playwright() as play:
    browser = play.chromium.launch(args=["--force-color-profile=srgb"])

    for name in PAGES:
        for label, width, height in VIEWPORTS:
            page = browser.new_page(viewport={"width": width, "height": height})

            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

            page.goto((preview / f"{name}.html").as_uri())
            page.wait_for_timeout(700)

            # a barra de QA não faz parte do produto
            page.add_style_tag(content=".qa{display:none!important}")
            page.screenshot(path=str(out / f"{name}-{label}.png"), full_page=True)

            # a fonte remota falha sem rede; qualquer outro erro importa
            real = [e for e in errors if "fonts.googleapis" not in e and "403" not in e]
            if real:
                print(f"  ERRO {name}/{label}: {real[:2]}")

            page.close()

    browser.close()

print(f"capturas em {out}")
