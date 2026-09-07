/**
 * Aula de conteúdo — documento, slides, imagem, áudio, texto, link.
 *
 * O guia §4 pede que a LMS aceite "muito mais que vídeo". Aqui ficam as regras
 * do que NÃO é vídeo: como o arquivo é classificado e quando a aula pode ser
 * dada por concluída.
 *
 * O critério de conclusão é o ponto. Vídeo fecha com 90% assistido; documento
 * não tem equivalente óbvio, e um botão que qualquer um clica sem abrir o
 * arquivo não mede nada. Há cursos que existem justamente para a pessoa passar
 * pelo material inteiro — e é isso que `pagesSeen` verifica.
 */

export type ContentKind =
  | "video"
  | "pdf"
  | "slides"
  | "document"
  | "spreadsheet"
  | "image"
  | "audio"
  | "text"
  | "link"
  | "scorm"
  /* Conteúdo interativo (F6-05): vídeo com perguntas, imagem com pontos,
     cartões. O player vive em `lesson/interactive-player.tsx`. */
  | "interactive";

export const KIND_LABEL: Record<ContentKind, string> = {
  video: "Vídeo",
  pdf: "PDF",
  slides: "Apresentação",
  document: "Documento",
  spreadsheet: "Planilha",
  image: "Imagem",
  audio: "Áudio",
  text: "Texto",
  link: "Link externo",
  scorm: "SCORM",
  interactive: "Conteúdo interativo",
};

/** Os tipos que abrem dentro da página, sem baixar. */
export const KINDS_EMBEDDABLE: ContentKind[] = ["pdf", "image", "audio", "video", "text"];

const EXTENSOES: Record<string, ContentKind> = {
  pdf: "pdf",
  ppt: "slides",
  pptx: "slides",
  odp: "slides",
  doc: "document",
  docx: "document",
  odt: "document",
  rtf: "document",
  txt: "document",
  xls: "spreadsheet",
  xlsx: "spreadsheet",
  ods: "spreadsheet",
  csv: "spreadsheet",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  mp3: "audio",
  wav: "audio",
  m4a: "audio",
  ogg: "audio",
  mp4: "video",
  webm: "video",
  mov: "video",
};

/**
 * O tipo, a partir do nome do arquivo.
 *
 * Extensão desconhecida vira `document`: melhor oferecer download que recusar o
 * arquivo do instrutor por não reconhecê-lo.
 */
export function contentKindOf(filename: string): ContentKind {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return EXTENSOES[ext] ?? "document";
}

export interface ContentLesson {
  kind: ContentKind;
  /** Páginas do documento. Ausente quando a contagem não foi possível. */
  pageCount?: number;
  /** Segundos mínimos na aula antes de concluir. */
  minSeconds?: number;
}

export interface ContentProgress {
  pagesSeen: number[];
  seconds: number;
}

export type ContentRefusal = "pages_pending" | "time_pending";

export type ContentDecision =
  | { allow: true }
  | { allow: false; reason: ContentRefusal; remaining: number };

/**
 * Se a aula pode ser marcada como concluída.
 *
 * As páginas são cobradas ANTES do tempo: quem não leu precisa saber que falta
 * ler, não que falta esperar.
 *
 * Documento sem contagem de páginas não trava ninguém. Um PDF cuja contagem
 * falhou no envio deixaria a aula impossível de concluir para sempre — e o erro
 * seria do sistema, não de quem está lendo.
 */
export function canCompleteContent(
  lesson: ContentLesson,
  progress: ContentProgress,
): ContentDecision {
  if (lesson.pageCount && lesson.pageCount > 0) {
    /* Só páginas dentro do documento contam: o cliente pode mandar qualquer
       número, e 99 numa aula de 5 páginas não pode fazer a conta fechar. */
    const validas = new Set(
      progress.pagesSeen.filter((p) => Number.isInteger(p) && p >= 1 && p <= lesson.pageCount!),
    );

    if (validas.size < lesson.pageCount) {
      return {
        allow: false,
        reason: "pages_pending",
        remaining: lesson.pageCount - validas.size,
      };
    }
  }

  if (lesson.minSeconds && progress.seconds < lesson.minSeconds) {
    return {
      allow: false,
      reason: "time_pending",
      remaining: lesson.minSeconds - progress.seconds,
    };
  }

  return { allow: true };
}

/**
 * Junta as páginas já vistas com as novas.
 *
 * Ordenado e sem duplicata: a lista vai para a tela, e desordenada confundiria
 * quem confere o que já leu.
 */
export function mergePagesSeen(atuais: number[], novas: number[]): number[] {
  const todas = new Set<number>();

  for (const p of [...atuais, ...novas]) {
    if (Number.isInteger(p) && p >= 1) todas.add(p);
  }

  return [...todas].sort((a, b) => a - b);
}

/**
 * Percentual lido.
 *
 * `null` sem contagem de páginas: a barra some, em vez de mostrar 0% para
 * sempre num documento que a pessoa já leu inteiro.
 */
export function readingProgress(pagesSeen: number[], pageCount: number | undefined): number | null {
  if (!pageCount || pageCount <= 0) return null;

  const validas = new Set(pagesSeen.filter((p) => Number.isInteger(p) && p >= 1 && p <= pageCount));
  return Math.min(100, Math.round((validas.size / pageCount) * 100));
}
