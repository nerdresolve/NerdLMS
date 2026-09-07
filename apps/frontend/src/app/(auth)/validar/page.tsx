import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CircleAlert, Clock, GraduationCap } from "lucide-react";

import { verifyCertificateUseCase } from "@nerdlms/backend/reports/certificate-use-case.ts";
import { formatDuration } from "@nerdlms/core/courses/progress.ts";

import { NOME_PADRAO } from "@nerdlms/core/tenancy/branding.ts";

import { tenantOfRequest } from "@/lib/tenant-request.ts";
import "@/styles/status-page.css";
import "./validar.css";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await tenantOfRequest();
  const nome = tenant?.name ?? NOME_PADRAO;

  return {
    title: "Validar certificado",
    description: `Confira a autenticidade de um certificado emitido pela plataforma de ensino da ${nome}.`,
  };
}

/* Consulta o banco a cada visita: um certificado emitido hoje precisa validar
   hoje, e a página é leve. */
export const dynamic = "force-dynamic";

function longDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

/**
 * Validação pública de certificado.
 *
 * O PDF traz "Código de verificação" no rodapé desde sempre, mas não havia
 * onde verificar — a promessa era decorativa. Esta página fecha o ciclo.
 *
 * Fica FORA do grupo `(app)` e não exige sessão: quem confere um certificado é
 * normalmente alguém de fora, um gestor ou um cliente que recebeu o PDF, e
 * exigir login inviabilizaria a conferência.
 *
 * Mostra só o que já está impresso no papel. Confirmar um código não pode
 * revelar mais do que o documento que a pessoa tem em mãos.
 */
export default async function ValidarPage({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>;
}) {
  const { codigo = "" } = await searchParams;
  const buscou = codigo.trim().length > 0;
  const certificado = buscou ? await verifyCertificateUseCase(codigo) : null;

  return (
    <main className="status-page">
      <div className="status-page__card validar">
        <h1 className="status-page__title">Validar certificado</h1>
        <p className="status-page__text">
          Informe o código impresso no rodapé do certificado para conferir se ele foi mesmo emitido
          por esta plataforma.
        </p>

        {/* GET com o código na URL: o resultado fica compartilhável, e é o que
            se espera de uma conferência — quem valida quer poder mandar o link
            para outra pessoa. */}
        <form className="validar__form" method="get" action="/validar">
          <label className="label" htmlFor="codigo">
            Código de verificação
          </label>
          <div className="validar__row">
            <input
              className="input"
              id="codigo"
              name="codigo"
              defaultValue={codigo}
              placeholder="Ex.: F645CAEB5BCB"
              maxLength={16}
              autoComplete="off"
              spellCheck={false}
              required
            />
            <button type="submit" className="btn btn--primary">
              Conferir
            </button>
          </div>
        </form>

        {buscou && certificado ? (
          <section className="validar__result" aria-live="polite">
            <p className="validar__badge">
              <BadgeCheck aria-hidden /> Certificado válido
            </p>

            <dl className="validar__data">
              <div>
                <dt>Nome</dt>
                <dd>{certificado.learnerName}</dd>
              </div>
              <div>
                <dt>Curso</dt>
                <dd>{certificado.courseTitle}</dd>
              </div>
              <div>
                <dt>Carga</dt>
                <dd>
                  <GraduationCap aria-hidden /> {certificado.lessons}{" "}
                  {certificado.lessons === 1 ? "aula" : "aulas"}
                  <span aria-hidden> · </span>
                  <Clock aria-hidden /> {formatDuration(certificado.durationSeconds)}
                </dd>
              </div>
              <div>
                <dt>Concluído em</dt>
                <dd>{longDate(certificado.completedAt)}</dd>
              </div>
              <div>
                <dt>Código</dt>
                <dd className="validar__code">{certificado.code}</dd>
              </div>
            </dl>

            <p className="validar__note">
              Documento de conclusão interna. Não equivale a certificação regulatória ou acadêmica.
            </p>
          </section>
        ) : null}

        {buscou && !certificado ? (
          <section className="validar__result validar__result--fail" aria-live="polite">
            <p className="validar__badge validar__badge--fail">
              <CircleAlert aria-hidden /> Código não confere
            </p>
            {/* A mensagem NÃO distingue "não existe" de "curso não concluído":
                separar os casos deixaria alguém descobrir matrículas em
                andamento testando códigos. */}
            <p className="status-page__text">
              Não encontramos um certificado com esse código. Confira se digitou exatamente como
              está no rodapé do documento.
            </p>
          </section>
        ) : null}

        <p className="status-page__links">
          <Link href="/">Voltar ao início</Link>
        </p>
      </div>
    </main>
  );
}
