import type { FormEvent } from "react";

/**
 * Campo obrigatório com mensagem NOSSA, em português.
 *
 * O PROBLEMA COM O `required` SOZINHO
 *
 * Ele funciona: barra o envio, leva o foco ao campo e mostra um balão. Mas o
 * texto do balão vem do NAVEGADOR, no idioma da interface dele, e não no do
 * documento. A página declara `lang="pt-BR"` e mesmo assim um Chrome instalado
 * em inglês escreve "Please fill out this field." num produto inteiro em
 * português. Não é hipótese: foi o que apareceu ao conferir o editor.
 *
 * Apostar que a máquina de quem apresenta está em português é apostar numa
 * configuração que ninguém conferiu.
 *
 * O SEGUNDO GANHO é dizer o que falta, e não que "um campo" falta. "Escreva o
 * título da aula" resolve; "Preencha este campo" manda a pessoa procurar qual.
 *
 * COMO USAR
 *
 *   <input {...campoObrigatorio("Escreva o título da aula.")} />
 *
 * `onInput` limpando a mensagem é obrigatório, e não zelo: uma vez definida,
 * `setCustomValidity` deixa o campo INVÁLIDO para sempre, e o formulário nunca
 * mais envia, mesmo depois de preenchido.
 */
/* `select` entra junto: um `<select required>` sem escolha mostra "Please
   select an item in the list", que é o mesmo defeito com outra frase. Ele não
   dispara `input` ao ser preenchido do mesmo jeito que um campo de texto, mas
   dispara ao mudar a opção — que é exatamente quando a mensagem deve sumir. */
type CampoValidavel = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export function campoObrigatorio(mensagem: string) {
  return {
    required: true,
    onInvalid: (evento: FormEvent<CampoValidavel>) => {
      evento.currentTarget.setCustomValidity(mensagem);
    },
    onInput: (evento: FormEvent<CampoValidavel>) => {
      evento.currentTarget.setCustomValidity("");
    },
  } as const;
}
