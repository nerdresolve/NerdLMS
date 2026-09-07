"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Award, CircleCheck, Clock, FileText, GraduationCap, TrendingUp, Users } from "lucide-react";

import { BrandMosaic } from "@/components/brand/brand-mosaic.tsx";
import { formatDuration } from "@nerdlms/core/courses/progress.ts";
import type { Role } from "@nerdlms/core/auth/permissions.ts";
import type { Course, User } from "@nerdlms/core/courses/types.ts";
import type { ProgressSummary } from "@nerdlms/core/courses/progress.ts";

import "./profile.css";
import { plural } from "@nerdlms/core/courses/plural.ts";
import { SignatureUpload } from "./signature-upload.tsx";
import { campoObrigatorio } from "@/lib/campo-obrigatorio.ts";

export interface ProfileCertificate {
  course: Course;
  summary: ProgressSummary;
  durationSeconds: number;
}

export interface ProfileTotals {
  lessons: number;
  completedLessons: number;
  courses: number;
  completedCourses: number;
  watchedSeconds: number;
  percent: number;
}

/* Anotado como `Record<Role, string>` de propósito: faltava `manager`, e o
   perfil de um gestor renderizava `undefined` no lugar do papel. Com o tipo
   fechado, acrescentar um papel sem rótulo passa a quebrar o build. */
const ROLE_LABEL: Record<Role, string> = {
  learner: "Aluno",
  manager: "Gestor",
  instructor: "Instrutor",
  admin: "Administrador",
};

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .slice(0, 2)
    .join("");
}

export function ProfileView({
  user,
  totals,
  certificates,
  assinaturaEnviadaEm,
}: {
  user: User;
  totals: ProfileTotals;
  certificates: ProfileCertificate[];
  assinaturaEnviadaEm: string | null;
}) {
  const router = useRouter();
  const formId = useId();
  const [notice, setNotice] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  /**
   * Só o nome é editável aqui.
   *
   * Papel e projeto definem o que a pessoa enxerga, então mudam pela
   * administração. E-mail é a credencial de acesso: trocá-lo é outro fluxo,
   * com confirmação. Dizer isso na tela evita que a ausência pareça defeito.
   */
  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fullName = (form.elements.namedItem("fullName") as HTMLInputElement | null)?.value ?? "";

    if (!fullName.trim()) {
      setNotice("Informe o nome.");
      return;
    }

    setSalvando(true);
    try {
      const response = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName }),
      });

      if (!response.ok) {
        const corpo = (await response.json().catch(() => ({}))) as { error?: string };
        setNotice(corpo.error ?? "Não foi possível salvar.");
        return;
      }

      setEditando(false);
      setNotice("Nome atualizado.");
      /* O nome aparece na barra do topo e no cabeçalho: sem recarregar, a
         tela passaria a discordar de si mesma até a próxima navegação. */
      router.refresh();
    } catch {
      setNotice("Não foi possível salvar. Verifique sua conexão.");
    } finally {
      setSalvando(false);
    }
  }

  const stats = [
    { Icon: CircleCheck, value: String(totals.completedLessons), label: `de ${plural(totals.lessons, "aula")} concluídas` },
    { Icon: Award, value: String(totals.completedCourses), label: `de ${totals.courses} cursos concluídos` },
    { Icon: Clock, value: formatDuration(totals.watchedSeconds), label: "de conteúdo assistido" },
    { Icon: TrendingUp, value: `${totals.percent}%`, label: "do seu plano concluído" },
  ];

  return (
    <div className="profile">
      <section className="profile-hero">
        <BrandMosaic variant="blob" className="profile-hero__wave" tone="silhueta" />

        <span className="profile-hero__avatar" aria-hidden="true">
          {initialsOf(user.fullName)}
        </span>

        <div className="profile-hero__text">
          <h1 className="profile-hero__name">{user.fullName}</h1>
          <div className="profile-hero__meta">
            <span className="badge badge--on-brand">
              <GraduationCap aria-hidden /> {ROLE_LABEL[user.role]}
            </span>
            {/* O projeto vem da pessoa, não fixo: com "Aguilhada" no JSX
                todo perfil dizia o mesmo, contradizendo a tela de usuários na
                mesma sessão. A data de entrada saiu porque o modelo não a
                guarda — imprimir uma fixa era inventar dado. */}
            {user.project ? (
              <span className="badge badge--on-brand">
                <Users aria-hidden /> {user.project}
              </span>
            ) : null}
          </div>
        </div>

        <div className="profile-hero__actions">
          <button
            type="button"
            className="btn btn--primary btn--on-brand"
            onClick={() => {
              setNotice(null);
              setEditando((atual) => !atual);
            }}
            aria-expanded={editando}
            aria-controls={formId}
          >
            {editando ? "Cancelar" : "Editar perfil"}
          </button>
        </div>
      </section>

      {editando ? (
        <form className="profile-edit" id={formId} onSubmit={handleSave}>
          <div className="field">
            <label className="label" htmlFor={`${formId}-nome`}>
              Nome completo
            </label>
            <input
              className="input"
              id={`${formId}-nome`}
              name="fullName"
              type="text"
              defaultValue={user.fullName}
              maxLength={200}
              {...campoObrigatorio("Escreva o seu nome completo.")}
              autoComplete="name"
            />
          </div>

          <p className="profile-edit__note">
            Para alterar e-mail, papel ou projeto, fale com a administração: são
            os dados que definem seu acesso.
          </p>

          <div className="profile-edit__actions">
            <button type="submit" className="btn btn--primary" disabled={salvando}>
              {salvando ? "Salvando" : "Salvar"}
            </button>
          </div>
        </form>
      ) : null}

      <p className="status-text" role="status">
        {notice}
      </p>

      <section className="course-section" aria-labelledby="jornada">
        <h2 className="course-section__title" id="jornada">
          Sua jornada
        </h2>
        <div className="profile-stats">
          {stats.map(({ Icon, value, label }) => (
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

      {/* Só para quem pode ser autor de curso. Para um aluno seria um campo
          sem consequência nenhuma — e campo sem consequência é o que faz uma
          tela de perfil virar formulário de cadastro. */}
      {user.role === "instructor" || user.role === "manager" || user.role === "admin" ? (
        <SignatureUpload enviadaEm={assinaturaEnviadaEm} />
      ) : null}

      <section className="course-section" aria-labelledby="certificados">
        <h2 className="course-section__title" id="certificados">
          Certificados
        </h2>

        {certificates.length > 0 ? (
          <div className="certificates">
            {certificates.map(({ course, summary, durationSeconds }) => (
              <article className="certificate" key={course.id}>
                <span className="certificate__seal">
                  <Award aria-hidden />
                </span>
                <span className="certificate__body">
                  <h3 className="certificate__title">{course.title}</h3>
                  <span className="certificate__meta">
                    {plural(summary.total, "aula")} · {formatDuration(durationSeconds)}
                  </span>
                </span>
                {/* Link e não botão: é um documento que se baixa, e um link
                    funciona sem JavaScript e permite "abrir em nova aba". */}
                <a className="btn btn--secondary" href={`/api/certificado?curso=${course.id}`}>
                  <FileText aria-hidden /> Baixar PDF
                </a>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">
            <span className="empty__rule" aria-hidden="true" />
            <div className="empty__inner">
              <span className="empty__icon">
                <Award aria-hidden />
              </span>
              <h3 className="empty__title">Nenhum certificado ainda</h3>
              <p className="empty__text">
                Conclua a última aula de um curso e o certificado aparece aqui para download.
              </p>
            </div>
          </div>
        )}

      </section>
    </div>
  );
}
