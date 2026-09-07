import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { construirMapa, ehUuid, remapearIds, type ColunaDeReferencia } from "./remissao.ts";

/** Ids previsíveis, para o teste poder afirmar o que saiu. */
function contador() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
}

const REFERENCIAS: ColunaDeReferencia[] = [
  { tabela: "modules", coluna: "course_id", destino: "courses", aceitaNulo: false },
  { tabela: "lessons", coluna: "module_id", destino: "modules", aceitaNulo: false },
  { tabela: "enrollments", coluna: "course_id", destino: "courses", aceitaNulo: false },
  { tabela: "enrollments", coluna: "learner_id", destino: "users", aceitaNulo: false },
];

const CURSO = "aaaaaaaa-0000-4000-8000-000000000001";
const MODULO = "bbbbbbbb-0000-4000-8000-000000000002";
const AULA = "cccccccc-0000-4000-8000-000000000003";

function backup() {
  return {
    courses: [{ id: CURSO, tenant_id: "origem", title: "Segurança" }],
    modules: [{ id: MODULO, tenant_id: "origem", course_id: CURSO, title: "Módulo 1" }],
    lessons: [{ id: AULA, module_id: MODULO, title: "Aula 1" }],
  };
}

describe("Migração entre clientes — os ids são reemitidos", () => {
  test("cada id ganha um novo", () => {
    const r = remapearIds(backup(), REFERENCIAS, "destino", contador());

    assert.equal(r.reemitidos, 3);
    assert.notEqual(r.dados["courses"]![0]!["id"], CURSO);
    assert.notEqual(r.dados["modules"]![0]!["id"], MODULO);
  });

  test("as referências acompanham", () => {
    /* É o ponto do módulo: sem isto, o módulo apontaria para o curso do
       cliente de origem — e a migração levaria uma linha a depender de dado
       que não é do destino. */
    const r = remapearIds(backup(), REFERENCIAS, "destino", contador());

    const cursoNovo = r.dados["courses"]![0]!["id"];
    const moduloNovo = r.dados["modules"]![0]!["id"];

    assert.equal(r.dados["modules"]![0]!["course_id"], cursoNovo);
    assert.equal(r.dados["lessons"]![0]!["module_id"], moduloNovo);
  });

  test("o mesmo id vira o mesmo novo em toda parte", () => {
    /* Duas linhas apontando para o mesmo curso precisam continuar apontando
       para o mesmo curso. Sortear por ocorrência partiria o dado em dois. */
    const dados = {
      courses: [{ id: CURSO }],
      enrollments: [
        { id: "dddddddd-0000-4000-8000-000000000004", course_id: CURSO },
        { id: "eeeeeeee-0000-4000-8000-000000000005", course_id: CURSO },
      ],
    };

    const r = remapearIds(dados, REFERENCIAS, "destino", contador());

    assert.equal(r.dados["enrollments"]![0]!["course_id"], r.dados["enrollments"]![1]!["course_id"]);
    assert.equal(r.dados["enrollments"]![0]!["course_id"], r.dados["courses"]![0]!["id"]);
  });

  test("o tenant passa a ser o do destino", () => {
    const r = remapearIds(backup(), REFERENCIAS, "destino", contador());

    assert.equal(r.dados["courses"]![0]!["tenant_id"], "destino");
    assert.equal(r.dados["modules"]![0]!["tenant_id"], "destino");
  });

  test("colunas que não são referência ficam intactas", () => {
    const r = remapearIds(backup(), REFERENCIAS, "destino", contador());
    assert.equal(r.dados["courses"]![0]!["title"], "Segurança");
  });
});

describe("Migração entre clientes — referências órfãs", () => {
  test("apontar para algo que o backup não trouxe é REGISTRADO", () => {
    /* O defeito mais perigoso possível: manter o id original faria a linha do
       destino depender de dado do cliente de ORIGEM. */
    const dados = {
      enrollments: [
        { id: "ffffffff-0000-4000-8000-000000000006", course_id: "99999999-0000-4000-8000-000000000009" },
      ],
    };

    const r = remapearIds(dados, REFERENCIAS, "destino", contador());

    assert.equal(r.orfas.length, 1);
    assert.equal(r.orfas[0]!.tabela, "enrollments");
    assert.equal(r.orfas[0]!.coluna, "course_id");
  });

  test("a órfã NÃO conserva o id de origem", () => {
    /* Nem o antigo, nem um inventado: a coluna fica como estava para quem
       chamou decidir, e o registro diz onde. */
    const orfao = "99999999-0000-4000-8000-000000000009";
    const dados = {
      enrollments: [{ id: "ffffffff-0000-4000-8000-000000000006", course_id: orfao }],
    };

    const r = remapearIds(dados, REFERENCIAS, "destino", contador());

    /* O valor permanece, e é por isso que `orfas` existe: quem chama precisa
       tratar antes de gravar. */
    assert.equal(r.dados["enrollments"]![0]!["course_id"], orfao);
    assert.ok(r.orfas.length > 0, "a órfã tem de ser registrada");
  });

  test("nulo não é órfã", () => {
    const dados = { enrollments: [{ id: CURSO, course_id: null }] };
    const r = remapearIds(dados, REFERENCIAS, "destino", contador());

    assert.equal(r.orfas.length, 0);
  });

  test("valor que não é UUID não é tocado", () => {
    /* Colunas de texto que por acaso se chamem como uma referência. */
    const dados = { modules: [{ id: MODULO, course_id: "não-é-uuid" }] };
    const r = remapearIds(dados, REFERENCIAS, "destino", contador());

    assert.equal(r.dados["modules"]![0]!["course_id"], "não-é-uuid");
    assert.equal(r.orfas.length, 0);
  });
});

describe("Migração entre clientes — detalhes", () => {
  test("o mapa cobre todas as tabelas antes de qualquer troca", () => {
    /* Uma aula referencia um módulo que aparece depois no arquivo. Trocar
       tabela por tabela deixaria a referência apontando para um id que ainda
       não foi reemitido. */
    const mapa = construirMapa(backup(), contador());

    assert.equal(mapa.size, 3);
    assert.ok(mapa.has(CURSO));
    assert.ok(mapa.has(AULA));
  });

  test("reconhece UUID de verdade", () => {
    assert.equal(ehUuid(CURSO), true);
    assert.equal(ehUuid("abc"), false);
    assert.equal(ehUuid(null), false);
    assert.equal(ehUuid(42), false);
  });

  test("backup vazio não quebra", () => {
    const r = remapearIds({}, REFERENCIAS, "destino", contador());

    assert.equal(r.reemitidos, 0);
    assert.equal(r.orfas.length, 0);
  });
});

describe("Migração entre clientes — órfã em coluna opcional", () => {
  const COM_OPCIONAL: ColunaDeReferencia[] = [
    { tabela: "grade_entries", coluna: "quiz_id", destino: "quizzes", aceitaNulo: false },
    { tabela: "grade_entries", coluna: "lti_link_id", destino: "lti_links", aceitaNulo: true },
  ];

  test("coluna opcional é ANULADA, não recusa a migração", () => {
    /* O caso real que o primeiro teste de migração encontrou:
       `grade_entries.lti_link_id` aponta para `lti_links`, que não está no
       manifesto do backup. A nota existe; o vínculo com a ferramenta externa
       não vem junto — e num cliente novo ele não existiria mesmo. */
    const dados = {
      grade_entries: [
        {
          id: "11111111-0000-4000-8000-000000000001",
          lti_link_id: "88888888-0000-4000-8000-000000000008",
        },
      ],
    };

    const r = remapearIds(dados, COM_OPCIONAL, "destino", contador());

    assert.equal(r.orfas.length, 0);
    assert.equal(r.anuladas, 1);
    assert.equal(r.dados["grade_entries"]![0]!["lti_link_id"], null);
  });

  test("coluna obrigatória continua recusando", () => {
    /* A linha não existe sem ela: anular criaria um registro impossível. */
    const dados = {
      grade_entries: [
        {
          id: "22222222-0000-4000-8000-000000000002",
          quiz_id: "99999999-0000-4000-8000-000000000009",
        },
      ],
    };

    const r = remapearIds(dados, COM_OPCIONAL, "destino", contador());

    assert.equal(r.orfas.length, 1);
    assert.equal(r.orfas[0]!.coluna, "quiz_id");
  });

  test("anular não conta como órfã", () => {
    /* São coisas diferentes: uma é aviso, a outra é impedimento. */
    const dados = {
      grade_entries: [
        {
          id: "33333333-0000-4000-8000-000000000003",
          lti_link_id: "88888888-0000-4000-8000-000000000008",
          quiz_id: "99999999-0000-4000-8000-000000000009",
        },
      ],
    };

    const r = remapearIds(dados, COM_OPCIONAL, "destino", contador());

    assert.equal(r.anuladas, 1);
    assert.equal(r.orfas.length, 1);
  });
});
