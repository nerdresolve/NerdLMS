import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CircleAlert, CircleSlash, Clock } from "lucide-react";

import { verifyBadgeUseCase } from "@nerdlms/backend/badges/badge-use-case.ts";
import { criteriaNarrative } from "@nerdlms/core/badges/open-badges.ts";

import "@/styles/status-page.css";
import "./badge-publico.css";

/**
 * Verificação pública de badge — F6-01 (guia §19, "verificação").
 *
 * É a URL que a pessoa compartilha: `/badge/ABC123DEF456`. Quem abre é alguém
 * de FORA — um recrutador, um cliente, um auditor — e exigir login
 * inviabilizaria justamente o uso que dá sentido ao badge.
 *
 * O e-mail de quem recebeu NÃO aparece. A página é pública, e publicar o
 * endereço de todo mundo que tem badge transformaria cada compartilhamento num
 * vazamento. O nome basta para conferir.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ codigo: string }>;
}): Promise<Metadata> {
  const { codigo } = await params;
  const award = await verifyBadgeUseCase(codigo);

  if (!award) return { title: "Badge não encontrado" };

  return {
    title: `${award.badgeName} · ${award.recipientName}`,
    description: `${award.recipientName} recebeu o badge ${award.badgeName} de ${award.tenantName}.`,
  };
}

function dataLonga(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export default async function BadgePublicoPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const award = await verifyBadgeUseCase(codigo);

  if (!award) {
    return (
      <main className="status-page">
        <div className="status-page__card">
          <p className="badge-publico__estado badge-publico__estado--invalido">
            <CircleAlert aria-hidden /> Badge não encontrado
          </p>
          <h1 className="status-page__title">Este código não corresponde a nenhum badge</h1>
          <p className="status-page__text">
            Confira se o código foi copiado por inteiro. Um badge emitido por esta plataforma
            sempre pode ser conferido aqui.
          </p>
          <Link className="btn btn--secondary" href="/login">
            Ir para a plataforma
          </Link>
        </div>
      </main>
    );
  }

  /* Os três estados têm tratamento visual distinto E texto distinto: quem lê
     precisa entender a diferença entre "vencido" e "revogado" sem depender da
     cor (WCAG 1.4.1). */
  const estado =
    award.status === "valid"
      ? { rotulo: "Badge válido", Icone: BadgeCheck, classe: "valido" }
      : award.status === "expired"
        ? { rotulo: "Badge vencido", Icone: Clock, classe: "vencido" }
        : { rotulo: "Badge revogado", Icone: CircleSlash, classe: "revogado" };

  const { Icone } = estado;

  return (
    <main className="status-page">
      <div className="status-page__card badge-publico">
        <p className={`badge-publico__estado badge-publico__estado--${estado.classe}`}>
          <Icone aria-hidden /> {estado.rotulo}
        </p>

        <h1 className="status-page__title">{award.badgeName}</h1>
        <p className="status-page__text">{award.badgeDescription}</p>

        <dl className="badge-publico__dados">
          <div>
            <dt>Concedido a</dt>
            <dd>{award.recipientName}</dd>
          </div>
          <div>
            <dt>Emitido por</dt>
            <dd>{award.tenantName}</dd>
          </div>
          <div>
            <dt>Em</dt>
            <dd>{dataLonga(award.awardedAt)}</dd>
          </div>
          {award.expiresAt ? (
            <div>
              <dt>{award.status === "expired" ? "Venceu em" : "Válido até"}</dt>
              <dd>{dataLonga(award.expiresAt)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Como se conquista</dt>
            <dd>
              {criteriaNarrative(award.criterion, {
                courseName: award.courseName,
                trackName: award.trackName,
                threshold: award.threshold,
              })}
            </dd>
          </div>
          <div>
            <dt>Código</dt>
            <dd>
              <code>{award.code}</code>
            </dd>
          </div>
        </dl>

        {award.status === "revoked" ? (
          <p className="badge-publico__motivo">
            <strong>Motivo da revogação:</strong>{" "}
            {award.revokedReason ?? "Revogado pelo emissor."}
          </p>
        ) : null}

        {award.status === "expired" ? (
          <p className="badge-publico__motivo">
            Este badge tinha prazo de validade e precisa ser renovado. Ele confirma que a formação
            foi feita, mas não que continua em dia.
          </p>
        ) : null}

        {/* O link para o documento Open Badges: é o que um verificador
            automático busca, e o que permite levar o badge para outro lugar. */}
        <p className="badge-publico__interop">
          <a href={`/api/badges/emissao/${award.code}`} rel="nofollow">
            Ver este badge em formato Open Badges
          </a>
        </p>
      </div>
    </main>
  );
}
