/**
 * Fábricas de dados para teste.
 *
 * Existe porque o modelo ganhou campos obrigatórios (`authorId`,
 * `enrollmentMode`, `status`, `learnerId`, `enrolledBy`) e **oito fixtures
 * escritos à mão, em quatro arquivos, quebraram de uma vez**. Cada um teria de
 * ser remendado separadamente, e o próximo campo obrigatório repetiria a dor.
 *
 * A regra: teste que precisa de um `Course` pede um aqui. Se o modelo mudar,
 * muda este arquivo — e só ele.
 *
 * Os padrões são deliberadamente neutros. Quando o teste depende de um valor
 * (autoria, modo de matrícula, situação), ele passa esse valor explicitamente,
 * e aí o leitor vê que aquilo importa para o caso.
 */

import type { Course, Enrollment, Lesson, Module, User } from "./types.ts";
import { COMPLETION_THRESHOLD } from "./progress.ts";

let sequence = 0;

/** Id estável dentro de um mesmo teste, sem colidir entre chamadas. */
function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export interface LessonOptions {
  id?: string;
  title?: string;
  durationSeconds?: number;
  kind?: Lesson["kind"];
}

export function makeLesson(options: LessonOptions = {}): Lesson {
  const id = options.id ?? nextId("l");
  return {
    id,
    title: options.title ?? `Aula ${id}`,
    durationSeconds: options.durationSeconds ?? 600,
    ...(options.kind === undefined ? {} : { kind: options.kind }),
  };
}

export interface ModuleOptions {
  id?: string;
  title?: string;
  /** Quantidade de aulas geradas, quando `lessons` não é fornecido. */
  lessonCount?: number;
  lessons?: Lesson[];
  durationSeconds?: number;
}

export function makeModule(options: ModuleOptions = {}): Module {
  const id = options.id ?? nextId("m");
  const lessons =
    options.lessons ??
    Array.from({ length: options.lessonCount ?? 2 }, (_, index) =>
      makeLesson({
        id: `${id}-l${index + 1}`,
        title: `Aula ${index + 1}`,
        ...(options.durationSeconds === undefined ? {} : { durationSeconds: options.durationSeconds }),
      }),
    );

  return { id, title: options.title ?? `Módulo ${id}`, lessons };
}

export interface CourseOptions {
  id?: string;
  slug?: string;
  title?: string;
  summary?: string;
  authorId?: string;
  status?: Course["status"];
  enrollmentMode?: Course["enrollmentMode"];
  project?: string;
  artwork?: Course["artwork"];
  modules?: Module[];
  /** Atalho: um módulo com N aulas de duração igual. */
  lessonCount?: number;
  durationSeconds?: number;

  /* Metadados da 007. Repassados como vieram: são opcionais no modelo, e um
     teste que não os menciona continua produzindo o curso de antes. */
  category?: Course["category"];
  code?: string;
  workloadMinutes?: number;
  level?: Course["level"];
  language?: string;
  objectives?: string;
  audience?: string;
  startsOn?: string;
  endsOn?: string;
  visibility?: Course["visibility"];
  tags?: Course["tags"];
}

export function makeCourse(options: CourseOptions = {}): Course {
  const id = options.id ?? nextId("c");

  const modules =
    options.modules ??
    [
      makeModule({
        id: `${id}-m1`,
        ...(options.lessonCount === undefined ? {} : { lessonCount: options.lessonCount }),
        ...(options.durationSeconds === undefined ? {} : { durationSeconds: options.durationSeconds }),
      }),
    ];

  return {
    id,
    slug: options.slug ?? id,
    title: options.title ?? `Curso ${id}`,
    summary: options.summary ?? "",
    authorId: options.authorId ?? "autor-1",
    status: options.status ?? "published",
    enrollmentMode: options.enrollmentMode ?? "open",
    artwork: options.artwork ?? 0,
    modules,
    // `exactOptionalPropertyTypes` distingue ausente de presente-como-undefined.
    // Por isso a chave é omitida, não atribuída como undefined.
    ...(options.project === undefined ? {} : { project: options.project }),
    ...(options.category === undefined ? {} : { category: options.category }),
    ...(options.code === undefined ? {} : { code: options.code }),
    ...(options.workloadMinutes === undefined ? {} : { workloadMinutes: options.workloadMinutes }),
    ...(options.level === undefined ? {} : { level: options.level }),
    ...(options.language === undefined ? {} : { language: options.language }),
    ...(options.objectives === undefined ? {} : { objectives: options.objectives }),
    ...(options.audience === undefined ? {} : { audience: options.audience }),
    ...(options.startsOn === undefined ? {} : { startsOn: options.startsOn }),
    ...(options.endsOn === undefined ? {} : { endsOn: options.endsOn }),
    ...(options.visibility === undefined ? {} : { visibility: options.visibility }),
    ...(options.tags === undefined ? {} : { tags: options.tags }),
  };
}

export interface EnrollmentOptions {
  courseId: string;
  learnerId?: string;
  enrolledBy?: Enrollment["enrolledBy"];
  saved?: boolean;
  lastLessonId?: string;
  /** Aulas concluídas: id → segundos assistidos. */
  progress?: Record<string, number>;
  /** Atalho: conclui as N primeiras aulas do curso. */
  completeFirst?: { course: Course; count: number };
  /**
   * O curso a que este progresso pertence.
   *
   * Serve para a fixture saber a duração de cada aula e decidir se o consumo
   * a concluiria. Sem ele vale 600s (o padrão de `makeLesson`), o que erra em
   * curso com aula mais longa — uma aula de 1200s com 1000s assistidos está
   * em andamento, não concluída.
   */
  course?: Course;
}

/* Data estável: a fixture não pode depender do relógio, senão dois testes que
   comparam progresso montado em instantes diferentes divergem sem motivo. */
const DATA_FIXA_DE_CONCLUSAO = "2026-01-01T00:00:00.000Z";

/**
 * Duração da aula, para a fixture decidir se o consumo a concluiria.
 *
 * `completeFirst` traz o curso e permite a resposta exata. `progress` não
 * traz — e ali vale o padrão de `makeLesson` (600s), que é o que essas
 * fixtures usam. Não é adivinhação: é o mesmo default, num arquivo só.
 */
function duracaoDaAula(options: EnrollmentOptions, lessonId: string): number {
  const curso = options.course ?? options.completeFirst?.course;
  if (!curso) return 600;

  const aula = curso.modules.flatMap((m) => m.lessons).find((l) => l.id === lessonId);
  return aula?.durationSeconds ?? 600;
}

export function makeEnrollment(options: EnrollmentOptions): Enrollment {
  let progress = options.progress ?? {};

  if (options.completeFirst) {
    const { course, count } = options.completeFirst;
    const lessons = course.modules.flatMap((module) => module.lessons).slice(0, count);
    progress = Object.fromEntries(lessons.map((lesson) => [lesson.id, lesson.durationSeconds]));
  }

  return {
    courseId: options.courseId,
    learnerId: options.learnerId ?? "aluno-1",
    enrolledBy: options.enrolledBy ?? "self",
    /* O atalho recebe segundos assistidos e monta o progresso completo.
       Consumo e conclusão são campos separados desde a 006 (guia §5), mas para
       a fixture continuar dizendo "assistiu N segundos" e significar o que
       significava, a conclusão automática é aplicada aqui — é o que
       `resolveCompletion` faria no caminho real ao cruzar o limiar.

       Um teste que precise do caso interessante — muito assistido e NÃO
       concluído, ou concluído sem vídeo — monta o progresso à mão. */
    progress: Object.fromEntries(
      Object.entries(progress).map(([lessonId, watchedSeconds]) => {
        const duracao = duracaoDaAula(options, lessonId);
        const concluiu = duracao > 0 && watchedSeconds / duracao >= COMPLETION_THRESHOLD;

        return [
          lessonId,
          {
            lessonId,
            watchedSeconds,
            lastPositionSeconds: watchedSeconds,
            ...(concluiu
              ? { completedAt: DATA_FIXA_DE_CONCLUSAO, completionSource: "auto" as const }
              : {}),
          },
        ];
      }),
    ),
    ...(options.saved === undefined ? {} : { saved: options.saved }),
    ...(options.lastLessonId === undefined ? {} : { lastLessonId: options.lastLessonId }),
  };
}

export interface UserOptions {
  id?: string;
  role?: User["role"];
  fullName?: string;
  project?: string;
  region?: string;
  status?: User["status"];
  email?: string;
  lastAccessAt?: string;
}

export function makeUser(options: UserOptions = {}): User {
  const id = options.id ?? nextId("u");
  const fullName = options.fullName ?? `Pessoa ${id}`;

  return {
    id,
    role: options.role ?? "learner",
    firstName: fullName.split(" ")[0] ?? fullName,
    fullName,
    ...(options.project === undefined ? {} : { project: options.project }),
    ...(options.region === undefined ? {} : { region: options.region }),
    ...(options.status === undefined ? {} : { status: options.status }),
    ...(options.email === undefined ? {} : { email: options.email }),
    ...(options.lastAccessAt === undefined ? {} : { lastAccessAt: options.lastAccessAt }),
  };
}
