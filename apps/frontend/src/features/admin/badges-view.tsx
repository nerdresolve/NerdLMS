"use client";

import { useState } from "react";
import {
  Award,
  BadgeCheck,
  CircleCheckBig,
  Clock,
  GraduationCap,
  Medal,
  ShieldCheck,
  Star,
  Target,
  TrendingUp,
} from "lucide-react";

import "./badges.css";

/**
 * Badges configuráveis — F6-01 (guia §19).
 *
 * A tela responde a duas perguntas diferentes, e por isso tem duas partes:
 * "que badges este cliente tem?" (a lista) e "criar mais um" (o formulário).
 *
 * O que o formulário mostra depende do CRITÉRIO escolhido — pedir curso para um
 * badge manual, ou nota para um de contagem, seria pedir dado que não vai a
 * lugar nenhum. O banco recusa a combinação errada; a tela evita chegar lá.
 */

export interface BadgeItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  criterion: string;
  courseId: string | null;
  trackId: string | null;
  courseName: string | null;
  trackName: string | null;
  threshold: number | null;
  validityMonths: number | null;
  active: boolean;
  awardCount: number;
}

export interface CourseOption {
  id: string;
  title: string;
}

/** Os ícones que um badge pode usar. Catálogo, não upload. */
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

const CRITERIOS = [
  { valor: "manual", rotulo: "Emitido à mão", pede: [] as string[] },
  { valor: "course_completed", rotulo: "Concluir um curso", pede: ["curso"] },
  { valor: "track_completed", rotulo: "Concluir uma trilha", pede: ["trilha"] },
  { valor: "courses_count", rotulo: "Concluir N cursos", pede: ["numero"] },
  { valor: "lessons_count", rotulo: "Concluir N aulas", pede: ["numero"] },
  { valor: "grade_above", rotulo: "Tirar nota mínima num curso", pede: ["curso", "numero"] },
];

function criterioTexto(badge: BadgeItem): string {
  switch (badge.criterion) {
    case "course_completed":
      return `Concluir ${badge.courseName ?? "um curso"}`;
    case "track_completed":
      return `Concluir a trilha ${badge.trackName ?? ""}`.trim();
    case "courses_count":
      return `Concluir ${badge.threshold ?? 0} cursos`;
    case "lessons_count":
      return `Concluir ${badge.threshold ?? 0} aulas`;
    case "grade_above":
      return `Nota ${badge.threshold ?? 0}% em ${badge.courseName ?? "um curso"}`;
    default:
      return "Emitido à mão";
  }
}

export function BadgesView({
  badges: iniciais,
  courses,
  tracks,
}: {
  badges: BadgeItem[];
  courses: CourseOption[];
  tracks: CourseOption[];
}) {
  const [badges, setBadges] = useState(iniciais);
  const [criterio, setCriterio] = useState("manual");
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const pede = CRITERIOS.find((c) => c.valor === criterio)?.pede ?? [];

  async function criar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const dados = new FormData(form);

    setBusy(true);
    setAviso(null);

    try {
      const resposta = await fetch("/api/badges", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: dados.get("name"),
          description: dados.get("description"),
          icon: dados.get("icon"),
          criterion: criterio,
          courseId: pede.includes("curso") ? dados.get("courseId") : null,
          trackId: pede.includes("trilha") ? dados.get("trackId") : null,
          threshold: pede.includes("numero") ? dados.get("threshold") : null,
          validityMonths: dados.get("validityMonths") || null,
        }),
      });

      const corpo = (await resposta.json().catch(() => ({}))) as { id?: string; error?: string };

      if (!resposta.ok || !corpo.id) {
        setAviso(corpo.error ?? "Não foi possível criar o badge.");
        return;
      }

      const cursoId = String(dados.get("courseId") ?? "");
      const trilhaId = String(dados.get("trackId") ?? "");

      setBadges((atual) => [
        {
          id: corpo.id!,
          name: String(dados.get("name") ?? ""),
          description: String(dados.get("description") ?? ""),
          icon: String(dados.get("icon") ?? "award"),
          criterion: criterio,
          courseId: cursoId || null,
          trackId: trilhaId || null,
          courseName: courses.find((c) => c.id === cursoId)?.title ?? null,
          trackName: tracks.find((t) => t.id === trilhaId)?.title ?? null,
          threshold: dados.get("threshold") ? Number(dados.get("threshold")) : null,
          validityMonths: dados.get("validityMonths")
            ? Number(dados.get("validityMonths"))
            : null,
          active: true,
          awardCount: 0,
        },
        ...atual,
      ]);

      form.reset();
      setCriterio("manual");
      setAviso("Badge criado.");
    } catch {
      setAviso("Não foi possível falar com o servidor.");
    } finally {
      setBusy(false);
    }
  }

  async function alternar(badge: BadgeItem) {
    /* Desativar não tira de quem já tem — a tela diz isso antes, porque é a
       dúvida óbvia de quem vai clicar. */
    if (
      badge.active &&
      badge.awardCount > 0 &&
      !confirm(
        `Desativar "${badge.name}"?\n\n` +
          `As ${badge.awardCount} pessoas que já o receberam continuam com ele. ` +
          "O badge só deixa de ser concedido daqui para frente.",
      )
    ) {
      return;
    }

    const resposta = await fetch("/api/badges", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: badge.id, active: !badge.active }),
    });

    if (resposta.ok) {
      setBadges((atual) =>
        atual.map((b) => (b.id === badge.id ? { ...b, active: !b.active } : b)),
      );
    } else {
      setAviso("Não foi possível alterar o badge.");
    }
  }

  return (
    <section className="course-section" aria-labelledby="badges">
      <h2 className="course-section__title" id="badges">
        <Award aria-hidden /> Badges
      </h2>

      <p className="platform__hint">
        Reconhecimentos que este cliente concede. Cada emissão ganha um código de verificação
        público — quem recebe pode compartilhar o link, e quem confere não precisa de conta.
      </p>

      <form className="platform__form" onSubmit={criar}>
        <div className="badges__linha">
          <div className="field">
            <label className="label" htmlFor="badge-nome">
              Nome
            </label>
            <input className="input" id="badge-nome" name="name" required maxLength={80} />
          </div>

          <div className="field">
            <label className="label" htmlFor="badge-icone">
              Ícone
            </label>
            <select className="select" id="badge-icone" name="icon" defaultValue="award">
              {Object.keys(ICONES).map((chave) => (
                <option key={chave} value={chave}>
                  {chave}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="badge-descricao">
            O que este badge significa
          </label>
          <input
            className="input"
            id="badge-descricao"
            name="description"
            required
            maxLength={200}
            placeholder="Formação em segurança para trabalho em altura."
          />
          <p className="field__hint">
            Aparece na verificação pública. Escreva para quem não conhece a plataforma.
          </p>
        </div>

        <div className="badges__linha">
          <div className="field">
            <label className="label" htmlFor="badge-criterio">
              Como se conquista
            </label>
            <select
              className="select"
              id="badge-criterio"
              value={criterio}
              onChange={(event) => setCriterio(event.target.value)}
            >
              {CRITERIOS.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.rotulo}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="label" htmlFor="badge-validade">
              Validade (meses)
            </label>
            <input
              className="input"
              id="badge-validade"
              name="validityMonths"
              type="number"
              min={1}
              max={600}
              placeholder="Sem prazo"
            />
            <p className="field__hint">
              Em branco vale para sempre. Use para treinamento que vence, como NR-10.
            </p>
          </div>
        </div>

        {/* Os campos do critério aparecem conforme a escolha: pedir curso para
            um badge manual seria pedir dado que não vai a lugar nenhum. */}
        {pede.includes("curso") ? (
          <div className="field">
            <label className="label" htmlFor="badge-curso">
              Curso
            </label>
            <select className="select" id="badge-curso" name="courseId" required>
              <option value="">Escolha o curso</option>
              {courses.map((curso) => (
                <option key={curso.id} value={curso.id}>
                  {curso.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {pede.includes("trilha") ? (
          <div className="field">
            <label className="label" htmlFor="badge-trilha">
              Trilha
            </label>
            <select className="select" id="badge-trilha" name="trackId" required>
              <option value="">Escolha a trilha</option>
              {tracks.map((trilha) => (
                <option key={trilha.id} value={trilha.id}>
                  {trilha.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {pede.includes("numero") ? (
          <div className="field">
            <label className="label" htmlFor="badge-numero">
              {criterio === "grade_above" ? "Nota mínima (%)" : "Quantidade"}
            </label>
            <input
              className="input"
              id="badge-numero"
              name="threshold"
              type="number"
              min={1}
              max={criterio === "grade_above" ? 100 : 9999}
              required
            />
          </div>
        ) : null}

        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? "Criando…" : "Criar badge"}
        </button>
      </form>

      {badges.length === 0 ? (
        <p className="platform__hint">Nenhum badge configurado.</p>
      ) : (
        <ul className="badges__lista">
          {badges.map((badge) => {
            const Icone = ICONES[badge.icon] ?? Award;

            return (
              <li className="badges__item" key={badge.id} data-inativo={!badge.active || undefined}>
                <span className="badges__icone" aria-hidden>
                  <Icone />
                </span>

                <div className="badges__dados">
                  <strong>{badge.name}</strong>
                  <span className="prefs__desc">{badge.description}</span>
                  <span className="prefs__desc">
                    {criterioTexto(badge)}
                    {badge.validityMonths ? (
                      <>
                        <span aria-hidden> · </span>
                        <Clock aria-hidden className="badges__relogio" /> vence em{" "}
                        {badge.validityMonths} meses
                      </>
                    ) : null}
                    <span aria-hidden> · </span>
                    {badge.awardCount} {badge.awardCount === 1 ? "pessoa" : "pessoas"}
                  </span>
                </div>

                <div className="badges__acoes">
                  {!badge.active ? <span className="platform__badge">Inativo</span> : null}
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => alternar(badge)}
                  >
                    {badge.active ? "Desativar" : "Ativar"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="status-text" role="status">
        {aviso}
      </p>
    </section>
  );
}
