import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  cursoConcluido,
  estadoDoCurso,
  ROTULO_CURTO_DO_ESTADO,
  ROTULO_DO_ESTADO,
} from "./completion.ts";
import type { ProgressSummary } from "./progress.ts";

const aulas = (status: ProgressSummary["status"]): ProgressSummary => ({
  total: 10,
  completed: status === "completed" ? 10 : status === "in_progress" ? 4 : 0,
  percent: status === "completed" ? 100 : status === "in_progress" ? 40 : 0,
  status,
});

describe("Conclusão do curso", () => {
  test("sem prova exigida, as aulas fecham o curso", () => {
    /* Cursos que não têm prova não passam a exigir uma que não existe. */
    const r = estadoDoCurso(aulas("completed"), { notaMinima: null, melhorPercentual: null });
    assert.equal(r, "concluido");
  });

  test("com prova exigida e nunca feita, o curso NÃO está concluído", () => {
    /* Era o defeito: o perfil listava certificado para quem tinha as aulas em
       dia, e o botão de baixar devolvia recusa. A tela prometia o que o
       servidor negava. */
    const r = estadoDoCurso(aulas("completed"), { notaMinima: 80, melhorPercentual: null });
    assert.equal(r, "falta-prova");
  });

  test("reprovado na prova também é falta-prova", () => {
    const r = estadoDoCurso(aulas("completed"), { notaMinima: 80, melhorPercentual: 60 });
    assert.equal(r, "falta-prova");
  });

  test("aulas em dia e prova aprovada fecham o curso", () => {
    const r = estadoDoCurso(aulas("completed"), { notaMinima: 80, melhorPercentual: 80 });
    assert.equal(r, "concluido");
  });

  test("aprovar na prova sem terminar as aulas não conclui", () => {
    /* A prova pode ser feita antes; concluir o curso continua exigindo o
       conteúdo. */
    const r = estadoDoCurso(aulas("in_progress"), { notaMinima: 80, melhorPercentual: 100 });
    assert.equal(r, "em-andamento");
  });

  test("quem não começou aparece como não iniciado, mesmo com prova exigida", () => {
    const r = estadoDoCurso(aulas("not_started"), { notaMinima: 80, melhorPercentual: null });
    assert.equal(r, "nao-comecou");
  });

  test("o atalho concorda com o estado", () => {
    assert.equal(cursoConcluido(aulas("completed"), { notaMinima: 80, melhorPercentual: 90 }), true);
    assert.equal(cursoConcluido(aulas("completed"), { notaMinima: 80, melhorPercentual: 70 }), false);
  });

  test("a nota de corte é a mesma da regra de aprovação", () => {
    /* 80% são 8,0. Se as duas divergissem, o curso fecharia por um caminho e
       o certificado seria recusado pelo outro. */
    assert.equal(cursoConcluido(aulas("completed"), { notaMinima: 80, melhorPercentual: 79 }), false);
    assert.equal(cursoConcluido(aulas("completed"), { notaMinima: 80, melhorPercentual: 80 }), true);
  });
});

describe("Os rótulos dos estados", () => {
  test("os dois mapas cobrem os mesmos estados", () => {
    /* São duas redações da MESMA coisa, a longa e a de selo. Acrescentar um
       estado num mapa e esquecer o outro faria uma tela dizer o nome do estado
       e a outra dizer `undefined`, e só numa situação específica. */
    assert.deepEqual(
      Object.keys(ROTULO_DO_ESTADO).sort(),
      Object.keys(ROTULO_CURTO_DO_ESTADO).sort(),
    );
  });

  test("`falta-prova` tem rótulo próprio, e não vira `concluído`", () => {
    /* O cartão caía no percentual das aulas e estampava "100%" num curso que
       ainda depende da prova. Quem lê o cartão lê o selo primeiro. */
    assert.equal(ROTULO_CURTO_DO_ESTADO["falta-prova"], "Falta a prova");
    assert.notEqual(
      ROTULO_CURTO_DO_ESTADO["falta-prova"],
      ROTULO_CURTO_DO_ESTADO.concluido,
    );
  });
});
