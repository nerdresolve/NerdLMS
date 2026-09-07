"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";

import type { Course } from "@nerdlms/core/courses/types.ts";

/**
 * Atribuir um curso à equipe — F1-03.
 *
 * O gestor escolhe as pessoas na tabela e o curso aqui. A ação é de turma: o
 * caso comum é "todo mundo de campo faz a NR-10", não uma matrícula por vez.
 *
 * Quem já está no curso é ignorado em silêncio pelo servidor. Falhar por isso
 * obrigaria o gestor a descobrir quem já estava para refazer a seleção — e ele
 * não tem essa informação na tela.
 */

export function AssignPanel({
  courses,
  classesByCourse,
  selecionadas,
  onDone,
}: {
  courses: Course[];
  /** Turmas abertas de cada curso, indexadas por id do curso (F2-02). */
  classesByCourse: Record<string, { id: string; name: string }[]>;
  selecionadas: string[];
  onDone: () => void;
}) {
  const router = useRouter();

  const [courseId, setCourseId] = useState("");
  const [classId, setClassId] = useState("");

  /* As turmas mudam com o curso; trocar de curso precisa limpar a escolha
     anterior, senão o envio levaria uma turma de outro curso — que o servidor
     recusa, mas com uma mensagem que não explica o que houve. */
  const turmas = classesByCourse[courseId] ?? [];
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const podeAtribuir = courseId !== "" && selecionadas.length > 0 && !busy;

  /* O resultado da última atribuição some assim que o gestor volta a montar
     turma: "2 pessoas matriculadas" parado na tela passaria a descrever algo
     que não é mais o que está selecionado.

     Derivado em vez de um efeito que chama `setNotice`: o aviso vale enquanto
     a seleção estiver vazia, que é exatamente o estado em que a ação o
     deixou. Sincronizar dois estados por efeito daria um quadro a mais com a
     tela inconsistente. */
  const avisoVisivel = selecionadas.length === 0 ? notice : null;

  async function atribuir() {
    setBusy(true);
    setNotice(null);

    try {
      const resposta = await fetch("/api/matricula/atribuir", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId, learnerIds: selecionadas }),
      });

      const dados = (await resposta.json().catch(() => ({}))) as {
        enrolled?: number;
        skipped?: number;
        error?: string;
      };

      if (!resposta.ok) {
        setNotice(dados.error ?? "Não foi possível matricular.");
        return;
      }

      const matriculadas = dados.enrolled ?? 0;
      const ignoradas = dados.skipped ?? 0;

      /* Distribuir na turma é um segundo passo, depois de a matrícula existir:
         a turma organiza quem já entrou. */
      if (classId && matriculadas + ignoradas > 0) {
        await fetch("/api/turmas", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ courseId, classId, learnerIds: selecionadas }),
        }).catch(() => {
          /* A matrícula já valeu; falhar aqui não a desfaz. */
        });
      }

      /* A mensagem informa os dois números porque "3 de 5" sem explicação
         pareceria falha parcial. */
      setNotice(
        ignoradas > 0
          ? `${matriculadas} ${matriculadas === 1 ? "pessoa matriculada" : "pessoas matriculadas"}. ` +
            `${ignoradas} já ${ignoradas === 1 ? "estava" : "estavam"} no curso.`
          : `${matriculadas} ${matriculadas === 1 ? "pessoa matriculada" : "pessoas matriculadas"}.`,
      );

      onDone();
      /* Recarrega para os números da tabela — matrículas, progresso — refletirem
         o que acabou de mudar. */
      router.refresh();
    } catch {
      setNotice("Não foi possível falar com o servidor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="assign">
      <div className="assign__row">
        <div className="field assign__field">
          <label className="label" htmlFor="assign-curso">
            Curso a atribuir
          </label>
          <select
            className="input"
            id="assign-curso"
            value={courseId}
            onChange={(event) => {
              setCourseId(event.target.value);
              setClassId("");
            }}
            disabled={busy}
          >
            <option value="">Selecione um curso</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>

        {turmas.length > 0 ? (
          <div className="field assign__field">
            <label className="label" htmlFor="assign-turma">
              Turma
            </label>
            <select
              className="input"
              id="assign-turma"
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              disabled={busy}
            >
              <option value="">Sem turma</option>
              {turmas.map((turma) => (
                <option key={turma.id} value={turma.id}>
                  {turma.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <button type="button" className="btn btn--primary" disabled={!podeAtribuir} onClick={atribuir}>
          <GraduationCap aria-hidden />
          {busy
            ? "Matriculando"
            : selecionadas.length > 0
              ? `Matricular ${selecionadas.length}`
              : "Matricular"}
        </button>
      </div>

      {/* A dica cala quando há resultado: "selecione as pessoas" logo acima de
          "2 pessoas matriculadas" se contradiz — a seleção foi limpa PORQUE a
          ação deu certo. */}
      {avisoVisivel === null ? (
        <p className="assign__hint">
          {selecionadas.length === 0
            ? "Selecione as pessoas na tabela abaixo."
            : `${selecionadas.length} ${selecionadas.length === 1 ? "pessoa selecionada" : "pessoas selecionadas"}.`}
        </p>
      ) : null}

      <p className="status-text" role="status">
        {avisoVisivel}
      </p>
    </div>
  );
}
