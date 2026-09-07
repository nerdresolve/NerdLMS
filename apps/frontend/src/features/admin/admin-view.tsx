import Link from "next/link";
import { Award, BookMarked, ShieldAlert, TrendingUp, Users } from "lucide-react";

import type { AdminPageData } from "./data.ts";

import "@/features/profile/profile.css";
import "@/features/studio/studio.css";

import { ReportFilters } from "./report-filters.tsx";

/**
 * Painel do administrador.
 *
 * Os quatro números respondem "a plataforma está sendo usada"; a quebra por
 * projeto responde "por quem"; e o alerta de negativas repetidas é o único
 * item que pede ação — por isso vem destacado, e não como mais uma linha de
 * tabela.
 */
/* O rótulo da unidade vem por PROP e já flexionado: este é Server Component,
   e o contexto do tenant vive no cliente. Quem renderiza tem a sessão. */
export function AdminView({
  stats,
  byProject,
  audit,
  alerts,
  unitLower,
  unitPlural,
}: Omit<AdminPageData, "admin"> & { unitLower: string; unitPlural: string }) {
  const cards = [
    { Icon: Users, value: String(stats.users), label: "usuários cadastrados" },
    { Icon: TrendingUp, value: String(stats.active30d), label: "ativos em 30 dias" },
    { Icon: BookMarked, value: String(stats.courses), label: "cursos publicados" },
    { Icon: Award, value: String(stats.completions), label: "cursos concluídos" },
  ];

  return (
    <div className="studio">
      <div className="studio__head">
        <div className="studio__head-text">
          <h1 className="page-head__greeting">Painel da plataforma</h1>
          <p className="page-head__sub">Visão consolidada de todas as {unitPlural}.</p>
        </div>

      </div>

      {/* Os recortes substituem os dois links diretos: eles continuam válidos
          como URL, mas exportavam sempre a plataforma inteira. */}
      <ReportFilters projects={byProject.map((item) => item.project)} />

      {alerts.length > 0 ? (
        <div className="audit-alert" role="status">
          <span className="audit-alert__icon" aria-hidden="true">
            <ShieldAlert />
          </span>
          <div className="audit-alert__body">
            <p className="audit-alert__title">
              {alerts.length} {alerts.length === 1 ? "pessoa acumulou" : "pessoas acumularam"} negativas
              repetidas
            </p>
            <p className="audit-alert__text">
              {alerts.map((alert) => `${alert.actorName} (${alert.denials})`).join(", ")}. Uma negativa
              isolada é engano; várias seguidas merecem olhar. <Link href="/admin/auditoria">Ver auditoria</Link>
            </p>
          </div>
        </div>
      ) : null}

      <section className="course-section" aria-labelledby="numeros">
        <h2 className="course-section__title" id="numeros">
          Visão geral
        </h2>
        <div className="profile-stats">
          {cards.map(({ Icon, value, label }) => (
            <article className="stat-card" key={label}>
              <span className="stat-card__icon">
                <Icon aria-hidden />
              </span>
              <span className="stat-card__value">{value}</span>
              <span className="stat-card__label">{label}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="course-section" aria-labelledby="projetos">
        <h2 className="course-section__title" id="projetos">
          Atividade por {unitLower}
        </h2>
        <p className="status-text">Pessoas com acesso registrado nos últimos 30 dias.</p>

        <div className="breakdown">
          {byProject.map(({ project, active, total }) => (
            <div className="breakdown__row" key={project}>
              <span className="breakdown__label">{project}</span>
              <span className="breakdown__value">
                {active} de {total} {total === 1 ? "pessoa" : "pessoas"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="course-section" aria-labelledby="auditoria">
        <h2 className="course-section__title" id="auditoria">
          Auditoria
        </h2>
        <div className="breakdown">
          <div className="breakdown__row">
            <span className="breakdown__label">Registros</span>
            <span className="breakdown__value">{audit.total}</span>
          </div>
          <div className="breakdown__row">
            <span className="breakdown__label">Ações negadas</span>
            <span className="breakdown__value">{audit.denied}</span>
          </div>
          <div className="breakdown__row">
            <span className="breakdown__label">Ações sensíveis</span>
            <span className="breakdown__value">{audit.sensitive}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
