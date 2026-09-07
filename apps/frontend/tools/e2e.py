"""
E2E do fluxo crítico (TASK-014).

Percorre, num navegador de verdade, o caminho que o cliente percorre: entrar,
abrir um curso, assistir uma aula, comentar, sair. E verifica que cada papel
alcança a própria área e nenhuma outra.

Existe porque os testes de unidade não pegam o que já quebrou aqui: rota que
vira 404, botão que não faz nada, sessão que cai ao navegar, tela de erro no
lugar de uma negativa. Todos foram encontrados clicando, não lendo o código.

Uso:
    python3 tools/e2e.py                      # contra o local
    E2E_BASE=https://... python3 tools/e2e.py # contra outro ambiente

Sai com código 1 se qualquer passo falhar, para servir de portão.
"""

import os
import sys

from playwright.sync_api import sync_playwright

BASE = os.environ.get("E2E_BASE", "https://localhost:8444")

CONTAS = {
    "aluno": ("user.mock", "usermock"),
    "instrutor": ("instructor.mock", "instructormock"),
    "gestor": ("manager.mock", "managermock"),
    "admin": ("admin.mock", "adminmock"),
}

# Área que cada papel PRECISA alcançar, e a que precisa ser negada.
ALCANCE = {
    "aluno": (["/dashboard", "/meus-cursos", "/cursos", "/perfil"], ["/admin", "/gestor"]),
    "instrutor": (["/instrutor/cursos", "/instrutor/engajamento"], ["/admin"]),
    "gestor": (["/gestor", "/gestor/equipe"], ["/admin"]),
    "admin": (["/admin", "/admin/usuarios", "/admin/auditoria"], []),
}

# Ruído que não é defeito da aplicação: analytics da borda e prefetch cancelado.
RUIDO = ("cloudflareinsights", "beacon", "ERR_ABORTED", "_rsc=", "favicon", "ERR_CERT")

falhas: list[str] = []


def anota(ok: bool, descricao: str, detalhe: str = "") -> None:
    print(f"  {'ok  ' if ok else 'FALHA'} {descricao}{'' if ok else f' :: {detalhe}'}")
    if not ok:
        falhas.append(f"{descricao} :: {detalhe}")


def relevante(texto: str) -> bool:
    return not any(n in texto for n in RUIDO)


def entrar(page, usuario: str, senha: str) -> bool:
    """`False` também quando o servidor não responde: um ambiente fora do ar é
    falha do teste, não motivo para traceback."""
    try:
        page.goto(f"{BASE}/login", wait_until="networkidle")
        page.fill('input[name="identifier"]', usuario)
        page.fill('input[name="password"]', senha)
        page.click('button[type="submit"]')
        page.wait_for_url(lambda url: "/login" not in url, timeout=25000)
        return True
    except Exception:
        return False


def tela_de_erro(page) -> bool:
    texto = page.evaluate("() => document.body.innerText.slice(0, 120)").lower()
    return "application error" in texto or "server-side exception" in texto


def main() -> int:
    with sync_playwright() as play:
        navegador = play.chromium.launch()

        # --- 1. Fluxo do aluno, de ponta a ponta -------------------------------
        print("\nFluxo do aluno")
        contexto = navegador.new_context(ignore_https_errors=True)
        pagina = contexto.new_page()
        erros: list[str] = []
        pagina.on("pageerror", lambda e: erros.append(str(e)))
        pagina.on("console", lambda m: erros.append(m.text) if m.type == "error" else None)

        if not entrar(pagina, *CONTAS["aluno"]):
            anota(False, "entra com usuário e senha", f"{BASE} não respondeu ou recusou o acesso")
            contexto.close()
            navegador.close()
            print(f"{len(falhas)} passo(s) falharam:")
            for f in falhas:
                print(f"  - {f}")
            return 1
        anota(True, "entra com usuário e senha")

        pagina.goto(f"{BASE}/meus-cursos", wait_until="networkidle")
        pagina.wait_for_timeout(500)
        curso = pagina.locator("a[href^='/cursos/']").first
        anota(curso.count() > 0, "a lista traz cursos")

        if curso.count() > 0:
            curso.click()
            pagina.wait_for_load_state("networkidle")
            pagina.wait_for_timeout(700)
            anota(not tela_de_erro(pagina) and "/cursos/" in pagina.url, "abre a página do curso", pagina.url)

            seguir = pagina.locator("a:has-text('Continuar'), a:has-text('Começar')").first
            if seguir.count() > 0:
                seguir.click()
                pagina.wait_for_load_state("networkidle")
                pagina.wait_for_timeout(1200)
                anota("/aulas/" in pagina.url and not tela_de_erro(pagina), "abre a aula", pagina.url)
                anota(pagina.locator("video").count() > 0, "a aula traz o player")

                caixa = pagina.locator("textarea").first
                if caixa.count() > 0:
                    caixa.fill("Comentário do teste automatizado.")
                    enviar = pagina.locator("form.composer button[type=submit]").first
                    if enviar.count() > 0:
                        enviar.click()
                        pagina.wait_for_timeout(2500)
                        publicado = "teste automatizado" in pagina.evaluate("() => document.body.innerText")
                        anota(publicado, "publica comentário")
                        if publicado:
                            apagar = pagina.locator("button:has-text('Excluir')").last
                            if apagar.count() > 0:
                                apagar.click()
                                pagina.wait_for_timeout(2500)
                                anota(
                                    "teste automatizado" not in pagina.evaluate("() => document.body.innerText"),
                                    "remove o próprio comentário",
                                )

        sair = pagina.locator('form[action="/sair"] button').first
        if sair.count() > 0:
            sair.click()
            pagina.wait_for_timeout(3500)
            anota("/login" in pagina.url, "sai da plataforma", pagina.url)
            pagina.goto(f"{BASE}/dashboard", wait_until="networkidle")
            anota("/login" in pagina.url, "a sessão encerrada não abre área interna", pagina.url)

        reais = [e for e in erros if relevante(e)]
        anota(not reais, "nenhum erro de console no fluxo", "; ".join(reais[:2]))
        contexto.close()

        # --- 2. Cada papel alcança a própria área, e só ela --------------------
        for papel, (permitidas, negadas) in ALCANCE.items():
            print(f"\nAcesso do {papel}")
            contexto = navegador.new_context(ignore_https_errors=True)
            pagina = contexto.new_page()

            if not entrar(pagina, *CONTAS[papel]):
                anota(False, f"{papel} entra na plataforma")
                contexto.close()
                continue

            for rota in permitidas:
                try:
                    resposta = pagina.goto(f"{BASE}{rota}", wait_until="networkidle")
                    pagina.wait_for_timeout(300)
                except Exception as erro:
                    anota(False, f"alcança {rota}", str(erro)[:60])
                    continue
                status = resposta.status if resposta else 0
                anota(status < 400 and not tela_de_erro(pagina), f"alcança {rota}", f"http {status}")

            for rota in negadas:
                pagina.goto(f"{BASE}{rota}", wait_until="networkidle")
                pagina.wait_for_timeout(300)
                texto = pagina.evaluate("() => document.body.innerText.slice(0, 60)")
                # Negar é 404 ou o redirecionamento para o login; erro técnico não.
                anota("404" in texto or "/login" in pagina.url, f"não alcança {rota}", texto.replace("\n", " ")[:50])
                anota(not tela_de_erro(pagina), f"{rota} nega sem tela de erro")

            contexto.close()

        navegador.close()

    print()
    if falhas:
        print(f"{len(falhas)} passo(s) falharam:")
        for f in falhas:
            print(f"  - {f}")
        return 1

    print("Fluxo crítico íntegro.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
