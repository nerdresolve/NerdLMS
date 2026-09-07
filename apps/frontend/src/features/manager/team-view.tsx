"use client";

import { useState } from "react";
import { Users } from "lucide-react";

import type { Course } from "@nerdlms/core/courses/types.ts";
import type { TeamPageData } from "./data.ts";
import { AssignPanel } from "./assign-panel.tsx";

import "@/features/studio/studio.css";
import "./manager.css";

/**
 * Minha equipe.
 *
 * Uma linha por pessoa, com o que o gestor precisa para agir: quantos cursos
 * tem, quantos terminou e como está em média. Quem não tem matrícula aparece
 * com zero — sumir da lista esconderia justamente quem precisa de atenção.
 *
 * A seleção existe para matricular em lote (F1-03): atribuir treinamento é
 * ação de turma, e uma matrícula por vez tornaria a tela inútil para uma
 * equipe de trinta pessoas.
 */
export function TeamView({
  project,
  team,
  courses,
  classesByCourse,
}: Omit<TeamPageData, "manager"> & {
  courses: Course[];
  classesByCourse: Record<string, { id: string; name: string }[]>;
}) {
  const [selecionadas, setSelecionadas] = useState<string[]>([]);

  const todas = team.map((item) => item.user.id);
  const todasMarcadas = selecionadas.length > 0 && selecionadas.length === todas.length;

  function alternar(id: string) {
    setSelecionadas((atual) =>
      atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id],
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="page-head__title">Minha equipe</h1>
          <p className="page-head__sub">Pessoas de {project} e o andamento de cada uma.</p>
        </div>
      </div>

      {team.length > 0 && courses.length > 0 ? (
        <section className="course-section" aria-labelledby="atribuir">
          <h2 className="course-section__title" id="atribuir">
            <Users aria-hidden /> Matricular a equipe
          </h2>
          <AssignPanel
            courses={courses}
            classesByCourse={classesByCourse}
            selecionadas={selecionadas}
            onDone={() => setSelecionadas([])}
          />
        </section>
      ) : null}

      <section className="course-section" aria-labelledby="equipe">
        <h2 className="course-section__title" id="equipe">
          {team.length} {team.length === 1 ? "pessoa" : "pessoas"}
        </h2>

        {team.length > 0 ? (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Progresso de cada pessoa da equipe</caption>
              <thead>
                <tr>
                  <th scope="col" className="table__check">
                    {/* O rótulo é visualmente oculto porque a coluna já se
                        explica pela posição; leitor de tela precisa dele. */}
                    <label className="sr-only" htmlFor="marcar-todas">
                      Selecionar todas as pessoas
                    </label>
                    <input
                      id="marcar-todas"
                      type="checkbox"
                      checked={todasMarcadas}
                      onChange={() => setSelecionadas(todasMarcadas ? [] : todas)}
                    />
                  </th>
                  <th scope="col">Pessoa</th>
                  <th scope="col" data-num>Matrículas</th>
                  <th scope="col" data-num>Concluídos</th>
                  <th scope="col" data-num>Progresso médio</th>
                </tr>
              </thead>
              <tbody>
                {team.map(({ user, enrollments, completed, averagePercent }) => (
                  <tr key={user.id} data-selecionada={selecionadas.includes(user.id) || undefined}>
                    {/* `data-label` vazio de propósito: a coluna do seletor não tem
                        nome visível, e o rótulo do modo estreito ficaria sem texto.
                        Vazio é a declaração de que não há rótulo; ausente seria
                        esquecimento, e é isso que `check:tabelas` cobra. */}
                    <td className="table__check" data-label="">
                      <label className="sr-only" htmlFor={`marcar-${user.id}`}>
                        Selecionar {user.fullName}
                      </label>
                      <input
                        id={`marcar-${user.id}`}
                        type="checkbox"
                        checked={selecionadas.includes(user.id)}
                        onChange={() => alternar(user.id)}
                      />
                    </td>
                    <td data-label="Pessoa">{user.fullName}</td>
                    <td data-label="Matrículas" data-num>{enrollments}</td>
                    <td data-label="Concluídos" data-num>{completed}</td>
                    <td data-label="Progresso médio" data-num>{averagePercent}%</td>
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
                <Users aria-hidden />
              </span>
              <h3 className="empty__title">Nenhuma pessoa em {project}</h3>
              <p className="empty__text">
                Quando alguém for cadastrado neste projeto, aparece aqui com o progresso.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
