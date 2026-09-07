/**
 * O que a aba "Sobre" tem para mostrar.
 *
 * Os campos já eram coletados no editor e gravados no banco, e nenhum deles
 * chegava ao aluno: a aba exibia apenas o resumo de uma linha. Quem preenchia
 * objetivos e público-alvo não via o resultado em lugar nenhum.
 *
 * Esta função reúne o que existe e informa o que falta, para a tela conseguir
 * pedir ao instrutor o que está em branco em vez de simplesmente omitir.
 */

import type { Course, CourseLevel } from "./types.ts";

export interface AboutSection {
  /** Uma linha por objetivo, já sem vazios e sem marcador manual. */
  objetivos: string[];
  publico: string | null;
  nivel: CourseLevel | null;
  /** Carga DECLARADA, em minutos. Não é a soma dos vídeos. */
  cargaMinutos: number | null;
  idioma: string | null;
  codigo: string | null;
  /**
   * Campos vazios, em nome legível.
   *
   * O instrutor vê esta lista na própria tela do curso dele; o aluno, não.
   * Sem ela, o editor não tem como saber que a aba está pobre.
   */
  faltando: string[];
}

/** Rótulo de nível em português, para a tela não repetir o mapa. */
export const ROTULO_DO_NIVEL: Record<CourseLevel, string> = {
  basic: "Básico",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

/**
 * Divide o campo de objetivos em linhas.
 *
 * O editor grava texto livre, e quem digita costuma abrir cada linha com
 * hífen ou bolinha. Repassar isso à tela produziria dois marcadores, o do
 * texto e o da lista.
 */
export function objetivosDe(texto: string | undefined): string[] {
  if (!texto) return [];

  return texto
    .split(/\r?\n/)
    .map((linha) => linha.replace(/^\s*[-–—*•]\s*/, "").trim())
    .filter((linha) => linha.length > 0);
}

/** Idioma em nome, não em código. "pt-BR" não diz nada a quem lê a página. */
export function nomeDoIdioma(tag: string | undefined): string | null {
  if (!tag) return null;

  const conhecidos: Record<string, string> = {
    "pt-br": "Português (Brasil)",
    pt: "Português",
    "en-us": "Inglês (Estados Unidos)",
    en: "Inglês",
    es: "Espanhol",
  };

  return conhecidos[tag.toLowerCase()] ?? tag;
}

export function aboutSection(course: Course): AboutSection {
  const objetivos = objetivosDe(course.objectives);
  const publico = course.audience?.trim() || null;
  const faltando: string[] = [];

  if (objetivos.length === 0) faltando.push("objetivos de aprendizagem");
  if (!publico) faltando.push("público-alvo");
  if (!course.workloadMinutes) faltando.push("carga horária");
  if (!course.level) faltando.push("nível");

  return {
    objetivos,
    publico,
    nivel: course.level ?? null,
    cargaMinutos: course.workloadMinutes ?? null,
    idioma: nomeDoIdioma(course.language),
    codigo: course.code?.trim() || null,
    faltando,
  };
}

/**
 * A carga declarada, escrita como se lê num certificado.
 *
 * Horas cheias saem sem os minutos: "4 horas", e não "4h 0min", que é como um
 * formatador de duração de vídeo escreveria.
 */
export function cargaFormatada(minutos: number | null): string | null {
  if (!minutos || minutos <= 0) return null;

  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;

  if (horas === 0) return `${resto} minutos`;
  if (resto === 0) return horas === 1 ? "1 hora" : `${horas} horas`;

  return `${horas}h${String(resto).padStart(2, "0")}`;
}
