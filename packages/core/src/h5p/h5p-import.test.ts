import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { equivalenteDe, importarH5p, nomeDoTipo, nomeLegivel } from "./h5p-import.ts";

function manifesto(mainLibrary: string, title = "Curso"): string {
  return JSON.stringify({ title, mainLibrary, embedTypes: ["div"] });
}

describe("H5P — quais tipos atravessam", () => {
  test("os três com equivalente no player próprio", () => {
    assert.equal(equivalenteDe("H5P.InteractiveVideo 1.22"), "interactive_video");
    assert.equal(equivalenteDe("H5P.ImageHotspots 1.10"), "image_hotspots");
    assert.equal(equivalenteDe("H5P.Flashcards 1.5"), "flashcards");
  });

  test("Dialogcards também vira cartões", () => {
    /* São a mesma coisa com nomes diferentes: pergunta de um lado, resposta do
       outro. */
    assert.equal(equivalenteDe("H5P.Dialogcards 1.8"), "flashcards");
  });

  test("a versão não atrapalha", () => {
    assert.equal(nomeDoTipo("H5P.Flashcards 1.5"), "H5P.Flashcards");
    assert.equal(nomeDoTipo("H5P.Flashcards"), "H5P.Flashcards");
  });

  test("os demais não têm equivalente", () => {
    assert.equal(equivalenteDe("H5P.DragQuestion 1.14"), null);
    assert.equal(equivalenteDe("H5P.Blanks 1.14"), null);
  });

  test("o nome legível é em português quando conhecido", () => {
    /* Quem exportou reconhece "arrastar e soltar"; "H5P.DragQuestion" só diz
       algo a quem já mexeu na ferramenta. */
    assert.equal(nomeLegivel("H5P.DragQuestion 1.14"), "arrastar e soltar");
    assert.equal(nomeLegivel("H5P.Blanks"), "preencher lacunas");
  });

  test("tipo desconhecido perde só o prefixo", () => {
    assert.equal(nomeLegivel("H5P.AlgoNovo 1.0"), "AlgoNovo");
  });
});

describe("H5P — cartões", () => {
  test("pergunta de um lado, resposta do outro", () => {
    const content = JSON.stringify({
      cards: [
        { text: "O que é floculação?", answer: "A aglomeração de partículas." },
        { text: "E decantação?", answer: "A separação por gravidade." },
      ],
    });

    const r = importarH5p(manifesto("H5P.Flashcards 1.5", "Tratamento"), content);

    assert.equal(r.ok, true, r.ok ? "" : r.error);
    assert.equal(r.ok && r.conteudo.kind, "flashcards");
    assert.equal(r.ok && r.conteudo.title, "Tratamento");
    assert.equal(r.ok && r.conteudo.items.length, 2);
    assert.equal(r.ok && r.conteudo.items[0]!.prompt, "O que é floculação?");
    assert.equal(r.ok && r.conteudo.items[0]!.body, "A aglomeração de partículas.");
  });

  test("o HTML do H5P vira texto", () => {
    /* O H5P grava HTML em todo campo. Deixá-lo entrar mostraria `<p>` literal
       na tela de quem estuda. */
    const content = JSON.stringify({
      cards: [{ text: "<p>O que é <strong>pH</strong>?</p>", answer: "<p>Potencial hidrogeniônico</p>" }],
    });

    const r = importarH5p(manifesto("H5P.Flashcards"), content);

    assert.equal(r.ok && r.conteudo.items[0]!.prompt, "O que é pH ?");
    assert.ok(r.ok && !r.conteudo.items[0]!.prompt.includes("<"));
  });

  test("cartão sem frente é descartado", () => {
    const content = JSON.stringify({ cards: [{ answer: "só resposta" }, { text: "válido", answer: "x" }] });
    const r = importarH5p(manifesto("H5P.Flashcards"), content);

    assert.equal(r.ok && r.conteudo.items.length, 1);
  });
});

describe("H5P — imagem com pontos", () => {
  test("a posição percentual atravessa", () => {
    /* Os dois medem em percentual a partir do canto superior esquerdo. */
    const content = JSON.stringify({
      hotspots: [
        { position: { x: 25.5, y: 40 }, header: "Gradeamento", action: [{ params: { text: "Remove sólidos grosseiros" } }] },
      ],
    });

    const r = importarH5p(manifesto("H5P.ImageHotspots"), content);

    assert.equal(r.ok, true, r.ok ? "" : r.error);
    assert.equal(r.ok && r.conteudo.items[0]!.xPercent, 25.5);
    assert.equal(r.ok && r.conteudo.items[0]!.yPercent, 40);
    assert.equal(r.ok && r.conteudo.items[0]!.prompt, "Gradeamento");
  });

  test("ponto sem posição é descartado", () => {
    /* Não há onde desenhá-lo. */
    const content = JSON.stringify({
      hotspots: [
        { header: "sem posição" },
        { position: { x: 10, y: 10 }, header: "com posição" },
      ],
    });

    const r = importarH5p(manifesto("H5P.ImageHotspots"), content);
    assert.equal(r.ok && r.conteudo.items.length, 1);
  });

  test("avisa que a imagem não vem", () => {
    const content = JSON.stringify({ hotspots: [{ position: { x: 1, y: 1 }, header: "x" }] });
    const r = importarH5p(manifesto("H5P.ImageHotspots"), content);

    assert.ok(r.ok && r.conteudo.avisos.some((a) => /imagem/i.test(a)));
  });
});

describe("H5P — vídeo interativo", () => {
  function videoCom(interactions: unknown[]): string {
    return JSON.stringify({ interactiveVideo: { assets: { interactions } } });
  }

  function pergunta(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      duration: { from: 42, to: 50 },
      pause: true,
      action: {
        library: "H5P.MultiChoice 1.16",
        params: {
          question: "Qual etapa remove sólidos grosseiros?",
          answers: [
            { text: "Gradeamento", correct: true },
            { text: "Cloração", correct: false },
          ],
        },
      },
      ...over,
    };
  }

  test("a pergunta atravessa com o instante do vídeo", () => {
    /* É o trabalho que ninguém quer refazer à mão: reposicionar cada pergunta
       no segundo certo de um vídeo de meia hora. */
    const r = importarH5p(manifesto("H5P.InteractiveVideo 1.22"), videoCom([pergunta()]));

    assert.equal(r.ok, true, r.ok ? "" : r.error);

    const item = r.ok ? r.conteudo.items[0]! : null;
    assert.equal(item?.atSeconds, 42);
    assert.equal(item?.prompt, "Qual etapa remove sólidos grosseiros?");
    assert.equal(item?.options.length, 2);
    assert.equal(item?.options[0]!.correct, true);
  });

  test("o `pause` do H5P vira a trava do player", () => {
    const comPausa = importarH5p(manifesto("H5P.InteractiveVideo"), videoCom([pergunta()]));
    const sem = importarH5p(manifesto("H5P.InteractiveVideo"), videoCom([pergunta({ pause: false })]));

    assert.equal(comPausa.ok && comPausa.conteudo.items[0]!.blocking, true);
    assert.equal(sem.ok && sem.conteudo.items[0]!.blocking, false);
  });

  test("verdadeiro/falso vira duas alternativas", () => {
    const vf = {
      duration: { from: 10, to: 15 },
      action: {
        library: "H5P.TrueFalse 1.8",
        params: { question: "A água tratada dispensa análise?", correct: "false" },
      },
    };

    const r = importarH5p(manifesto("H5P.InteractiveVideo"), videoCom([vf]));
    const item = r.ok ? r.conteudo.items[0]! : null;

    assert.equal(item?.options.length, 2);
    assert.equal(item?.options.find((o) => o.text === "Falso")?.correct, true);
  });

  test("interação que não é pergunta é IGNORADA, não convertida", () => {
    /* Um texto ou um link não vira pergunta. Convertê-lo à força criaria um
       item que pergunta o que ninguém perguntou. */
    const texto = {
      duration: { from: 5, to: 8 },
      action: { library: "H5P.Text 1.1", params: { text: "Uma observação" } },
    };

    const r = importarH5p(manifesto("H5P.InteractiveVideo"), videoCom([pergunta(), texto]));

    assert.equal(r.ok && r.conteudo.items.length, 1);
    assert.ok(r.ok && r.conteudo.avisos.some((a) => /ignorad/i.test(a)));
  });

  test("pergunta sem gabarito é ignorada", () => {
    /* Vale zero para todo mundo que responder. Mesma regra do QTI e da
       importação por planilha. */
    const semGabarito = pergunta({
      action: {
        library: "H5P.MultiChoice",
        params: {
          question: "Qual?",
          answers: [{ text: "A", correct: false }, { text: "B", correct: false }],
        },
      },
    });

    const r = importarH5p(manifesto("H5P.InteractiveVideo"), videoCom([pergunta(), semGabarito]));
    assert.equal(r.ok && r.conteudo.items.length, 1);
  });

  test("o feedback da alternativa atravessa", () => {
    const comFeedback = pergunta({
      action: {
        library: "H5P.MultiChoice",
        params: {
          question: "Qual?",
          answers: [
            { text: "Certa", correct: true, tipsAndFeedback: { chosenFeedback: "Isso mesmo." } },
            { text: "Errada", correct: false },
          ],
        },
      },
    });

    const r = importarH5p(manifesto("H5P.InteractiveVideo"), videoCom([comFeedback]));
    assert.equal(r.ok && r.conteudo.items[0]!.options[0]!.feedback, "Isso mesmo.");
  });

  test("avisa que o vídeo não vem", () => {
    const r = importarH5p(manifesto("H5P.InteractiveVideo"), videoCom([pergunta()]));
    assert.ok(r.ok && r.conteudo.avisos.some((a) => /vídeo não vem/i.test(a)));
  });
});

describe("H5P — o que é recusado", () => {
  test("tipo sem equivalente diz QUAL tipo", () => {
    const r = importarH5p(manifesto("H5P.DragQuestion 1.14"), "{}");

    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /arrastar e soltar/);
  });

  test("pacote sem tipo declarado é recusado", () => {
    const r = importarH5p(JSON.stringify({ title: "x" }), "{}");
    assert.equal(r.ok, false);
  });

  test("JSON inválido é recusado", () => {
    assert.equal(importarH5p("{isto não é json", "{}").ok, false);
  });

  test("pacote sem item nenhum é recusado", () => {
    /* Melhor que criar um conteúdo vazio que ninguém entende por que existe. */
    const r = importarH5p(manifesto("H5P.Flashcards"), JSON.stringify({ cards: [] }));

    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /nenhum item/i);
  });

  test("sempre avisa que a aparência é a do player daqui", () => {
    const r = importarH5p(
      manifesto("H5P.Flashcards"),
      JSON.stringify({ cards: [{ text: "a", answer: "b" }] }),
    );

    assert.ok(r.ok && r.conteudo.avisos.some((a) => /aparência/i.test(a)));
  });
});
