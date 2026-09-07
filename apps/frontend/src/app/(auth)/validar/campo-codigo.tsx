"use client";

import { campoObrigatorio } from "@/lib/campo-obrigatorio.ts";

/**
 * O campo do código, separado só para poder falar português.
 *
 * A página é componente de SERVIDOR, e `campoObrigatorio` devolve `onInvalid` e
 * `onInput` — manipuladores de evento não atravessam a fronteira do servidor
 * para o DOM, e passá-los dali derruba a renderização.
 *
 * Sem isso a alternativa era o `required` cru, que faz o navegador mostrar
 * "Preencha este campo" no idioma DELE: quem usa o navegador em inglês lê
 * "Please fill out this field" no meio de uma tela em português, e a frase não
 * diz o que o campo espera.
 *
 * O formulário em volta continua um GET comum: esta ilha é só o campo.
 */
export function CampoCodigo({ codigo }: { codigo: string }) {
  return (
    <input
      className="input"
      id="codigo"
      name="codigo"
      defaultValue={codigo}
      placeholder="Ex.: F645CAEB5BCB"
      maxLength={16}
      autoComplete="off"
      spellCheck={false}
      {...campoObrigatorio("Digite o código impresso no certificado.")}
    />
  );
}
