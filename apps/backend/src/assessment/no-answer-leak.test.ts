import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * O gabarito não sai para quem está respondendo — F3-03.
 *
 * A tela poderia esconder a resposta certa, e quem abrisse o inspetor a veria
 * assim mesmo. Por isso o servidor não a ENVIA: `QuestionForLearner` existe
 * separada de `Question` exatamente para isso.
 *
 * Esta verificação é estrutural: garante que o tipo que vai para o aluno não
 * carregue os campos que revelam a resposta, e que a função que o monta não
 * seja contornada. Um teste de valor pegaria uma chamada; este pega a forma.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));

/** Campos que, se chegarem ao aluno, entregam a prova. */
const REVELADORES = ["isCorrect", "explanation", "feedback"];

describe("O tipo que vai para o aluno", () => {
  test("não declara nenhum campo revelador", async () => {
    const fonte = await readFile(join(AQUI, "quiz-use-case.ts"), "utf8");

    /* O bloco da interface, não o arquivo inteiro: o resto do módulo lida com
       a questão completa, e ali os campos são legítimos. */
    const inicio = fonte.indexOf("export interface QuestionForLearner");
    assert.ok(inicio > 0, "a interface do aluno sumiu — o vazamento perdeu a barreira");

    const bloco = fonte.slice(inicio, fonte.indexOf("}", inicio));

    for (const campo of REVELADORES) {
      assert.ok(
        !bloco.includes(campo),
        `QuestionForLearner declara \`${campo}\` — isso entrega a resposta a quem abrir o inspetor`,
      );
    }
  });

  test("a função que monta a questão do aluno existe e é usada", async () => {
    // Se alguém devolver `findQuizQuestions` direto da rota, o gabarito vaza
    // inteiro. A existência de `paraAluno` é a barreira.
    const fonte = await readFile(join(AQUI, "quiz-use-case.ts"), "utf8");

    assert.ok(fonte.includes("function paraAluno"), "a função de sanear a questão sumiu");
    assert.ok(
      fonte.includes("paraAluno(q,"),
      "a função de sanear existe mas não é chamada",
    );
  });
});

describe("As rotas de prova", () => {
  test("nenhuma devolve a questão completa ao responder", async () => {
    /* Varre as rotas de API atrás de quem devolve `findQuizQuestions` sem
       passar pelo saneamento. A rota do INSTRUTOR pode — ele monta a prova e
       precisa ver o gabarito —, então a busca é pelas rotas de aluno. */
    const raiz = join(AQUI, "..", "..", "..", "frontend", "src", "app", "api");

    const arquivos: string[] = [];
    async function walk(dir: string) {
      let entradas;
      try {
        entradas = await readdir(dir, { withFileTypes: true });
      } catch {
        return; // a pasta pode não existir ainda
      }

      for (const e of entradas) {
        const full = join(dir, e.name);
        if (e.isDirectory()) await walk(full);
        else if (e.name.endsWith(".ts")) arquivos.push(full);
      }
    }

    await walk(raiz);

    for (const caminho of arquivos) {
      const fonte = await readFile(caminho, "utf8");

      /* `findQuizQuestions` devolve o gabarito. Uma rota que a importa e
         responde com o resultado precisa ser deliberada — e as de aluno usam
         o caso de uso, que saneia. */
      if (fonte.includes("findQuizQuestions")) {
        assert.ok(
          fonte.includes("instrutor") || fonte.includes("gabarito") || fonte.includes("paraAluno"),
          `${caminho.split(/[\\/]/).pop()} usa findQuizQuestions sem marcar que é do instrutor`,
        );
      }
    }
  });
});
