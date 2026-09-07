"use client";

import { useState } from "react";
import {
  Award,
  BadgeCheck,
  CircleCheckBig,
  CircleSlash,
  Clock,
  GraduationCap,
  Link2,
  Medal,
  ShieldCheck,
  Star,
  Target,
  TrendingUp,
} from "lucide-react";

import type { ProfileBadge } from "./data.ts";

import "./profile-badges.css";

/**
 * Os badges de quem está logado — F6-01 (guia §19, "perfil" e "compartilhamento").
 *
 * Vive no perfil, ao lado dos certificados: badge é credencial verificável, e a
 * pergunta que responde é a mesma — "o que eu posso comprovar?".
 *
 * O botão de copiar link é o §19 "compartilhamento": sem ele, o código de
 * verificação seria uma promessa sem uso, exatamente como o certificado antes
 * de a página de validação existir.
 */

const ICONES: Record<string, typeof Award> = {
  award: Award,
  medal: Medal,
  star: Star,
  "shield-check": ShieldCheck,
  "badge-check": BadgeCheck,
  "graduation-cap": GraduationCap,
  target: Target,
  "trending-up": TrendingUp,
  "circle-check-big": CircleCheckBig,
};

/**
 * A data, sempre no MESMO fuso no servidor e no navegador.
 *
 * Sem `timeZone`, o servidor formata em UTC e o navegador no fuso de quem lê —
 * e um `awardedAt` de 03:00 UTC vira "23 de ago" lá e "22 de ago" aqui. O texto
 * diferente é uma HIDRATAÇÃO QUEBRADA: o React descarta a árvore do cliente e a
 * página inteira para de responder a clique.
 *
 * `UTC` e não o fuso de Brasília: é o mesmo que a validação de certificado já
 * usa, e a data de emissão é um fato, não um horário local.
 */
function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function ProfileBadges({ badges }: { badges: ProfileBadge[] }) {
  const [copiado, setCopiado] = useState<string | null>(null);

  async function copiarLink(code: string) {
    /* A URL absoluta é montada no navegador: é ela que a pessoa vai colar
       noutro lugar, e um caminho relativo não abriria em lugar nenhum. */
    const url = `${window.location.origin}/badge/${code}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopiado(code);
    } catch {
      /* Sem permissão de área de transferência: o link continua clicável ao
         lado, e a pessoa copia à mão. Não é erro que mereça alarme. */
      setCopiado(null);
    }
  }

  if (badges.length === 0) {
    return (
      <section className="course-section" aria-labelledby="meus-badges">
        <h2 className="course-section__title" id="meus-badges">
          <Award aria-hidden /> Badges
        </h2>
        <p className="pbadges__vazio">
          Você ainda não recebeu nenhum badge. Eles são concedidos ao concluir cursos e trilhas, ou
          pela equipe responsável pelo treinamento.
        </p>
      </section>
    );
  }

  return (
    <section className="course-section" aria-labelledby="meus-badges">
      <h2 className="course-section__title" id="meus-badges">
        <Award aria-hidden /> Badges
      </h2>

      <p className="pbadges__hint">
        Cada badge tem um link público de verificação. Quem abrir vê o que você conquistou, sem
        precisar de conta, e sem ver o seu e-mail.
      </p>

      <ul className="pbadges">
        {badges.map((badge) => {
          const Icone = ICONES[badge.icon] ?? Award;

          return (
            <li className="pbadges__item" key={badge.code} data-situacao={badge.status}>
              <span className="pbadges__icone" aria-hidden>
                <Icone />
              </span>

              <div className="pbadges__dados">
                <strong className="pbadges__nome">{badge.name}</strong>
                <span className="pbadges__desc">{badge.description}</span>

                <span className="pbadges__meta">
                  {/* A situação é dita em PALAVRA, não só pela cor da borda. */}
                  {badge.status === "revoked" ? (
                    <span className="pbadges__estado">
                      <CircleSlash aria-hidden /> Revogado
                    </span>
                  ) : badge.status === "expired" ? (
                    <span className="pbadges__estado">
                      <Clock aria-hidden /> Vencido em {dataCurta(badge.expiresAt!)}
                    </span>
                  ) : (
                    <>
                      Recebido em {dataCurta(badge.awardedAt)}
                      {badge.expiresAt ? ` · vale até ${dataCurta(badge.expiresAt)}` : ""}
                    </>
                  )}
                </span>
              </div>

              {/* Badge revogado não se compartilha: o link diria "revogado", e
                  oferecer o botão seria convidar a um constrangimento. */}
              {badge.status !== "revoked" ? (
                <div className="pbadges__acoes">
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => copiarLink(badge.code)}
                  >
                    <Link2 aria-hidden /> {copiado === badge.code ? "Copiado" : "Copiar link"}
                  </button>

                  <a
                    className="btn btn--ghost btn--small"
                    href={`/badge/${badge.code}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver
                  </a>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
