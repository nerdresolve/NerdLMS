import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
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
 * renderização das páginas para todo mundo (DEC-009, ISSUE-024).
 *
 * A URL expira: enquanto ela vale, quem a tiver acessa o arquivo, e é por isso
 * que o TTL é curto e a emissão exige matrícula, checada por quem chama.
 */

const UPLOAD_TTL_SECONDS = 15 * 60;
const DOWNLOAD_TTL_SECONDS = 60 * 60;

/* Um cliente por endereço público. A assinatura do S3 cobre o host, então
   cada origem precisa da sua — um cache único devolveria a URL assinada para o
   endereço de outra pessoa. */
const clientesPublicos = new Map<string, S3Client>();
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
 * `/lms-media/*` ao storage sem reescrever caminho nem host — o que chega ao
 * MinIO é exatamente o que foi assinado.
 *
 * A ORIGEM VEM DA REQUISIÇÃO, e a variável de ambiente é só a rede de
 * segurança. Antes ela era a única fonte, com padrão `https://localhost:8444`,
 * e nada publicava aquela porta: toda URL assinada apontava para um endereço
 * morto e NENHUM vídeo carregava — nem aqui nem na instalação publicada, que
 * atende em outro domínio e também caía no padrão.
 *
 * Assinar contra o endereço que o navegador acabou de usar acerta sozinho em
 * qualquer ambiente, e ainda mantém a URL na mesma origem do site — o que faz
 * o `media-src 'self'` da CSP aceitá-la sem exceção nenhuma.
 */
function publicClient(origem?: string): S3Client {
  /* Vazio conta como ausente. `??` só cai adiante em nulo, e o Compose passa
     a variável como string vazia quando ninguém a definiu — sem este cuidado,
     o cliente seria construído com endereço "" e toda URL sairia quebrada. */
  const configurado = process.env.STORAGE_PUBLIC_ENDPOINT?.trim();
  const endereco = origem || configurado || requireEnv("STORAGE_ENDPOINT");

  const existente = clientesPublicos.get(endereco);
  if (existente) return existente;

  const cliente = build(endereco);
  clientesPublicos.set(endereco, cliente);
  return cliente;
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
/**
 * Onde o arquivo vai parar dentro do bucket.
 *
 * "biblioteca" tem o TENANT como dono, e não um curso: o documento não
 * pertence a nenhum, e pendurá-lo num curso arbitrário faria a chave mentir
 * sobre a origem no dia em que alguém fosse auditar o storage.
 */
export type EscopoDeUpload = "aulas" | "materiais" | "biblioteca";

export function buildKey(scope: EscopoDeUpload, ownerId: string, filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "bin";
  return `${scope}/${ownerId}/${randomUUID()}.${ext}`;
}

/**
 * URL para o navegador enviar o arquivo direto ao storage.
 *
 * `origem` pelo mesmo motivo do download, e com a mesma consequência quando
 * falta: sem ela a URL era assinada contra `http://storage:9000`, nome que só
 * existe dentro da rede do Compose. O navegador não o resolve, e a CSP recusa
 * a origem antes mesmo da tentativa — anexar arquivo pela tela nunca chegava a
 * sair do lugar.
 */
export async function presignUpload(
  key: string,
  contentType: string,
  origem?: string,
): Promise<string> {
  return getSignedUrl(
    publicClient(origem),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
    {
      expiresIn: UPLOAD_TTL_SECONDS,
      /* O TIPO ENTRA NA ASSINATURA.

         Sem isto, `ContentType` era só uma sugestão: um PUT com
         `content-type: text/html` numa URL assinada como `image/png` era
         aceito, e o objeto ficava guardado como HTML. Assinado, o storage
         confere o cabeçalho contra a assinatura e recusa a divergência. */
      signableHeaders: new Set(["host", "content-type"]),
    },
  );
}

/**
 * URL temporária de leitura, emitida depois de confirmada a permissão.
 *
 * `origem` é o endereço que o navegador está usando — `https://exemplo.com`,
 * `http://localhost:8080`. Quem chama sabe disso; este módulo, não.
 *
 * O TIPO QUEM DIZ SOMOS NÓS, NÃO O ARQUIVO
 *
 * `ResponseContentType` manda o storage anunciar o tipo que NÓS escolhemos, e
 * não o que ficou gravado no objeto. Isso importa porque o conteúdo do arquivo
 * nunca passa por aqui — o navegador envia direto — e conferir assinatura de
 * bytes exigiria baixá-lo de volta para inspecionar.
 *
 * O ataque que isto fecha: um arquivo enviado como `.png` cujo conteúdo é
 * `<script>`, servido de volta como `text/html` a partir de `/lms-media/*` —
 * a MESMA origem da aplicação. O script rodava com a sessão de quem abrisse o
 * material, e quem podia enviar arquivo (qualquer instrutor) alcançaria assim
 * a sessão de um administrador.
 *
 * A extensão vem da CHAVE, que é nossa: `buildKey` a monta como
 * `escopo/dono/uuid.ext`, com a extensão já filtrada pela mesma lista de
 * `contentTypeOf`. O nome que a pessoa digitou não sobrevive a essa montagem.
 *
 * Fora da lista vira `application/octet-stream` e download forçado: um objeto
 * com extensão que não reconhecemos não deveria existir, e se existir o
 * navegador não vai renderizá-lo.
 */
export async function presignDownload(key: string, origem?: string): Promise<string> {
  const tipo = contentTypeOf(key);

  return getSignedUrl(
    publicClient(origem),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentType: tipo ?? "application/octet-stream",
      ...(tipo ? {} : { ResponseContentDisposition: "attachment" }),
    }),
    { expiresIn: DOWNLOAD_TTL_SECONDS },
  );
}

/**
 * Escreve um objeto direto, sem URL assinada.
 *
 * É EXCEÇÃO À REGRA DESTE ARQUIVO, e a exceção tem um caso só: o pacote SCORM.
 *
 * A regra existe porque um vídeo de duas horas atravessando o processo do Next
 * ocuparia o event loop e travaria a renderização para todo mundo (DEC-009). O
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
 * Traz o objeto para um arquivo em disco, EM FLUXO.
 *
 * Em fluxo e não em memória: um vídeo de aula tem centenas de megabytes, e
 * `await response.Body.transformToByteArray()` colocaria o arquivo inteiro no
 * heap do processo que atende as requisições de todo mundo.
 *
 * Só o corte de vídeo chama — é o único fluxo que precisa do conteúdo do lado
 * do servidor. Tudo o mais fala com o storage por URL assinada, e o arquivo não
 * atravessa o Next (DEC-009).
 */
export async function baixarObjeto(key: string, destino: string): Promise<void> {
  const resposta = await internalClient().send(
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
  );

  const corpo = resposta.Body;
  if (!corpo) throw new Error(`objeto sem conteúdo: ${key}`);

  await pipeline(corpo as NodeJS.ReadableStream, createWriteStream(destino));
}

/**
 * Apaga o arquivo do bucket.
 *
 * Faltava. `deleteMaterial` dizia no comentário que "o arquivo no storage é
 * removido pelo chamador", e nenhum chamador removia: desanexar um material
 * apagava a linha e deixava o arquivo no bucket para sempre. Cada troca de PDF
 * de aula somava mais um órfão que ninguém sabia existir.
 *
 * Pelo cliente INTERNO: é operação de servidor, não de navegador, e nenhuma
 * URL assinada de remoção precisa existir.
 *
 * NUNCA LANÇA — mesma regra de `recordAudit`, `notify` e `emitStatement`.
 *
 * É o que resolve o dilema que a rota de material documentava: remover antes
 * da linha arrisca o material reaparecer se a linha não sair; remover depois
 * arrisca a requisição falhar com a linha já apagada, e quem clicou ver erro
 * numa remoção que deu certo. Com a remoção incapaz de falhar, a ordem certa é
 * linha primeiro, arquivo depois, e o pior caso vira um objeto órfão que
 * ninguém alcança — que era o pior caso da versão anterior de qualquer jeito.
 *
 * Chave inexistente também não é erro: o S3 responde 204, e apagar duas vezes
 * tem o mesmo resultado de apagar uma.
 */
export async function removeObject(key: string): Promise<void> {
  try {
    await internalClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  } catch (erro) {
    console.error("[storage] falha ao remover objeto:", key, erro);
  }
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
