import type { Role } from "./permissions.ts";

/**
 * A porta de entrada, uma só para todo papel.
 *
 * O caminho NÃO carrega o papel. Quem entra vai para `/dashboard`, e é o
 * servidor que decide qual painel montar a partir de quem está na sessão —
 * aluno vê o próprio progresso, instrutor vê o engajamento dos cursos que
 * assina, gestor vê a equipe, administrador vê a organização.
 *
 * A alternativa era mandar cada papel para o endereço da sua área. Funciona
 * até o dia em que alguém muda de papel e fica com um atalho que não serve
 * mais, ou compartilha o link do próprio painel e o colega cai numa recusa.
 * Endereço descreve o QUE se está vendo; quem pode ver é outra pergunta, e ela
 * se responde na sessão.
 */
export const HOME = "/dashboard";

/**
 * Como o menu chama o painel de cada papel.
 *
 * O destino é o mesmo para todos; o nome muda porque a tela muda. Chamar as
 * quatro de "Dashboard" esconderia justamente a diferença que importa para
 * quem abriu a plataforma para trabalhar.
 */
export function rotuloDoPainel(role: Role): string {
  switch (role) {
    case "instructor":
      return "Painel do instrutor";
    case "manager":
      return "Painel da gestão";
    case "admin":
      return "Painel da plataforma";
    case "learner":
      /* Os outros três papéis leem "Painel do instrutor", "Painel da gestão",
         "Painel da plataforma". Este lia "Dashboard", a única palavra em inglês
         de um menu inteiro em português — e a única que não dizia de quem era o
         painel. */
      return "Meu painel";
  }
}

/**
 * A área de trabalho de cada papel, para quem chega por link direto.
 *
 * Serve à navegação — trilha, item de menu, marcação do item ativo —, não à
 * porta de entrada. `learner` não tem área de trabalho: quem só estuda já está
 * em casa no painel.
 */
export function areaDoPapel(role: Role): string | null {
  switch (role) {
    case "instructor":
      return "/instrutor/engajamento";
    case "manager":
      return "/gestor";
    case "admin":
      return "/admin";
    case "learner":
      return null;
  }
}
