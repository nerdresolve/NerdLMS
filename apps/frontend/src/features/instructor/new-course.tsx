"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Plus } from "lucide-react";

/**
 * Criação de curso.
 *
 * O curso nasce rascunho e vazio, e a tela leva direto ao editor: criar sem
 * poder acrescentar módulo e aula em seguida deixaria a pessoa numa lista com
 * um item que não faz nada.
 *
 * O formulário só aparece depois do clique. Um campo de título sempre aberto
 * no topo da lista competiria com os cursos que já existem — e criar curso é
 * ação ocasional, não o que se faz ao abrir a tela.
 *
 * Houve aqui um botão que apontava para `courses[0]`: abria o PRIMEIRO curso
 * da lista já preenchido, e quem digitasse sobrescrevia um curso real achando
 * que criava outro. Por isso este componente fala com a rota de criação, e
 * navega para o id que ela devolve.
 */
export function NewCourse() {
  const router = useRouter();
  const formId = useId();

  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const title = (form.elements.namedItem("title") as HTMLInputElement | null)?.value ?? "";
    const summary = (form.elements.namedItem("summary") as HTMLTextAreaElement | null)?.value ?? "";

    if (!title.trim()) {
      setErro("Informe o título do curso.");
      return;
    }

    setErro(null);
    setSalvando(true);

    try {
      const response = await fetch("/api/cursos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, summary }),
      });

      if (!response.ok) {
        const corpo = (await response.json().catch(() => ({}))) as { error?: string };
        setErro(corpo.error ?? "Não foi possível criar o curso.");
        return;
      }

      const { courseId } = (await response.json()) as { courseId: string };

      /* Direto para o editor: o curso está vazio, e o próximo passo é sempre
         acrescentar o primeiro módulo. */
      router.push(`/instrutor/cursos/${courseId}`);
    } catch {
      setErro("Não foi possível falar com o servidor. Verifique sua conexão.");
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        className="btn btn--primary"
        onClick={() => setAberto(true)}
        aria-expanded={false}
        aria-controls={formId}
      >
        <Plus aria-hidden /> Novo curso
      </button>
    );
  }

  return (
    <form className="new-course" id={formId} onSubmit={handleSubmit}>
      <div className="field">
        <label className="label" htmlFor={`${formId}-titulo`}>
          Título do curso
        </label>
        <input
          className="input"
          id={`${formId}-titulo`}
          name="title"
          type="text"
          maxLength={160}
          placeholder="Ex.: Operação de Estações Elevatórias"
          required
          autoFocus
        />
      </div>

      <div className="field">
        <label className="label" htmlFor={`${formId}-resumo`}>
          Resumo <span className="new-course__optional">(opcional)</span>
        </label>
        <textarea
          className="textarea"
          id={`${formId}-resumo`}
          name="summary"
          rows={2}
          maxLength={400}
          placeholder="Uma ou duas linhas sobre o que a pessoa vai aprender."
        />
      </div>

      <p className="new-course__note">
        O curso é criado como rascunho, só visível para você. Ele fica disponível para os alunos
        quando você publicar, o que exige ao menos uma aula.
      </p>

      {erro ? (
        <p className="new-course__error" role="alert">
          {erro}
        </p>
      ) : null}

      <div className="new-course__actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            setAberto(false);
            setErro(null);
          }}
        >
          Cancelar
        </button>
        <button type="submit" className="btn btn--primary" disabled={salvando}>
          {salvando ? "Criando" : "Criar e abrir"}
        </button>
      </div>
    </form>
  );
}
