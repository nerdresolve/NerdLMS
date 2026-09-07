import type { Role } from "../auth/permissions.ts";

/**
 * Importação de usuários — F5-05 (guia §24).
 *
 * Regras puras: validam a planilha e dizem o que fazer com cada linha. A
 * escrita fica no backend.
 *
 * O princípio da tela toda: **nada é gravado antes de a pessoa ver o que vai
 * acontecer.** Uma planilha de RH com 400 linhas tem erro de digitação, papel
 * escrito errado e gente repetida; importar direto e avisar depois deixaria o
 * banco num estado que ninguém pediu.
 */

/** Como cada coluna pode vir escrita na planilha. */
const COLUNAS = {
  nome: ["nome", "nomecompleto", "fullname", "name"],
  email: ["email", "endereco", "enderecodeemail", "mail"],
  papel: ["papel", "perfil", "funcao", "role", "cargo"],
  unidade: ["unidade", "projeto", "area", "setor", "lotacao", "project"],
} as const;

/** Acha o valor da coluna, aceitando qualquer um dos nomes conhecidos. */
function valor(linha: Record<string, string>, nomes: readonly string[]): string {
  for (const nome of nomes) {
    const encontrado = linha[nome];
    if (encontrado !== undefined && encontrado !== "") return encontrado;
  }
  return "";
}

/**
 * Como o papel pode vir escrito.
 *
 * Quem preenche a planilha escreve "Aluno", "aluno", "estudante" ou deixa em
 * branco. Recusar a linha porque o RH escreveu "Instrutor" em vez de
 * `instructor` seria transformar tradução em erro de importação.
 */
const PAPEIS: Record<string, Role> = {
  aluno: "learner",
  alunos: "learner",
  estudante: "learner",
  learner: "learner",
  instrutor: "instructor",
  professor: "instructor",
  instructor: "instructor",
  gestor: "manager",
  gerente: "manager",
  manager: "manager",
  admin: "admin",
  administrador: "admin",
};

/** Normaliza para comparar: sem acento, sem caixa, sem espaço. */
function chave(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * O e-mail tem forma de e-mail?
 *
 * Deliberadamente frouxo. A validação rigorosa de e-mail é impossível na
 * prática, e uma expressão agressiva recusa endereços válidos — o que numa
 * importação de RH significa deixar gente de fora sem motivo. O que se recusa
 * aqui é o que claramente não é endereço: sem `@`, sem domínio, com espaço.
 */
function pareceEmail(texto: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto);
}

export type LinhaSituacao = "criar" | "duplicada" | "existente" | "erro";

export interface LinhaImportada {
  /** Número da linha NA PLANILHA, contando o cabeçalho. */
  linha: number;
  nome: string;
  email: string;
  papel: Role;
  unidade: string | null;
  situacao: LinhaSituacao;
  /** Por que não dá para criar. Só quando `situacao` é "erro". */
  erro?: string;
}

export interface PlanoDeImportacao {
  linhas: LinhaImportada[];
  /** Quantas seriam criadas de fato. */
  criar: number;
  erros: number;
  /** Repetidas dentro da própria planilha. */
  duplicadas: number;
  /** Já existentes no cliente. */
  existentes: number;
}

/**
 * Monta o plano: o que aconteceria se esta planilha fosse importada.
 *
 * Não grava nada. Recebe os e-mails que já existem para poder dizer "esta
 * pessoa já está cadastrada" ANTES, e não como erro depois.
 *
 * @param papelPadrao O papel de quem não trouxe a coluna. `learner` porque é o
 *   caso comum de uma planilha de RH — e porque errar para menos privilégio é
 *   o lado seguro de errar.
 */
export function planImport(
  linhas: Array<Record<string, string>>,
  emailsExistentes: Set<string>,
  papelPadrao: Role = "learner",
): PlanoDeImportacao {
  const resultado: LinhaImportada[] = [];

  /* E-mails vistos NESTA planilha: a segunda ocorrência é duplicata, não um
     segundo cadastro. Sem isto, a mesma pessoa duas vezes viraria uma criação
     e um erro de chave — e o erro apareceria como falha do sistema. */
  const vistos = new Set<string>();

  const existentes = new Set([...emailsExistentes].map((e) => e.trim().toLowerCase()));

  linhas.forEach((linha, indice) => {
    /* +2: a planilha começa em 1 e a primeira linha é o cabeçalho. É o número
       que a pessoa vê no Excel ao ir corrigir. */
    const numero = indice + 2;

    const nome = valor(linha, COLUNAS.nome).trim();
    const emailBruto = valor(linha, COLUNAS.email).trim();
    const email = emailBruto.toLowerCase();
    const papelBruto = valor(linha, COLUNAS.papel).trim();
    const unidadeBruta = valor(linha, COLUNAS.unidade).trim();

    const base = {
      linha: numero,
      nome,
      email: emailBruto,
      unidade: unidadeBruta === "" ? null : unidadeBruta,
    };

    if (nome === "" && emailBruto === "") return;

    if (nome === "") {
      resultado.push({ ...base, papel: papelPadrao, situacao: "erro", erro: "Sem nome." });
      return;
    }

    if (emailBruto === "") {
      resultado.push({ ...base, papel: papelPadrao, situacao: "erro", erro: "Sem e-mail." });
      return;
    }

    if (!pareceEmail(emailBruto)) {
      resultado.push({
        ...base,
        papel: papelPadrao,
        situacao: "erro",
        erro: `"${emailBruto}" não parece um e-mail.`,
      });
      return;
    }

    /* Papel desconhecido é ERRO, e não "vai de aluno mesmo": se o RH escreveu
       "Coordenador", ninguém sabe o que isso significa aqui, e adivinhar dá a
       alguém um acesso que não foi pedido. Vazio, sim, é o padrão. */
    let papel = papelPadrao;
    if (papelBruto !== "") {
      const encontrado = PAPEIS[chave(papelBruto)];
      if (!encontrado) {
        resultado.push({
          ...base,
          papel: papelPadrao,
          situacao: "erro",
          erro: `Papel "${papelBruto}" não existe. Use aluno, instrutor, gestor ou admin.`,
        });
        return;
      }
      papel = encontrado;
    }

    if (vistos.has(email)) {
      resultado.push({ ...base, papel, situacao: "duplicada" });
      return;
    }
    vistos.add(email);

    if (existentes.has(email)) {
      resultado.push({ ...base, papel, situacao: "existente" });
      return;
    }

    resultado.push({ ...base, papel, situacao: "criar" });
  });

  return {
    linhas: resultado,
    criar: resultado.filter((l) => l.situacao === "criar").length,
    erros: resultado.filter((l) => l.situacao === "erro").length,
    duplicadas: resultado.filter((l) => l.situacao === "duplicada").length,
    existentes: resultado.filter((l) => l.situacao === "existente").length,
  };
}

/** O modelo que a tela oferece para baixar. */
export const MODELO_USUARIOS = {
  headers: ["Nome", "Email", "Papel", "Unidade"],
  exemplo: [
    ["Maria Souza", "maria.souza@empresa.com.br", "aluno", "Operações"],
    ["João Lima", "joao.lima@empresa.com.br", "instrutor", "Treinamento"],
  ],
};
