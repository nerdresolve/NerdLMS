import { randomUUID } from "node:crypto";

import { parseManifest } from "@nerdlms/core/scorm/manifest.ts";
import { acharManifesto, readZip } from "@nerdlms/core/scorm/zip.ts";

import { putObject, scormKey } from "../storage/object-storage.ts";
import { createPackage } from "./scorm-repository.ts";

/**
 * Publicação de um pacote SCORM.
 *
 * O caminho inteiro: recebe o `.zip`, lê, confere, escreve cada arquivo no
 * storage e registra o pacote. É a peça que faltava — o player, o modelo de
 * dados e o leitor de manifesto já existiam, e ninguém conseguia subir um
 * pacote pela tela.
 *
 * NADA É GRAVADO ANTES DE TUDO SER CONFERIDO. O ZIP é lido inteiro na memória,
 * o manifesto é validado e o ponto de entrada é localizado ANTES do primeiro
 * `putObject`. Escrever primeiro e conferir depois deixaria arquivos órfãos no
 * storage cada vez que alguém subisse um pacote inválido — e não há quem os
 * limpe.
 */

/**
 * Tipo de conteúdo por extensão, para o que vive dentro de um pacote.
 *
 * Separado do catálogo de upload comum de propósito: aquele lista o que uma
 * PESSOA pode enviar como material, e `.js` não está lá por boa razão. Aqui a
 * lista é outra porque o conteúdo é um site — sem `text/html` e
 * `application/javascript` corretos, o navegador baixa em vez de executar, e o
 * curso não abre.
 */
const TIPOS_SCORM: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  mjs: "application/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  webm: "video/webm",
  ogg: "audio/ogg",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  eot: "application/vnd.ms-fontobject",
  pdf: "application/pdf",
};

function tipoDe(caminho: string): string {
  const ext = caminho.toLowerCase().split(".").pop() ?? "";
  /* O padrão é `octet-stream`: o navegador baixa em vez de interpretar. Para
     um arquivo de tipo desconhecido dentro do pacote, é o comportamento
     seguro — melhor não abrir que executar algo com o tipo errado. */
  return TIPOS_SCORM[ext] ?? "application/octet-stream";
}

export type UploadOutcome =
  | {
      status: 200;
      packageId: string;
      title: string | null;
      version: "1.2" | "2004";
      arquivos: number;
    }
  | { status: 400 | 413; error: string };

export interface UploadCommand {
  tenantId: string;
  lessonId: string;
  zip: Buffer;
}

export async function publicarPacoteScorm(command: UploadCommand): Promise<UploadOutcome> {
  const lido = readZip(command.zip);
  if (!lido.ok) return { status: 400, error: lido.error };

  const manifesto = acharManifesto(lido.entries);
  if (!manifesto) {
    return {
      status: 400,
      error: "O pacote não tem imsmanifest.xml, não parece um pacote SCORM.",
    };
  }

  const dados = parseManifest(manifesto.entry.data.toString("utf8"));
  if (!dados) {
    return { status: 400, error: "O imsmanifest.xml do pacote não pôde ser lido." };
  }

  /* O `entryPoint` vem relativo ao manifesto. Se ele estava numa subpasta, o
     ponto de entrada está na mesma — e sem juntar os dois o caminho apontaria
     para um arquivo que não existe no storage. */
  const entradaCompleta = `${manifesto.prefix}${dados.entryPoint}`;

  const existe = lido.entries.some((e) => e.path === entradaCompleta);
  if (!existe) {
    /* O caminho vai na mensagem: quem empacotou precisa saber que o manifesto
       aponta para um arquivo que não foi incluído. */
    return {
      status: 400,
      error: `O manifesto aponta para "${dados.entryPoint}", que não está no pacote.`,
    };
  }

  const packageId = randomUUID();

  /* O prefixo do pacote é REMOVIDO das chaves. O conteúdo referencia os
     próprios arquivos por caminho relativo ao manifesto, e manter a pasta
     externa faria cada referência interna errar por um nível. */
  const semPrefixo = (caminho: string): string =>
    manifesto.prefix && caminho.startsWith(manifesto.prefix)
      ? caminho.slice(manifesto.prefix.length)
      : caminho;

  for (const entrada of lido.entries) {
    const relativo = semPrefixo(entrada.path);
    await putObject(scormKey(packageId, relativo), entrada.data, tipoDe(relativo));
  }

  await createPackage({
    tenantId: command.tenantId,
    lessonId: command.lessonId,
    storagePrefix: `scorm/${packageId}/`,
    entryPoint: dados.entryPoint,
    version: dados.version,
    title: dados.title ?? null,
    masteryScore: dados.masteryScore ?? null,
    scaledPassingScore: dados.scaledPassingScore ?? null,
  });

  return {
    status: 200,
    packageId,
    title: dados.title ?? null,
    version: dados.version,
    arquivos: lido.entries.length,
  };
}
