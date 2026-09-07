"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, Plus, Trash2 } from "lucide-react";

/**
 * Montar a rubrica de um trabalho — F3-07.
 *
 * A nota deixa de ser um número solto e passa a ser a soma dos critérios. A
 * diferença para quem recebe é grande: "7 de 10" não diz o que melhorar,
 * "clareza 3/4, profundidade 2/4, referências 2/2" diz.
 */

export interface CriterionDraft {
  name: string;
  description: string;
  maxPoints: string;
}

export function RubricPanel({
  assignmentId,
  assignmentTitle,
  rubricName,
  criteria,
}: {
  assignmentId: string;
  assignmentTitle: string;
  rubricName?: string;
  criteria: { name: string; description?: string; maxPoints: number }[];
}) {
  const router = useRouter();

  const [nome, setNome] = useState(rubricName ?? `Rubrica: ${assignmentTitle}`);
  const [linhas, setLinhas] = useState<CriterionDraft[]>(
    criteria.length > 0
      ? criteria.map((c) => ({
          name: c.name,
          description: c.description ?? "",
          maxPoints: String(c.maxPoints),
        }))
      : [{ name: "", description: "", maxPoints: "" }],
  );

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  /* O total é somado na tela para o instrutor ver se bate com a nota do
     trabalho antes de salvar — descobrir depois de corrigir três entregas
     seria tarde. */
  const total = linhas.reduce((soma, l) => soma + (Number(l.maxPoints) || 0), 0);

  function alterar(indice: number, campo: keyof CriterionDraft, valor: string) {
    setLinhas((atuais) =>
      atuais.map((linha, i) => (i === indice ? { ...linha, [campo]: valor } : linha)),
    );
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();

    const validas = linhas
      .map((l) => ({
        name: l.name.trim(),
        description: l.description.trim() || null,
        maxPoints: Number(l.maxPoints),
      }))
      .filter((l) => l.name !== "" && Number.isFinite(l.maxPoints) && l.maxPoints > 0);

    if (validas.length === 0) {
      setNotice("Informe ao menos um critério com nome e pontuação.");
      return;
    }

    setBusy(true);
    setNotice(null);

    try {
      const resposta = await fetch("/api/rubricas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignmentId, name: nome, criteria: validas }),
      });

      if (!resposta.ok) {
        const erro = (await resposta.json().catch(() => ({}))) as { error?: string };
        setNotice(erro.error ?? "Não foi possível salvar a rubrica.");
        return;
      }

      setNotice("Rubrica salva.");
      router.refresh();
    } catch {
      setNotice("Não foi possível falar com o servidor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="course-section" aria-labelledby={`rubrica-${assignmentId}`}>
      <h2 className="course-section__title" id={`rubrica-${assignmentId}`}>
        <ListChecks aria-hidden /> Rubrica de {assignmentTitle}
      </h2>

      <form className="rubric" onSubmit={salvar}>
        <div className="field">
          <label className="label" htmlFor={`nome-${assignmentId}`}>
            Nome da rubrica
          </label>
          <input
            className="input"
            id={`nome-${assignmentId}`}
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            disabled={busy}
          />
        </div>

        <ul className="rubric__list">
          {linhas.map((linha, indice) => (
            <li className="rubric__row" key={indice}>
              <div className="field rubric__name">
                <label className="label" htmlFor={`c-${assignmentId}-${indice}`}>
                  Critério {indice + 1}
                </label>
                <input
                  className="input"
                  id={`c-${assignmentId}-${indice}`}
                  value={linha.name}
                  placeholder="Clareza"
                  onChange={(event) => alterar(indice, "name", event.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="field rubric__desc">
                <label className="label" htmlFor={`d-${assignmentId}-${indice}`}>
                  O que se espera
                </label>
                <input
                  className="input"
                  id={`d-${assignmentId}-${indice}`}
                  value={linha.description}
                  placeholder="Texto compreensível, sem ambiguidade"
                  onChange={(event) => alterar(indice, "description", event.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="field rubric__points">
                <label className="label" htmlFor={`p-${assignmentId}-${indice}`}>
                  Pontos
                </label>
                <input
                  className="input"
                  id={`p-${assignmentId}-${indice}`}
                  type="number"
                  min={0.5}
                  step="0.5"
                  value={linha.maxPoints}
                  onChange={(event) => alterar(indice, "maxPoints", event.target.value)}
                  disabled={busy}
                />
              </div>

              <button
                type="button"
                className="reorder__button rubric__remove"
                aria-label={`Remover critério ${indice + 1}`}
                disabled={busy || linhas.length === 1}
                onClick={() => setLinhas((atuais) => atuais.filter((_, i) => i !== indice))}
              >
                <Trash2 aria-hidden />
              </button>
            </li>
          ))}
        </ul>

        <div className="rubric__actions">
          <button
            type="button"
            className="btn btn--secondary btn--small"
            disabled={busy}
            onClick={() =>
              setLinhas((atuais) => [...atuais, { name: "", description: "", maxPoints: "" }])
            }
          >
            <Plus aria-hidden /> Critério
          </button>

          <p className="rubric__total">
            Total: <strong>{total}</strong> {total === 1 ? "ponto" : "pontos"}
          </p>

          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? "Salvando" : "Salvar rubrica"}
          </button>
        </div>
      </form>

      <p className="status-text" role="status">
        {notice}
      </p>
    </section>
  );
}
