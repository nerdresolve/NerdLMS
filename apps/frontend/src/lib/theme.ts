/**
 * Tema claro/escuro.
 *
 * A escolha vive em `localStorage` e é aplicada no atributo `data-theme` do
 * `<html>`, que é o que os tokens consultam.
 *
 * O valor precisa ser lido ANTES da primeira pintura, senão a página aparece
 * clara por um instante e vira escura em seguida. Por isso o
 * `THEME_INIT_SCRIPT` roda como script inline no `<head>`, e não num efeito
 * do React — um efeito só corre depois da hidratação, tarde demais.
 */

export const THEME_KEY = "nerd-theme";

export type Theme = "light" | "dark";

/**
 * Executado inline no `<head>`, antes de qualquer pintura.
 *
 * Ordem: escolha salva > claro. A preferência do sistema NÃO entra: quem usa
 * o Windows no escuro caía no tema escuro sem ter pedido, e a plataforma é
 * apresentada no claro. O escuro passa a ser uma escolha explícita, feita no
 * botão da topbar, e essa escolha sobrevive ao recarregamento.
 *
 * O `try` cobre o navegador com armazenamento bloqueado (janela privada,
 * cookies de terceiros desligados), onde `localStorage` lança em vez de
 * devolver `null` — sem ele, a exceção aqui derrubaria o carregamento da
 * página inteira.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var s=localStorage.getItem(${JSON.stringify(THEME_KEY)});
document.documentElement.setAttribute("data-theme",s==="dark"?"dark":"light");
}catch(e){}})();`;

/** Lê a escolha efetiva já aplicada ao documento. */
export function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/** Aplica e guarda a escolha. Falha de armazenamento não impede a troca. */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* Sem persistência (janela privada), o tema ainda vale nesta aba. */
  }
}
