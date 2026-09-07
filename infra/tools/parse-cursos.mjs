/**
 * Lê os cursos reais exportados do Forms e produz o conteúdo estruturado.
 *
 * ENTRADA: `com-prova/<codigo>/{video.mp4, prova.txt}` e
 * `sem-prova/<nome>/video.mp4`. É o formato em que o material chega, e não vale
 * pedir outro: o trabalho de converter é este arquivo, e ele roda uma vez.
 *
 * SAÍDA: `infra/db/content/cursos.json` — só texto, alguns kilobytes. Os
 * vídeos NÃO entram no repositório: são meio gigabyte de MP4, e o Git guarda
 * toda versão de todo binário para sempre. Eles vão para o storage, e o que
 * fica aqui é a chave que os aponta.
 *
 * O QUE É DESCARTADO, E POR QUÊ
 *
 * Os quatro primeiros itens de cada formulário — nome, função, departamento,
 * empresa — e o "confirmo que assisti" são artefato do Microsoft Forms. Aqui a
 * identidade vem do login, e o "assisti" é a trava do player, que mede em vez
 * de perguntar. Importá-los criaria perguntas cuja resposta o sistema já sabe.
 *
 * Uso: node infra/tools/parse-cursos.mjs <pasta>
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { duracaoDeMp4 } from "./duracao-mp4.mjs";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const origem = process.argv[2];

if (!origem) {
  console.error("uso: node infra/tools/parse-cursos.mjs <pasta com CURSOS>");
  process.exit(2);
}

/** Item numerado do formulário: `6.Enunciado...` */
const ITEM = /^(\d+)\.(.*)$/;
/** A linha de pontuação que marca um item como QUESTÃO de verdade. */
const PONTOS = /^\((\d+) Pontos?\)$/;

/**
 * Texto comparável: sem acento, sem caixa, sem pontuação de ponta.
 *
 * O gabarito foi digitado à mão e as alternativas vieram de exportação: "Todas
 * as Alternativas." e "Todas as alternativas;" são a MESMA resposta, e comparar
 * literalmente não casaria nenhuma das duas.
 */
const comparavel = (texto) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.;:,]+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * O gabarito, escrito no fim do arquivo.
 *
 * A MARCAÇÃO VARIA entre os arquivos — `respostas:`, `resposta:`,
 * `respostas corretas`, e num deles nenhuma. O que não varia é a linha
 * "Confirmo que eu assisti.", que abre a lista em todos os cinco. Ela também
 * aparece antes, como alternativa do item de confirmação, então vale a ÚLTIMA
 * ocorrência.
 *
 * Da linha seguinte em diante é uma resposta por questão pontuada, na ordem.
 */
function lerGabarito(linhas) {
  const marca = comparavel("Confirmo que eu assisti");

  let inicio = -1;
  linhas.forEach((linha, i) => {
    if (comparavel(linha) === marca) inicio = i;
  });

  if (inicio < 0) return [];

  return linhas
    .slice(inicio + 1)
    .map((l) => l.trim())
    .filter(Boolean)
    /* Um dos arquivos traz linhas de preenchimento antes das respostas
       ("Nome completo: seu nome completo"). Não são gabarito de questão. */
    .filter((l) => !/^(nome completo|fun[çc][ãa]o|departamento|ger[êe]ncia|empresa)\s*:/i.test(l));
}

/**
 * Separa as questões pontuadas do resto.
 *
 * A pontuação é o que distingue: o Forms só a escreve em item que vale nota.
 * Filtrar por texto ("Nome completo") funcionaria nestes cinco arquivos e
 * quebraria no sexto.
 */
function lerProva(texto) {
  const linhas = texto.split(/\r?\n/);
  const gabarito = lerGabarito(linhas);

  const cabecalho = {
    titulo: (linhas[0] ?? "").trim(),
    procedimento: (linhas.find((l) => l.startsWith("Procedimento:")) ?? "")
      .replace("Procedimento:", "")
      .trim(),
    ministrante: (linhas.find((l) => l.startsWith("Ministrante:")) ?? "")
      .replace("Ministrante:", "")
      .trim(),
  };

  const questoes = [];
  let atual = null;

  for (const bruta of linhas) {
    const linha = bruta.trim();
    if (!linha) continue;

    const item = ITEM.exec(linha);

    if (item) {
      /* Item novo fecha o anterior. Só entra na lista quem tiver pontuação —
         a checagem acontece no fechamento, porque a linha de pontos vem
         DEPOIS do enunciado. */
      if (atual?.pontos) questoes.push(atual);
      atual = { enunciado: item[2].trim(), pontos: 0, alternativas: [] };
      continue;
    }

    if (!atual) continue;

    const pontos = PONTOS.exec(linha);
    if (pontos) {
      atual.pontos = Number(pontos[1]);
      continue;
    }

    if (atual.pontos > 0) {
      const texto = linha.replace(/;\s*$/, "").trim();
      const anterior = atual.alternativas[atual.alternativas.length - 1];

      /* ALTERNATIVA QUEBRADA EM DUAS LINHAS.

         A exportação parte texto longo, e a continuação virava uma alternativa
         própria: "Quem são as partes interessadas" ficou com "funcionários,
         superficiários, parceiros de negócios, clientes, comunidades," e
         "investidores, poder Público etc." como opções separadas — e o gabarito
         não casava com nenhuma das duas, porque ele traz a frase inteira.

         A vírgula no fim é o sinal: alternativa completa não termina em
         vírgula, continuação sim. Emendar por comprimento ou por letra
         minúscula erraria em texto que legitimamente começa assim. */
      if (anterior !== undefined && /,$/.test(anterior)) {
        atual.alternativas[atual.alternativas.length - 1] = `${anterior} ${texto}`;
      } else {
        atual.alternativas.push(texto);
      }
    }
  }

  if (atual?.pontos) questoes.push(atual);

  /* O gabarito vem DEPOIS das questões no arquivo, e sem marcador em alguns
     deles — então as respostas foram lidas como alternativas do último item.
     Aqui elas são cortadas: o que aparece a partir da primeira resposta não é
     alternativa. Sem isto, a última questão ganharia o gabarito inteiro como
     opções, e uma delas seria a correta duas vezes. */
  const ultima = questoes[questoes.length - 1];
  if (ultima && gabarito.length > 0) {
    const primeira = comparavel(gabarito[0]);
    const corte = ultima.alternativas.findIndex((a, i) => i > 0 && comparavel(a) === primeira);
    if (corte > 0) ultima.alternativas = ultima.alternativas.slice(0, corte);
  }

  return { ...cabecalho, questoes, gabarito };
}

const slugify = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Títulos e resumos escritos por quem conhece o material.
 *
 * DUAS RAZÕES, e as duas vieram do próprio material:
 *
 *   A pasta é um código de procedimento ou um apelido de arquivo — nem um nem
 *   outro diz nada a quem abre o catálogo.
 *
 *   1007 e 1022 COMPARTILHAM o formulário: os dois `prova.txt` são idênticos no
 *   cabeçalho, porque um documento cobre os dois procedimentos. Tirando o
 *   título dali, os cursos ficavam indistinguíveis no catálogo. A diferença —
 *   Unidade Central e Polo Atalaia — só existe no nome do vídeo.
 *
 * Fica no código, e não no JSON gerado, porque o JSON é SAÍDA: editá-lo lá
 * duraria até a próxima execução deste script. Aqui é entrada, e sobrevive.
 */
const TITULOS = {
  /* Os três abaixo vinham em CAIXA ALTA do formulário e destoavam no catálogo,
     ao lado dos outros quatro. Caixa alta é como o documento oficial escreve;
     não é como um catálogo se lê. As palavras são as mesmas. */
  "1001-PE-0003-BRA-I": "Plano de Resposta a Emergências Ambientais",
  "1001-PR-0006-BRA-I": "Gerenciamento de Riscos Sociais",
  "1014-PE-0004-BRA-I": "Requisitos Mínimos de Segurança para PT",

  "1007-PE-00022-BRA-I": "Plano de Resposta a Emergências: Unidade Central",
  "1022-PE-00022-BRA-I": "Plano de Resposta a Emergências: Polo Atalaia",
  myahgora: "Acesso ao My Ahgora",
  "consicencia-negra": "Campanha de Consciência Negra",
};

/**
 * O resumo de cada procedimento, com o código no fim.
 *
 * O texto do procedimento continua sendo a fonte: nenhuma palavra aqui foi
 * inventada, só saíram da caixa alta e o código deixou de abrir a frase. Ele
 * vinha colado na frente ("1014-PE-0004-BRA-I - REQUISITOS MÍNIMOS...") e era
 * a primeira coisa que o cartão dizia, antes do assunto.
 *
 * O CÓDIGO FICA, no fim. Ele é como este material é procurado por quem audita
 * treinamento obrigatório, e a coluna `courses.code` guarda o dado mas nenhuma
 * tela o mostra ainda — tirá-lo daqui o faria sumir de vez.
 *
 * 1007 e 1022 ganham resumos DIFERENTES pelo mesmo motivo dos títulos: o
 * formulário é um só para os dois polos, e o de origem descrevia ambos, o que
 * deixava dois cursos distintos com a mesma descrição.
 */
const RESUMOS = {
  "1001-PE-0003-BRA-I":
    "Resposta a emergências ambientais no ativo de produção da operação de " +
    "Unidade Central. Procedimento 1001-PE-0003-BRA-I.",
  "1001-PR-0006-BRA-I":
    "Gerenciamento de riscos sociais e relacionamento comunitário. " +
    "Procedimento 1001-PR-0006-BRA-I.",
  "1007-PE-00022-BRA-I":
    "Plano de resposta a emergências do polo de Unidade Central. " +
    "Procedimento 1007-PE-00022-BRA-I.",
  "1014-PE-0004-BRA-I":
    "Requisitos mínimos de segurança para Permissão para Trabalho. " +
    "Procedimento 1014-PE-0004-BRA-I.",
  "1022-PE-00022-BRA-I":
    "Plano de resposta a emergências do Polo Atalaia. " +
    "Procedimento 1022-PE-00022-BRA-I.",
  myahgora: "Como acessar o My Ahgora, registrar ponto e consultar seu espelho.",
  "consicencia-negra":
    "A campanha de Consciência Negra da Exemplo S.A.: o que é, por que existe e como participar.",
};

const cursos = [];
const semGabarito = [];
const naoCasaram = [];

/** Percorre `<pasta>/<codigo>/` — a mesma forma nas duas metades do material. */
function lerPasta(base, comProva) {
  if (!existsSync(base)) return;

  for (const codigo of readdirSync(base)) {
    const pasta = join(base, codigo);
    if (!statSync(pasta).isDirectory()) continue;

    const arquivos = readdirSync(pasta);

    /* TODOS os vídeos da pasta, em ordem. Cada um vira uma aula.
       A ordenação é numérica e não alfabética: com dez partes ou mais, a
       alfabética colocaria "parte10" antes de "parte02". */
    const videos = arquivos
      .filter((f) => f.toLowerCase().endsWith(".mp4"))
      .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));

    if (videos.length === 0) {
      console.warn(`  aviso: ${codigo} não tem vídeo, pulado`);
      continue;
    }

    const provaArquivo = comProva
      ? arquivos.find((f) => f.toLowerCase() === "prova.txt")
      : undefined;

    const prova = provaArquivo
      ? lerProva(readFileSync(join(pasta, provaArquivo), "utf8"))
      : null;

    cursos.push({
      codigo,
      slug: slugify(codigo),
      titulo: TITULOS[codigo] ?? prova?.titulo ?? codigo,
      /* O texto do procedimento vira o resumo: é a descrição oficial do que o
         curso cobre, e escrever outra seria inventar. */
      resumo: RESUMOS[codigo] ?? prova?.procedimento ?? "",
      ministrante: prova?.ministrante || null,
      /* Uma entrada por arquivo. O título da aula sai do nome da parte
         quando há mais de uma, e do título do curso quando é uma só: "Aula 1"
         num curso de aula única seria numeração sem função. */
      aulas: videos.map((video, indice) => ({
        arquivo: video,
        titulo:
          videos.length === 1
            ? TITULOS[codigo] ?? prova?.titulo ?? codigo
            : `Parte ${indice + 1} de ${videos.length}`,
        pasta: `${basename(base)}/${codigo}`,
        /* A chave no storage. Prefixo por código para o objeto ser localizável
           sem consultar o banco. */
        mediaKey: `cursos/${slugify(codigo)}/${slugify(basename(video, ".mp4"))}.mp4`,
        bytes: statSync(join(pasta, video)).size,
        /* Lida do cabeçalho do próprio arquivo. Sem ela a aula entra com zero,
           e a trava do player deixa passar: `podeConcluirVideo` libera quando
           a duração é desconhecida, para não trancar quem não tem culpa por um
           campo vazio. Medir é o que faz a trava valer neste material. */
        duracaoSegundos: duracaoDeMp4(join(pasta, video)),
      })),
      prova: prova
        ? {
            notaMinima: 8,
            questoes: prova.questoes.map((q, i) => {
              /* A resposta escrita no fim do arquivo, casada com a alternativa
                 pelo TEXTO — não pela posição, porque o gabarito foi digitado à
                 mão e a ordem das alternativas veio da exportação.

                 Sem casar, NÃO INVENTA: fica sem correta e o script avisa. Um
                 gabarito chutado em treinamento de segurança reprova quem sabe
                 e aprova quem não sabe. */
              const resposta = prova.gabarito[i];
              const indice = resposta
                ? q.alternativas.findIndex((a) => comparavel(a) === comparavel(resposta))
                : -1;

              if (!resposta) semGabarito.push(`${codigo} q${i + 1}`);
              else if (indice < 0) naoCasaram.push(`${codigo} q${i + 1}: "${resposta}"`);

              return {
                enunciado: q.enunciado,
                pontos: q.pontos,
                alternativas: q.alternativas,
                corretaIndice: indice,
              };
            }),
          }
        : null,
    });
  }
}

lerPasta(join(origem, "com-prova"), true);
lerPasta(join(origem, "sem-prova"), false);

const saida = join(raiz, "infra", "db", "content", "cursos.json");
writeFileSync(saida, `${JSON.stringify({ cursos }, null, 2)}\n`, "utf8");

const comQuestoes = cursos.filter((c) => c.prova);
const totalQuestoes = comQuestoes.reduce((s, c) => s + c.prova.questoes.length, 0);
const todasAsAulas = cursos.flatMap((c) => c.aulas);
const totalBytes = todasAsAulas.reduce((s, a) => s + a.bytes, 0);

console.log(`\n${saida}`);
console.log(
  `  ${cursos.length} cursos, ${todasAsAulas.length} aulas, ` +
    `${comQuestoes.length} com prova, ${totalQuestoes} questões`,
);
console.log(`  vídeos: ${(totalBytes / 1048576).toFixed(0)} MB, vão para o storage e não para o Git`);

/* O teto por aula precisa bater com packages/core/src/courses/duracao-da-aula.ts.
   Repetido aqui porque este script roda sobre o material de origem, antes de
   qualquer coisa existir no banco, e não importa do pacote. */
const TETO_DA_AULA = 15 * 60 + 30;
const longas = todasAsAulas.filter((a) => a.duracaoSegundos > TETO_DA_AULA);
if (longas.length > 0) {
  console.log(`  ATENÇÃO: ${longas.length} aula(s) passam de 15 minutos.`);
  console.log("           Rode infra/tools/cortar-cursos.mjs sobre o material antes.");
  for (const a of longas) console.log(`    ${Math.round(a.duracaoSegundos / 60)}min  ${a.arquivo}`);
}

const semDuracao = todasAsAulas.filter((a) => !a.duracaoSegundos);
if (semDuracao.length > 0) {
  console.log(`  ATENÇÃO: ${semDuracao.length} vídeo(s) sem duração legível. A trava do player`);
  console.log("           não vale neles, porque ela precisa saber quanto a aula dura.");
  for (const a of semDuracao) console.log(`    ${a.arquivo}`);
}

for (const curso of comQuestoes) {
  const soma = curso.prova.questoes.reduce((s, q) => s + q.pontos, 0);
  const sem = curso.prova.questoes.filter((q) => q.corretaIndice < 0).length;
  const alerta = [
    soma === 10 ? "" : `soma ${soma}, esperado 10`,
    sem === 0 ? "" : `${sem} sem correta`,
  ]
    .filter(Boolean)
    .join(" · ");
  console.log(
    `    ${curso.codigo}: ${curso.prova.questoes.length} questões` +
      (alerta ? `   ATENÇÃO: ${alerta}` : ""),
  );
}

const semCorreta = semGabarito.length + naoCasaram.length;

if (semCorreta === 0) {
  console.log(`\n  Gabarito completo: as ${totalQuestoes} questões têm resposta correta.\n`);
} else {
  console.log(`\n  ${semCorreta} de ${totalQuestoes} questões SEM resposta correta:`);
  for (const item of semGabarito) console.log(`    sem gabarito:  ${item}`);
  for (const item of naoCasaram) console.log(`    não casou:     ${item}`);
  console.log(
    "\n  Elas entram sem correta — nenhuma resposta marcaria ponto. Prefiro isso a\n" +
      "  chutar: em treinamento de segurança, gabarito errado reprova quem sabe.\n",
  );
}
