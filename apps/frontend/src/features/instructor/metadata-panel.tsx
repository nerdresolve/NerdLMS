"use client";

import { useId, useState } from "react";
import { Check, Tag as TagIcon } from "lucide-react";

import { LEVEL_LABEL } from "@nerdlms/core/courses/metadata.ts";
import type { Course, CourseLevel } from "@nerdlms/core/courses/types.ts";

/**
 * Metadados do curso — F2-03.
 *
 * O guia §3 lista dezoito campos por curso. Aqui estão os que não existiam:
 * código, categoria, carga horária, nível, idioma, tags, objetivos,
 * público-alvo, janela de datas e visibilidade.
 *
 * Um formulário só, com um botão só. Salvar campo a campo daria dez requisições
 * e dez chances de deixar o curso meio preenchido — e nenhum destes campos faz
 * sentido isolado dos outros.
 */

export interface CategoryOption {
  id: string;
  name: string;
  parentName: string | null;
}

export function MetadataPanel({
  course,
  categories,
  onSave,
  busy,
}: {
  course: Course;
  categories: CategoryOption[];
  onSave: (payload: Record<string, unknown>) => Promise<boolean>;
  busy: boolean;
}) {
  const id = useId();

  const [categoryId, setCategoryId] = useState(course.category?.id ?? "");
  const [code, setCode] = useState(course.code ?? "");
  const [workload, setWorkload] = useState(
    course.workloadMinutes ? String(course.workloadMinutes) : "",
  );
  const [level, setLevel] = useState<CourseLevel | "">(course.level ?? "");
  const [language, setLanguage] = useState(course.language ?? "pt-BR");
  const [objectives, setObjectives] = useState(course.objectives ?? "");
  const [audience, setAudience] = useState(course.audience ?? "");
  const [startsOn, setStartsOn] = useState(course.startsOn ?? "");
  const [endsOn, setEndsOn] = useState(course.endsOn ?? "");
  const [unlisted, setUnlisted] = useState(course.visibility === "unlisted");
  const [sequencial, setSequencial] = useState(course.contentRelease === "sequential");
  /* Ausente conta como LIGADA: é o padrão da coluna, e o estado inicial da
     tela não pode discordar do que o banco fará. */
  const [travaDoPlayer, setTravaDoPlayer] = useState(course.watchGuard !== false);
  const [tags, setTags] = useState((course.tags ?? []).map((tag) => tag.name).join(", "));

  const [notice, setNotice] = useState<string | null>(null);

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);

    const ok = await onSave({
      metadata: true,
      courseId: course.id,
      categoryId: categoryId || null,
      code: code || null,
      /* Campo de texto devolve string; o caso de uso espera número ou nulo. */
      workloadMinutes: workload === "" ? null : Number(workload),
      level: level || null,
      language: language || null,
      objectives: objectives || null,
      audience: audience || null,
      startsOn: startsOn || null,
      endsOn: endsOn || null,
      visibility: unlisted ? "unlisted" : "catalog",
      watchGuard: travaDoPlayer,
      contentRelease: sequencial ? "sequential" : "open",
      tags: tags
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item !== ""),
    });

    if (ok) setNotice("Informações do curso salvas.");
  }

  return (
    <section className="course-section" aria-labelledby={`${id}-titulo`}>
      <h2 className="course-section__title" id={`${id}-titulo`}>
        <TagIcon aria-hidden /> Informações do curso
      </h2>

      <form className="meta-form" onSubmit={salvar}>
        <div className="field">
          <label className="label" htmlFor={`${id}-categoria`}>
            Categoria
          </label>
          <select
            className="input"
            id={`${id}-categoria`}
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            disabled={busy}
          >
            <option value="">Sem categoria</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.parentName ? `${item.parentName} › ${item.name}` : item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor={`${id}-codigo`}>
            Código
          </label>
          <input
            className="input"
            id={`${id}-codigo`}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="NR-10"
            disabled={busy}
          />
          <p className="field__hint">O identificador usado pelo RH. Sem espaços.</p>
        </div>

        <div className="field">
          <label className="label" htmlFor={`${id}-carga`}>
            Carga horária (minutos)
          </label>
          <input
            className="input"
            id={`${id}-carga`}
            type="number"
            min={1}
            value={workload}
            onChange={(event) => setWorkload(event.target.value)}
            placeholder="240"
            disabled={busy}
          />
          <p className="field__hint">
            A carga declarada, que vai para o certificado, não a soma dos vídeos.
          </p>
        </div>

        <div className="field">
          <label className="label" htmlFor={`${id}-nivel`}>
            Nível
          </label>
          <select
            className="input"
            id={`${id}-nivel`}
            value={level}
            onChange={(event) => setLevel(event.target.value as CourseLevel | "")}
            disabled={busy}
          >
            <option value="">Não informado</option>
            <option value="basic">{LEVEL_LABEL.basic}</option>
            <option value="intermediate">{LEVEL_LABEL.intermediate}</option>
            <option value="advanced">{LEVEL_LABEL.advanced}</option>
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor={`${id}-idioma`}>
            Idioma
          </label>
          <input
            className="input"
            id={`${id}-idioma`}
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            placeholder="pt-BR"
            disabled={busy}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor={`${id}-inicio`}>
            Início
          </label>
          <input
            className="input"
            id={`${id}-inicio`}
            type="date"
            value={startsOn}
            onChange={(event) => setStartsOn(event.target.value)}
            disabled={busy}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor={`${id}-fim`}>
            Encerramento
          </label>
          <input
            className="input"
            id={`${id}-fim`}
            type="date"
            value={endsOn}
            onChange={(event) => setEndsOn(event.target.value)}
            disabled={busy}
          />
        </div>

        <div className="field meta-form__wide">
          <label className="label" htmlFor={`${id}-tags`}>
            Tags
          </label>
          <input
            className="input"
            id={`${id}-tags`}
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="segurança, campo, obrigatório"
            disabled={busy}
          />
          <p className="field__hint">
            Separadas por vírgula. Tags equivalentes são reunidas, “NR-10” e “nr 10” viram a mesma.
          </p>
        </div>

        <div className="field meta-form__wide">
          <label className="label" htmlFor={`${id}-objetivos`}>
            Objetivos de aprendizagem
          </label>
          <textarea
            className="input"
            id={`${id}-objetivos`}
            rows={4}
            value={objectives}
            onChange={(event) => setObjectives(event.target.value)}
            placeholder={"Identificar riscos elétricos\nAplicar as medidas de controle"}
            disabled={busy}
          />
          <p className="field__hint">Um objetivo por linha.</p>
        </div>

        <div className="field meta-form__wide">
          <label className="label" htmlFor={`${id}-publico`}>
            Público-alvo
          </label>
          <textarea
            className="input"
            id={`${id}-publico`}
            rows={2}
            value={audience}
            onChange={(event) => setAudience(event.target.value)}
            placeholder="Equipes de manutenção de campo"
            disabled={busy}
          />
        </div>

        <div className="field meta-form__wide">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={unlisted}
              onChange={(event) => setUnlisted(event.target.checked)}
              disabled={busy}
            />
            {/* O input real fica invisível (`opacity: 0`) e este span É a caixa
                que se vê — sem ele o controle some da tela, embora continue
                clicável e acessível. */}
            <span className="checkbox__box" aria-hidden="true">
              <Check />
            </span>
            <span>
              Não listar no catálogo
              <span className="field__hint">
                O curso continua acessível a quem for matriculado, só não aparece na busca nem na
                biblioteca.
              </span>
            </span>
          </label>
        </div>

        <div className="field meta-form__wide">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={travaDoPlayer}
              onChange={(event) => setTravaDoPlayer(event.target.checked)}
              disabled={busy}
            />
            <span className="checkbox__box" aria-hidden="true">
              <Check />
            </span>
            <span>
              Exigir que o vídeo seja assistido
              <span className="field__hint">
                Bloqueia avançar o vídeo e só libera a conclusão com 90% assistido, em tempo
                compatível. Deixe ligado em treinamento obrigatório, onde o registro serve de
                evidência. Desligue em conteúdo informativo, como comunicado ou orientação de
                acesso a sistema: o progresso continua sendo registrado de qualquer forma.
              </span>
            </span>
          </label>
        </div>

        <div className="field meta-form__wide">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={sequencial}
              onChange={(event) => setSequencial(event.target.checked)}
              disabled={busy}
            />
            <span className="checkbox__box" aria-hidden="true">
              <Check />
            </span>
            <span>
              Liberar as aulas em sequência
              <span className="field__hint">
                Cada aula abre quando a anterior é concluída. Sem isto, o aluno escolhe a ordem.
              </span>
            </span>
          </label>
        </div>

        <div className="meta-form__actions">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? "Salvando" : "Salvar informações"}
          </button>
        </div>
      </form>

      <p className="status-text" role="status">
        {notice}
      </p>
    </section>
  );
}
