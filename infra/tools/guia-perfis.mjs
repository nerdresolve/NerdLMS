/**
 * O guia de perfis e acessos, em PDF, na identidade da Exemplo S.A..
 *
 * POR QUE UM PDF, E NÃO SÓ O MARKDOWN
 *
 * `docs/PERFIS-E-ACESSOS.md` é o mesmo conteúdo e continua sendo a fonte para
 * quem trabalha no código. Este arquivo existe para a outra situação: a mesa
 * de reunião, onde alguém quer folhear, anotar na margem e levar embora. Um
 * `.md` no GitHub não faz isso.
 *
 * POR QUE O GERADOR PRÓPRIO
 *
 * É o mesmo que emite o certificado — `@nerdlms/core/reports/pdf.ts`, escrito
 * no repositório, sem dependência. Usar uma biblioteca só para este documento
 * traria um pacote novo para a árvore inteira por causa de um arquivo que se
 * gera uma vez. E o gerador já sabe desenhar a faixa do mosaico e a logo, que
 * é justamente o que faz o documento parecer da empresa.
 *
 * Uso: node --experimental-strip-types infra/tools/guia-perfis.mjs
 * Sai em: docs/NerdResolve-Energy-Perfis-e-Acessos.pdf
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildPdfPages, rgb, approximateWidth } from "@nerdlms/core/reports/pdf.ts";
import { MOSAIC_SHAPES } from "@nerdlms/core/brand/mosaic.ts";
import { NERD_LOGO } from "@nerdlms/core/reports/logo.ts";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/* A4 RETRATO. O certificado é paisagem por convenção de diploma; documento de
   leitura é retrato, que é como a mão segura e a impressora entrega. */
const PAGINA = { width: 595, height: 842 };

/* As cores vêm do Design System, repetidas aqui porque o PDF não lê CSS. */
const BRAND = rgb("#6D28D9");
const BRAND_DEEP = rgb("#4C1D95");
const INK = rgb("#18191B");
const MUTED = rgb("#494C50");
const PAPER = rgb("#FFFFFF");
const LINHA = rgb("#D8DCE2");
const TILE_BLUE = rgb("#A855F7");
const TILE_NAVY = rgb("#1E0F45");
const TILE_SUN = rgb("#EC4899");
const TILE_LEAF = rgb("#818CF8");
const TILE_RING = rgb("#C084FC");
const FUNDO_SUAVE = rgb("#F4F6F9");
const NEGADO = rgb("#B3261E");

/* As chaves são as próprias variáveis do Design System, porque é assim que o
   grafismo declara o preenchimento de cada forma. Escrever "blue" aqui faria
   toda peça cair no padrão e a faixa sair navy chapada — que foi o que
   aconteceu na primeira tentativa. */
const CORES_DO_MOSAICO = {
  "var(--tile-navy)": TILE_NAVY,
  "var(--tile-blue)": TILE_BLUE,
  "var(--tile-sun)": TILE_SUN,
  "var(--tile-leaf)": TILE_LEAF,
  "var(--tile-ring)": TILE_RING,
};

/* ------------------------------------------------------------------ */
/* Elementos de marca                                                  */
/* ------------------------------------------------------------------ */

/**
 * A faixa do mosaico no topo, igual à do certificado.
 *
 * O navy vai por baixo porque a grade do grafismo deixa vãos: sem ele a faixa
 * sairia com buracos brancos em vez de ser um bloco.
 */
/* `band` é a variante de uma linha só: 14 colunas por 1, a mesma do
   certificado. Com duas linhas, a altura da faixa cortaria a segunda ao meio e
   as formas sairiam decepadas.

   A ALTURA NÃO É LIVRE. As coordenadas do path vão de 0 a 14 no eixo x, então
   a escala que faz a faixa caber na largura da página é `largura / 14` — e
   essa mesma escala define a altura, porque a caixa tem uma unidade. Escolher
   a altura à mão esticaria as formas ou as deixaria para fora. */
const COLUNAS_DA_FAIXA = 14;
const ALTURA_DA_FAIXA = PAGINA.width / COLUNAS_DA_FAIXA;

function faixa() {
  const grade = MOSAIC_SHAPES.band;
  const y = PAGINA.height - ALTURA_DA_FAIXA;

  return [
    /* O navy vai por baixo porque a grade deixa vãos: sem ele a faixa sairia
       com buracos brancos em vez de ser um bloco. */
    { kind: "rect", x: 0, y, width: PAGINA.width, height: ALTURA_DA_FAIXA, color: BRAND_DEEP },
    ...grade.paths.map((path) => ({
      kind: "vector",
      d: path.d,
      x: 0,
      y,
      scale: ALTURA_DA_FAIXA,
      boxHeight: 1,
      color: CORES_DO_MOSAICO[path.fill] ?? BRAND_DEEP,
      /* O anel é círculo com furo; sem `evenOdd` ele fecha e vira disco. */
      evenOdd: true,
    })),
  ];
}

/** A logo, com proporção preservada. Esticar a marca seria erro de identidade. */
function logo(x, y, largura) {
  return {
    kind: "image",
    x,
    y,
    width: largura,
    height: largura * (NERD_LOGO.height / NERD_LOGO.width),
    pixelWidth: NERD_LOGO.width,
    pixelHeight: NERD_LOGO.height,
    data: NERD_LOGO.data,
  };
}

/* ------------------------------------------------------------------ */
/* Uma folha em construção                                             */
/* ------------------------------------------------------------------ */

const MARGEM = 56;
const LARGURA_UTIL = PAGINA.width - MARGEM * 2;

/**
 * Acumula texto e formas descendo a página.
 *
 * O gerador de PDF trabalha em coordenadas absolutas, com o zero embaixo. Sem
 * um cursor, cada linha do documento viraria um número escrito à mão, e mexer
 * num parágrafo obrigaria a recalcular todos os seguintes.
 */
class Folha {
  constructor() {
    this.texts = [];
    this.shapes = [{ kind: "rect", x: 0, y: 0, width: PAGINA.width, height: PAGINA.height, color: PAPER }];
    this.y = PAGINA.height - MARGEM;
  }

  espaco(pontos) {
    this.y -= pontos;
    return this;
  }

  linha(texto, { size = 10, font, color = INK, x = MARGEM, avanco } = {}) {
    this.y -= avanco ?? size + 4;
    this.texts.push({ text: texto, x, y: this.y, size, font, color });
    return this;
  }

  /**
   * Texto que quebra sozinho na largura disponível.
   *
   * A medida é aproximada — `approximateWidth` usa a média de 0,5em por
   * caractere, porque medir de verdade exigiria a tabela de métricas da
   * Helvetica. Erra alguns pontos, e alguns pontos numa margem de 56 não
   * aparecem.
   */
  paragrafo(texto, { size = 9.5, color = MUTED, x = MARGEM, largura = LARGURA_UTIL, font } = {}) {
    const palavras = texto.split(" ");
    let atual = "";

    for (const palavra of palavras) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (approximateWidth(tentativa, size, font === "Helvetica-Bold") > largura && atual) {
        this.linha(atual, { size, color, x, font, avanco: size + 4.5 });
        atual = palavra;
      } else {
        atual = tentativa;
      }
    }
    if (atual) this.linha(atual, { size, color, x, font, avanco: size + 4.5 });
    return this;
  }

  filete({ largura = LARGURA_UTIL, cor = LINHA, x = MARGEM } = {}) {
    this.y -= 10;
    this.shapes.push({ kind: "rect", x, y: this.y, width: largura, height: 0.7, color: cor });
    return this;
  }

  /** Título de seção: um filete curto azul e o texto logo abaixo. */
  secao(titulo) {
    this.espaco(14);
    this.shapes.push({ kind: "rect", x: MARGEM, y: this.y - 2, width: 26, height: 2, color: TILE_BLUE });
    this.linha(titulo, { size: 13, font: "Helvetica-Bold", color: BRAND_DEEP, avanco: 20 });
    return this;
  }

  /** Bloco com fundo, para destacar sem usar cor de texto. */
  caixa(altura) {
    this.shapes.push({
      kind: "rect",
      x: MARGEM,
      y: this.y - altura + 12,
      width: LARGURA_UTIL,
      height: altura,
      color: FUNDO_SUAVE,
    });
    return this;
  }

  rodape(numero, total) {
    this.shapes.push({ kind: "rect", x: MARGEM, y: 52, width: LARGURA_UTIL, height: 0.7, color: LINHA });
    this.texts.push({
      text: "Exemplo S.A. · Plataforma de Ensino · Perfis e Acessos",
      x: MARGEM,
      y: 38,
      size: 7.5,
      color: MUTED,
    });
    const pagina = `${numero} de ${total}`;
    this.texts.push({
      text: pagina,
      x: PAGINA.width - MARGEM - approximateWidth(pagina, 7.5),
      y: 38,
      size: 7.5,
      color: MUTED,
    });
    return this;
  }

  paraPagina() {
    return { size: PAGINA, texts: this.texts, shapes: this.shapes };
  }
}

/**
 * Cabeçalho das páginas internas.
 *
 * Um filete azul, e não o mosaico: a faixa tem altura fixa de 42pt e repeti-la
 * em toda página comeria um quinto de cada folha por decoração. O grafismo fica
 * na capa, que é onde ele diz alguma coisa.
 */
function folhaInterna(titulo) {
  const f = new Folha();
  f.shapes.push({ kind: "rect", x: 0, y: PAGINA.height - 4, width: PAGINA.width, height: 4, color: BRAND_DEEP });
  f.shapes.push({ kind: "rect", x: 0, y: PAGINA.height - 6, width: 120, height: 2, color: TILE_SUN });

  f.texts.push({
    text: titulo.toUpperCase().split("").join(" "),
    x: MARGEM,
    y: PAGINA.height - 40,
    size: 7.5,
    font: "Helvetica-Bold",
    color: BRAND,
  });

  f.y = PAGINA.height - 72;
  return f;
}

/* ------------------------------------------------------------------ */
/* Conteúdo                                                            */
/* ------------------------------------------------------------------ */

const PERFIS = [
  {
    nome: "Aluno",
    conta: "user.mock",
    senha: "usermock",
    resumo:
      "Papel padrão, atribuído a toda pessoa criada a partir do Active " +
      "Directory da Exemplo S.A..",
    faz: [
      ["Catálogo e matrícula", "Vê os cursos publicados e se matricula nos de inscrição aberta. Treinamento obrigatório é atribuído pelo gestor."],
      ["Aula com trava", "O player não permite avançar além do ponto já assistido. Retroceder é liberado, e a velocidade pode chegar a 2x. A conclusão da aula só é aceita com 90% de cobertura e tempo de sessão compatível."],
      ["Prova", "Fica disponível quando todas as aulas do curso estão concluídas. Antes disso o botão permanece desabilitado e informa quantas aulas faltam."],
      ["Pedido de reteste", "Após reprovação, o aluno solicita nova tentativa ao instrutor. A justificativa é opcional. Só um pedido pode ficar em aberto por prova."],
      ["Certificado", "Emitido em PDF na conclusão do curso, com assinatura do instrutor responsável e código de verificação."],
      ["Fórum, trilhas e agenda", "Participa das discussões do curso, acompanha trilhas de aprendizagem e consulta prazos."],
    ],
    naoFaz: [
      "Matricular outra pessoa. A matrícula própria é a única permitida.",
      "Consultar ou alterar o progresso de outros alunos.",
      "Acessar as telas de instrutor, gestor ou administração.",
    ],
  },
  {
    nome: "Instrutor",
    conta: "instructor.mock",
    senha: "instructormock",
    resumo:
      "Responsável pelo conteúdo. As permissões de edição são delimitadas " +
      "pela autoria: cada instrutor altera apenas os cursos que criou.",
    faz: [
      ["Editor de curso", "Cria módulos e aulas, define a ordem e envia vídeo, PDF ou pacote SCORM. O arquivo é transferido diretamente ao armazenamento, sem passar pela aplicação."],
      ["Provas", "Monta as questões, define a nota mínima e corrige as respostas dissertativas."],
      ["Fila de reteste", "Analisa cada pedido e libera ou recusa. O comentário é obrigatório nas duas decisões."],
      ["Engajamento", "Consulta os pontos de abandono do vídeo, por aula."],
      ["Assinatura", "Envia, no próprio perfil, a imagem que será aplicada aos certificados dos seus cursos."],
    ],
    naoFaz: [
      "Editar, publicar ou arquivar curso de outro instrutor.",
      "Matricular alunos. A atribuição de matrícula é do gestor.",
      "Alterar o progresso de alunos. O acesso é somente de consulta.",
      "Acessar as telas de administração.",
    ],
  },
  {
    nome: "Gestor",
    conta: "manager.mock",
    senha: "managermock",
    resumo:
      "Acompanha a equipe. Todas as consultas são delimitadas pelo projeto " +
      "ao qual o gestor pertence.",
    faz: [
      ["Painel do projeto", "Indicadores da própria unidade: concluídos, atrasados e não iniciados."],
      ["Minha equipe", "Relação das pessoas do projeto, com o andamento individual."],
      ["Matrícula atribuída", "Inscreve a equipe em treinamento obrigatório."],
    ],
    naoFaz: [
      "Consultar pessoas de outro projeto.",
      "Criar ou editar conteúdo. A produção de curso é atribuição do instrutor.",
      "Decidir pedidos de reteste.",
      "Acessar as telas de administração.",
    ],
  },
  {
    nome: "Administrador",
    conta: "admin.mock",
    senha: "adminmock",
    resumo:
      "Acesso amplo à plataforma da Exemplo S.A., com três restrições " +
      "definidas em projeto.",
    faz: [
      ["Pessoas e papéis", "Convite, atribuição de papel, situação da conta e importação em massa por CSV."],
      ["Acesso e SSO", "Configuração de Active Directory, SAML 2.0, Google e Microsoft."],
      ["Auditoria", "Consulta ao registro de ações, com autor e data."],
      ["Plataforma", "Marca, recursos habilitados, textos de e-mail e backup."],
      ["Competências e distintivos", "Mapa de competências e regras de concessão."],
      ["Integrações", "LTI, xAPI e webhooks."],
    ],
    naoFaz: [
      "Acessar dados de outra organização. A verificação de tenant precede a regra de papel. Como existe uma organização cadastrada, a restrição não é exercida hoje; ela vale para o cenário de treinamento a terceirizados ou parceiros, com catálogo separado.",
      "Receber a identificação de Professor em comentários. Ela indica autoria do curso, e não hierarquia.",
      "Editar comentário de outro autor. A moderação disponível é a remoção, que fica registrada em auditoria.",
    ],
  },
];

/* ------------------------------------------------------------------ */

const paginas = [];

/* --- Capa --- */
{
  const f = new Folha();
  f.shapes.push(...faixa());
  f.shapes.push(logo((PAGINA.width - 150) / 2, PAGINA.height - ALTURA_DA_FAIXA - 78, 150));

  f.y = PAGINA.height - 300;
  const centro = (texto, size, font, color) => {
    f.texts.push({
      text: texto,
      x: (PAGINA.width - approximateWidth(texto, size, font === "Helvetica-Bold")) / 2,
      y: f.y,
      size,
      font,
      color,
    });
  };

  centro("PLATAFORMA DE ENSINO DA EXEMPLO S.A.", 9, "Helvetica-Bold", MUTED);
  f.y -= 46;
  centro("Perfis e Acessos", 30, "Helvetica-Bold", BRAND_DEEP);
  f.y -= 28;
  centro("Atribuições de cada papel e os limites", 13, undefined, MUTED);
  f.y -= 19;
  centro("de permissão aplicados a cada um", 13, undefined, MUTED);

  f.shapes.push({ kind: "rect", x: (PAGINA.width - 60) / 2, y: f.y - 30, width: 60, height: 2, color: TILE_BLUE });

  /* O sumário na capa: quem recebe o documento sabe o que tem dentro, e a
     capa deixa de ser meia página vazia. */
  f.y -= 78;
  const indice = [
    "Visão geral e ordem de avaliação das permissões",
    "Aluno",
    "Instrutor",
    "Gestor",
    "Administrador",
    "Contas, restrições verificadas e autenticação corporativa",
  ];
  indice.forEach((item, i) => {
    f.y -= 21;
    f.texts.push({ text: String(i + 2), x: 150, y: f.y, size: 9, font: "Helvetica-Bold", color: TILE_BLUE });
    f.texts.push({ text: item, x: 172, y: f.y, size: 9.5, color: INK });
  });

  f.y = 132;
  f.paragrafo(
    "As regras descritas neste documento foram verificadas na aplicação em " +
      "execução, e não inferidas a partir do código-fonte.",
    { size: 9.5, x: 110, largura: PAGINA.width - 220 },
  );

  f.texts.push({
    text: "Documento de apoio interno",
    x: (PAGINA.width - approximateWidth("Documento de apoio interno", 8)) / 2,
    y: 86,
    size: 8,
    color: MUTED,
  });

  paginas.push(f.paraPagina());
}

/* --- Quadro comparativo --- */
{
  const f = folhaInterna("Visão geral");

  f.linha("Os quatro perfis", { size: 22, font: "Helvetica-Bold", color: BRAND_DEEP, avanco: 26 });
  f.espaco(6);
  f.paragrafo(
    "Cada pessoa cadastrada recebe um destes quatro papéis, e o papel define " +
      "o conjunto de telas e operações disponíveis. A autorização é resolvida " +
      "por uma única função, chamada tanto pela interface quanto pelas rotas " +
      "da API, de modo que a permissão exibida na tela e a aplicada no " +
      "servidor não divergem.",
  );

  f.secao("Ordem de avaliação das permissões");
  const ordem = [
    ["1. Organização", "Recursos de outra organização são negados antes de qualquer verificação de papel."],
    ["2. Administrador", "Autorizado, exceto nas três restrições listadas na página do perfil."],
    ["3. Gestor", "Autorizado dentro do projeto ao qual pertence."],
    ["4. Instrutor e Aluno", "Avaliados por autoria do curso e por matrícula."],
  ];
  for (const [titulo, texto] of ordem) {
    f.espaco(4);
    f.linha(titulo, { size: 10, font: "Helvetica-Bold", color: INK, avanco: 14 });
    f.paragrafo(texto, { size: 9, x: MARGEM + 12, largura: LARGURA_UTIL - 12 });
  }

  f.secao("Resumo de cada perfil");
  for (const perfil of PERFIS) {
    f.espaco(6);
    f.linha(perfil.nome, { size: 11, font: "Helvetica-Bold", color: BRAND, avanco: 15 });
    f.paragrafo(perfil.resumo, { size: 9, x: MARGEM + 12, largura: LARGURA_UTIL - 12 });
  }

  paginas.push(f.paraPagina());
}

/* --- Uma página por perfil --- */
for (const perfil of PERFIS) {
  const f = folhaInterna(perfil.nome);

  f.linha(perfil.nome, { size: 26, font: "Helvetica-Bold", color: BRAND_DEEP, avanco: 30 });
  f.espaco(4);
  f.paragrafo(perfil.resumo, { size: 10 });

  f.secao("O que faz");
  for (const [titulo, texto] of perfil.faz) {
    f.espaco(5);
    f.linha(titulo, { size: 10, font: "Helvetica-Bold", color: INK, avanco: 14 });
    f.paragrafo(texto, { size: 9, x: MARGEM + 12, largura: LARGURA_UTIL - 12 });
  }

  f.secao("O que NÃO faz");
  for (const item of perfil.naoFaz) {
    f.espaco(3);
    /* O marcador é uma FORMA, e não um caractere. A fonte padrão do PDF só
       cobre Latin-1: travessão e bullet ficam acima de 0xFF e sairiam como
       "?" na página, sem nenhum aviso. Um retângulo de 7 por 1,6 não tem esse
       problema e ainda carrega a cor de recusa. */
    f.shapes.push({ kind: "rect", x: MARGEM, y: f.y - 10, width: 7, height: 1.6, color: NEGADO });
    f.paragrafo(item, { size: 9, x: MARGEM + 14, largura: LARGURA_UTIL - 14, color: INK });
  }

  paginas.push(f.paraPagina());
}

/* --- Contas e limites verificados --- */
{
  const f = folhaInterna("Acessos");

  f.linha("Contas de demonstração", { size: 22, font: "Helvetica-Bold", color: BRAND_DEEP, avanco: 26 });
  f.espaco(4);
  f.paragrafo(
    "O nome exibido corresponde à função da conta, o que facilita " +
      "identificar qual visão está sendo demonstrada. A senha de cada conta é " +
      "o login sem o ponto.",
  );

  f.espaco(14);
  const colunas = [MARGEM, MARGEM + 150, MARGEM + 300, MARGEM + 410];
  f.y -= 16;
  ["Perfil", "Entrar com", "Senha", "Campo"].forEach((titulo, i) => {
    f.texts.push({ text: titulo.toUpperCase(), x: colunas[i], y: f.y, size: 7.5, font: "Helvetica-Bold", color: MUTED });
  });
  f.filete();

  const linhas = [
    ["Aluno", "user.mock", "usermock", "Siririzinho"],
    ["Instrutor", "instructor.mock", "instructormock", "Unidade Norte"],
    ["Instrutor 2", "instructor2.mock", "instructor2mock", "Riachuelo"],
    ["Gestor", "manager.mock", "managermock", "Unidade Norte"],
    ["Administrador", "admin.mock", "adminmock", "Sede"],
  ];

  for (const linha of linhas) {
    f.y -= 20;
    linha.forEach((celula, i) => {
      f.texts.push({
        text: celula,
        x: colunas[i],
        y: f.y,
        size: 9,
        font: i === 0 ? "Helvetica-Bold" : undefined,
        color: i === 0 ? INK : MUTED,
      });
    });
  }

  f.espaco(10);
  f.filete();
  f.espaco(4);
  f.paragrafo(
    "O e-mail completo também é aceito no campo de login. O cadastro inclui " +
      "ainda oito usuários sem senha, no estado convidado, usados para popular " +
      "as telas de gestão e engajamento.",
    { size: 8.5 },
  );

  f.secao("Restrição de uso das credenciais");
  f.paragrafo(
    "As contas acima são de homologação e não devem ser criadas em produção, " +
      "por terem senha derivada do login. A carga dos dados de homologação " +
      "exige uma chave explícita para ser executada, o que impede a aplicação " +
      "acidental em ambiente produtivo.",
  );

  f.secao("Restrições verificadas");
  f.paragrafo(
    "As tentativas de acesso abaixo foram executadas na aplicação. Todas " +
      "retornam HTTP 404. A escolha de 404 em vez de 403 evita confirmar a " +
      "existência da tela a quem não tem permissão para acessá-la.",
    { size: 9 },
  );

  f.espaco(8);
  const negados = [
    ["Aluno", "/admin, /admin/usuarios, /admin/auditoria"],
    ["Aluno", "/instrutor/cursos, /instrutor/correcao"],
    ["Aluno", "/gestor/equipe"],
    ["Instrutor", "/admin/usuarios, /admin/auditoria, /admin/plataforma"],
    ["Gestor", "/admin/usuarios, /admin/plataforma"],
    ["Gestor", "/instrutor/correcao"],
  ];
  for (const [quem, rotas] of negados) {
    f.y -= 15;
    f.texts.push({ text: quem, x: MARGEM, y: f.y, size: 9, font: "Helvetica-Bold", color: INK });
    f.texts.push({ text: rotas, x: MARGEM + 84, y: f.y, size: 8.5, color: MUTED });
    f.texts.push({ text: "404", x: PAGINA.width - MARGEM - 22, y: f.y, size: 8.5, font: "Helvetica-Bold", color: NEGADO });
  }

  f.secao("Autenticação corporativa");
  f.paragrafo(
    "A plataforma suporta Active Directory, SAML 2.0, Google e Microsoft. O " +
      "papel atribuído ao usuário é derivado do grupo a que ele pertence no " +
      "diretório, o que dispensa manutenção de cadastro em duplicidade. A " +
      "integração com o Active Directory da Exemplo S.A. foi validada e " +
      "encontra-se desabilitada, aguardando decisão de operação.",
  );

  paginas.push(f.paraPagina());
}

/* Rodapé em todas menos a capa. */
paginas.forEach((pagina, index) => {
  if (index === 0) return;
  const f = new Folha();
  f.texts = pagina.texts;
  f.shapes = pagina.shapes;
  f.rodape(index + 1, paginas.length);
});

const destino = join(raiz, "docs", "NerdResolve-Energy-Perfis-e-Acessos.pdf");
const bytes = buildPdfPages(paginas);
writeFileSync(destino, bytes);

console.log(`\n${destino}`);
console.log(`  ${paginas.length} páginas · ${(bytes.length / 1024).toFixed(1)} kB\n`);
