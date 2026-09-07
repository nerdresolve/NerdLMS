import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { COMPLETION_THRESHOLD, createStore, isComplete, percentOf } from "@nerdlms/core/store/learner-store.js";
import { COMPLETION_THRESHOLD as DOMAIN_THRESHOLD, courseProgress, isLessonCompleted } from "@nerdlms/core/courses/progress.ts";
import { courses, enrollments } from "../../mocks/data.ts";

describe("A store não pode divergir das regras de domínio", () => {
  test("o limiar de conclusão é o mesmo dos dois lados", () => {
    assert.equal(COMPLETION_THRESHOLD, DOMAIN_THRESHOLD);
  });

  test("isComplete concorda com isLessonCompleted em toda a faixa", () => {
    for (const duration of [600, 1560, 1800, 0]) {
      for (const watched of [0, 1, 100, 539, 540, 1403, 1404, 1560, 5000]) {
        assert.equal(
          isComplete(watched, duration),
          isLessonCompleted(watched, duration),
          `${watched}/${duration}`,
        );
      }
    }
  });

  test("percentOf reproduz o percentual de courseProgress no catálogo inteiro", () => {
    for (const course of courses) {
      const enrollment = enrollments.find((item) => item.courseId === course.id)!;
      const summary = courseProgress(course, enrollment);
      assert.equal(percentOf(summary.completed, summary.total), summary.percent, course.id);
    }
  });

  test("curso vazio é 0%, nunca 100%", () => {
    assert.equal(percentOf(0, 0), 0);
  });
});

describe("Progresso", () => {
  test("concluir aula registra a duração inteira", () => {
    const store = createStore();
    store.hydrate({});
    store.completeLesson("l1", 600);
    assert.equal(store.isLessonComplete("l1", 600), true);
  });

  test("a posição assistida nunca retrocede", () => {
    const store = createStore();
    store.hydrate({ progress: { l1: 300 } });
    store.trackProgress("l1", 120);
    assert.equal(store.getState().progress.l1, 300, "voltar o vídeo não pode apagar progresso");
    store.trackProgress("l1", 420);
    assert.equal(store.getState().progress.l1, 420);
  });

  test("90% conclui, 89% não", () => {
    const store = createStore();
    store.hydrate({ progress: { a: 89, b: 90 } });
    assert.equal(store.isLessonComplete("a", 100), false);
    assert.equal(store.isLessonComplete("b", 100), true);
  });
});

describe("Favoritos e matrícula", () => {
  test("alternar salva e remove", () => {
    const store = createStore();
    store.hydrate({});
    assert.equal(store.isSaved("c1"), false);
    store.toggleSaved("c1");
    assert.equal(store.isSaved("c1"), true);
    store.toggleSaved("c1");
    assert.equal(store.isSaved("c1"), false);
  });

  test("matricular duas vezes não duplica nem notifica de novo", () => {
    const store = createStore();
    store.hydrate({});
    let avisos = 0;
    store.subscribe(() => (avisos += 1));
    store.enroll("c1");
    store.enroll("c1");
    assert.equal(store.isEnrolled("c1"), true);
    assert.equal(avisos, 1);
  });
});

describe("Comentários", () => {
  test("o comentário do aluno nunca sai destacado como professor", () => {
    const store = createStore();
    store.hydrate({});
    const comment = store.addComment({
      lessonId: "l1",
      authorId: "u1",
      authorName: "Maria Souza",
      body: "  Comentário com espaços  ",
      // O destaque não é parâmetro de addComment. O spread simula um payload
      // adulterado chegando com o campo — que a store precisa ignorar.
      ...{ highlighted: true },
    });
    assert.equal(comment.highlighted, false);
    assert.equal(comment.body, "Comentário com espaços");
  });

  test("resposta guarda o comentário pai", () => {
    const store = createStore();
    store.hydrate({});
    const raiz = store.addComment({ lessonId: "l1", authorId: "u1", authorName: "Maria", body: "Pergunta" });
    const resposta = store.addComment({
      lessonId: "l1",
      authorId: "u1",
      authorName: "Maria",
      body: "Complemento",
      parentId: raiz.id,
    });
    assert.equal(resposta.parentId, raiz.id);
    assert.equal(store.commentsFor("l1").length, 2);
    assert.equal(store.commentsFor("outra").length, 0);
  });
});

describe("Notificação de mudança", () => {
  test("assinantes são avisados e podem cancelar", () => {
    const store = createStore();
    store.hydrate({});
    let contador = 0;
    const cancelar = store.subscribe(() => (contador += 1));
    store.toggleSaved("c1");
    assert.equal(contador, 1);
    cancelar();
    store.toggleSaved("c2");
    assert.equal(contador, 1);
  });
});

describe("Edição de curso pelo instrutor", () => {
  const curso = {
    id: "c9",
    title: "Curso novo",
    status: "draft",
    modules: [{ id: "m1", title: "Módulo 1", lessons: [] }],
  };

  function comRascunho() {
    const store = createStore();
    store.hydrate({});
    store.openDraft(curso);
    return store;
  }

  /**
   * Os métodos de rascunho devolvem `null` quando o curso não existe. Esses
   * nulos sempre existiram — ficavam escondidos atrás de `any` até a store
   * ganhar tipos por JSDoc.
   *
   * Estas duas funções verificam a ausência de null **como parte do teste**,
   * em vez de silenciá-la com `!`. Se um método passar a devolver null onde
   * não devia, a falha aponta a linha exata.
   */
  function rascunhoDe(store: ReturnType<typeof createStore>, courseId: string) {
    const draft = store.getDraft(courseId);
    assert.ok(draft, `rascunho ${courseId} deveria existir`);
    return draft;
  }

  function naoNulo<T>(valor: T | null | undefined, oQue: string): T {
    assert.ok(valor !== null && valor !== undefined, `${oQue} não deveria ser nulo`);
    return valor;
  }

  test("abrir rascunho copia o curso, sem alterar o original", () => {
    const store = comRascunho();
    store.updateDraft("c9", { title: "Outro nome" });
    assert.equal(rascunhoDe(store, "c9").title, "Outro nome");
    assert.equal(curso.title, "Curso novo", "o objeto original não pode ser mutado");
  });

  test("abrir duas vezes não descarta a edição em andamento", () => {
    const store = comRascunho();
    store.updateDraft("c9", { title: "Editado" });
    store.openDraft(curso);
    assert.equal(rascunhoDe(store, "c9").title, "Editado");
  });

  test("adiciona e remove módulo", () => {
    const store = comRascunho();
    const modulo = naoNulo(store.addModule("c9", "Módulo 2"), "módulo criado");
    assert.equal(rascunhoDe(store, "c9").modules.length, 2);
    store.removeModule("c9", modulo.id);
    assert.equal(rascunhoDe(store, "c9").modules.length, 1);
  });

  test("módulo sem título recebe um nome padrão em vez de ficar vazio", () => {
    const store = comRascunho();
    const modulo = naoNulo(store.addModule("c9", "   "), "módulo criado");
    assert.equal(modulo.title, "Módulo 2");
  });

  test("adiciona aula convertendo minutos em segundos", () => {
    const store = comRascunho();
    const aula = naoNulo(store.addLesson("c9", "m1", { title: "Aula 1", durationMinutes: 30 }), "aula criada");
    assert.equal(aula.durationSeconds, 1800);
  });

  test("duração inválida vira zero, nunca NaN", () => {
    const store = comRascunho();
    for (const entrada of ["abc", -5, "", null, undefined]) {
      const aula = naoNulo(store.addLesson("c9", "m1", { title: "x", durationMinutes: entrada }), "aula criada");
      assert.equal(aula.durationSeconds, 0, String(entrada));
      assert.equal(Number.isNaN(aula.durationSeconds), false);
    }
  });

  test("remove aula sem afetar as outras", () => {
    const store = comRascunho();
    const a = naoNulo(store.addLesson("c9", "m1", { title: "A", durationMinutes: 10 }), "aula A");
    store.addLesson("c9", "m1", { title: "B", durationMinutes: 10 });
    store.removeLesson("c9", "m1", a.id);

    const modulo = naoNulo(rascunhoDe(store, "c9").modules[0], "primeiro módulo");
    assert.equal(modulo.lessons.length, 1);
    assert.equal(naoNulo(modulo.lessons[0], "aula restante").title, "B");
  });

  test("não publica curso sem nenhuma aula", () => {
    const store = comRascunho();
    const resultado = store.publishDraft("c9");
    assert.equal(resultado.ok, false);
    assert.match(naoNulo(resultado.reason, "motivo da recusa"), /aula/);
    assert.equal(rascunhoDe(store, "c9").status, "draft");
  });

  test("não publica curso sem título", () => {
    const store = comRascunho();
    store.addLesson("c9", "m1", { title: "Aula", durationMinutes: 10 });
    store.updateDraft("c9", { title: "   " });
    assert.equal(store.publishDraft("c9").ok, false);
  });

  test("publica quando há título e ao menos uma aula", () => {
    const store = comRascunho();
    store.addLesson("c9", "m1", { title: "Aula", durationMinutes: 10 });
    assert.equal(store.publishDraft("c9").ok, true);
    assert.equal(rascunhoDe(store, "c9").status, "published");
  });
});
