"use client";

import { useState } from "react";
import { BookOpenCheck, Layers, Link2, Target, X } from "lucide-react";

import { levelLabel } from "@nerdlms/core/competencies/proficiency.ts";

import "./competencies.css";

/**
 * Competências e planos — F6-02 (guia §20).
 *
 * A tela responde três perguntas em ordem, e é por isso que tem três partes:
 *
 *   1. Que competências existem? (framework e competências)
 *   2. Que curso desenvolve cada uma? (vínculo)
 *   3. Quem precisa de quais? (plano)
 *
 * A ordem importa: sem framework não há competência, sem competência não há
 * vínculo nem plano. A tela mostra o próximo passo em vez de oferecer tudo de
 * uma vez e deixar a pessoa descobrir a dependência por erro.
 */

export interface FrameworkItem {
  id: string;
  name: string;
  description: string | null;
  levels: string[];
  active: boolean;
  competencyCount: number;
}

export interface CompetencyItem {
  id: string;
  frameworkId: string;
  frameworkName: string;
  levels: string[];
  parentId: string | null;
  code: string | null;
  name: string;
  description: string | null;
  learningOutcome: string | null;
  active: boolean;
  courses: Array<{ id: string; title: string; grantsLevel: number }>;
}

export interface PlanItem {
  id: string;
  name: string;
  description: string | null;
  dueDate: string | null;
  active: boolean;
  items: Array<{
    competencyId: string;
    competencyName: string;
    requiredLevel: number;
    /** A escala do framework desta competência — o gap precisa dela. */
    levels: string[];
  }>;
  assignedCount: number;
}

export interface CourseOption {
  id: string;
  title: string;
}

export function CompetenciesView({
  frameworks: fwIniciais,
  competencies: compIniciais,
  plans: planosIniciais,
  courses,
}: {
  frameworks: FrameworkItem[];
  competencies: CompetencyItem[];
  plans: PlanItem[];
  courses: CourseOption[];
}) {
  const [frameworks, setFrameworks] = useState(fwIniciais);
  const [competencies, setCompetencies] = useState(compIniciais);
  const [plans, setPlans] = useState(planosIniciais);
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  /* As competências escolhidas para o plano em construção. */
  const [itensDoPlano, setItensDoPlano] = useState<Map<string, number>>(new Map());

  async function enviar(corpo: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    setBusy(true);
    setAviso(null);

    try {
      const resposta = await fetch("/api/competencias", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      });

      const dados = (await resposta.json().catch(() => ({}))) as Record<string, unknown>;

      if (!resposta.ok) {
        setAviso(String(dados.error ?? "Não foi possível concluir."));
        return null;
      }

      return dados;
    } catch {
      setAviso("Não foi possível falar com o servidor.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function criarFramework(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const dados = new FormData(form);

    const niveis = String(dados.get("levels") ?? "")
      .split(",")
      .map((n) => n.trim())
      .filter((n) => n !== "");

    const resultado = await enviar({
      acao: "framework",
      name: dados.get("name"),
      description: dados.get("description"),
      levels: niveis,
    });

    if (!resultado?.id) return;

    setFrameworks((atual) => [
      ...atual,
      {
        id: String(resultado.id),
        name: String(dados.get("name") ?? ""),
        description: String(dados.get("description") ?? "") || null,
        levels: niveis,
        active: true,
        competencyCount: 0,
      },
    ]);

    form.reset();
    setAviso("Framework criado.");
  }

  async function criarCompetencia(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const dados = new FormData(form);
    const frameworkId = String(dados.get("frameworkId") ?? "");

    const resultado = await enviar({
      acao: "competencia",
      frameworkId,
      name: dados.get("name"),
      description: dados.get("description"),
      learningOutcome: dados.get("learningOutcome"),
      code: dados.get("code"),
    });

    if (!resultado?.id) return;

    const framework = frameworks.find((f) => f.id === frameworkId);

    setCompetencies((atual) => [
      ...atual,
      {
        id: String(resultado.id),
        frameworkId,
        frameworkName: framework?.name ?? "",
        levels: framework?.levels ?? [],
        parentId: null,
        code: String(dados.get("code") ?? "") || null,
        name: String(dados.get("name") ?? ""),
        description: String(dados.get("description") ?? "") || null,
        learningOutcome: String(dados.get("learningOutcome") ?? "") || null,
        active: true,
        courses: [],
      },
    ]);

    form.reset();
    setAviso("Competência criada.");
  }

  async function vincular(competency: CompetencyItem, courseId: string, nivel: number) {
    const resultado = await enviar({
      acao: "vincular",
      competencyId: competency.id,
      courseId,
      grantsLevel: nivel,
    });

    if (!resultado) return;

    const curso = courses.find((c) => c.id === courseId);

    setCompetencies((atual) =>
      atual.map((c) =>
        c.id === competency.id
          ? {
              ...c,
              courses: [
                ...c.courses,
                { id: courseId, title: curso?.title ?? "", grantsLevel: nivel },
              ],
            }
          : c,
      ),
    );

    setAviso(`Concluir "${curso?.title}" passa a desenvolver "${competency.name}".`);
  }

  async function desvincular(competencyId: string, courseId: string) {
    const resultado = await enviar({ acao: "desvincular", competencyId, courseId });
    if (!resultado) return;

    setCompetencies((atual) =>
      atual.map((c) =>
        c.id === competencyId
          ? { ...c, courses: c.courses.filter((curso) => curso.id !== courseId) }
          : c,
      ),
    );
  }

  async function criarPlano(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const dados = new FormData(form);

    if (itensDoPlano.size === 0) {
      setAviso("Escolha pelo menos uma competência para o plano.");
      return;
    }

    const itens = [...itensDoPlano].map(([competencyId, requiredLevel]) => ({
      competencyId,
      requiredLevel,
    }));

    const resultado = await enviar({
      acao: "plano",
      name: dados.get("name"),
      description: dados.get("description"),
      dueDate: dados.get("dueDate") || null,
      items: itens,
    });

    if (!resultado?.id) return;

    setPlans((atual) => [
      ...atual,
      {
        id: String(resultado.id),
        name: String(dados.get("name") ?? ""),
        description: String(dados.get("description") ?? "") || null,
        dueDate: String(dados.get("dueDate") ?? "") || null,
        active: true,
        items: itens.map((i) => {
          const competencia = competencies.find((c) => c.id === i.competencyId);
          return {
            competencyId: i.competencyId,
            competencyName: competencia?.name ?? "",
            requiredLevel: i.requiredLevel,
            levels: competencia?.levels ?? [],
          };
        }),
        assignedCount: 0,
      },
    ]);

    form.reset();
    setItensDoPlano(new Map());
    setAviso("Plano criado. Atribua-o a quem precisa cumpri-lo.");
  }

  return (
    <>
      <section className="course-section" aria-labelledby="frameworks">
        <h2 className="course-section__title" id="frameworks">
          <Layers aria-hidden /> Frameworks de competência
        </h2>

        <p className="platform__hint">
          Um framework agrupa competências que se comparam entre si. &ldquo;Técnicas de
          operação&rdquo; e &ldquo;Liderança&rdquo; são frameworks diferentes — misturá-los num
          relatório produziria um número sem significado.
        </p>

        <form className="platform__form" onSubmit={criarFramework}>
          <div className="comp__linha">
            <div className="field">
              <label className="label" htmlFor="fw-nome">
                Nome
              </label>
              <input className="input" id="fw-nome" name="name" required maxLength={80} />
            </div>

            <div className="field">
              <label className="label" htmlFor="fw-niveis">
                Níveis de domínio
              </label>
              <input
                className="input"
                id="fw-niveis"
                name="levels"
                required
                defaultValue="Básico, Intermediário, Avançado"
              />
              <p className="field__hint">
                Do menor para o maior, separados por vírgula. Pelo menos dois.
              </p>
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="fw-desc">
              Descrição
            </label>
            <input className="input" id="fw-desc" name="description" maxLength={200} />
          </div>

          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? "Criando…" : "Criar framework"}
          </button>
        </form>

        {frameworks.length > 0 ? (
          <ul className="comp__frameworks">
            {frameworks.map((framework) => (
              <li key={framework.id}>
                <strong>{framework.name}</strong>
                <span className="prefs__desc">
                  {framework.levels.join(" → ")}
                  <span aria-hidden> · </span>
                  {framework.competencyCount}{" "}
                  {framework.competencyCount === 1 ? "competência" : "competências"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* Sem framework não há competência: oferecer o formulário seria oferecer
          um caminho que termina em erro. */}
      {frameworks.length > 0 ? (
        <section className="course-section" aria-labelledby="competencias">
          <h2 className="course-section__title" id="competencias">
            <Target aria-hidden /> Competências
          </h2>

          <form className="platform__form" onSubmit={criarCompetencia}>
            <div className="comp__linha">
              <div className="field">
                <label className="label" htmlFor="comp-fw">
                  Framework
                </label>
                <select className="select" id="comp-fw" name="frameworkId" required>
                  {frameworks.map((framework) => (
                    <option key={framework.id} value={framework.id}>
                      {framework.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="label" htmlFor="comp-codigo">
                  Código (opcional)
                </label>
                <input className="input" id="comp-codigo" name="code" maxLength={30} />
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="comp-nome">
                Competência
              </label>
              <input
                className="input"
                id="comp-nome"
                name="name"
                required
                maxLength={120}
                placeholder="Operar estação de tratamento de água"
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="comp-outcome">
                O que a pessoa consegue fazer
              </label>
              <input
                className="input"
                id="comp-outcome"
                name="learningOutcome"
                maxLength={200}
                placeholder="Conduzir a operação de uma ETA em regime normal e em contingência."
              />
              <p className="field__hint">
                É o que distingue competência de assunto: &ldquo;saneamento&rdquo; é assunto;
                &ldquo;dimensionar uma rede&rdquo; é competência, porque dá para observar se
                aconteceu.
              </p>
            </div>

            <div className="field">
              <label className="label" htmlFor="comp-desc">
                Descrição
              </label>
              <input className="input" id="comp-desc" name="description" maxLength={200} />
            </div>

            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? "Criando…" : "Criar competência"}
            </button>
          </form>

          {competencies.length > 0 ? (
            <ul className="comp__lista">
              {competencies.map((competency) => (
                <li className="comp__item" key={competency.id}>
                  <div className="comp__cabeca">
                    <strong>{competency.name}</strong>
                    <span className="comp__framework">{competency.frameworkName}</span>
                  </div>

                  {competency.learningOutcome ? (
                    <p className="comp__outcome">{competency.learningOutcome}</p>
                  ) : null}

                  <div className="comp__cursos">
                    <span className="comp__cursos-titulo">
                      <Link2 aria-hidden /> Desenvolvida por
                    </span>

                    {competency.courses.length === 0 ? (
                      <span className="prefs__desc">
                        Nenhum curso ainda — só atestada à mão.
                      </span>
                    ) : (
                      <ul className="comp__vinculos">
                        {competency.courses.map((curso) => (
                          <li key={curso.id}>
                            {curso.title}
                            <span className="comp__nivel">
                              {levelLabel(competency.levels, curso.grantsLevel)}
                            </span>
                            <button
                              type="button"
                              className="comp__remover"
                              onClick={() => desvincular(competency.id, curso.id)}
                              aria-label={`Desvincular ${curso.title}`}
                            >
                              <X aria-hidden />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <VincularCurso
                      competency={competency}
                      courses={courses.filter(
                        (curso) => !competency.courses.some((c) => c.id === curso.id),
                      )}
                      onVincular={vincular}
                      busy={busy}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {competencies.length > 0 ? (
        <section className="course-section" aria-labelledby="planos">
          <h2 className="course-section__title" id="planos">
            <BookOpenCheck aria-hidden /> Planos de desenvolvimento
          </h2>

          <p className="platform__hint">
            Um plano diz que competências alguém precisa ter. A diferença entre isso e o que a
            pessoa tem é o relatório de lacunas.
          </p>

          <form className="platform__form" onSubmit={criarPlano}>
            <div className="comp__linha">
              <div className="field">
                <label className="label" htmlFor="plano-nome">
                  Nome do plano
                </label>
                <input
                  className="input"
                  id="plano-nome"
                  name="name"
                  required
                  maxLength={80}
                  placeholder="Operador de ETA — nível pleno"
                />
              </div>

              <div className="field">
                <label className="label" htmlFor="plano-prazo">
                  Prazo
                </label>
                <input className="input" id="plano-prazo" name="dueDate" type="date" />
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="plano-desc">
                Descrição
              </label>
              <input className="input" id="plano-desc" name="description" maxLength={200} />
            </div>

            <fieldset className="comp__escolha">
              <legend className="label">Competências exigidas</legend>

              {competencies.map((competency) => {
                const escolhida = itensDoPlano.has(competency.id);

                return (
                  <div className="comp__escolha-item" key={competency.id}>
                    <label className="comp__escolha-nome">
                      <input
                        type="checkbox"
                        checked={escolhida}
                        onChange={(event) => {
                          setItensDoPlano((atual) => {
                            const novo = new Map(atual);
                            if (event.target.checked) novo.set(competency.id, 1);
                            else novo.delete(competency.id);
                            return novo;
                          });
                        }}
                      />
                      <span>{competency.name}</span>
                    </label>

                    {/* O nível exigido só aparece quando a competência está
                        escolhida: um seletor inerte ao lado de uma caixa
                        desmarcada convida a preencher algo que não vai a lugar
                        nenhum. */}
                    {escolhida ? (
                      <select
                        className="select comp__escolha-nivel"
                        value={itensDoPlano.get(competency.id)}
                        aria-label={`Nível exigido em ${competency.name}`}
                        onChange={(event) => {
                          setItensDoPlano((atual) => {
                            const novo = new Map(atual);
                            novo.set(competency.id, Number(event.target.value));
                            return novo;
                          });
                        }}
                      >
                        {competency.levels.map((rotulo, indice) => (
                          <option key={rotulo} value={indice + 1}>
                            {rotulo}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                );
              })}
            </fieldset>

            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? "Criando…" : "Criar plano"}
            </button>
          </form>

          {plans.length > 0 ? (
            <ul className="comp__lista">
              {plans.map((plan) => (
                <li className="comp__item" key={plan.id}>
                  <div className="comp__cabeca">
                    <strong>{plan.name}</strong>
                    <span className="comp__framework">
                      {plan.items.length}{" "}
                      {plan.items.length === 1 ? "competência" : "competências"}
                      <span aria-hidden> · </span>
                      {plan.assignedCount}{" "}
                      {plan.assignedCount === 1 ? "pessoa" : "pessoas"}
                    </span>
                  </div>

                  <ul className="comp__vinculos">
                    {plan.items.map((item) => (
                      <li key={item.competencyId}>
                        {item.competencyName}
                        <span className="comp__nivel">nível {item.requiredLevel}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <p className="status-text" role="status">
        {aviso}
      </p>
    </>
  );
}

/** O formulário de vincular um curso a uma competência. */
function VincularCurso({
  competency,
  courses,
  onVincular,
  busy,
}: {
  competency: CompetencyItem;
  courses: CourseOption[];
  onVincular: (competency: CompetencyItem, courseId: string, nivel: number) => void;
  busy: boolean;
}) {
  const [curso, setCurso] = useState("");
  const [nivel, setNivel] = useState(1);

  if (courses.length === 0) return null;

  return (
    <div className="comp__vincular">
      <select
        className="select"
        value={curso}
        aria-label={`Curso que desenvolve ${competency.name}`}
        onChange={(event) => setCurso(event.target.value)}
      >
        <option value="">Vincular um curso…</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>

      {curso ? (
        <>
          <select
            className="select"
            value={nivel}
            aria-label="Nível concedido"
            onChange={(event) => setNivel(Number(event.target.value))}
          >
            {competency.levels.map((rotulo, indice) => (
              <option key={rotulo} value={indice + 1}>
                {rotulo}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn--secondary btn--sm"
            disabled={busy}
            onClick={() => {
              onVincular(competency, curso, nivel);
              setCurso("");
              setNivel(1);
            }}
          >
            Vincular
          </button>
        </>
      ) : null}
    </div>
  );
}
