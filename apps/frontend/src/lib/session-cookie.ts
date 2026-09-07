/**
 * Nome do cookie de sessão.
 *
 * Vive fora das rotas porque um Route Handler do Next só pode exportar os
 * handlers HTTP e um punhado de opções — qualquer outro export faz o build
 * falhar com "does not satisfy the constraint '{ [x: string]: never; }'".
 * Enquanto ninguém importava daqui o problema ficou latente; passou a quebrar
 * assim que a página `/sair` precisou do mesmo nome.
 *
 * O prefixo `__Host-` é o que o torna difícil de forjar: o navegador só aceita
 * o cookie sobre HTTPS, com path `/` e sem atributo de domínio — ou seja,
 * nenhum subdomínio consegue gravá-lo.
 */
export const SESSION_COOKIE = "__Host-nerdlms-session";
