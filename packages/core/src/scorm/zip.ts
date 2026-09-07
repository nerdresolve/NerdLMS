/**
 * Leitura de arquivo ZIP, o suficiente para um pacote SCORM.
 *
 * POR QUE ESCREVER ISTO EM VEZ DE INSTALAR UMA BIBLIOTECA
 *
 * A mesma razão registrada no leitor do manifesto e no player de H5P: a
 * proposta exclui licença de terceiro do escopo. Um pacote SCORM usa duas
 * formas de armazenamento — sem compressão e `deflate` — e o `node:zlib`
 * resolve a segunda. O que sobra é ler a tabela central do ZIP, que são
 * quarenta linhas de deslocamento de bytes.
 *
 * O QUE ESTE LEITOR NÃO FAZ
 *
 * Não descomprime ZIP64 (arquivos acima de 4 GB), não lê entradas cifradas e
 * não trata os métodos exóticos (bzip2, LZMA). Os três são RECUSADOS por nome,
 * e nenhum aparece num pacote SCORM real — que é feito para ser lido por
 * qualquer LMS, e portanto usa o denominador comum.
 */

import { inflateRawSync } from "node:zlib";

/** Assinaturas que delimitam as estruturas do formato. */
const FIM_DO_DIRETORIO = 0x06054b50;
const ENTRADA_DO_DIRETORIO = 0x02014b50;

export interface ZipEntry {
  /** Caminho dentro do pacote, com barras normais. */
  path: string;
  /** Conteúdo já descomprimido. */
  data: Buffer;
}

export type ZipResult =
  | { ok: true; entries: ZipEntry[] }
  | { ok: false; error: string };

/**
 * Onde começa a tabela central.
 *
 * Ela fica no FIM do arquivo, e o registro que a localiza também — depois de
 * um comentário de tamanho variável. Por isso a busca é de trás para frente:
 * é a única forma de achar o início sem ler o arquivo inteiro adivinhando.
 */
function acharFimDoDiretorio(buf: Buffer): number {
  /* O comentário tem no máximo 65535 bytes, e o registro tem 22. Procurar
     além disso seria procurar num arquivo que não é ZIP. */
  const minimo = Math.max(0, buf.length - 65535 - 22);

  for (let i = buf.length - 22; i >= minimo; i -= 1) {
    if (buf.readUInt32LE(i) === FIM_DO_DIRETORIO) return i;
  }

  return -1;
}

/**
 * O caminho é seguro para virar chave no storage?
 *
 * Um `../` sairia do prefixo do pacote e escreveria em cima de outro; um
 * caminho absoluto apontaria para outro lugar. É a mesma conferência que o
 * leitor do manifesto faz no `href`, e pelo mesmo motivo: o pacote vem de
 * terceiro, e um ZIP malicioso é um vetor conhecido — chama-se "zip slip".
 */
function caminhoSeguro(nome: string): boolean {
  if (nome === "" || nome.endsWith("/")) return false;
  if (nome.startsWith("/") || nome.startsWith("\\")) return false;
  if (nome.includes("..")) return false;
  /* `C:\` e afins. */
  if (/^[a-z]:/i.test(nome)) return false;

  return true;
}

export interface ZipLimits {
  /** Teto do arquivo inteiro, já descomprimido. */
  maxTotalBytes: number;
  /** Teto de uma entrada isolada. */
  maxEntryBytes: number;
  /** Quantas entradas, no máximo. */
  maxEntries: number;
}

export const LIMITES_PADRAO: ZipLimits = {
  /* 200 MB descomprimidos. Um treinamento com vídeo embutido chega perto; o
     que passa disso costuma ser vídeo que deveria estar no storage, não
     dentro do pacote. */
  maxTotalBytes: 200 * 1024 * 1024,
  maxEntryBytes: 100 * 1024 * 1024,
  maxEntries: 2000,
};

/**
 * Lê as entradas de um ZIP.
 *
 * OS LIMITES NÃO SÃO ZELO EXCESSIVO. Um ZIP de 42 KB pode declarar 4,5
 * petabytes descomprimidos — é o "zip bomb", e sem teto o servidor tenta
 * alocar e morre. Por isso o tamanho declarado é conferido ANTES de
 * descomprimir, e o acumulado é conferido a cada entrada.
 */
export function readZip(buf: Buffer, limites: ZipLimits = LIMITES_PADRAO): ZipResult {
  const fim = acharFimDoDiretorio(buf);
  if (fim < 0) return { ok: false, error: "O arquivo não é um ZIP válido." };

  const total = buf.readUInt16LE(fim + 10);
  const inicioDoDiretorio = buf.readUInt32LE(fim + 16);

  if (total > limites.maxEntries) {
    return { ok: false, error: `O pacote tem mais de ${limites.maxEntries} arquivos.` };
  }

  /* ZIP64 marca 0xFFFF/0xFFFFFFFF nos campos que estouraram. Recusar por nome
     é melhor que ler os campos errados e produzir lixo. */
  if (total === 0xffff || inicioDoDiretorio === 0xffffffff) {
    return { ok: false, error: "Pacotes ZIP64 não são suportados." };
  }

  const entries: ZipEntry[] = [];
  let ponteiro = inicioDoDiretorio;
  let acumulado = 0;

  for (let i = 0; i < total; i += 1) {
    if (ponteiro + 46 > buf.length) {
      return { ok: false, error: "O índice do ZIP está truncado." };
    }
    if (buf.readUInt32LE(ponteiro) !== ENTRADA_DO_DIRETORIO) {
      return { ok: false, error: "O índice do ZIP está corrompido." };
    }

    const flags = buf.readUInt16LE(ponteiro + 8);
    const metodo = buf.readUInt16LE(ponteiro + 10);
    const tamanhoComprimido = buf.readUInt32LE(ponteiro + 20);
    const tamanhoOriginal = buf.readUInt32LE(ponteiro + 24);
    const tamanhoNome = buf.readUInt16LE(ponteiro + 28);
    const tamanhoExtra = buf.readUInt16LE(ponteiro + 30);
    const tamanhoComentario = buf.readUInt16LE(ponteiro + 32);
    const inicioLocal = buf.readUInt32LE(ponteiro + 42);

    const bruto = buf.toString("utf8", ponteiro + 46, ponteiro + 46 + tamanhoNome);
    ponteiro += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario;

    /* BARRA INVERTIDA VIRA BARRA NORMAL.

       O formato ZIP manda usar `/`, mas o `Compress-Archive` do Windows grava
       `assets\\app.js` — e foi assim que um pacote real chegou no teste. Sem
       esta linha, a chave no storage sairia com a barra invertida e o
       navegador procuraria `assets/app.js`, que não existiria. O conteúdo
       carregaria a página inicial e nenhum script. */
    const nome = bruto.replace(/\\/g, "/");

    /* Bit 0: entrada cifrada. O conteúdo viria embaralhado e o SCORM não
       rodaria — melhor dizer isso do que gravar lixo no storage. */
    if ((flags & 0x1) !== 0) {
      return { ok: false, error: "O pacote está protegido por senha." };
    }

    /* Pasta: entra no índice e não tem conteúdo. Não é erro, é ruído. */
    if (nome.endsWith("/")) continue;

    if (!caminhoSeguro(nome)) {
      /* O caminho vai para o nome, de propósito: quem empacotou precisa saber
         qual arquivo consertar. */
      return { ok: false, error: `Caminho inseguro no pacote: ${nome}` };
    }

    if (tamanhoOriginal > limites.maxEntryBytes) {
      return { ok: false, error: `Arquivo grande demais dentro do pacote: ${nome}` };
    }

    acumulado += tamanhoOriginal;
    if (acumulado > limites.maxTotalBytes) {
      /* A conferência é sobre o tamanho DECLARADO, antes de descomprimir: é o
         que impede o zip bomb de ser expandido para descobrir que era grande
         demais. */
      return { ok: false, error: "O pacote descomprimido passa do limite." };
    }

    const conteudo = lerEntrada(buf, inicioLocal, metodo, tamanhoComprimido, tamanhoOriginal);
    if (!conteudo.ok) return conteudo;

    entries.push({ path: nome, data: conteudo.data });
  }

  if (entries.length === 0) return { ok: false, error: "O pacote está vazio." };

  return { ok: true, entries };
}

/**
 * Lê uma entrada a partir do cabeçalho local.
 *
 * O cabeçalho local repete o nome e os campos extras, com tamanhos que podem
 * DIFERIR dos do índice central — e o conteúdo começa depois deles. Usar os
 * tamanhos do índice aqui é um erro clássico: funciona na maioria dos arquivos
 * e produz lixo naqueles em que os campos extras diferem.
 */
function lerEntrada(
  buf: Buffer,
  inicio: number,
  metodo: number,
  comprimido: number,
  original: number,
): { ok: true; data: Buffer } | { ok: false; error: string } {
  if (inicio + 30 > buf.length) {
    return { ok: false, error: "O pacote está truncado." };
  }

  const tamanhoNome = buf.readUInt16LE(inicio + 26);
  const tamanhoExtra = buf.readUInt16LE(inicio + 28);
  const dados = inicio + 30 + tamanhoNome + tamanhoExtra;

  if (dados + comprimido > buf.length) {
    return { ok: false, error: "O pacote está truncado." };
  }

  const bruto = buf.subarray(dados, dados + comprimido);

  /* 0 é "guardado"; 8 é `deflate`. São os dois que um pacote SCORM usa, porque
     ele precisa ser legível por qualquer LMS. */
  if (metodo === 0) return { ok: true, data: Buffer.from(bruto) };

  if (metodo !== 8) {
    return { ok: false, error: `Compressão não suportada no pacote (método ${metodo}).` };
  }

  try {
    const saida = inflateRawSync(bruto, { maxOutputLength: original + 1 });
    return { ok: true, data: saida };
  } catch {
    /* `maxOutputLength` estourado significa que o tamanho declarado no índice
       era mentira — a defesa contra o zip bomb que declara pouco e expande
       muito. Um arquivo corrompido cai aqui também, e a mensagem serve aos
       dois. */
    return { ok: false, error: "Não foi possível descomprimir o pacote." };
  }
}

/**
 * O `imsmanifest.xml`, esteja ele onde estiver.
 *
 * O padrão manda na raiz, e boa parte das ferramentas de autoria empacota uma
 * pasta a mais por fora — o arquivo acaba em `curso/imsmanifest.xml`. Recusar
 * por isso seria recusar pacote válido do Articulate e do iSpring, que é o que
 * a maioria dos clientes usa.
 */
export function acharManifesto(entries: ZipEntry[]): { entry: ZipEntry; prefix: string } | null {
  const candidatos = entries.filter((e) =>
    e.path.toLowerCase().endsWith("imsmanifest.xml"),
  );

  if (candidatos.length === 0) return null;

  /* O mais raso vence: um pacote pode trazer manifestos de sub-módulos, e o
     da raiz é o que descreve o conjunto. */
  const escolhido = candidatos.reduce((menor, atual) =>
    atual.path.split("/").length < menor.path.split("/").length ? atual : menor,
  );

  const barra = escolhido.path.lastIndexOf("/");
  const prefix = barra < 0 ? "" : escolhido.path.slice(0, barra + 1);

  return { entry: escolhido, prefix };
}
