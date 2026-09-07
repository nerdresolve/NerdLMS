"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, Clock, FileText, Info, ListVideo, Paperclip, Plus, Send } from "lucide-react";

import { formatDuration } from "@nerdlms/core/courses/progress.ts";
import type { Course } from "@nerdlms/core/courses/types.ts";
import { contentKindOf } from "@nerdlms/core/courses/content.ts";
import { countPdfPages } from "@nerdlms/core/reports/pdf-pages.ts";
import { MetadataPanel, type CategoryOption } from "./metadata-panel.tsx";
import { Reorderable } from "./reorderable.tsx";
import { ClassesPanel, type InstructorOption } from "./classes-panel.tsx";
import type { CourseClass } from "@nerdlms/core/courses/classes.ts";

import { useCourseUpload } from "./use-course-upload.ts";

import "@/features/studio/studio.css";

/**
 * Editor de curso.
 *
 * Salvar e publicar gravam de verdade. Depois de cada escrita, `router.refresh`
 * recarrega do servidor: a contagem de aulas, a duração e a situação são
 * calculadas lá, e reproduzi-las aqui criaria duas versões dos mesmos números.
 */
export function EditorView({
  course,
  lessons,
  durationSeconds,
  categories,
  classes,
  instructors,
}: {
  course: Course;
  lessons: number;
  durationSeconds: number;
  categories: CategoryOption[];
  classes: CourseClass[];
  instructors: InstructorOption[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(course.title);
  const [summary, setSummary] = useState(course.summary);
  const [busy, setBusy] = useState(false);
  const upload = useCourseUpload(course.id);
  const { enviando, progresso } = upload;
  const [notice, setNotice] = useState<string | null>(null);

  /** Envia e devolve `true` quando deu certo, para quem chamou decidir o resto. */
  async function send(method: "PATCH" | "POST", payload: unknown): Promise<boolean> {
    setBusy(true);
    setNotice(null);

    try {
      const response = await fetch("/api/cursos", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        router.refresh();
        return true;
      }

      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setNotice(body.error ?? "Não foi possível salvar.");
      return false;
    } catch {
      setNotice("Não foi possível falar com o servidor. Verifique sua conexão.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  /**
   * Anexa um material a uma aula.
   *
   * Dois passos, como o vídeo: o arquivo sobe direto para o storage por URL
   * assinada, e só então a linha é gravada. O arquivo não atravessa o processo
   * do Next.
   */
  async function anexarMaterial(lessonId: string, file: File) {
    const key = await upload.enviar(file, "materiais");
    if (!key) return;

    const resposta = await fetch("/api/materiais", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lessonId,
        name: file.name,
        storageKey: key,
        sizeBytes: file.size,
      }),
    });

    if (!resposta.ok) {
      const erro = (await resposta.json().catch(() => ({}))) as { error?: string };
      setNotice(erro.error ?? "Não foi possível anexar o material.");
      return;
    }

    setNotice(`${file.name} anexado.`);
    router.refresh();
  }

  async function handleSave() {
    if (await send("PATCH", { courseId: course.id, title, summary })) {
      setNotice("Alterações salvas.");
    }
  }

  async function handlePublish() {
    if (await send("PATCH", { courseId: course.id, title, publish: true })) {
      setNotice("Curso publicado.");
    }
  }

  /**
   * Tira o curso do ar.
   *
   * Arquivar é o caminho normal: o curso sai do catálogo e para de aceitar
   * matrícula, mas quem já cursava continua com acesso — inclusive ao
   * certificado. Voltar ao rascunho só é possível enquanto ninguém entrou,
   * e o servidor recusa o contrário.
   *
   * Não existe excluir. Apagar levaria junto matrícula, progresso e
   * comentários, e o certificado já emitido deixaria de conferir no validador.
   */
  async function handleRetire(status: "archived" | "draft") {
    if (await send("PATCH", { courseId: course.id, status })) {
      setNotice(status === "archived" ? "Curso arquivado." : "Curso voltou para rascunho.");
    }
  }

  /* Campos inline em vez de `window.prompt`: o prompt do navegador não é
     estilizável, não é acessível e some no mobile. */
  async function handleAddModule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("moduleTitle") as HTMLInputElement | null;
    if (!input?.value.trim()) return;

    if (await send("POST", { courseId: course.id, title: input.value })) {
      form.reset();
    }
  }

  /**
   * Envia o arquivo direto ao storage e devolve a chave.
   *
   * O vídeo não passa pela aplicação: ela só emite uma URL assinada de curta
   * duração, e o navegador fala com o storage. Um arquivo de duas horas
   * atravessando o processo travaria a renderização das páginas.
   */

  /**
   * Cria a aula e publica o pacote SCORM nela.
   *
   * DUAS ETAPAS, e a ordem importa: o pacote precisa de uma aula para
   * pertencer, e a aula precisa existir antes de o `.zip` ser processado. Se a
   * segunda falhar, sobra uma aula SCORM vazia — visível no editor, e que o
   * instrutor conserta reenviando o arquivo. O contrário (pacote órfão no
   * storage) não teria quem o limpasse.
   *
   * O `.zip` vai pelo SERVIDOR, ao contrário dos outros arquivos. Não é
   * inconsistência: um pacote precisa ser descompactado, e a URL assinada
   * resolveria o envio sem resolver o que vem depois.
   */
  async function publicarScorm(moduleId: string, title: string, minutos: string, zip: File) {
    setBusy(true);
    setNotice(null);

    try {
      const criacao = await fetch("/api/cursos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          moduleId,
          title,
          durationMinutes: minutos,
          kind: "scorm",
        }),
      });

      const criada = (await criacao.json().catch(() => ({}))) as {
        lessonId?: string;
        error?: string;
      };

      if (!criacao.ok || !criada.lessonId) {
        setNotice(criada.error ?? "Não foi possível criar a aula.");
        return false;
      }

      const corpo = new FormData();
      corpo.append("arquivo", zip);
      corpo.append("lessonId", criada.lessonId);

      upload.marcarEnvio(zip.name);

      const publicacao = await fetch("/api/scorm/pacote", { method: "POST", body: corpo });
      const resultado = (await publicacao.json().catch(() => ({}))) as {
        error?: string;
        titulo?: string | null;
        versao?: string;
        arquivos?: number;
      };

      if (!publicacao.ok) {
        setNotice(resultado.error ?? "Não foi possível publicar o pacote.");
        router.refresh();
        return false;
      }

      /* O que o pacote declarou, de volta para quem enviou: o instrutor
         escolheu um `.zip` e não tem como saber que versão de SCORM ele é nem
         quantos arquivos tinha dentro. */
      setNotice(
        `Pacote SCORM ${resultado.versao ?? ""} publicado — ${resultado.arquivos ?? 0} arquivos.`,
      );
      router.refresh();
      return true;
    } catch {
      setNotice("Não foi possível enviar o pacote. Verifique sua conexão.");
      return false;
    } finally {
      setBusy(false);
      upload.marcarEnvio(null);
    }
  }

  async function handleAddLesson(event: React.FormEvent<HTMLFormElement>, moduleId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const title = (form.elements.namedItem("lessonTitle") as HTMLInputElement | null)?.value ?? "";
    const minutes = (form.elements.namedItem("lessonMinutes") as HTMLInputElement | null)?.value ?? "";
    const campo = form.elements.namedItem("lessonFile") as HTMLInputElement | null;
    const file = campo?.files?.[0];
    if (!title.trim()) return;

    /* O `.zip` tem caminho próprio: precisa ser descompactado no servidor, e o
       upload comum entrega o arquivo ao storage sem abri-lo. Sem este desvio,
       um pacote SCORM viraria uma aula de "documento" com um zip para baixar. */
    if (file && /\.zip$/i.test(file.name)) {
      if (await publicarScorm(moduleId, title, minutes, file)) form.reset();
      return;
    }

    /* O arquivo sobe ANTES da aula: se o envio falhar, não fica uma aula
       apontando para arquivo que não chegou. */
    let mediaKey: string | undefined;
    let pageCount: number | undefined;

    if (file) {
      const key = await upload.enviar(file);
      if (!key) return;
      mediaKey = key;

      /* Conta as páginas do PDF aqui, no navegador, antes de subir a aula.
         
         É o denominador de "chegou ao fim" — sem ele o documento não tem como
         exigir leitura completa. Ler no cliente evita uma segunda viagem do
         arquivo até o servidor, que já o mandou direto para o storage. */
      if (file.name.toLowerCase().endsWith(".pdf")) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        pageCount = countPdfPages(bytes) ?? undefined;
      }
    }

    /* O tipo sai da extensão: pedir ao instrutor para classificar o arquivo
       que ele acabou de escolher seria trabalho que o nome já responde. */
    const kind = file ? contentKindOf(file.name) : "video";

    if (
      await send("POST", {
        moduleId,
        title,
        durationMinutes: minutes,
        kind,
        ...(mediaKey ? { mediaKey } : {}),
        ...(pageCount ? { pageCount } : {}),
      })
    ) {
      form.reset();
    }
  }

  return (
    <div className="editor" id="editor" data-course-id={course.id}>
      <div className="editor__main">
        <section className="editor__panel">
          <h2 className="editor__panel-title">Dados do curso</h2>

          <div className="field">
            <label className="field__label" htmlFor="curso-titulo">
              Título
            </label>
            <input
              className="input"
              id="curso-titulo"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="curso-resumo">
              Resumo
            </label>
            <textarea
              className="input"
              id="curso-resumo"
              rows={3}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
            />
          </div>

          <button type="button" className="btn btn--secondary" onClick={handleSave} disabled={busy}>
            {busy ? "Salvando…" : "Salvar alterações"}
          </button>
        </section>

        <section className="editor__panel">
          <h2 className="editor__panel-title">Conteúdo</h2>

          {course.modules.map((module, index) => (
            <div className="editor-module" key={module.id}>
              <div className="editor-module__head">
                <h3 className="editor-module__title">
                  Módulo {index + 1} — {module.title}
                </h3>
                <form className="editor-add-form" onSubmit={(event) => handleAddLesson(event, module.id)}>
                  <label className="sr-only" htmlFor={`aula-${module.id}`}>
                    Título da nova aula
                  </label>
                  <input
                    className="input"
                    id={`aula-${module.id}`}
                    name="lessonTitle"
                    type="text"
                    placeholder="Título da aula"
                  />
                  <label className="sr-only" htmlFor={`min-${module.id}`}>
                    Duração em minutos
                  </label>
                  <input
                    className="input input--narrow"
                    id={`min-${module.id}`}
                    name="lessonMinutes"
                    type="number"
                    min="0"
                    placeholder="min"
                    defaultValue="20"
                  />
                  <label className="sr-only" htmlFor={`arq-${module.id}`}>
                    Arquivo da aula: vídeo, documento ou pacote SCORM (opcional)
                  </label>
                  <input
                    className="input input--file"
                    id={`arq-${module.id}`}
                    name="lessonFile"
                    type="file"
                    /* O guia §4 pede muito mais que vídeo. O tipo da aula é
                       deduzido da extensão ao enviar, e o `.zip` tem caminho
                       próprio: vira pacote SCORM, não documento. */
                    accept="video/*,audio/*,image/*,application/pdf,.doc,.docx,.odt,.xls,.xlsx,.csv,.ods,.ppt,.pptx,.odp,.zip"
                  />
                  <button type="submit" className="btn btn--secondary" disabled={busy || enviando !== null}>
                    <Plus aria-hidden /> {enviando ? "Enviando" : "Aula"}
                  </button>

                  {/* A barra só aparece durante o envio, e some junto com ele.
                      `role="progressbar"` com os valores torna o número
                      audível para leitor de tela — sem isso, quem não vê a
                      barra fica sem saber se travou. */}
                  {enviando ? (
                    <div className="upload-progress">
                      <div
                        className="upload-progress__track"
                        role="progressbar"
                        aria-label={enviando}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        {...(progresso === null ? {} : { "aria-valuenow": progresso })}
                      >
                        <span
                          className="upload-progress__fill"
                          data-indeterminate={progresso === null || undefined}
                          style={progresso === null ? undefined : { width: `${progresso}%` }}
                        />
                      </div>
                      <span className="upload-progress__label">
                        {progresso === null ? "Preparando" : `${progresso}%`}
                      </span>
                    </div>
                  ) : null}
                </form>
              </div>

              {module.lessons.length > 1 ? (
                <Reorderable
                  items={module.lessons.map((lesson) => ({
                    id: lesson.id,
                    label: `${lesson.title} — ${formatDuration(lesson.durationSeconds)}`,
                  }))}
                  itemLabel="aula"
                  disabled={busy}
                  onReorder={(orderedIds) =>
                    send("PATCH", { reorder: "lessons", parentId: module.id, orderedIds })
                  }
                />
              ) : (
                /* Com uma aula só não há o que reordenar, e a lista com pegador
                   e botões desabilitados só sugeriria uma ação impossível. */
                <ul className="editor-lessons">
                  {module.lessons.map((lesson) => (
                    <li className="editor-lesson" key={lesson.id}>
                      <ListVideo aria-hidden />
                      <span className="editor-lesson__title">{lesson.title}</span>
                      <span className="editor-lesson__duration">
                        {formatDuration(lesson.durationSeconds)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <ul className="editor-materials">
                {module.lessons.map((lesson) => (
                  <li className="editor-materials__row" key={`mat-${lesson.id}`}>
                    <label className="editor-materials__label" htmlFor={`material-${lesson.id}`}>
                      <Paperclip aria-hidden /> Material para “{lesson.title}”
                    </label>
                    <input
                      className="input editor-materials__input"
                      id={`material-${lesson.id}`}
                      type="file"
                      accept=".pdf,.doc,.docx,.odt,.xls,.xlsx,.csv,.ods,.ppt,.pptx,.odp"
                      disabled={busy || enviando !== null}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        /* O campo é limpo depois de ler o arquivo: sem isso,
                           escolher o mesmo arquivo de novo não dispara evento e
                           parece que o envio falhou. */
                        event.target.value = "";
                        if (file) void anexarMaterial(lesson.id, file);
                      }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {course.modules.length > 1 ? (
            <div className="editor-module-order">
              <h3 className="editor-module-order__title">Ordem dos módulos</h3>
              <Reorderable
                items={course.modules.map((module) => ({ id: module.id, label: module.title }))}
                itemLabel="módulo"
                disabled={busy}
                onReorder={(orderedIds) =>
                  send("PATCH", { reorder: "modules", parentId: course.id, orderedIds })
                }
              />
            </div>
          ) : null}

          <form className="editor-add-form" onSubmit={handleAddModule}>
            <label className="sr-only" htmlFor="novo-modulo">
              Título do novo módulo
            </label>
            <input
              className="input"
              id="novo-modulo"
              name="moduleTitle"
              type="text"
              placeholder="Título do módulo"
            />
            <button type="submit" className="editor-add" disabled={busy}>
              <Plus aria-hidden /> Novo módulo
            </button>
          </form>
        </section>

        <MetadataPanel
          course={course}
          categories={categories}
          busy={busy}
          onSave={(payload) => send("PATCH", payload)}
        />

        <ClassesPanel courseId={course.id} classes={classes} instructors={instructors} />
      </div>

      <aside className="editor__aside">
        <div className="editor__summary">
          <h2 className="editor__panel-title">Resumo</h2>

          <div className="editor__summary-row">
            <span className="editor__summary-label">
              <FileText aria-hidden /> Módulos
            </span>
            <span className="editor__summary-value">{course.modules.length}</span>
          </div>
          <div className="editor__summary-row">
            <span className="editor__summary-label">
              <ListVideo aria-hidden /> Aulas
            </span>
            <span className="editor__summary-value">{lessons}</span>
          </div>
          <div className="editor__summary-row">
            <span className="editor__summary-label">
              <Clock aria-hidden /> Duração
            </span>
            <span className="editor__summary-value">{formatDuration(durationSeconds)}</span>
          </div>

          <div className="editor__publish">
            <button
              type="button"
              className="btn btn--primary"
              onClick={handlePublish}
              disabled={busy || course.status === "published"}
            >
              <Send aria-hidden />
              {course.status === "published" ? "Publicado" : "Publicar curso"}
            </button>

            {/* Arquivar só aparece no que está no ar: rascunho já não é
                visível para ninguém, e oferecer "tirar do ar" ali não teria
                efeito nenhum. */}
            {course.status === "published" ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => handleRetire("archived")}
                disabled={busy}
              >
                <Archive aria-hidden /> Arquivar
              </button>
            ) : null}

            {course.status === "archived" ? (
              <>
                <p className="editor__retired">
                  Curso arquivado: fora do catálogo e sem matrículas novas. Quem já cursava
                  continua com acesso ao conteúdo e ao certificado.
                </p>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={handlePublish}
                  disabled={busy}
                >
                  <Send aria-hidden /> Publicar de novo
                </button>
              </>
            ) : null}
          </div>

          <div className="notice" data-visible={notice ? "true" : "false"} role="status">
            {notice ? (
              <>
                <Info aria-hidden="true" />
                <span>{notice}</span>
              </>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}
