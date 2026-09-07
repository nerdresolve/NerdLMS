"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Plus } from "lucide-react";

import { classPeriod, seatsLeft, type CourseClass } from "@nerdlms/core/courses/classes.ts";

/**
 * Turmas do curso — F2-02.
 *
 * Uma turma é um recorte da matrícula: mesmo conteúdo, com instrutor, datas e
 * relatório próprios. Aqui o instrutor cria as turmas e as abre ou fecha para
 * novas matrículas.
 *
 * Distribuir pessoas nas turmas é gesto do gestor, na tela de equipe: ele
 * matricula trinta de uma vez e depois decide quem vai em março e quem vai em
 * abril.
 */

export interface InstructorOption {
  id: string;
  name: string;
}

export function ClassesPanel({
  courseId,
  classes,
  instructors,
}: {
  courseId: string;
  classes: CourseClass[];
  instructors: InstructorOption[];
}) {
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState(false);

  async function enviar(method: "POST" | "PATCH", payload: Record<string, unknown>) {
    setBusy(true);
    setNotice(null);

    try {
      const resposta = await fetch("/api/turmas", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId, ...payload }),
      });

      if (!resposta.ok) {
        const erro = (await resposta.json().catch(() => ({}))) as { error?: string };
        setNotice(erro.error ?? "Não foi possível salvar.");
        return false;
      }

      router.refresh();
      return true;
    } catch {
      setNotice("Não foi possível falar com o servidor.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function criar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const vagas = form.get("capacity");

    const ok = await enviar("POST", {
      name: form.get("name"),
      instructorId: form.get("instructorId") || null,
      startsOn: form.get("startsOn") || null,
      endsOn: form.get("endsOn") || null,
      /* Campo vazio é "sem limite", não zero: zero seria lido como turma
         lotada e recusaria toda matrícula. */
      capacity: vagas && String(vagas) !== "" ? Number(vagas) : null,
    });

    if (ok) {
      setNotice("Turma criada.");
      setAbrindo(false);
      event.currentTarget.reset();
    }
  }

  return (
    <section className="course-section" aria-labelledby="turmas">
      <h2 className="course-section__title" id="turmas">
        <CalendarRange aria-hidden /> Turmas
      </h2>

      {classes.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Turmas deste curso</caption>
            <thead>
              <tr>
                <th scope="col">Turma</th>
                <th scope="col">Período</th>
                <th scope="col">Instrutor</th>
                <th scope="col">Matriculados</th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((turma) => {
                const vagas = seatsLeft(turma);

                return (
                  <tr key={turma.id}>
                    <td>{turma.name}</td>
                    <td>{classPeriod(turma) ?? "Contínua"}</td>
                    <td>{turma.instructorName ?? "—"}</td>
                    <td>
                      {turma.enrolled}
                      {vagas !== null ? (
                        <span className="classes__seats">
                          {" "}
                          de {turma.capacity} ({vagas} {vagas === 1 ? "vaga" : "vagas"})
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={busy}
                        onClick={() =>
                          void enviar("PATCH", {
                            classId: turma.id,
                            status: turma.status === "open" ? "closed" : "open",
                          })
                        }
                      >
                        {turma.status === "open" ? "Aberta" : "Fechada"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="platform__hint">
          Nenhuma turma. Sem turmas, o curso funciona como oferta contínua — cada pessoa entra
          quando quiser.
        </p>
      )}

      {abrindo ? (
        <form className="meta-form classes__form" onSubmit={criar}>
          <div className="field">
            <label className="label" htmlFor="turma-nome">
              Nome da turma
            </label>
            <input className="input" id="turma-nome" name="name" required placeholder="Turma de março" />
          </div>

          <div className="field">
            <label className="label" htmlFor="turma-instrutor">
              Instrutor
            </label>
            <select className="input" id="turma-instrutor" name="instructorId" defaultValue="">
              <option value="">A definir</option>
              {instructors.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="label" htmlFor="turma-inicio">
              Início
            </label>
            <input className="input" id="turma-inicio" name="startsOn" type="date" />
          </div>

          <div className="field">
            <label className="label" htmlFor="turma-fim">
              Encerramento
            </label>
            <input className="input" id="turma-fim" name="endsOn" type="date" />
          </div>

          <div className="field">
            <label className="label" htmlFor="turma-vagas">
              Vagas
            </label>
            <input className="input" id="turma-vagas" name="capacity" type="number" min={1} />
            <p className="field__hint">Em branco, a turma não tem limite.</p>
          </div>

          <div className="meta-form__actions">
            <button type="button" className="btn btn--secondary" onClick={() => setAbrindo(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? "Criando" : "Criar turma"}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn--secondary" onClick={() => setAbrindo(true)}>
          <Plus aria-hidden /> Nova turma
        </button>
      )}

      <p className="status-text" role="status">
        {notice}
      </p>
    </section>
  );
}
