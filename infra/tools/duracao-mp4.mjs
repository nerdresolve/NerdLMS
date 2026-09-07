import { openSync, readSync, closeSync, statSync } from "node:fs";

/**
 * A duração de um MP4, lida do próprio arquivo.
 *
 * POR QUE NÃO `ffprobe`
 *
 * Ele não está nesta máquina, e trazer o ffmpeg — dezenas de megabytes de
 * binário — para ler um número de quatro bytes seria desproporcional. A
 * informação está no cabeçalho do arquivo, e chegar até ela são trinta linhas.
 *
 * COMO O MP4 GUARDA ISSO
 *
 * O formato é uma árvore de "boxes": quatro bytes de tamanho, quatro de tipo, e
 * o conteúdo. A duração mora no `mvhd`, dentro do `moov` — dois campos, um
 * dizendo quantas unidades de tempo há por segundo (`timescale`) e outro
 * dizendo quantas unidades o filme dura.
 *
 * LÊ SÓ OS CABEÇALHOS, não o arquivo. Um vídeo de cem megabytes é percorrido
 * em alguns saltos: cada box diz o próprio tamanho, então dá para pular o
 * `mdat` — que é o vídeo em si e ocupa quase tudo — sem tocá-lo.
 *
 * O `moov` pode estar no FIM do arquivo, e frequentemente está: quem grava
 * escreve os dados primeiro e o índice depois. Por isso a varredura vai até o
 * fim em vez de desistir no primeiro box grande.
 */

/** Cabeçalho de um box: tamanho, tipo, e onde o conteúdo começa. */
function lerCabecalho(fd, posicao, limite) {
  if (posicao + 8 > limite) return null;

  const buf = Buffer.alloc(16);
  const lidos = readSync(fd, buf, 0, 16, posicao);
  if (lidos < 8) return null;

  let tamanho = buf.readUInt32BE(0);
  const tipo = buf.toString("latin1", 4, 8);
  let conteudo = posicao + 8;

  if (tamanho === 1) {
    /* Tamanho estendido de 64 bits. `readBigUInt64BE` porque um `mdat` de
       vídeo longo passa de 4 GB, e ler como 32 bits daria um salto curto que
       cairia no meio do dado. */
    if (lidos < 16) return null;
    tamanho = Number(buf.readBigUInt64BE(8));
    conteudo = posicao + 16;
  } else if (tamanho === 0) {
    /* Zero significa "vai até o fim do arquivo". */
    tamanho = limite - posicao;
  }

  if (tamanho < 8) return null;

  return { tipo, tamanho, conteudo, fim: posicao + tamanho };
}

/** Procura um box por tipo, entre duas posições. */
function procurar(fd, de, ate, tipo) {
  let posicao = de;

  while (posicao < ate) {
    const box = lerCabecalho(fd, posicao, ate);
    if (!box) return null;
    if (box.tipo === tipo) return box;
    posicao = box.fim;
  }

  return null;
}

/**
 * A duração somando os fragmentos, quando o cabeçalho não a declara.
 *
 * Último recurso, e o mais trabalhoso — mas EXATO, que é o que importa: a trava
 * do player exige 90% da aula, e um número aproximado deixaria a conclusão
 * cedo demais ou impossível.
 *
 * Cada `moof` traz um `traf` por faixa; dentro dele, `tfhd` pode declarar uma
 * duração padrão de amostra e `trun` lista as amostras — às vezes com duração
 * própria, às vezes contando com o padrão. Somar tudo dá o total em unidades da
 * faixa.
 *
 * SÓ A PRIMEIRA FAIXA. Vídeo e áudio têm a mesma duração e escalas de tempo
 * diferentes; somar as duas daria o dobro.
 */
function somarFragmentos(fd, tamanhoArquivo, moov) {
  const trak = procurar(fd, moov.conteudo, moov.fim, "trak");
  if (!trak) return null;

  const mdia = procurar(fd, trak.conteudo, trak.fim, "mdia");
  const mdhd = mdia ? procurar(fd, mdia.conteudo, mdia.fim, "mdhd") : null;
  if (!mdhd) return null;

  const cabecaMdhd = Buffer.alloc(24);
  readSync(fd, cabecaMdhd, 0, 24, mdhd.conteudo);
  const versaoMdhd = cabecaMdhd.readUInt8(0);
  const escalaFaixa =
    versaoMdhd === 1 ? cabecaMdhd.readUInt32BE(20) : cabecaMdhd.readUInt32BE(12);

  if (!escalaFaixa) return null;

  /* O `trex` guarda a duração padrão de amostra da faixa — usada quando nem o
     `tfhd` nem o `trun` a informam, que é o caso comum em vídeo de taxa fixa. */
  const mvex = procurar(fd, moov.conteudo, moov.fim, "mvex");
  const trex = mvex ? procurar(fd, mvex.conteudo, mvex.fim, "trex") : null;

  let padraoGlobal = 0;
  let idDaFaixa = 0;

  if (trex) {
    const b = Buffer.alloc(24);
    readSync(fd, b, 0, 24, trex.conteudo);
    idDaFaixa = b.readUInt32BE(4);
    padraoGlobal = b.readUInt32BE(12);
  }

  let total = 0;
  let posicao = 0;

  while (posicao < tamanhoArquivo) {
    const box = lerCabecalho(fd, posicao, tamanhoArquivo);
    if (!box) break;

    if (box.tipo === "moof") {
      const traf = procurar(fd, box.conteudo, box.fim, "traf");

      if (traf) {
        const tfhd = procurar(fd, traf.conteudo, traf.fim, "tfhd");
        let padrao = padraoGlobal;
        let daFaixaCerta = true;

        if (tfhd) {
          const b = Buffer.alloc(32);
          readSync(fd, b, 0, 32, tfhd.conteudo);
          const flags = b.readUInt32BE(0) & 0xffffff;
          daFaixaCerta = idDaFaixa === 0 || b.readUInt32BE(4) === idDaFaixa;

          /* Os campos do `tfhd` são opcionais e a presença de cada um é dita
             por um bit da bandeira. Ler por posição fixa daria lixo. */
          let off = 8;
          if (flags & 0x000001) off += 8; // base-data-offset
          if (flags & 0x000002) off += 4; // sample-description-index
          if (flags & 0x000008) {
            padrao = b.readUInt32BE(off);
            off += 4;
          }
        }

        const trun = daFaixaCerta ? procurar(fd, traf.conteudo, traf.fim, "trun") : null;

        if (trun) {
          const cabeca = Buffer.alloc(16);
          readSync(fd, cabeca, 0, 16, trun.conteudo);
          const flags = cabeca.readUInt32BE(0) & 0xffffff;
          const quantas = cabeca.readUInt32BE(4);

          if (flags & 0x000100) {
            /* Cada amostra traz a própria duração. É preciso percorrer. */
            let off = 8;
            if (flags & 0x000001) off += 4; // data-offset
            if (flags & 0x000004) off += 4; // first-sample-flags

            const tamanhoAmostra =
              (flags & 0x000100 ? 4 : 0) +
              (flags & 0x000200 ? 4 : 0) +
              (flags & 0x000400 ? 4 : 0) +
              (flags & 0x000800 ? 4 : 0);

            const corpo = Buffer.alloc(quantas * tamanhoAmostra);
            readSync(fd, corpo, 0, corpo.length, trun.conteudo + off);

            for (let i = 0; i < quantas; i += 1) {
              total += corpo.readUInt32BE(i * tamanhoAmostra);
            }
          } else {
            total += quantas * padrao;
          }
        }
      }
    }

    posicao = box.fim;
  }

  /* Para baixo, pelo mesmo motivo das outras duas leituras: a duração
     alimenta um teto, e um teto que arredonda para cima se estoura. */
  return total > 0 ? Math.floor(total / escalaFaixa) : null;
}

/**
 * Segundos, arredondados PARA BAIXO. `null` quando o arquivo não é um MP4
 * legível.
 *
 * Devolve nulo em vez de lançar, e nulo em vez de zero: quem chama precisa
 * distinguir "não consegui medir" de "dura zero segundo", porque as duas coisas
 * levam a decisões diferentes — uma pede atenção, a outra é um dado.
 */
export function duracaoDeMp4(caminho) {
  let fd;

  try {
    fd = openSync(caminho, "r");
    const tamanhoArquivo = statSync(caminho).size;

    const moov = procurar(fd, 0, tamanhoArquivo, "moov");
    if (!moov) return null;

    const mvhd = procurar(fd, moov.conteudo, moov.fim, "mvhd");
    if (!mvhd) return null;

    const buf = Buffer.alloc(32);
    readSync(fd, buf, 0, 32, mvhd.conteudo);

    /* Primeiro byte é a versão; ela decide se as datas e a duração ocupam
       quatro ou oito bytes, e portanto onde `timescale` começa. */
    const versao = buf.readUInt8(0);

    const timescale = versao === 1 ? buf.readUInt32BE(20) : buf.readUInt32BE(12);
    const duracao =
      versao === 1 ? Number(buf.readBigUInt64BE(24)) : buf.readUInt32BE(16);

    if (!timescale) return null;

    if (duracao > 0) /* PARA BAIXO, e não para o mais próximo.
       A duração alimenta um TETO de quinze minutos por aula. Arredondar para
       cima transformava um arquivo de 900,6s em 901 — quinze minutos e um
       segundo —, e uma regra de máximo que o próprio cálculo estoura não é
       uma regra. Um segundo a menos não muda nada para quem assiste. */
    return Math.floor(duracao / timescale);

    /* DURAÇÃO ZERO: o arquivo é FRAGMENTADO.
       
       Vídeo preparado para streaming vem em pares `moof`/`mdat`, e o cabeçalho
       do filme não sabe quanto o todo dura — cada pedaço só conhece a si mesmo.
       A duração total, quando declarada, fica no `mehd`, dentro do `mvex`.
       
       Sem esta queda, um dos sete cursos entrava com duração zero e a trava do
       player não valia nele — exatamente o defeito que medir veio corrigir. */
    const mvex = procurar(fd, moov.conteudo, moov.fim, "mvex");
    if (!mvex) return null;

    /* Caminho curto: o `mehd` declara a duração total. É OPCIONAL, e o arquivo
       que motivou tudo isto não o traz — por isso existe o caminho longo
       abaixo. */
    const mehd = procurar(fd, mvex.conteudo, mvex.fim, "mehd");
    if (mehd) {
      const cabecaMehd = Buffer.alloc(12);
      readSync(fd, cabecaMehd, 0, 12, mehd.conteudo);

      const versaoMehd = cabecaMehd.readUInt8(0);
      const declarada =
        versaoMehd === 1 ? Number(cabecaMehd.readBigUInt64BE(4)) : cabecaMehd.readUInt32BE(4);

      if (declarada > 0) return Math.floor(declarada / timescale);
    }

    return somarFragmentos(fd, tamanhoArquivo, moov);
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
