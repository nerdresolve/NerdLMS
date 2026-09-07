"""Renderiza o certificado em PNG, para ele poder ser CONFERIDO.

Existe porque o certificado era o único artefato do produto que ninguém
olhava. Os testes conferem que o PDF é válido e que os textos estão dentro
dele; nenhum deles diz se o desenho faz sentido — e foi assim que a rubrica em
onda da marca ANTERIOR sobreviveu a uma troca inteira de identidade.

Usa o pdf.js dentro do Chromium, que é o mesmo motor que vai abrir o arquivo
do lado de quem recebe. Saída em `docs/certificado.png` e
`docs/certificado-nome-longo.png` — o segundo existe porque nome e título vêm
do cadastro e não têm limite prático: é o caso que quebra a composição.

Uso: python tools/certificate-preview.py
Exige: playwright + chromium, e `npm install` (pdfjs-dist é dependência de
desenvolvimento do frontend).
"""
import base64
import json
import pathlib
import subprocess
import tempfile

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
REPO = ROOT.parent.parent
DOCS = REPO / "docs"
def _pdfjs() -> pathlib.Path:
    """npm hasteia a dependência para a raiz do workspace; procura nos dois."""
    for base in (ROOT, REPO):
        caminho = base / "node_modules" / "pdfjs-dist" / "build"
        if (caminho / "pdf.mjs").exists():
            return caminho
    raise SystemExit("pdfjs-dist não instalado — rode `npm install`")

CASOS = [
    (
        "certificado.png",
        {
            "learnerName": "Maria Souza",
            "courseTitle": "Relacionamento com Comunidades",
            "lessons": 14,
            "durationSeconds": 18360,
            "completedAt": "2026-08-12T12:00:00-03:00",
        },
    ),
    (
        "certificado-nome-longo.png",
        {
            "learnerName": "Maria Aparecida do Nascimento Vasconcelos",
            "courseTitle": "Segurança em Operações de Campo: Trabalho a Quente e Espaço Confinado",
            "lessons": 20,
            "durationSeconds": 34200,
            "completedAt": "2026-08-12T12:00:00-03:00",
        },
    ),
    (
        # Instrutor definido e assinatura AINDA NAO enviada.
        #
        # E o estado em que todo instrutor comeca, e o que aparece enquanto
        # ninguem subiu arquivo nenhum: o nome impresso sob a linha, com a
        # regua de tres cores acima dela. O certificado nao pode depender de um
        # PNG, e este caso e o que prova isso continuar valendo.
        #
        # O caso COM imagem nao entra aqui de proposito: ele exigiria um PNG
        # convertido embutido nesta ferramenta, que envelheceria em silencio.
        # Ele se confere emitindo pela aplicacao, que e onde a assinatura de
        # verdade vive.
        "certificado-com-instrutor.png",
        {
            "learnerName": "Maria Souza",
            "courseTitle": "Relacionamento com Comunidades",
            "lessons": 14,
            "durationSeconds": 18360,
            "completedAt": "2026-08-12T12:00:00-03:00",
            "signer": {"name": "Camila Prado", "title": "Instrutor responsável"},
        },
    ),
]

GERA = """
import('./packages/core/src/reports/certificate.ts').then(async (m) => {
  const fs = await import('node:fs');
  const dados = JSON.parse(process.argv[2]);
  const pdf = m.buildCertificate({ ...dados, code: m.certificateCode('preview') });
  fs.writeFileSync(process.argv[1], pdf);
});
"""

PAGINA = """
<!doctype html><html><head><meta charset="utf-8"></head>
<body style="margin:0"><canvas id="c"></canvas>
<script type="module">
import * as pdfjs from "/pdf.mjs";
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
const bytes = Uint8Array.from(atob(window.PDF_B64), (ch) => ch.charCodeAt(0));
const doc = await pdfjs.getDocument({ data: bytes }).promise;
const page = await doc.getPage(1);
const viewport = page.getViewport({ scale: 1.6 });
const canvas = document.getElementById("c");
canvas.width = viewport.width;
canvas.height = viewport.height;
await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
window.PRONTO = true;
</script></body></html>
"""

PDFJS = _pdfjs()
DOCS.mkdir(exist_ok=True)

with tempfile.TemporaryDirectory() as tmp, sync_playwright() as play:
    navegador = play.chromium.launch()

    def servir(rota):
        nome = rota.request.url.split("/")[-1]
        if nome in ("pdf.mjs", "pdf.worker.mjs"):
            rota.fulfill(status=200, content_type="text/javascript", body=(PDFJS / nome).read_bytes())
        elif nome.endswith(".html"):
            rota.fulfill(status=200, content_type="text/html", body=PAGINA)
        else:
            rota.fulfill(status=404, body="")

    for saida, dados in CASOS:
        pdf = pathlib.Path(tmp) / "c.pdf"
        subprocess.run(
            ["node", "--experimental-strip-types", "-e", GERA, str(pdf), json.dumps(dados)],
            cwd=REPO, check=True,
        )

        pagina = navegador.new_page(viewport={"width": 1400, "height": 1000})
        pagina.route("**/*", servir)
        pagina.add_init_script(f'window.PDF_B64 = "{base64.b64encode(pdf.read_bytes()).decode()}";')
        pagina.goto("http://certificado.local/render.html")
        pagina.wait_for_function("window.PRONTO === true", timeout=30000)
        pagina.locator("#c").screenshot(path=str(DOCS / saida))
        pagina.close()
        print(f"docs/{saida}  ({pdf.stat().st_size / 1024:.1f} kB de PDF)")

    navegador.close()
