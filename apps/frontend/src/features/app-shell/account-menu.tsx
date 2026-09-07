"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { LogOut, User } from "lucide-react";

import type { Role } from "@nerdlms/core/auth/permissions.ts";

const ROLE_LABEL: Record<Role, string> = {
  learner: "Aluno",
  manager: "Gestor",
  instructor: "Instrutor",
  admin: "Administrador",
};

/**
 * Menu da conta, na foto de perfil.
 *
 * O avatar era um link direto para `/perfil`. Sair, que é a única ação que
 * alguém procura ali, só existia no pé da barra lateral — e a barra lateral
 * some no mobile e quando o menu está recolhido. Quem quisesse sair de um
 * notebook emprestado tinha de abrir o menu antes.
 *
 * NÃO usa `role="menu"`. Aquele papel obriga navegação por setas, com um item
 * focalizável por vez, e anunciar o papel sem implementar o teclado é pior que
 * não anunciá-lo: o leitor de tela promete um comportamento que não existe.
 * Aqui são links comuns dentro de um painel — Tab percorre, Enter ativa, e é
 * exatamente o que o usuário espera de dois links.
 */
export function AccountMenu({
  fullName,
  role,
  /* As iniciais vêm PRONTAS de quem chama. Já existem três cópias de
     `initialsOf` no projeto, cada uma com um corte diferente do nome; uma
     quarta aqui garantiria que o avatar da barra e o do menu divergissem
     algum dia. */
  initials,
}: {
  fullName: string;
  role: Role;
  initials: string;
}) {
  const painelId = useId();
  const [aberto, setAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const primeiro = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!aberto) return;

    /* O foco entra no painel ao abrir, senão quem usa teclado precisa dar Tab
       para trás por cima da barra inteira para chegar em "Sair". */
    primeiro.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setAberto(false);
      /* Devolve o foco a quem abriu: sem isto ele volta para o começo do
         documento e a pessoa se perde. */
      botao.current?.focus();
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aberto]);

  return (
    <div className="account">
      <button
        ref={botao}
        type="button"
        className="icon-button icon-button--avatar"
        /* O nome acessível precisa CONTER o texto visível (WCAG 2.5.3): com
           "Sua conta" sobre as iniciais, quem navega por voz diz "MS" e o
           comando não encontra o botão. */
        aria-label={`${initials}, sua conta`}
        aria-haspopup="true"
        aria-expanded={aberto}
        aria-controls={painelId}
        onClick={() => setAberto((atual) => !atual)}
      >
        {initials}
      </button>

      {aberto ? (
        <>
          {/* Captura o clique fora sem escurecer a tela — mesmo recurso do
              sino de avisos, pelo mesmo motivo: o painel é pequeno. */}
          <div className="account__catcher" role="presentation" onClick={() => setAberto(false)} />

          <div className="account__panel" id={painelId} aria-label="Sua conta">
            <div className="account__head">
              <span className="account__name">{fullName}</span>
              <span className="account__role">{ROLE_LABEL[role]}</span>
            </div>

            <Link ref={primeiro} className="account__item" href="/perfil" onClick={() => setAberto(false)}>
              <User aria-hidden /> Ver perfil
            </Link>

            {/* Formulário com POST, não `<Link>`.

                `/sair` é uma rota do servidor — encerrar sessão invalida o
                token no banco, e um botão que só limpasse o estado do cliente
                deixaria o cookie de pé. Mas ela responde SÓ a POST, e um
                `<Link>` navega por GET: o Next devolvia 405 e quem clicava via
                tela de erro em vez de sair. Era o que acontecia aqui.

                O POST não é detalhe de implementação: como GET, o prefetch do
                `<Link>` abriria a rota sozinho ao montar a barra de navegação e
                deslogaria quem tinha acabado de entrar. É a mesma razão pela
                qual a barra lateral já usava formulário — este menu é que
                nasceu fora do padrão. */}
            {/* SEM `onClick` que feche o painel, e isso é o defeito que estava
                aqui. Fechar no clique roda ANTES da submissão nativa: o React
                desmontava o `<form>`, e o navegador não submete um formulário
                que saiu da página. O botão parecia morto — o "Ver perfil" ao
                lado funcionava, porque um `<Link>` navega dentro do próprio
                manipulador do clique.

                Não há o que fechar: a submissão leva para `/login`, e o menu
                vai embora com a página. */}
            <form action="/sair" method="post" className="account__form">
              <button type="submit" className="account__item account__item--exit">
                <LogOut aria-hidden /> Sair
              </button>
            </form>
          </div>
        </>
      ) : null}
    </div>
  );
}
