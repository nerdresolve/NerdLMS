import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { acaoDoAluno, aprovado, notaDeDez, notaFormatada, validarDecisao } from "./retake.ts";

describe("Nota de zero a dez", () => {
  test("o percentual guardado vira a nota que se lê", () => {
    /* A coluna continua em percentual: convertê-la reescreveria histórico. O
       que muda é a leitura. */
    assert.equal(notaDeDez(100), 10);
    assert.equal(notaDeDez(80), 8);
    assert.equal(notaDeDez(75), 7.5);
    assert.equal(notaDeDez(0), 0);
  });

  test("uma casa decimal, não duas", () => {
    /* Uma prova de quatro questões não tem a precisão que 7,50 sugere. */
    assert.equal(notaFormatada(75), "7,5");
    assert.equal(notaFormatada(100), "10,0");
    assert.equal(notaFormatada(83.333), "8,3");
  });

  test("oito aprova, sete vírgula nove não", () => {
    assert.equal(aprovado(80), true);
    assert.equal(aprovado(79), false);
    assert.equal(aprovado(100), true);
  });

  test("quem a tela diz que passou, passa", () => {
    /* 79,96% arredondam para 8,0 na tela. Reprovar quem lê "8,0" seria
       indefensável — e é o tipo de divergência que ninguém consegue explicar
       para o aluno. */
    assert.equal(notaFormatada(79.96), "8,0");
    assert.equal(aprovado(79.96), true);
  });

  test("valor fora da escala não vira nota maluca", () => {
    assert.equal(notaDeDez(Number.NaN), 0);
    assert.equal(notaDeDez(-50), 0);
    assert.equal(notaDeDez(500), 10);
  });
});

describe("Reteste, o que o aluno pode fazer", () => {
  const base = {
    tentativasUsadas: 0,
    retestesAprovados: 0,
    pedidoPendente: false,
    jaAprovado: false,
  };

  test("quem ainda não fez, faz", () => {
    assert.equal(acaoDoAluno(base).tipo, "fazer");
  });

  test("quem reprovou e gastou a tentativa, pede reteste", () => {
    assert.equal(acaoDoAluno({ ...base, tentativasUsadas: 1 }).tipo, "pedir-reteste");
  });

  test("com pedido em aberto, espera, e não pede de novo", () => {
    /* Sem isto, o botão continuaria ali e o aluno criaria pedidos em série; o
       instrutor veria a mesma pessoa várias vezes na fila. */
    const r = acaoDoAluno({ ...base, tentativasUsadas: 1, pedidoPendente: true });
    assert.equal(r.tipo, "aguardando");
  });

  test("reteste aprovado devolve a tentativa", () => {
    const r = acaoDoAluno({ ...base, tentativasUsadas: 1, retestesAprovados: 1 });
    assert.equal(r.tipo, "fazer");
  });

  test("cada reteste vale UMA tentativa, não tentativas ilimitadas", () => {
    /* Um reteste aprovado dá duas no total. Gastas as duas, pede de novo. */
    const r = acaoDoAluno({ ...base, tentativasUsadas: 2, retestesAprovados: 1 });
    assert.equal(r.tipo, "pedir-reteste");
  });

  test("quem passou não pede nada", () => {
    /* Refazer prova já aprovada só serviria para PIORAR a nota, já que o
       boletim guarda a mais recente. */
    const r = acaoDoAluno({ ...base, tentativasUsadas: 1, jaAprovado: true });
    assert.equal(r.tipo, "aprovado");
  });

  test("aprovado vence pedido pendente", () => {
    const r = acaoDoAluno({
      tentativasUsadas: 2,
      retestesAprovados: 1,
      pedidoPendente: true,
      jaAprovado: true,
    });
    assert.equal(r.tipo, "aprovado");
  });
});

describe("Reteste, a decisão do instrutor", () => {
  test("aprovar sem dizer por quê é recusado", () => {
    /* Aprovação sem justificativa é um clique. Com ela existe registro de por
       que aquela pessoa teve uma chance a mais. */
    const r = validarDecisao({ status: "approved", comentario: "  " });
    assert.equal(r.ok, false);
    assert.ok(!r.ok && /liberando/.test(r.erro));
  });

  test("recusar sem dizer por quê também", () => {
    /* É a pior mensagem que um aluno pode receber. */
    const r = validarDecisao({ status: "denied", comentario: "" });
    assert.equal(r.ok, false);
    assert.ok(!r.ok && /não foi liberado/.test(r.erro));
  });

  test("comentário válido passa, já sem espaços nas pontas", () => {
    const r = validarDecisao({ status: "approved", comentario: "  Faltou por atestado.  " });
    assert.ok(r.ok);
    assert.equal(r.comentario, "Faltou por atestado.");
  });

  test("comentário longo demais é recusado", () => {
    const r = validarDecisao({ status: "denied", comentario: "x".repeat(1001) });
    assert.equal(r.ok, false);
  });
});
