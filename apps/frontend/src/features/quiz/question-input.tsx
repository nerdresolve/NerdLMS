"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

import type { QuestionKind } from "@nerdlms/core/assessment/grading.ts";

/**
 * O campo de resposta de cada tipo de questão — F3-02.
 *
 * Um componente por tipo seria oito arquivos com a mesma casca; um `switch`
 * aqui mantém junto o que muda e separado o que é comum (enunciado, pontos,
 * rótulo acessível).
 *
 * A resposta sobe no formato que o motor de correção espera — ver `gradeAnswer`:
 * lista de ids na escolha, texto na dissertativa, objeto na associação.
 */

export interface QuestionView {
  id: string;
  kind: QuestionKind;
  prompt: string;
  points: number;
  options: { id: string; text: string; matchText?: string }[];
}

export function QuestionInput({
  question,
  value,
  onChange,
  disabled,
}: {
  question: QuestionView;
  value: unknown;
  onChange: (response: unknown) => void;
  disabled: boolean;
}) {
  const nome = `q-${question.id}`;

  switch (question.kind) {
    /* Uma resposta. `radio` porque o navegador já garante a exclusividade — e
       porque o leitor de tela anuncia "1 de 4", que uma lista de caixas não
       daria. */
    case "single_choice":
    case "true_false": {
      const escolhida = Array.isArray(value) ? value[0] : null;

      return (
        <div className="quiz-options" role="radiogroup" aria-label={question.prompt}>
          {question.options.map((opcao) => (
            <label className="quiz-option" key={opcao.id}>
              <input
                type="radio"
                name={nome}
                checked={escolhida === opcao.id}
                disabled={disabled}
                onChange={() => onChange([opcao.id])}
              />
              <span className="quiz-option__text">{opcao.text}</span>
            </label>
          ))}
        </div>
      );
    }

    case "multiple_choice": {
      const marcadas: string[] = Array.isArray(value) ? (value as string[]) : [];

      return (
        <div className="quiz-options">
          <p className="quiz-hint">Marque todas as corretas.</p>
          {question.options.map((opcao) => (
            <label className="quiz-option" key={opcao.id}>
              <input
                type="checkbox"
                checked={marcadas.includes(opcao.id)}
                disabled={disabled}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...marcadas, opcao.id]
                      : marcadas.filter((id) => id !== opcao.id),
                  )
                }
              />
              <span className="quiz-option__text">{opcao.text}</span>
            </label>
          ))}
        </div>
      );
    }

    case "essay":
      return (
        <>
          <label className="sr-only" htmlFor={nome}>
            Sua resposta
          </label>
          <textarea
            className="input quiz-textarea"
            id={nome}
            rows={8}
            value={typeof value === "string" ? value : ""}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
          />
          <p className="quiz-hint">Esta questão é corrigida pelo instrutor.</p>
        </>
      );

    case "short_answer":
      return (
        <>
          <label className="sr-only" htmlFor={nome}>
            Sua resposta
          </label>
          <input
            className="input"
            id={nome}
            value={typeof value === "string" ? value : ""}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
          />
        </>
      );

    case "numeric":
      return (
        <>
          <label className="sr-only" htmlFor={nome}>
            Sua resposta, em número
          </label>
          <input
            className="input quiz-numeric"
            id={nome}
            /* `text` e não `number`: o campo numérico do navegador recusa
               vírgula em alguns locales, e o motor aceita "7,2". `inputMode`
               ainda abre o teclado numérico no celular. */
            type="text"
            inputMode="decimal"
            value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
          />
        </>
      );

    /* Cada item tem um seletor com todos os pares possíveis. Arrastar seria
       mais bonito e exigiria alternativa por teclado (WCAG 2.5.7); o seletor
       já é acessível por natureza. */
    case "matching": {
      const pares = value && typeof value === "object" ? (value as Record<string, string>) : {};
      const alternativas = question.options.map((o) => o.matchText ?? "").filter(Boolean);

      return (
        <div className="quiz-matching">
          {question.options.map((opcao) => (
            <div className="quiz-matching__row" key={opcao.id}>
              <label className="quiz-matching__term" htmlFor={`${nome}-${opcao.id}`}>
                {opcao.text}
              </label>
              <select
                className="input"
                id={`${nome}-${opcao.id}`}
                value={pares[opcao.id] ?? ""}
                disabled={disabled}
                onChange={(event) => onChange({ ...pares, [opcao.id]: event.target.value })}
              >
                <option value="">Selecione</option>
                {/* Ordenadas para a lista não entregar o par pela posição. */}
                {[...alternativas].sort().map((texto) => (
                  <option key={texto} value={texto}>
                    {texto}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      );
    }

    /* Ordenar com botões ↑ ↓, não arrastando: é a mesma decisão do F2-06 —
       arrastar exigiria alternativa por teclado de qualquer forma, e mover uma
       posição por clique é mais rápido que arrastar. */
    case "ordering": {
      const ordem: string[] = Array.isArray(value)
        ? (value as string[])
        : question.options.map((o) => o.id);

      const mover = (de: number, para: number) => {
        if (para < 0 || para >= ordem.length) return;
        const copia = [...ordem];
        const [item] = copia.splice(de, 1);
        copia.splice(para, 0, item!);
        onChange(copia);
      };

      const porId = new Map(question.options.map((o) => [o.id, o.text]));

      return (
        <ol className="quiz-ordering">
          {ordem.map((id, index) => (
            <li className="quiz-ordering__item" key={id}>
              <span className="quiz-ordering__number">{index + 1}</span>
              <span className="quiz-ordering__text">{porId.get(id) ?? id}</span>
              <span className="quiz-ordering__actions">
                <button
                  type="button"
                  className="reorder__button"
                  aria-label={`Mover ${porId.get(id) ?? id} para cima`}
                  disabled={disabled || index === 0}
                  onClick={() => mover(index, index - 1)}
                >
                  <ChevronUp aria-hidden />
                </button>
                <button
                  type="button"
                  className="reorder__button"
                  aria-label={`Mover ${porId.get(id) ?? id} para baixo`}
                  disabled={disabled || index === ordem.length - 1}
                  onClick={() => mover(index, index + 1)}
                >
                  <ChevronDown aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ol>
      );
    }
  }
}
