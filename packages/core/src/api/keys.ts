/**
 * Chaves de API e escopos — F5-01.
 *
 * Regras puras. A geração e o hash vivem no backend, que tem `node:crypto`.
 */

export interface ApiScope {
  key: string;
  label: string;
  description: string;
}

/**
 * O que uma chave pode fazer.
 *
 * Por RECURSO e AÇÃO, não por endpoint: endpoints mudam de nome e de forma, e
 * uma chave criada hoje não pode perder acesso porque a rota foi renomeada.
 */
export const API_SCOPES: ApiScope[] = [
  {
    key: "cursos:ler",
    label: "Ler cursos",
    description: "Listar cursos, módulos e aulas.",
  },
  {
    key: "cursos:escrever",
    label: "Escrever cursos",
    description: "Criar e alterar cursos. Inclui a leitura.",
  },
  {
    key: "usuarios:ler",
    label: "Ler usuários",
    description: "Listar pessoas e seus dados de cadastro.",
  },
  {
    key: "usuarios:escrever",
    label: "Escrever usuários",
    description: "Criar e alterar pessoas. Inclui a leitura.",
  },
  {
    key: "matriculas:ler",
    label: "Ler matrículas",
    description: "Consultar quem está em qual curso e o progresso.",
  },
  {
    key: "matriculas:escrever",
    label: "Escrever matrículas",
    description: "Matricular e desmatricular pessoas. Inclui a leitura.",
  },
  {
    key: "notas:ler",
    label: "Ler notas",
    description: "Consultar o livro de notas.",
  },
  {
    key: "notas:escrever",
    label: "Lançar notas",
    description:
      "Lançar nota no livro. Usado por ferramenta LTI que devolve resultado. Inclui a leitura.",
  },
];

const CONHECIDOS = new Set([...API_SCOPES.map((s) => s.key), "*"]);

/** `aeg_` + 48 hexadecimais. */
const FORMATO = /^aeg_[0-9a-f]{48}$/;

/**
 * O texto tem cara de chave?
 *
 * Filtra ANTES da consulta ao banco: sem isso, cada requisição com lixo no
 * cabeçalho viraria uma ida ao banco. Recusar por formato é de graça.
 *
 * O prefixo `aeg_` existe para a chave ser reconhecível: quem a vê num log ou
 * num repositório sabe o que revogar.
 */
export function isValidKeyFormat(chave: string): boolean {
  return FORMATO.test(chave);
}

/**
 * A chave tem permissão para isto?
 *
 * `escrever` implica `ler` — quem pode alterar precisa poder consultar, e
 * exigir os dois seria burocracia. O contrário NÃO vale: quem deu leitura não
 * está dando escrita, e uma hierarquia por prefixo faria exatamente isso.
 */
export function hasScope(escoposDaChave: string[], exigido: string): boolean {
  if (escoposDaChave.includes("*")) return true;
  if (escoposDaChave.includes(exigido)) return true;

  if (exigido.endsWith(":ler")) {
    const recurso = exigido.slice(0, -":ler".length);
    return escoposDaChave.includes(`${recurso}:escrever`);
  }

  return false;
}

/**
 * Os escopos pedidos, filtrados pelos que existem.
 *
 * Um escopo inventado no corpo da requisição não pode virar permissão — e
 * guardá-lo faria a lista da tela mostrar algo que não significa nada.
 */
export function parseScopes(pedidos: unknown[]): string[] {
  const validos = new Set<string>();

  for (const item of pedidos) {
    if (typeof item === "string" && CONHECIDOS.has(item)) validos.add(item);
  }

  return [...validos];
}
