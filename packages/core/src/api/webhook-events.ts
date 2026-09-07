/**
 * Os eventos que um webhook pode assinar — F5-02.
 *
 * Mora no core, e não junto do disparador, porque a TELA precisa listá-los para
 * quem cadastra um webhook. O disparador é backend (usa `node:crypto` e o
 * banco); uma tela que o importasse arrastaria o banco para o navegador.
 */

export const WEBHOOK_EVENTS = [
  "enrollment.created",
  "lesson.completed",
  "course.completed",
  "quiz.submitted",
  "grade.posted",
  "certificate.issued",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** O que cada evento significa, para a tela explicar sem jargão. */
export const WEBHOOK_EVENT_LABEL: Record<WebhookEvent, string> = {
  "enrollment.created": "Alguém foi matriculado num curso",
  "lesson.completed": "Uma aula foi concluída",
  "course.completed": "Um curso foi concluído",
  "quiz.submitted": "Uma prova foi enviada",
  "grade.posted": "Uma nota foi lançada",
  "certificate.issued": "Um certificado foi emitido",
};
