import { randomUUID } from "node:crypto";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Armazenamento de mídia e materiais.
 *
 * O MinIO fala o protocolo do S3, então o mesmo cliente serve para os dois: se
 * um dia isso migrar para S3 de verdade, muda a variável de ambiente e nada
 * mais.
 *
 * O arquivo NÃO passa pelo processo do Next em nenhuma direção. Subir e baixar
 * usam URL assinada, e o navegador fala direto com o storage — mandar um vídeo
 * de duas horas por dentro do Node ocuparia o event loop e travaria a
 * renderização das páginas para todo mundo.
 *
 * A URL expira: enquanto ela vale, quem a tiver acessa o arquivo, e é por isso
 * que o TTL é curto e a emissão exige matrícula, checada por quem chama.
 */

const UPLOAD_TTL_SECONDS = 15 * 60;
const DOWNLOAD_TTL_SECONDS = 60 * 60;

let cachedPublic: S3Client | null = null;
let cachedInternal: S3Client | null = null;

/**
 * Cliente usado só para ASSINAR — a aplicação nunca transfere o arquivo.
 *
 * `STORAGE_ENDPOINT` é `http://storage:9000`, nome que só existe dentro da
 * rede do Compose. A aplicação o resolve; o navegador, não. Como a assinatura
 * do S3 cobre o host, não dá para emitir a URL com um endereço e entregar
 * outro: o MinIO recusaria com SignatureDoesNotMatch.
 *
 * Então a URL é assinada já contra o endereço público, onde o proxy repassa
 * `/media-storage/*` ao storage removendo o prefixo — o que chega ao MinIO é
 * exatamente o que foi assinado.
 */
function publicClient(): S3Client {
  if (cachedPublic) return cachedPublic;
  cachedPublic = build(process.env.STORAGE_PUBLIC_ENDPOINT ?? requireEnv("STORAGE_ENDPOINT"));
  return cachedPublic;
}

/**
 * Cliente para o servidor FALAR com o storage, não para assinar URL.
 *
 * `STORAGE_ENDPOINT` é o nome interno do serviço (`http://storage:9000`), que
 * o navegador não resolve — e é exatamente por isso que ele serve aqui: quem
 * transfere é este processo, dentro da rede do Compose.
 *
 * Usar o cliente público daria `ECONNREFUSED`: o endereço externo não é
 * alcançável de dentro do contêiner. Foi o que aconteceu na primeira tentativa
 * de publicar um pacote SCORM.
 */
function internalClient(): S3Client {
  if (cachedInternal) return cachedInternal;
  cachedInternal = build(requireEnv("STORAGE_ENDPOINT"));
  return cachedInternal;
}

function build(endpoint: string): S3Client {
  return new S3Client({
    endpoint,
    /* O MinIO ignora a região, mas o SDK exige uma. */
    region: process.env.STORAGE_REGION ?? "us-east-1",
    /* Sem isto o SDK monta `http://bucket.storage:9000`, que não resolve
       dentro da rede do Compose: o host é o nome do serviço, não um domínio
       com subdomínio de bucket. */
    forcePathStyle: true,
    credentials: {
      accessKeyId: requireEnv("STORAGE_ACCESS_KEY"),
      secretAccessKey: requireEnv("STORAGE_SECRET_KEY"),
    },
  });
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Armazenamento exige ${name} definido no ambiente.`);
  return value;
}

function bucket(): string {
  return requireEnv("STORAGE_BUCKET");
}

/** Extensões aceitas por tipo de anexo, e o content-type de cada uma. */
const TIPOS: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export function contentTypeOf(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return TIPOS[ext] ?? null;
}

/**
 * Chave do objeto no bucket.
 *
 * O nome enviado pela pessoa entra só como sufixo legível, atrás de um UUID:
 * dois arquivos com o mesmo nome não se sobrescrevem, e um nome com `../` ou
 * caractere de controle não escapa do prefixo.
 */
export function buildKey(scope: "aulas" | "materiais", ownerId: string, filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "bin";
  return `${scope}/${ownerId}/${randomUUID()}.${ext}`;
}

/** URL para o navegador enviar o arquivo direto ao storage. */
export async function presignUpload(key: string, contentType: string): Promise<string> {
  return getSignedUrl(
    publicClient(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
    { expiresIn: UPLOAD_TTL_SECONDS },
  );
}

/** URL temporária de leitura, emitida depois de confirmada a permissão. */
export async function presignDownload(key: string): Promise<string> {
  return getSignedUrl(publicClient(), new GetObjectCommand({ Bucket: bucket(), Key: key }), {
    expiresIn: DOWNLOAD_TTL_SECONDS,
  });
}

/**
 * Escreve um objeto direto, sem URL assinada.
 *
 * É EXCEÇÃO À REGRA DESTE ARQUIVO, e a exceção tem um caso só: o pacote SCORM.
 *
 * A regra existe porque um vídeo de duas horas atravessando o processo do Next
 * ocuparia o event loop e travaria a renderização para todo mundo. O
 * pacote SCORM não escapa disso por ser especial — escapa porque não há
 * alternativa: ele chega como `.zip` e precisa virar dezenas de arquivos, e
 * descompactar é trabalho de servidor. A URL assinada resolveria o envio do
 * `.zip` e não resolveria o que vem depois.
 *
 * O que mantém a exceção contida:
 *
 *   - Só o upload de SCORM chama. Nenhum outro fluxo passa por aqui.
 *   - O tamanho é limitado na rota, ANTES de o arquivo ser lido na memória.
 *   - Roda uma vez por publicação, não por acesso de aluno.
 *
 * O restore de backup já passa pelo servidor pela mesma razão — processar
 * exige ter o conteúdo. Esta função torna o padrão explícito em vez de
 * repetido.
 */
export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await internalClient().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/**
 * A chave de um arquivo dentro de um pacote SCORM.
 *
 * O caminho de dentro do pacote é PRESERVADO: o conteúdo referencia os
 * próprios arquivos por caminho relativo — `assets/js/player.js` —, e
 * renomeá-los quebraria todas as referências internas de uma vez.
 *
 * Quem garante que o caminho é seguro é o leitor do ZIP, antes de chegar aqui.
 */
export function scormKey(packageId: string, caminhoInterno: string): string {
  return `scorm/${packageId}/${caminhoInterno}`;
}
