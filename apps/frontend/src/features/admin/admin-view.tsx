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
  unitLabel,
}: Omit<AdminPageData, "admin"> & { unitLower: string; unitLabel: string }) {
  const cards = [
    { Icon: Users, value: String(stats.users), label: "usuários cadastrados" },
    { Icon: TrendingUp, value: String(stats.active30d), label: "ativos em 30 dias" },
    { Icon: BookMarked, value: String(stats.courses), label: "cursos publicados" },
    { Icon: Award, value: String(stats.completions), label: "cursos concluídos" },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="page-head__title">Painel da plataforma</h1>
          <p className="page-head__sub">Números de toda a organização.</p>
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
              {alerts.map((alert) => `${alert.actorName} (${alert.denials})`).join(", ")}.{" "}
              <Link href="/admin/auditoria">Ver auditoria</Link>
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

        {/* Tabela, e não lista de rótulo e valor: são três colunas com o mesmo
            significado em cada linha, que é o que uma tabela é. Escritas como
            "3 de 4 pessoas" num texto solto, elas não se alinhavam entre as
            linhas e não davam para comparar de relance — que é a única coisa
            que alguém faz nesta seção. */}
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">
              Pessoas com acesso nos últimos 30 dias, por {unitLower}
            </caption>
            <thead>
              <tr>
                <th scope="col">{unitLabel}</th>
                <th scope="col" data-num>Ativos</th>
                <th scope="col" data-num>Pessoas</th>
              </tr>
            </thead>
            <tbody>
              {byProject.map(({ project, active, total }) => (
                <tr key={project}>
                  <td data-label={unitLabel}>{project}</td>
                  <td data-label="Ativos" data-num>{active}</td>
                  <td data-label="Pessoas" data-num>{total}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
