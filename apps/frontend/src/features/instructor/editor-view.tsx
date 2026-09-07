"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Archive,
  Clock,
  FileText,
  Info,
  ListVideo,
  Paperclip,
  Plus,
  Send,
  Trash2,
} from "lucide-react";

import { formatDuration } from "@nerdlms/core/courses/progress.ts";
import type { Course, LessonMaterial } from "@nerdlms/core/courses/types.ts";
import { contentKindOf } from "@nerdlms/core/courses/content.ts";
import { countPdfPages } from "@nerdlms/core/reports/pdf-pages.ts";
import { MetadataPanel, type CategoryOption } from "./metadata-panel.tsx";
import { Reorderable } from "./reorderable.tsx";
import { ClassesPanel, type InstructorOption } from "./classes-panel.tsx";
import type { CourseClass } from "@nerdlms/core/courses/classes.ts";

import { campoObrigatorio } from "@/lib/campo-obrigatorio.ts";
import { duracaoDoVideo } from "./duracao-do-video.ts";
import { aulasNecessarias, cabeNumaAula } from "@nerdlms/core/courses/duracao-da-aula.ts";
import { uploadWithProgress } from "./upload-progress.ts";

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
  materials,
}: {
  course: Course;
  lessons: number;
  durationSeconds: number;
  categories: CategoryOption[];
  classes: CourseClass[];
  instructors: InstructorOption[];
  materials: Record<string, LessonMaterial[]>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(course.title);
  const [summary, setSummary] = useState(course.summary);
  const [busy, setBusy] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<number | null>(null);
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
   * do Next (DEC-009).
   */
  async function anexarMaterial(lessonId: string, file: File) {
    const key = await enviarArquivo(file, "materiais");
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

  /**
   * Desanexa um material.
   *
   * Sem isto, quem subisse o arquivo errado não tinha saída: anexava o certo e
   * convivia com os dois na lista que o aluno vê.
   */
  async function removerMaterial(lessonId: string, materialId: string, nome: string) {
    setBusy(true);
    setNotice(null);

    try {
      const resposta = await fetch("/api/materiais", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lessonId, materialId }),
      });

      if (!resposta.ok) {
        const erro = (await resposta.json().catch(() => ({}))) as { error?: string };
        setNotice(erro.error ?? "Não foi possível remover o material.");
        return;
      }

      setNotice(`${nome} removido.`);
      router.refresh();
    } catch {
      setNotice("Não foi possível falar com o servidor.");
    } finally {
      setBusy(false);
    }
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

    /* O `required` do campo já barra o vazio e explica. Esta guarda continua
       porque ele não pega o título só de espaços, e porque nada garante que o
       envio venha do formulário. */
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
  async function enviarArquivo(
    file: File,
    scope: "aulas" | "materiais" = "aulas",
  ): Promise<string | null> {
    setProgresso(0);
    setEnviando(`Enviando ${file.name}`);
    try {
      const autorizacao = await fetch("/api/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId: course.id, filename: file.name, scope }),
      });

      if (!autorizacao.ok) {
        const corpo = (await autorizacao.json().catch(() => ({}))) as { error?: string };
        setNotice(corpo.error ?? "Não foi possível preparar o envio.");
        return null;
      }

      const { url, key, contentType } = (await autorizacao.json()) as {
        url: string;
        key: string;
        contentType: string;
      };

      /* `XMLHttpRequest`, e não `fetch`: só ele reporta progresso de ENVIO.
         `fetch` acompanha o download da resposta, o que aqui não serve — o
         que demora é o vídeo subindo. Sem isso, um arquivo grande em conexão
         de campo deixava o botão em "Enviando" por minutos, sem sinal de que
         algo acontecia, e quem opera recarregava a página no meio. */
      const envio = uploadWithProgress(url, file, contentType, (pct) => setProgresso(pct));
      const enviado = await envio.done;

      if (!enviado) {
        setNotice("O arquivo não chegou ao armazenamento. Tente de novo.");
        return null;
      }

      return key;
    } catch {
      setNotice("Não foi possível enviar o arquivo. Verifique sua conexão.");
      return null;
    } finally {
      setEnviando(null);
      setProgresso(null);
    }
  }

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

      setEnviando(zip.name);

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
        `Pacote SCORM ${resultado.versao ?? ""} publicado, ${resultado.arquivos ?? 0} arquivos.`,
      );
      router.refresh();
      return true;
    } catch {
      setNotice("Não foi possível enviar o pacote. Verifique sua conexão.");
      return false;
    } finally {
      setBusy(false);
      setEnviando(null);
    }
  }

  async function handleAddLesson(event: React.FormEvent<HTMLFormElement>, moduleId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const title = (form.elements.namedItem("lessonTitle") as HTMLInputElement | null)?.value ?? "";
    const minutes = (form.elements.namedItem("lessonMinutes") as HTMLInputElement | null)?.value ?? "";
    const campo = form.elements.namedItem("lessonFile") as HTMLInputElement | null;
    const file = campo?.files?.[0];

    /* Como no módulo: o `required` explica o vazio, esta guarda pega o título
       só de espaços, que o navegador aceita. */
    if (!title.trim()) return;

    /* O `.zip` tem caminho próprio: precisa ser descompactado no servidor, e o
       upload comum entrega o arquivo ao storage sem abri-lo. Sem este desvio,
       um pacote SCORM viraria uma aula de "documento" com um zip para baixar. */
    if (file && /\.zip$/i.test(file.name)) {
      if (await publicarScorm(moduleId, title, minutes, file)) form.reset();
      return;
    }

    /* O TETO DE DURAÇÃO: AVISO, E NÃO MAIS RECUSA.

       Esta checagem RECUSAVA o vídeo longo e mandava o instrutor cortar por
       fora. Fazia sentido enquanto o servidor não cortava; agora corta, e
       recusar seria negar o trabalho que o produto passou a fazer sozinho.

       A leitura continua acontecendo aqui, antes do envio, porque é o que
       permite dizer QUANTAS aulas vão sair — a pessoa fica sabendo o que
       esperar antes de 300 MB atravessarem a rede. */
    if (file && file.type.startsWith("video/")) {
      const duracao = await duracaoDoVideo(file);
      const veredito = cabeNumaAula(duracao);

      if (!veredito.aceita) {
        const partes = duracao ? aulasNecessarias(duracao) : 0;
        setNotice(
          partes > 1
            ? `Este vídeo passa de 15 minutos: ele será dividido em ${partes} aulas depois do envio.`
            : "Este vídeo passa de 15 minutos e será dividido depois do envio.",
        );
      }
    }

    /* O arquivo sobe ANTES da aula: se o envio falhar, não fica uma aula
       apontando para arquivo que não chegou. */
    let mediaKey: string | undefined;
    let pageCount: number | undefined;

    if (file) {
      const key = await enviarArquivo(file);
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
                  Módulo {index + 1}: {module.title}
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
                    /* Sem isto o clique não fazia NADA e não dizia nada, e quem
                       clicou conclui que o botão está quebrado. */
                    {...campoObrigatorio("Escreva o título da aula.")}
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
                    /* O estado da mídia entra no rótulo porque esta lista não
                       tem outro lugar para ele — e um vídeo sendo cortado
                       dentro de um módulo que já tem aulas ficaria sem aviso
                       nenhum, parecendo uma aula pronta de 56 minutos. */
                    label:
                      lesson.mediaStatus === "splitting"
                        ? `${lesson.title} · dividindo o vídeo em aulas de 15 minutos…`
                        : lesson.mediaStatus === "failed"
                          ? `${lesson.title} · não foi possível dividir. O vídeo está inteiro`
                          : `${lesson.title}, ${formatDuration(lesson.durationSeconds)}`,
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

                      {/* SE HÁ ARQUIVO, E COMO ABRI-LO.

                          A lista mostrava só ícone, título e duração — e uma
                          aula com vídeo de cem megabytes ficava idêntica a uma
                          vazia. Quem abria o editor de um curso importado via
                          uma casca, e concluía, com razão, que não havia nada
                          ali dentro.

                          O link leva à aula como o ALUNO a vê, em vez de um
                          segundo player aqui: aquela tela já resolve URL
                          assinada, legenda e retomada, e duplicá-la criaria
                          duas formas de assistir que envelheceriam em
                          separado. */}
                      {/* O CORTE EM ANDAMENTO PRECISA APARECER.

                          O vídeo longo entra inteiro e o trabalhador o
                          substitui por partes de quinze minutos. Sem este
                          aviso, o instrutor veria uma aula de 56 minutos
                          aparentemente pronta e concluiria que o corte não
                          acontece — ou publicaria o curso assim. */}
                      {lesson.mediaStatus === "splitting" ? (
                        <span className="editor-lesson__preparando">
                          Dividindo o vídeo em aulas de 15 minutos…
                        </span>
                      ) : lesson.mediaStatus === "failed" ? (
                        <span className="editor-lesson__falhou">
                          Não foi possível dividir este vídeo. Ele está inteiro.
                        </span>
                      ) : lesson.mediaKey ? (
                        <a
                          className="editor-lesson__arquivo"
                          href={`/aulas/${lesson.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Paperclip aria-hidden /> Ver arquivo
                        </a>
                      ) : (
                        <span className="editor-lesson__sem-arquivo">Sem arquivo</span>
                      )}
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

                    {/* O QUE JÁ ESTÁ ANEXADO.

                        O editor oferecia o campo de envio e nunca mostrava o
                        resultado: quem anexava lia "arquivo.pdf anexado.",
                        recarregava a página e não encontrava mais rastro
                        nenhum. Sem a lista não dá para conferir se o envio deu
                        certo, nem para perceber que subiu o arquivo errado —
                        e o aluno via os dois. */}
                    {(materials[lesson.id] ?? []).length > 0 ? (
                      <ul className="editor-materials__anexos">
                        {(materials[lesson.id] ?? []).map((material) => (
                          <li className="editor-materials__anexo" key={material.id}>
                            <Paperclip aria-hidden />
                            <span className="editor-materials__nome">{material.name}</span>
                            <button
                              type="button"
                              className="btn btn--ghost btn--small"
                              disabled={busy || enviando !== null}
                              onClick={() =>
                                void removerMaterial(lesson.id, material.id, material.name)
                              }
                            >
                              <Trash2 aria-hidden /> Remover
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
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
              /* Mesmo motivo do título da aula: clique mudo lê-se como defeito. */
              {...campoObrigatorio("Escreva o título do módulo.")}
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
