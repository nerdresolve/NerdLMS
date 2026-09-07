import { ShieldAlert, ScrollText } from "lucide-react";

import { isSensitive, type AuditAction } from "@nerdlms/core/courses/audit.ts";
import type { AuditPageData } from "./data.ts";

import "@/features/studio/studio.css";

/**
 * Rótulo em português para cada ação registrada.
 *
 * O tipo é `Record<AuditAction, string>` de propósito: acrescentar uma ação ao
 * domínio sem traduzi-la aqui passa a quebrar o build, em vez de aparecer como
 * `role_changed` cru na tela para quem for auditar.
 */
const ACTION_LABEL: Record<AuditAction, string> = {
  login: "Entrou",
  login_failed: "Falha ao entrar",
  course_created: "Criou curso",
  course_published: "Publicou curso",
  course_deleted: "Removeu curso",
  user_invited: "Convidou usuário",
  users_imported: "Importou usuários em massa",
  questions_imported: "Importou questões em massa",
  courses_imported: "Importou cursos em massa",
  backup_generated: "Gerou backup",
  backup_restored: "Restaurou backup",
  badge_created: "Configurou badge",
  badge_awarded: "Emitiu badge",
  badge_revoked: "Revogou badge",
  competency_configured: "Configurou competências",
  competency_attested: "Atestou competência",
  competency_revoked: "Revogou competência",
  effectiveness_reviewed: "Avaliou eficácia do treinamento",
  user_deactivated: "Desativou usuário",
  role_changed: "Alterou papel",
  config_changed: "Configuração da plataforma",
  report_exported: "Exportou relatório",
  enrollment_created: "Matriculou aluno",
  comment_deleted: "Removeu comentário",
  access_denied: "Acesso negado",
  password_reset: "Redefiniu a senha",
  sso_login_failed: "Falha no acesso pelo provedor",
  sso_identity_linked: "Vinculou conta ao provedor",
};

/** Data legível em pt-BR, a partir do ISO que o registro guarda. */
function formatMoment(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Registro de auditoria.
 *
 * A tabela é somente leitura por desenho, não por falta de tempo: registro que
 * se edita não prova nada, e o banco recusa UPDATE e DELETE nesta tabela
 * (DEC-048).
 */
export function AuditView({ summary, events, alerts }: Omit<AuditPageData, "admin">) {
  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="page-head__title">Auditoria</h1>
          <p className="page-head__sub">
            Quem fez o quê, quando e se foi permitido. O registro não pode ser alterado nem apagado.
          </p>
        </div>
      </div>

      {alerts.length > 0 ? (
        <div className="audit-alert" role="status">
          <span className="audit-alert__icon" aria-hidden="true">
            <ShieldAlert />
          </span>
          <div className="audit-alert__body">
            <p className="audit-alert__title">Negativas repetidas</p>
            <p className="audit-alert__text">
              {alerts.map((alert) => `${alert.actorName} (${alert.denials})`).join(", ")}
            </p>
          </div>
        </div>
      ) : null}

      <section className="course-section" aria-labelledby="registros">
        <h2 className="course-section__title" id="registros">
          {summary.total} {summary.total === 1 ? "registro" : "registros"}
        </h2>
        <p className="status-text">
          {summary.denied} {summary.denied === 1 ? "negado" : "negados"} · {summary.sensitive}{" "}
          {summary.sensitive === 1 ? "sensível" : "sensíveis"} · {summary.actors}{" "}
          {summary.actors === 1 ? "pessoa" : "pessoas"}
        </p>

        {events.length > 0 ? (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Registro de ações administrativas</caption>
              <thead>
                <tr>
                  <th scope="col">Quando</th>
                  <th scope="col">Quem</th>
                  <th scope="col">Ação</th>
                  <th scope="col">Alvo</th>
                  <th scope="col">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td data-label="Quando" className="audit-time">{formatMoment(event.at)}</td>
                    <td data-label="Quem">{event.actorName}</td>
                    <td data-label="Ação">
                      {ACTION_LABEL[event.action]}
                      {isSensitive(event) ? (
                        <>
                          {" "}
                          <span className="badge badge--pending">sensível</span>
                        </>
                      ) : null}
                    </td>
                    <td data-label="Alvo" className="audit-target">{event.target}</td>
                    <td data-label="Resultado">
                      <span className={`badge${event.outcome === "denied" ? " badge--denied" : " badge--success"}`}>
                        {event.outcome === "denied" ? "Negado" : "Permitido"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <span className="empty__rule" aria-hidden="true" />
            <div className="empty__inner">
              <span className="empty__icon">
                <ScrollText aria-hidden />
              </span>
              <h3 className="empty__title">Nenhum registro ainda</h3>
              <p className="empty__text">
                Ações administrativas aparecem aqui assim que a gravação da auditoria entrar.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
